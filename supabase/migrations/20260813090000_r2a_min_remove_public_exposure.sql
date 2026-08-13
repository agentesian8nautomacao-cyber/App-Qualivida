-- =============================================================================
-- R2A-MIN — Remover exposição pública do Storage boletos
-- =============================================================================
-- Nome lógico: R2A-MIN-REMOVE-PUBLIC-EXPOSURE
-- Status: PREPARED / NOT EXECUTED
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Plano: docs/evidence/R2A-MIN-PLAN-2026-08-13.md
--
-- Escopo MÍNIMO (somente bucket boletos):
--   1) DROP SELECT público boletos_read_all
--   2) CREATE SELECT autenticado (mesma condição de bucket; role mais estreita)
--   3) public = false no bucket boletos
--
-- NÃO faz:
--   packages (Allow all já removida na R1);
--   DROP/ALTER de boletos_insert_authenticated / boletos_update_authenticated;
--   helpers is_staff_from_auth / is_admin_for_staff_invites / current_resident_id;
--   has_permission() / is_member();
--   condominium_id / site_id / memberships;
--   tabela public.boletos; outras buckets; código.
--
-- SELECT autenticado NÃO é RBAC tenant-aware.
-- É restrição de exposição pública (public → authenticated).
-- Ownership / permission definitiva: REQUIRES M1/M12.
--
-- NÃO executar sem autorização explícita.
-- Rollback emergencial: *.rollback.sql
-- =============================================================================

BEGIN;

-- Pré-condição (operador, SQL Editor READ-ONLY antes):
--   SELECT id, public FROM storage.buckets WHERE id = 'boletos';
--     Esperado ANTES: public = true
--   SELECT policyname, cmd, roles::text, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname LIKE 'boletos%'
--   ORDER BY 1;
--     Esperado ANTES:
--       boletos_insert_authenticated | INSERT | {authenticated}
--       boletos_read_all             | SELECT | {public}
--       boletos_update_authenticated | UPDATE | {authenticated}

DROP POLICY IF EXISTS "boletos_read_all" ON storage.objects;

DROP POLICY IF EXISTS "boletos_select_authenticated" ON storage.objects;
CREATE POLICY "boletos_select_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'boletos');

COMMENT ON POLICY "boletos_select_authenticated" ON storage.objects IS
  'R2A-MIN: SELECT autenticado no bucket boletos. Fecha exposição pública. Não é RBAC/membership. Ownership pendente (M1/M12).';

UPDATE storage.buckets
SET public = false
WHERE id = 'boletos';

-- Pós (operador):
--   public = false
--   boletos_read_all ausente
--   boletos_select_authenticated presente
--   insert/update autenticados presentes e inalterados
--   packages: sem mudança (R1 permanece)

COMMIT;
