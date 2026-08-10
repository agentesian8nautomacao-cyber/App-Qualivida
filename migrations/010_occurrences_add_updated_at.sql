-- ============================================
-- OCORRÊNCIAS: Adicionar updated_at para INSERT via app
-- ============================================
-- O app (offlineDataService) envia updated_at no INSERT. Se a coluna não
-- existir, o Supabase rejeita e a ocorrência fica só no cache do morador
-- e na outbox — o admin nunca vê. Esta migration garante que o INSERT
-- funcione e a ocorrência seja persistida para todos os perfis.
-- ============================================

BEGIN;

-- Coluna updated_at (usada pelo createData no front e para merge no cache)
ALTER TABLE IF EXISTS public.occurrences
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Garantir que colunas usadas pelo app existam (evita erro em projetos antigos)
ALTER TABLE IF EXISTS public.occurrences
  ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE IF EXISTS public.occurrences
  ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb;

-- Trigger para atualizar updated_at em UPDATE (opcional, boa prática)
CREATE OR REPLACE FUNCTION update_occurrences_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trigger_occurrences_updated_at ON public.occurrences;
CREATE TRIGGER trigger_occurrences_updated_at
  BEFORE UPDATE ON public.occurrences
  FOR EACH ROW EXECUTE FUNCTION update_occurrences_updated_at();

COMMIT;
