-- migrations/005_visitors_expected_flow.sql
-- Novo fluxo operacional de visitantes:
-- - Morador cria visitante antecipado (pendente)
-- - Porteiro confirma entrada (confirmado) sem editar nome/observação
-- - Finalização (finalizado) mantém histórico

BEGIN;

-- Campos novos exigidos
ALTER TABLE IF EXISTS public.visitors
  ADD COLUMN IF NOT EXISTS morador_id uuid NULL REFERENCES public.residents(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.visitors
  ADD COLUMN IF NOT EXISTS nome_visitante text NULL;

ALTER TABLE IF EXISTS public.visitors
  ADD COLUMN IF NOT EXISTS observacao text NULL;

ALTER TABLE IF EXISTS public.visitors
  ADD COLUMN IF NOT EXISTS data_registro timestamptz NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.visitors
  ADD COLUMN IF NOT EXISTS data_confirmacao timestamptz NULL;

ALTER TABLE IF EXISTS public.visitors
  ADD COLUMN IF NOT EXISTS porteiro_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL;

-- Ajustar enum/check do status
ALTER TABLE IF EXISTS public.visitors
  DROP CONSTRAINT IF EXISTS visitors_status_check;

-- Backfill (legado -> novo)
UPDATE public.visitors
SET
  morador_id = COALESCE(morador_id, resident_id),
  nome_visitante = COALESCE(nome_visitante, NULLIF(visitor_names, ''), 'Visitante'),
  observacao = COALESCE(observacao, NULLIF(doc, ''), NULL),
  data_registro = COALESCE(data_registro, created_at, entry_time, now()),
  data_confirmacao = COALESCE(
    data_confirmacao,
    CASE WHEN lower(status) IN ('active', 'completed') THEN entry_time ELSE NULL END
  ),
  porteiro_id = COALESCE(porteiro_id, registered_by)
WHERE true;

-- Normalizar status (legado -> novo)
UPDATE public.visitors
SET status = CASE
  WHEN status IS NULL THEN 'pendente'
  WHEN lower(status) = 'active' THEN 'confirmado'
  WHEN lower(status) = 'completed' THEN 'finalizado'
  WHEN lower(status) IN ('pendente','confirmado','finalizado') THEN lower(status)
  ELSE 'pendente'
END;

ALTER TABLE IF EXISTS public.visitors
  ALTER COLUMN status SET DEFAULT 'pendente';

ALTER TABLE IF EXISTS public.visitors
  ADD CONSTRAINT visitors_status_check
  CHECK (status IN ('pendente', 'confirmado', 'finalizado'));

CREATE INDEX IF NOT EXISTS idx_visitors_morador_id ON public.visitors(morador_id);
CREATE INDEX IF NOT EXISTS idx_visitors_status_new ON public.visitors(status);

-- Garantia: ninguém consegue editar nome/observação/morador_id após criar.
CREATE OR REPLACE FUNCTION public.prevent_visitor_identity_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.nome_visitante IS DISTINCT FROM OLD.nome_visitante)
     OR (NEW.observacao IS DISTINCT FROM OLD.observacao)
     OR (NEW.morador_id IS DISTINCT FROM OLD.morador_id)
     OR (NEW.data_registro IS DISTINCT FROM OLD.data_registro)
  THEN
    RAISE EXCEPTION 'Não é permitido alterar nome/observação do visitante. Apenas confirmar/finalizar.';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'visitors' AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_prevent_visitor_identity_edit ON public.visitors;
    CREATE TRIGGER trigger_prevent_visitor_identity_edit
      BEFORE UPDATE OF nome_visitante, observacao, morador_id, data_registro ON public.visitors
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_visitor_identity_edit();
  END IF;
END
$$;

-- RPC para confirmar entrada (porteiro) sem permitir edição de dados do visitante.
CREATE OR REPLACE FUNCTION public.confirm_expected_visitor(p_visitor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_porteiro_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Resolver porteiro/síndico logado em public.users (id interno)
  SELECT u.id
    INTO v_porteiro_id
  FROM public.users u
  WHERE u.auth_user_id = auth.uid()
    AND upper(coalesce(u.role,'')) IN ('PORTEIRO','SINDICO')
    AND coalesce(u.is_active, true) = true
  LIMIT 1;

  IF v_porteiro_id IS NULL THEN
    RAISE EXCEPTION 'Apenas porteiro/síndico pode confirmar visitantes';
  END IF;

  UPDATE public.visitors
  SET
    status = 'confirmado',
    porteiro_id = v_porteiro_id,
    data_confirmacao = now(),
    entry_time = coalesce(entry_time, now()),
    registered_by = coalesce(registered_by, v_porteiro_id)
  WHERE id = p_visitor_id
    AND status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visitante não encontrado ou já confirmado/finalizado';
  END IF;
END;
$$;

COMMIT;

