-- =============================================================================
-- R2A — Storage boletos: fechar exposição pública + restringir escrita
-- =============================================================================
-- Status: PREPARED / NOT EXECUTED
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Diagnósticos:
--   docs/evidence/R2.3-STORAGE-POLICY-AUDIT-2026-08-12.md
--   docs/evidence/R2.2-BOLETOS-OWNERSHIP-AUDIT-2026-08-12.md (OWNERSHIP = C)
--   docs/evidence/R2A-STORAGE-BOLETOS-SECURITY-REMEDIATION.md
--
-- Escopo (SOMENTE Storage bucket boletos):
--   1) DROP SELECT público boletos_read_all
--   2) public = false no bucket boletos
--   3) SELECT autenticado compatível (staff/admin/resident helpers)
--   4) REPLACE INSERT/UPDATE "qualquer authenticated" por staff/admin helpers
--
-- NÃO faz:
--   condominium_id / site_id / memberships / ownership por path;
--   alterar tabela public.boletos;
--   código / deploy / outras buckets.
--
-- LIMITAÇÃO (obrigatório registrar):
--   SELECT = "compatibilidade temporária — ownership ainda pendente"
--   INSERT/UPDATE = papel de projeto (helpers existentes), NÃO tenant/site.
--   REVIEW REQUIRED residual: CABO_TURMA (fora de is_staff/is_admin);
--   morador autenticado ainda pode baixar qualquer path conhecido no bucket.
--
-- NÃO executar em produção sem autorização explícita.
-- Rollback emergencial: *.rollback.sql (NÃO é fluxo normal).
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Pré-condições documentais (operador valida ANTES no SQL Editor)
-- ---------------------------------------------------------------------------
-- SELECT id, public FROM storage.buckets WHERE id = 'boletos';
--   Esperado ANTES: public = true
--
-- SELECT policyname, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname LIKE 'boletos%'
-- ORDER BY 1;
--   Esperado ANTES:
--     boletos_read_all | SELECT | {public}
--     boletos_insert_authenticated | INSERT | {authenticated}
--     boletos_update_authenticated | UPDATE | {authenticated}
--
-- SELECT
--   to_regprocedure('public.is_staff_from_auth()') IS NOT NULL AS has_is_staff,
--   to_regprocedure('public.is_admin_for_staff_invites()') IS NOT NULL AS has_is_admin,
--   to_regprocedure('public.current_resident_id_from_auth()') IS NOT NULL AS has_resident;
--   Esperado: true, true, true

-- ---------------------------------------------------------------------------
-- 1) Remover SELECT público
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "boletos_read_all" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 2) Remover INSERT/UPDATE "qualquer authenticated"
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "boletos_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "boletos_update_authenticated" ON storage.objects;

-- Idempotência se reaplicar após tentativa parcial
DROP POLICY IF EXISTS "boletos_select_auth_compat" ON storage.objects;
DROP POLICY IF EXISTS "boletos_insert_staff_compat" ON storage.objects;
DROP POLICY IF EXISTS "boletos_update_staff_compat" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 3) SELECT — compatibilidade temporária (ownership pendente)
-- ---------------------------------------------------------------------------
-- Quem: staff (PORTEIRO/SINDICO), admin-like, ou qualquer residente vinculado.
-- Limitação: NÃO restringe por boleto/path/tenant — só fecha anon + contas
-- sem papel staff/admin/resident.
CREATE POLICY "boletos_select_auth_compat"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'boletos'
    AND (
      public.is_staff_from_auth()
      OR public.is_admin_for_staff_invites()
      OR public.current_resident_id_from_auth() IS NOT NULL
    )
  );

COMMENT ON POLICY "boletos_select_auth_compat" ON storage.objects IS
  'R2A: SELECT autenticado temporário para bucket boletos. Compatibilidade — ownership ainda pendente (sem path/tenant).';

-- ---------------------------------------------------------------------------
-- 4) INSERT — staff/admin (não "qualquer authenticated")
-- ---------------------------------------------------------------------------
-- Quem no código: ImportBoletosModal / uploadBoletoOriginalPdf / addBoletoOriginalPdf
-- UI bloqueia MORADOR; RBAC boletos.create. Helpers cobrem PORTEIRO/SINDICO +
-- ADMIN/ADMINISTRADORA/ADM. Sem ownership de path.
CREATE POLICY "boletos_insert_staff_compat"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'boletos'
    AND (
      public.is_staff_from_auth()
      OR public.is_admin_for_staff_invites()
    )
  );

COMMENT ON POLICY "boletos_insert_staff_compat" ON storage.objects IS
  'R2A: INSERT no bucket boletos para staff/admin helpers. Sem tenant/site. REVIEW: CABO_TURMA fora do helper.';

-- ---------------------------------------------------------------------------
-- 5) UPDATE — staff/admin (necessário para upsert:true)
-- ---------------------------------------------------------------------------
CREATE POLICY "boletos_update_staff_compat"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'boletos'
    AND (
      public.is_staff_from_auth()
      OR public.is_admin_for_staff_invites()
    )
  )
  WITH CHECK (
    bucket_id = 'boletos'
    AND (
      public.is_staff_from_auth()
      OR public.is_admin_for_staff_invites()
    )
  );

COMMENT ON POLICY "boletos_update_staff_compat" ON storage.objects IS
  'R2A: UPDATE no bucket boletos para upsert PDF. Staff/admin helpers. Sem ownership de objeto.';

-- ---------------------------------------------------------------------------
-- 6) Bucket privado
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'boletos';

-- ---------------------------------------------------------------------------
-- 7) Validações pós (operador confirma no SQL Editor após COMMIT)
-- ---------------------------------------------------------------------------
-- SELECT id, public FROM storage.buckets WHERE id = 'boletos';
--   Esperado: public = false
--
-- SELECT policyname, cmd, roles::text, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname LIKE 'boletos%'
-- ORDER BY 1;
--   Esperado: select_auth_compat, insert_staff_compat, update_staff_compat
--   Ausente: boletos_read_all, boletos_insert_authenticated, boletos_update_authenticated
--
-- SELECT COUNT(*) AS public_select_boletos
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND cmd = 'SELECT'
--   AND 'public' = ANY (roles)
--   AND (qual ILIKE '%boletos%' OR with_check ILIKE '%boletos%');
--   Esperado: 0

COMMIT;
