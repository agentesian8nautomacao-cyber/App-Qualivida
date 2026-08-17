-- =============================================================================
-- M-G6-1 PRE-CHECK LIVE — SOMENTE LEITURA (execução expandida)
-- =============================================================================
-- Companion: docs/evidence/M-G6-1-PRECHECK-LIVE.sql
-- ZERO writes.
-- =============================================================================

SELECT current_database() AS db, current_user AS usr, (now() AT TIME ZONE 'utc') AS utc_now;

-- 1-3) regclass / existence
SELECT
  to_regclass('public.organizations') AS organizations_regclass,
  CASE WHEN to_regclass('public.organizations') IS NOT NULL THEN 'EXISTS' ELSE 'ABSENT' END AS organizations_verdict,
  to_regclass('public.condominiums') AS condominiums_regclass,
  CASE WHEN to_regclass('public.condominiums') IS NOT NULL THEN 'EXISTS' ELSE 'ABSENT' END AS condominiums_verdict,
  to_regclass('public.api_idempotency_keys') AS api_idempotency_keys_regclass,
  CASE WHEN to_regclass('public.api_idempotency_keys') IS NULL THEN 'ABSENT' ELSE 'EXISTS' END AS api_idempotency_keys_verdict;

-- 4-5) PK + id types for FK targets
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

-- 8) conflicting objects with same name
SELECT n.nspname AS schema_name, c.relname AS relname, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'api_idempotency_keys'
ORDER BY n.nspname, c.relkind;

SELECT n.nspname, t.typname
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typname = 'api_idempotency_keys';

-- 9/13) M1–M4 dependency presence
SELECT
  to_regclass('public.organizations') IS NOT NULL AS organizations_exists,
  to_regclass('public.condominiums') IS NOT NULL AS condominiums_exists,
  to_regclass('public.units') IS NOT NULL AS units_exists,
  to_regclass('public.tenant_memberships') IS NOT NULL AS tenant_memberships_exists,
  to_regclass('public.api_idempotency_keys') IS NULL AS api_idempotency_keys_absent,
  (
    to_regclass('public.organizations') IS NOT NULL
    AND to_regclass('public.condominiums') IS NOT NULL
    AND to_regclass('public.api_idempotency_keys') IS NULL
  ) AS m_g6_1_create_safe;

-- pilot seed presence (informational; M4 applied historically)
SELECT
  (SELECT COUNT(*)::bigint FROM public.organizations) AS organizations_rows,
  (SELECT COUNT(*)::bigint FROM public.condominiums) AS condominiums_rows,
  (SELECT COUNT(*)::bigint FROM public.organizations WHERE slug = 'qualivida-admin') AS org_pilot_rows,
  (SELECT COUNT(*)::bigint FROM public.condominiums WHERE slug = 'qualivida-club-residence') AS condo_pilot_rows;

-- condominiums.organization_id type compatibility with organizations.id
SELECT
  a.data_type AS condominiums_organization_id_type,
  a.udt_name AS condominiums_organization_id_udt,
  b.data_type AS organizations_id_type,
  b.udt_name AS organizations_id_udt,
  (a.udt_name = b.udt_name) AS org_fk_types_compatible
FROM information_schema.columns a
CROSS JOIN information_schema.columns b
WHERE a.table_schema = 'public' AND a.table_name = 'condominiums' AND a.column_name = 'organization_id'
  AND b.table_schema = 'public' AND b.table_name = 'organizations' AND b.column_name = 'id';
