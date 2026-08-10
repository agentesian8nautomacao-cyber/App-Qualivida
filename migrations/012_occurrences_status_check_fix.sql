-- ============================================
-- OCORRÊNCIAS: Ajustar constraint de status
-- ============================================
-- Erro: "new row violates check constraint occurrences_status_check"
-- O app envia status em minúsculo: 'aberta', 'em_andamento', 'resolvida'.
-- Este script normaliza dados existentes e redefine a constraint.
-- Execute no SQL Editor do Supabase.
-- ============================================

BEGIN;

-- Remover constraint antiga (pode ter valores como 'Aberto' em vez de 'aberta')
ALTER TABLE IF EXISTS public.occurrences
  DROP CONSTRAINT IF EXISTS occurrences_status_check;

-- Normalizar status já existentes na tabela para os valores que o app usa
UPDATE public.occurrences
SET status = CASE
  WHEN status IS NULL THEN 'aberta'
  WHEN lower(trim(status)) IN ('aberto', 'aberta') THEN 'aberta'
  WHEN lower(replace(replace(trim(status), ' ', '_'), '-', '_')) IN ('em_andamento', 'emandamento') THEN 'em_andamento'
  WHEN lower(trim(status)) IN ('resolvido', 'resolvida') THEN 'resolvida'
  ELSE 'aberta'
END;

-- Valores aceitos pelo app (toDbOccurrenceStatus no dataService.ts)
ALTER TABLE IF EXISTS public.occurrences
  ADD CONSTRAINT occurrences_status_check
  CHECK (status IN ('aberta', 'em_andamento', 'resolvida'));

-- Default para novas linhas
ALTER TABLE IF EXISTS public.occurrences
  ALTER COLUMN status SET DEFAULT 'aberta';

COMMIT;
