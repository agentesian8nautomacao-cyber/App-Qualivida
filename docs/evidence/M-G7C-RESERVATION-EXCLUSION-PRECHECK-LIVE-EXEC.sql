-- =============================================================================
-- M-G7C-1 PRE-CHECK LIVE EXEC — SOMENTE LEITURA (expandido p/ evidência)
-- Companion canônico: M-G7C-RESERVATION-EXCLUSION-PRECHECK-LIVE.sql
-- =============================================================================

\echo '=== AUTH ==='
SELECT current_database(), current_user, (now() AT TIME ZONE 'utc') AS utc_now;

\echo '=== VERSION ==='
SELECT version();

\echo '=== RESERVATIONS TABLE ==='
SELECT to_regclass('public.reservations') AS reservations_regclass;

\echo '=== COLUMNS ==='
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reservations'
ORDER BY ordinal_position;

\echo '=== CONDOMINIUM_ID PRESENCE ==='
SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'condominium_id'
  ) AS reservations_has_condominium_id,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'areas'
      AND column_name = 'condominium_id'
  ) AS areas_has_condominium_id;

\echo '=== AREAS COLUMNS ==='
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'areas'
ORDER BY ordinal_position;

\echo '=== STATUS CHECK ==='
SELECT pg_get_constraintdef(c.oid) AS status_check_def
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'reservations'
  AND c.conname = 'reservations_status_check';

\echo '=== EXTENSIONS ==='
SELECT e.extname, n.nspname
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname IN ('btree_gist', 'uuid-ossp', 'pgcrypto')
ORDER BY 1;

\echo '=== EXISTING CONSTRAINTS ==='
SELECT c.conname, c.contype, pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public' AND t.relname = 'reservations'
ORDER BY c.conname;

\echo '=== HALF-OPEN SMOKE ==='
SELECT
  (tsrange('2026-09-01 10:00', '2026-09-01 12:00', '[)')
    && tsrange('2026-09-01 11:00', '2026-09-01 13:00', '[)')) AS overlap_partial_expect_t,
  (tsrange('2026-09-01 10:00', '2026-09-01 12:00', '[)')
    && tsrange('2026-09-01 12:00', '2026-09-01 14:00', '[)')) AS overlap_adjacent_expect_f;

\echo '=== OVERLAPPING PAIRS ==='
SELECT COUNT(*)::bigint AS overlapping_active_pairs
FROM public.reservations a
JOIN public.reservations b
  ON a.id < b.id
 AND a.area_id = b.area_id
 AND a."date" = b."date"
 AND a.status IN ('scheduled', 'active')
 AND b.status IN ('scheduled', 'active')
 AND tsrange((a."date"::timestamp + a.start_time), (a."date"::timestamp + a.end_time), '[)')
  && tsrange((b."date"::timestamp + b.start_time), (b."date"::timestamp + b.end_time), '[)');

\echo '=== COUNTS ==='
SELECT COUNT(*)::bigint AS reservations_total FROM public.reservations;
SELECT status, COUNT(*)::bigint AS n FROM public.reservations GROUP BY status ORDER BY n DESC;

\echo '=== SUMMARY ==='
SELECT
  to_regclass('public.reservations') IS NOT NULL AS reservations_exists,
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') AS btree_gist_exists,
  NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'reservations'
      AND c.conname = 'reservations_area_date_slot_excl'
  ) AS exclusion_absent,
  NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'condominium_id'
  ) AS condominium_id_absent_expected,
  (
    SELECT COUNT(*)::bigint
    FROM public.reservations a
    JOIN public.reservations b
      ON a.id < b.id AND a.area_id = b.area_id AND a."date" = b."date"
     AND a.status IN ('scheduled', 'active') AND b.status IN ('scheduled', 'active')
     AND tsrange((a."date"::timestamp + a.start_time), (a."date"::timestamp + a.end_time), '[)')
      && tsrange((b."date"::timestamp + b.start_time), (b."date"::timestamp + b.end_time), '[)')
  ) = 0 AS no_overlapping_active_pairs;
