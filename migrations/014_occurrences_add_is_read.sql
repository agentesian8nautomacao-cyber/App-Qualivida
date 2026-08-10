-- ============================================
-- OCORRÊNCIAS: Campo is_read para notificações do sino
-- ============================================
-- Quando o morador visualiza a ocorrência (clique no sino ou na listagem),
-- is_read = true e a notificação some do dropdown. A ocorrência continua
-- visível na tela de Ocorrências.
-- ============================================

BEGIN;

ALTER TABLE IF EXISTS public.occurrences
  ADD COLUMN IF NOT EXISTS is_read boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.occurrences.is_read IS 'Morador: true após visualizar; controla exibição no sino de notificações.';

COMMIT;
