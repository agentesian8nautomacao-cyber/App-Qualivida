-- =============================================================================
-- M-G6-1 PRE-CHECK LIVE — SOMENTE LEITURA
-- =============================================================================
-- Status: DOCUMENTADO / NÃO EXECUTADO nesta tarefa de criação do SQL
-- Project alvo: zaemlxjwhzrfmowbckmk
-- Uso: SQL Editor (read-only) ANTES de qualquer APPLY de M-G6-1
--
-- Interpretação (PASS para APPLY):
--   organizations EXISTS
--   condominiums EXISTS
--   api_idempotency_keys ABSENT
--
-- Qualquer divergência → STOP / BLOCKED (não APPLY)
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

-- 3) api_idempotency_keys NÃO deve existir
SELECT
  to_regclass('public.api_idempotency_keys') AS api_idempotency_keys_regclass,
  CASE
    WHEN to_regclass('public.api_idempotency_keys') IS NULL THEN 'ABSENT — OK for M-G6-1 CREATE'
    ELSE 'EXISTS — STOP / BLOCKED'
  END AS api_idempotency_keys_verdict;

-- 4) FKs alvo (organizações / condominiums) — presença de PK
SELECT
  (SELECT COUNT(*) FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = 'organizations'
       AND constraint_type = 'PRIMARY KEY') AS organizations_pk_count,
  (SELECT COUNT(*) FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = 'condominiums'
       AND constraint_type = 'PRIMARY KEY') AS condominiums_pk_count;

-- 5) Resumo único
SELECT
  to_regclass('public.organizations') IS NOT NULL AS organizations_exists,
  to_regclass('public.condominiums') IS NOT NULL AS condominiums_exists,
  to_regclass('public.api_idempotency_keys') IS NULL AS api_idempotency_keys_absent,
  (
    to_regclass('public.organizations') IS NOT NULL
    AND to_regclass('public.condominiums') IS NOT NULL
    AND to_regclass('public.api_idempotency_keys') IS NULL
  ) AS m_g6_1_create_safe;
