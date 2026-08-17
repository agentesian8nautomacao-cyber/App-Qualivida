-- =============================================================================
-- M-G7J EVENT STORE PRE-CHECK LIVE — SOMENTE LEITURA
-- =============================================================================
-- Status: DOCUMENTADO / executar no SQL Editor ANTES do APPLY 008
-- Project alvo: zaemlxjwhzrfmowbckmk
-- Gate: G7-J
-- Migration: supabase/migrations/20260815220000_008_api_domain_events.sql
--
-- Interpretação (PASS para APPLY):
--   organizations EXISTS
--   condominiums EXISTS
--   api_domain_events ABSENT
--   organizations PK + condominiums PK present (FK targets)
--
-- Informativo (não bloqueante do CREATE; intactos esperados):
--   api_idempotency_keys EXISTS (G6-1)
--   api_confirmations EXISTS (G6-2)
--   reservations exclusion G7-C (informativo)
--
-- Qualquer divergência nos critérios bloqueantes → STOP / BLOCKED
--
-- Este script NÃO contém INSERT/UPDATE/DELETE/DDL.
-- =============================================================================

-- 1) organizations (M1)
SELECT
  to_regclass('public.organizations') AS organizations_regclass,
  CASE
    WHEN to_regclass('public.organizations') IS NOT NULL THEN 'EXISTS — OK (M1)'
    ELSE 'ABSENT — STOP / BLOCKED (M1 required)'
  END AS organizations_verdict;

-- 2) condominiums (M1)
SELECT
  to_regclass('public.condominiums') AS condominiums_regclass,
  CASE
    WHEN to_regclass('public.condominiums') IS NOT NULL THEN 'EXISTS — OK (M1)'
    ELSE 'ABSENT — STOP / BLOCKED (M1 required)'
  END AS condominiums_verdict;

-- 3) api_domain_events NÃO deve existir
SELECT
  to_regclass('public.api_domain_events') AS api_domain_events_regclass,
  CASE
    WHEN to_regclass('public.api_domain_events') IS NULL THEN 'ABSENT — OK for G7-J CREATE'
    ELSE 'EXISTS — STOP / BLOCKED'
  END AS api_domain_events_verdict;

-- 4) G6-1 / G6-2 informativo (esperados EXISTS; NÃO alterar)
SELECT
  to_regclass('public.api_idempotency_keys') AS api_idempotency_keys_regclass,
  CASE
    WHEN to_regclass('public.api_idempotency_keys') IS NOT NULL THEN 'EXISTS — OK (G6-1 intact)'
    ELSE 'ABSENT — WARN (G6-1 expected CLOSED)'
  END AS api_idempotency_keys_verdict;

SELECT
  to_regclass('public.api_confirmations') AS api_confirmations_regclass,
  CASE
    WHEN to_regclass('public.api_confirmations') IS NOT NULL THEN 'EXISTS — OK (G6-2 intact)'
    ELSE 'ABSENT — WARN (G6-2 expected CLOSED)'
  END AS api_confirmations_verdict;

-- 5) PKs alvo das FKs (uuid)
SELECT
  (SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'id')
    AS organizations_id_type,
  (SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'condominiums' AND column_name = 'id')
    AS condominiums_id_type,
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
WHERE c.relname = 'api_domain_events'
ORDER BY n.nspname;

-- 7) Índices planejados ainda ausentes (esperado)
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_api_domain_events_tenant_occurred',
    'idx_api_domain_events_request_id',
    'idx_api_domain_events_tenant_type_occurred'
  );

-- 8) G7-C informativo (exclusion em reservations — não alterar)
SELECT
  to_regclass('public.reservations') AS reservations_regclass,
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_no_overlap_excl'
       OR contype = 'x' AND conrelid = 'public.reservations'::regclass
  ) AS reservations_has_exclusion_hint;

-- 9) Resumo bloqueante
SELECT
  to_regclass('public.organizations') IS NOT NULL AS organizations_exists,
  to_regclass('public.condominiums') IS NOT NULL AS condominiums_exists,
  to_regclass('public.api_domain_events') IS NULL AS api_domain_events_absent,
  to_regclass('public.api_idempotency_keys') IS NOT NULL AS api_idempotency_keys_exists,
  to_regclass('public.api_confirmations') IS NOT NULL AS api_confirmations_exists,
  (
    to_regclass('public.organizations') IS NOT NULL
    AND to_regclass('public.condominiums') IS NOT NULL
    AND to_regclass('public.api_domain_events') IS NULL
  ) AS m_g7j_create_safe;
