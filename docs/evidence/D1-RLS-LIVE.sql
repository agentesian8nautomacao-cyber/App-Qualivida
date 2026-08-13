-- =============================================================================
-- D1 — RLS LIVE (somente leitura)
-- =============================================================================
-- Objetivo: exportar estado real de RLS (relrowsecurity) nas tabelas prioritárias.
-- Ambiente: SQL Editor do projeto Supabase de produção (ref: zaemlxjwhzrfmowbckmk)
-- Fonte: docs/FASE-0-DIAGNOSTICO-PRODUCAO.md — Anexo D (bloco D1)
--
-- PROIBIDO neste script (e na execução desta etapa):
--   CREATE / ALTER / DROP / INSERT / UPDATE / DELETE /
--   GRANT / REVOKE / CREATE POLICY / ALTER POLICY / DROP POLICY
--
-- Como usar:
--   1. Abrir SQL Editor no projeto correto
--   2. Colar e executar este arquivo inteiro
--   3. Exportar o resultado (CSV/JSON/texto) para:
--      docs/evidence/results/D1-RLS-LIVE-<YYYY-MM-DD>.txt
--   4. Preencher docs/evidence/README.md (data/hora, responsável, ambiente)
-- =============================================================================

-- D1) RLS por tabela prioritária
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'users','staff','residents','packages','package_items','occurrences',
    'notices','notice_reads','notifications','reservations','areas','boletos',
    'roles','permissions','role_permissions','staff_invites','resident_invites',
    'admin_audit_logs','app_config'
  )
ORDER BY 1;
