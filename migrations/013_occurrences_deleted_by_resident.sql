-- ============================================
-- OCORRÊNCIAS: Exclusão independente morador x admin
-- ============================================
-- Quando o morador "exclui" uma ocorrência, ela some só para ele.
-- Quando o admin "exclui", ela some só para admin/síndico/porteiro.
-- A ocorrência permanece no banco e visível para o outro perfil.
-- ============================================

BEGIN;

ALTER TABLE IF EXISTS public.occurrences
  ADD COLUMN IF NOT EXISTS deleted_by_resident boolean NOT NULL DEFAULT false;

COMMIT;
