-- =============================================================================
-- D2 — STORAGE LIVE / POLICIES (somente leitura)
-- =============================================================================
-- Objetivo: exportar policies live de tabelas públicas prioritárias e de
--           storage.objects (necessário para fechar Storage live + RLS live).
-- Ambiente: SQL Editor do projeto Supabase de produção (ref: zaemlxjwhzrfmowbckmk)
-- Fonte: docs/FASE-0-DIAGNOSTICO-PRODUCAO.md — Anexo D (bloco D2)
--
-- PROIBIDO neste script (e na execução desta etapa):
--   CREATE / ALTER / DROP / INSERT / UPDATE / DELETE /
--   GRANT / REVOKE / CREATE POLICY / ALTER POLICY / DROP POLICY
--   alterar buckets, objetos ou metadados de Storage
--
-- Como usar:
--   1. Abrir SQL Editor no projeto correto
--   2. Colar e executar este arquivo inteiro
--   3. Exportar o resultado para:
--      docs/evidence/results/D2-STORAGE-LIVE-<YYYY-MM-DD>.txt
--   4. Preencher docs/evidence/README.md (data/hora, responsável, ambiente)
-- =============================================================================

-- D2) Policies detalhadas (tabelas public prioritárias + storage.objects)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN (
    'users','staff','residents','packages','package_items','occurrences',
    'notices','notice_reads','notifications','reservations','areas','boletos',
    'roles','permissions','role_permissions','staff_invites','resident_invites',
    'admin_audit_logs','app_config'
  ))
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, policyname;
