-- =============================================================================
-- M-G6-2 PRE-CHECK LIVE — SOMENTE LEITURA
-- =============================================================================
-- Status: DOCUMENTADO / NÃO EXECUTADO nesta tarefa de criação do SQL
-- Project alvo: zaemlxjwhzrfmowbckmk
-- Uso: SQL Editor (read-only) ANTES de qualquer APPLY de M-G6-2
--
-- Interpretação (PASS para APPLY):
--   organizations EXISTS
--   condominiums EXISTS
--   api_confirmations ABSENT
--
-- Informativo (não bloqueante do CREATE):
--   api_idempotency_keys EXISTS esperado (G6-1 CLOSED) — NÃO alterar
--
-- Qualquer divergência nos critérios bloqueantes → STOP / BLOCKED
--
-- Este script NÃO contém INSERT/UPDATE/DELETE/DDL.
-- =============================================================================

-- 1) organizations (M1) deve existir
SELECT
  to_regclass('public.organizations') AS organizations_regclass,
  CASE
    WHEN to_regclass('public.organizations') IS NOT NULL THEN 'EXISTS — OK (M1)'
    ELSE 'ABSENT — STOP / BLOCKED (M1 required)'
  END AS organizations_verdict;

-- 2) condominiums (M1) deve existir
SELECT
  to_regclass('public.condominiums') AS condominiums_regclass,
  CASE
    WHEN to_regclass('public.condominiums') IS NOT NULL THEN 'EXISTS — OK (M1)'
    ELSE 'ABSENT — STOP / BLOCKED (M1 required)'
  END AS condominiums_verdict;

-- 3) api_confirmations NÃO deve existir
SELECT
  to_regclass('public.api_confirmations') AS api_confirmations_regclass,
  CASE
    WHEN to_regclass('public.api_confirmations') IS NULL THEN 'ABSENT — OK for M-G6-2 CREATE'
    ELSE 'EXISTS — STOP / BLOCKED'
  END AS api_confirmations_verdict;

-- 4) G6-1 informativo (esperado EXISTS; não alterar)
SELECT
  to_regclass('public.api_idempotency_keys') AS api_idempotency_keys_regclass,
  CASE
    WHEN to_regclass('public.api_idempotency_keys') IS NOT NULL THEN 'EXISTS — OK (G6-1 intact)'
    ELSE 'ABSENT — WARN (G6-1 expected CLOSED; investigate)'
  END AS api_idempotency_keys_verdict;

-- 5) PKs alvo das FKs
SELECT
  (SELECT COUNT(*) FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = 'organizations'
       AND constraint_type = 'PRIMARY KEY') AS organizations_pk_count,
  (SELECT COUNT(*) FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = 'condominiums'
       AND constraint_type = 'PRIMARY KEY') AS condominiums_pk_count;

-- 6) Objetos conflitantes com o nome
SELECT n.nspname AS schema_name, c.relname, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'api_confirmations'
ORDER BY n.nspname;

-- 7) Resumo
SELECT
  to_regclass('public.organizations') IS NOT NULL AS organizations_exists,
  to_regclass('public.condominiums') IS NOT NULL AS condominiums_exists,
  to_regclass('public.api_confirmations') IS NULL AS api_confirmations_absent,
  to_regclass('public.api_idempotency_keys') IS NOT NULL AS api_idempotency_keys_exists,
  (
    to_regclass('public.organizations') IS NOT NULL
    AND to_regclass('public.condominiums') IS NOT NULL
    AND to_regclass('public.api_confirmations') IS NULL
  ) AS m_g6_2_create_safe;
