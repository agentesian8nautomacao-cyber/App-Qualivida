-- migrations/006_packages_receipt_and_hide.sql
-- Corrige persistência de encomendas:
-- - Normaliza status para: pendente | recebida
-- - Adiciona data_recebimento (timestamp da baixa pelo morador)
-- - Implementa "apagar" como ocultar (oculta_para_morador) sem deletar registro
-- - Protege regras críticas via RLS + triggers (não depender só do frontend)

BEGIN;

-- 1) Novos campos
ALTER TABLE IF EXISTS public.packages
  ADD COLUMN IF NOT EXISTS oculta_para_morador boolean NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS public.packages
  ADD COLUMN IF NOT EXISTS data_recebimento timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_packages_oculta_para_morador ON public.packages(oculta_para_morador);
CREATE INDEX IF NOT EXISTS idx_packages_data_recebimento ON public.packages(data_recebimento);

-- 2) Normalizar status
ALTER TABLE IF EXISTS public.packages
  DROP CONSTRAINT IF EXISTS packages_status_check;

UPDATE public.packages
SET status = CASE
  WHEN status IS NULL THEN 'pendente'
  WHEN lower(status) IN ('pendente', 'pending', 'p') THEN 'pendente'
  WHEN lower(status) IN ('entregue', 'recebida', 'delivered', 'e') THEN 'recebida'
  ELSE 'pendente'
END;

ALTER TABLE IF EXISTS public.packages
  ALTER COLUMN status SET DEFAULT 'pendente';

ALTER TABLE IF EXISTS public.packages
  ADD CONSTRAINT packages_status_check
  CHECK (status IN ('pendente', 'recebida'));

-- 3) Backfill da data de recebimento (compatibilidade com deployments que já usavam delivered_at)
DO $$
BEGIN
  BEGIN
    UPDATE public.packages
    SET data_recebimento = COALESCE(data_recebimento, delivered_at)
    WHERE (status = 'recebida' OR delivered_at IS NOT NULL);
  EXCEPTION WHEN undefined_column THEN
    -- delivered_at não existe nesse deployment; manter data_recebimento como está
    NULL;
  END;
END
$$;

-- 4) Helpers (auth → staff/resident)
CREATE OR REPLACE FUNCTION public.is_staff_from_auth()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    SELECT EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.auth_user_id = auth.uid()
        AND upper(coalesce(u.role,'')) IN ('PORTEIRO','SINDICO')
        AND coalesce(u.is_active, true) = true
    ) INTO ok;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    ok := false;
  END;

  RETURN ok;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_resident_id_from_auth()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  rid := NULL;

  BEGIN
    SELECT r.id
      INTO rid
    FROM public.residents r
    WHERE r.auth_user_id = auth.uid()
    LIMIT 1;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    BEGIN
      SELECT r.id
        INTO rid
      FROM public.resident r
      WHERE r.auth_user_id = auth.uid()
      LIMIT 1;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      rid := NULL;
    END;
  END;

  RETURN rid;
END;
$$;

-- 5) Trigger: ao marcar como recebida, garantir data_recebimento (e compat com delivered_at)
CREATE OR REPLACE FUNCTION public.set_package_receipt_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'recebida' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.data_recebimento := COALESCE(NEW.data_recebimento, now());
    BEGIN
      NEW.delivered_at := COALESCE(NEW.delivered_at, NEW.data_recebimento, now());
    EXCEPTION WHEN undefined_column THEN
      NULL;
    END;
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
    WHERE c.relname = 'packages' AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_set_package_receipt_fields ON public.packages;
    CREATE TRIGGER trigger_set_package_receipt_fields
      BEFORE UPDATE OF status, data_recebimento ON public.packages
      FOR EACH ROW
      EXECUTE FUNCTION public.set_package_receipt_fields();
  END IF;
END
$$;

