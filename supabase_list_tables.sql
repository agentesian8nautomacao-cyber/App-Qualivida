-- ============================================
-- LISTAR TABELAS EXISTENTES NO BANCO
-- ============================================
-- Execute no Supabase: SQL Editor → New query → Run.
--
-- TABELAS NECESSÁRIAS PARA O APP (checklist):
--   app_config, areas, chat_messages, crm_issues, crm_units, notes,
--   notice_reads, notices, notifications, occurrences, package_items,
--   packages, password_reset_tokens, reservations, residents, staff,
--   users, visitors, boletos  <-- se boletos não existir, use supabase_create_boletos_table.sql
-- ============================================

-- Tabelas do schema public (suas tabelas do app)
SELECT
    table_schema,
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_schema = t.table_schema AND c.table_name = t.table_name) AS colunas
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;
