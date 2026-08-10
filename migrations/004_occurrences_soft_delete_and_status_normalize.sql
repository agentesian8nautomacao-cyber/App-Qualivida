-- migrations/004_occurrences_soft_delete_and_status_normalize.sql
-- 1) Implementa soft delete em occurrences (deleted_by_admin)
-- 2) Normaliza valores de status no banco para: aberta | em_andamento | resolvida
--    (UI continua exibindo labels amigáveis via mapeamento no frontend)

BEGIN;

-- Coluna para soft delete (admin "remove" sem apagar historico)
ALTER TABLE IF EXISTS public.occurrences
  ADD COLUMN IF NOT EXISTS deleted_by_admin boolean NOT NULL DEFAULT false;

-- Remover constraint antiga (padrão gerado pelo Postgres geralmente é occurrences_status_check)
ALTER TABLE IF EXISTS public.occurrences
  DROP CONSTRAINT IF EXISTS occurrences_status_check;

-- Normalizar status existente (suporta legado em PT-BR e valores já normalizados)
UPDATE public.occurrences
SET status = CASE
  WHEN status IS NULL THEN 'aberta'
  WHEN lower(status) IN ('aberto', 'aberta') THEN 'aberta'
  WHEN replace(replace(lower(status), ' ', '_'), '-', '_') IN ('em_andamento', 'emandamento') THEN 'em_andamento'
  WHEN lower(status) IN ('resolvido', 'resolvida') THEN 'resolvida'
  ELSE status
END;

-- Default consistente
ALTER TABLE IF EXISTS public.occurrences
  ALTER COLUMN status SET DEFAULT 'aberta';

-- Nova constraint
ALTER TABLE IF EXISTS public.occurrences
  ADD CONSTRAINT occurrences_status_check
  CHECK (status IN ('aberta', 'em_andamento', 'resolvida'));

COMMIT;

