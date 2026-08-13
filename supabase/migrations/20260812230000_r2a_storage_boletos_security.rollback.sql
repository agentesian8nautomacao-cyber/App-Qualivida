-- =============================================================================
-- R2A ROLLBACK EMERGENCIAL — restaurar estado pré-R2A do Storage boletos
-- =============================================================================
-- Status: PREPARED — NÃO é fluxo normal
-- Project: zaemlxjwhzrfmowbckmk
--
-- Restaura EXATAMENTE o estado LIVE documentado em D2/D5/R2.3:
--   - boletos_read_all (SELECT TO public)
--   - boletos_insert_authenticated (INSERT TO authenticated, só bucket_id)
--   - boletos_update_authenticated (UPDATE TO authenticated, só bucket_id)
--   - storage.buckets.public = true para id = 'boletos'
--
-- Remove policies criadas pela R2A.
-- NÃO alterar outras buckets / tabelas / código.
--
-- Usar SOMENTE se R2A causar incidente e autorização explícita para reabrir
-- a exposição pública (risco HIGH conhecido).
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "boletos_select_auth_compat" ON storage.objects;
DROP POLICY IF EXISTS "boletos_insert_staff_compat" ON storage.objects;
DROP POLICY IF EXISTS "boletos_update_staff_compat" ON storage.objects;

DROP POLICY IF EXISTS "boletos_read_all" ON storage.objects;
CREATE POLICY "boletos_read_all"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'boletos');

DROP POLICY IF EXISTS "boletos_insert_authenticated" ON storage.objects;
CREATE POLICY "boletos_insert_authenticated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'boletos');

DROP POLICY IF EXISTS "boletos_update_authenticated" ON storage.objects;
CREATE POLICY "boletos_update_authenticated"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'boletos')
  WITH CHECK (bucket_id = 'boletos');

UPDATE storage.buckets
SET public = true
WHERE id = 'boletos';

COMMIT;
