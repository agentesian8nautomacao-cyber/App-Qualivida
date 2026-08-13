-- =============================================================================
-- R2A-MIN ROLLBACK EMERGENCIAL — restaurar exposição pública pré-R2A-MIN
-- =============================================================================
-- Status: PREPARED — NÃO é fluxo normal
-- Project: zaemlxjwhzrfmowbckmk
-- Restaura Storage boletos ao estado D2/D5 (2026-08-12):
--   boletos_read_all SELECT TO public
--   boletos_insert_authenticated / boletos_update_authenticated intactos
--   storage.buckets.public = true
--
-- Remove somente a policy criada pela R2A-MIN.
-- NÃO altera packages / helpers / outras tabelas.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "boletos_select_authenticated" ON storage.objects;

DROP POLICY IF EXISTS "boletos_read_all" ON storage.objects;
CREATE POLICY "boletos_read_all"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'boletos');

UPDATE storage.buckets
SET public = true
WHERE id = 'boletos';

COMMIT;