-- 6) Trigger: morador NÃO pode editar identidade/dados da encomenda, apenas dar baixa e ocultar
CREATE OR REPLACE FUNCTION public.prevent_package_edit_by_resident()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
BEGIN
  -- staff pode tudo
  IF public.is_staff_from_auth() THEN
    RETURN NEW;
  END IF;

  rid := public.current_resident_id_from_auth();
  IF rid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se for morador, somente permitir:
  -- - status: pendente -> recebida (nunca volta)
  -- - data_recebimento (setada automaticamente)
  -- - oculta_para_morador: false -> true
  IF NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.recipient_name IS DISTINCT FROM OLD.recipient_name
     OR NEW.unit IS DISTINCT FROM OLD.unit
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.received_at IS DISTINCT FROM OLD.received_at
     OR NEW.display_time IS DISTINCT FROM OLD.display_time
     OR NEW.deadline_minutes IS DISTINCT FROM OLD.deadline_minutes
     OR NEW.resident_phone IS DISTINCT FROM OLD.resident_phone
     OR NEW.qr_code_data IS DISTINCT FROM OLD.qr_code_data
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.received_by_name IS DISTINCT FROM OLD.received_by_name
  THEN
    RAISE EXCEPTION 'Morador não pode editar dados da encomenda. Apenas dar baixa (recebida) e ocultar.';
  END IF;

  IF OLD.status = 'recebida' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Encomenda já recebida; status não pode ser alterado.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'pendente' AND NEW.status = 'recebida') THEN
    RAISE EXCEPTION 'Transição de status inválida para morador.';
  END IF;

  IF OLD.oculta_para_morador = true AND NEW.oculta_para_morador IS DISTINCT FROM OLD.oculta_para_morador THEN
    RAISE EXCEPTION 'Encomenda já oculta; não é permitido reexibir.';
  END IF;

  IF NEW.oculta_para_morador IS DISTINCT FROM OLD.oculta_para_morador AND NOT (OLD.oculta_para_morador = false AND NEW.oculta_para_morador = true) THEN
    RAISE EXCEPTION 'Ação inválida. Morador só pode ocultar a encomenda.';
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
    WHERE c.relname = 'packages' AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_prevent_package_edit_by_resident ON public.packages;
    CREATE TRIGGER trigger_prevent_package_edit_by_resident
      BEFORE UPDATE ON public.packages
      FOR EACH ROW
      EXECUTE FUNCTION public.prevent_package_edit_by_resident();
  END IF;
END
$$;

-- 7) RLS: morador só vê suas encomendas não ocultas e só pode dar baixa/ocultar.
ALTER TABLE IF EXISTS public.packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS packages_staff_select ON public.packages;
DROP POLICY IF EXISTS packages_staff_insert ON public.packages;
DROP POLICY IF EXISTS packages_staff_update ON public.packages;
DROP POLICY IF EXISTS packages_staff_delete ON public.packages;
DROP POLICY IF EXISTS packages_resident_select ON public.packages;
DROP POLICY IF EXISTS packages_resident_update ON public.packages;

CREATE POLICY packages_staff_select
  ON public.packages
  FOR SELECT
  USING (public.is_staff_from_auth());

CREATE POLICY packages_staff_insert
  ON public.packages
  FOR INSERT
  WITH CHECK (public.is_staff_from_auth());

CREATE POLICY packages_staff_update
  ON public.packages
  FOR UPDATE
  USING (public.is_staff_from_auth())
  WITH CHECK (public.is_staff_from_auth());

CREATE POLICY packages_staff_delete
  ON public.packages
  FOR DELETE
  USING (public.is_staff_from_auth());

CREATE POLICY packages_resident_select
  ON public.packages
  FOR SELECT
  USING (
    recipient_id = public.current_resident_id_from_auth()
    AND oculta_para_morador = false
  );

CREATE POLICY packages_resident_update
  ON public.packages
  FOR UPDATE
  USING (recipient_id = public.current_resident_id_from_auth())
  WITH CHECK (recipient_id = public.current_resident_id_from_auth());

COMMIT;

