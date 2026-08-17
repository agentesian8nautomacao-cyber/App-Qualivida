-- =============================================================================
-- M-G6-2 PRE-CHECK LIVE — SOMENTE LEITURA (execução expandida)
-- =============================================================================
-- Companion: docs/evidence/M-G6-2-PRECHECK-LIVE.sql
-- ZERO writes. ZERO DDL.
-- =============================================================================

SELECT current_database() AS db, current_user AS usr, (now() AT TIME ZONE 'utc') AS utc_now;

-- 1-4) regclass / existence (deps + target + G6-1)
SELECT
  to_regclass('public.organizations') AS organizations_regclass,
  CASE WHEN to_regclass('public.organizations') IS NOT NULL THEN 'EXISTS — OK (M1)' ELSE 'ABSENT — STOP / BLOCKED' END AS organizations_verdict,
  to_regclass('public.condominiums') AS condominiums_regclass,
  CASE WHEN to_regclass('public.condominiums') IS NOT NULL THEN 'EXISTS — OK (M1)' ELSE 'ABSENT — STOP / BLOCKED' END AS condominiums_verdict,
  to_regclass('public.api_confirmations') AS api_confirmations_regclass,
  CASE WHEN to_regclass('public.api_confirmations') IS NULL THEN 'ABSENT — OK for M-G6-2 CREATE' ELSE 'EXISTS — STOP / BLOCKED' END AS api_confirmations_verdict,
  to_regclass('public.api_idempotency_keys') AS api_idempotency_keys_regclass,
  CASE WHEN to_regclass('public.api_idempotency_keys') IS NOT NULL THEN 'EXISTS — OK (G6-1 intact)' ELSE 'ABSENT — WARN (G6-1 expected CLOSED)' END AS api_idempotency_keys_verdict;

-- PK / id types for FK targets
SELECT c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN ('organizations', 'condominiums')
  AND c.column_name = 'id'
ORDER BY c.table_name;

SELECT tc.table_name, tc.constraint_type, tc.constraint_name
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('organizations', 'condominiums')
  AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY tc.table_name;

-- Planned FK type compatibility (uuid → uuid)
SELECT
  'organization_id → organizations.id' AS planned_fk,
  b.data_type AS target_data_type,
  b.udt_name AS target_udt,
  (b.udt_name = 'uuid') AS compatible
FROM information_schema.columns b
WHERE b.table_schema = 'public' AND b.table_name = 'organizations' AND b.column_name = 'id'
UNION ALL
SELECT
  'condominium_id → condominiums.id',
  b.data_type,
  b.udt_name,
  (b.udt_name = 'uuid')
FROM information_schema.columns b
WHERE b.table_schema = 'public' AND b.table_name = 'condominiums' AND b.column_name = 'id';

-- Conflicting objects named api_confirmations
SELECT n.nspname AS schema_name, c.relname AS relname, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'api_confirmations'
ORDER BY n.nspname, c.relkind;

SELECT n.nspname, t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'api_confirmations';

-- M1–M4 + G6-1 presence + create-safe guard
SELECT
  to_regclass('public.organizations') IS NOT NULL AS organizations_exists,
  to_regclass('public.condominiums') IS NOT NULL AS condominiums_exists,
  to_regclass('public.units') IS NOT NULL AS units_exists,
  to_regclass('public.tenant_memberships') IS NOT NULL AS tenant_memberships_exists,
  to_regclass('public.api_idempotency_keys') IS NOT NULL AS api_idempotency_keys_exists,
  to_regclass('public.api_confirmations') IS NULL AS api_confirmations_absent,
  (
    to_regclass('public.organizations') IS NOT NULL
    AND to_regclass('public.condominiums') IS NOT NULL
    AND to_regclass('public.api_confirmations') IS NULL
  ) AS m_g6_2_create_safe;

-- Pilot seed baseline (informational; M4)
SELECT
  (SELECT COUNT(*)::bigint FROM public.organizations) AS organizations_rows,
  (SELECT COUNT(*)::bigint FROM public.condominiums) AS condominiums_rows,
  (SELECT COUNT(*)::bigint FROM public.units) AS units_rows,
  (SELECT COUNT(*)::bigint FROM public.tenant_memberships) AS tenant_memberships_rows,
  (SELECT COUNT(*)::bigint FROM public.organizations WHERE slug = 'qualivida-admin') AS org_pilot_rows,
  (SELECT COUNT(*)::bigint FROM public.condominiums WHERE slug = 'qualivida-club-residence') AS condo_pilot_rows;

-- G6-1 intact snapshot (informational)
SELECT
  (SELECT COUNT(*)::bigint FROM public.api_idempotency_keys) AS api_idempotency_keys_rows,
  (SELECT COUNT(*)::bigint FROM information_schema.columns
     WHERE table_schema='public' AND table_name='api_idempotency_keys') AS api_idempotency_keys_column_count,
  (SELECT c.relrowsecurity FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname='public' AND c.relname='api_idempotency_keys') AS api_idempotency_keys_relrowsecurity;
