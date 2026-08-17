-- =============================================================================
-- M-G6-2 POST-APPLY VALIDATION — SOMENTE LEITURA
-- =============================================================================
-- ZERO writes.
-- =============================================================================

SELECT current_database() AS db, current_user AS usr, (now() AT TIME ZONE 'utc') AS utc_now;

SELECT
  to_regclass('public.api_confirmations') IS NOT NULL AS api_confirmations_exists,
  to_regclass('public.api_idempotency_keys') IS NOT NULL AS api_idempotency_keys_exists,
  to_regclass('public.organizations') IS NOT NULL AS organizations_exists,
  to_regclass('public.condominiums') IS NOT NULL AS condominiums_exists,
  to_regclass('public.units') IS NOT NULL AS units_exists,
  to_regclass('public.tenant_memberships') IS NOT NULL AS tenant_memberships_exists;

SELECT COUNT(*)::bigint AS api_confirmations_rows FROM public.api_confirmations;

SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'api_confirmations'
ORDER BY ordinal_position;

SELECT COUNT(*)::bigint AS column_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'api_confirmations';

-- PK
SELECT tc.constraint_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public' AND tc.table_name = 'api_confirmations'
  AND tc.constraint_type = 'PRIMARY KEY'
ORDER BY kcu.ordinal_position;

-- FKs + delete rule
SELECT
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table,
  ccu.column_name AS foreign_column,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
WHERE tc.table_schema = 'public' AND tc.table_name = 'api_confirmations'
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.constraint_name;

-- CHECKs
SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public' AND rel.relname = 'api_confirmations' AND con.contype = 'c'
ORDER BY con.conname;

-- Indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'api_confirmations'
ORDER BY indexname;

-- Triggers on table
SELECT tgname FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'api_confirmations' AND NOT t.tgisinternal
ORDER BY tgname;

-- Functions created by this migration (expect none named api_confirmations*)
SELECT n.nspname, p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname ILIKE '%api_confirmation%'
ORDER BY n.nspname, p.proname;

-- cron jobs (if extension present)
SELECT CASE
  WHEN to_regclass('cron.job') IS NULL THEN 'cron.job ABSENT'
  ELSE 'cron.job PRESENT — inspect separately'
END AS cron_status;

-- RLS observation (not created by migration; platform may set)
SELECT c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='api_confirmations') AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relname='api_confirmations';

-- No plaintext token column
SELECT COUNT(*)::bigint AS plaintext_token_columns
FROM information_schema.columns
WHERE table_schema='public' AND table_name='api_confirmations'
  AND column_name IN ('confirmation_token','token_plaintext','plaintext_token','token');

-- Required columns present
SELECT
  BOOL_AND(column_name = 'token_hash') FILTER (WHERE column_name='token_hash') AS has_token_hash,
  BOOL_AND(column_name = 'operation_fingerprint') FILTER (WHERE column_name='operation_fingerprint') AS has_fingerprint,
  BOOL_AND(column_name = 'status') FILTER (WHERE column_name='status') AS has_status,
  BOOL_AND(column_name = 'expires_at') FILTER (WHERE column_name='expires_at') AS has_expires_at,
  BOOL_AND(column_name = 'consumed_at') FILTER (WHERE column_name='consumed_at') AS has_consumed_at
FROM information_schema.columns
WHERE table_schema='public' AND table_name='api_confirmations';

-- G6-1 intact
SELECT
  (SELECT COUNT(*)::bigint FROM public.api_idempotency_keys) AS api_idempotency_keys_rows,
  (SELECT COUNT(*)::bigint FROM information_schema.columns
     WHERE table_schema='public' AND table_name='api_idempotency_keys') AS api_idempotency_keys_column_count;

-- Pilot / M1-M4
SELECT
  (SELECT COUNT(*)::bigint FROM public.organizations) AS organizations_rows,
  (SELECT COUNT(*)::bigint FROM public.condominiums) AS condominiums_rows,
  (SELECT COUNT(*)::bigint FROM public.units) AS units_rows,
  (SELECT COUNT(*)::bigint FROM public.tenant_memberships) AS tenant_memberships_rows,
  (SELECT COUNT(*)::bigint FROM public.organizations WHERE slug='qualivida-admin') AS org_pilot_rows,
  (SELECT COUNT(*)::bigint FROM public.condominiums WHERE slug='qualivida-club-residence') AS condo_pilot_rows;
