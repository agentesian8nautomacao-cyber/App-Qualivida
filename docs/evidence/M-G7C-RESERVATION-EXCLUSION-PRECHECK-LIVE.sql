-- =============================================================================
-- M-G7C-1 PRE-CHECK LIVE — SOMENTE LEITURA
-- =============================================================================
-- Project alvo: zaemlxjwhzrfmowbckmk
-- Uso: SQL Editor / psql READ-ONLY ANTES de qualquer APPLY de
--      20260814210000_007_reservations_no_overlap.sql
--
-- Interpretação (PASS para preparação de APPLY):
--   public.reservations EXISTS
--   colunas area_id(uuid), date(date), start_time(time), end_time(time), status PRESENT
--   condominium_id ABSENT (esperado neste gate — não inventar)
--   btree_gist EXISTS
--   constraint reservations_area_date_slot_excl ABSENT (ainda não aplicada)
--   overlapping active pairs = 0
--
-- Se overlapping > 0 → STOP / BLOCKED (não resolver automaticamente)
--
-- Este script NÃO contém INSERT/UPDATE/DELETE/DDL.
-- =============================================================================

-- 1) tabela
SELECT
  to_regclass('public.reservations') AS reservations_regclass,
  CASE
    WHEN to_regclass('public.reservations') IS NOT NULL THEN 'EXISTS — OK'
    ELSE 'ABSENT — STOP / BLOCKED'
  END AS reservations_verdict;

-- 2) colunas críticas (tipos)
SELECT column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'reservations'
ORDER BY ordinal_position;

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'area_id' AND udt_name = 'uuid'
  ) AS area_id_uuid_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'date' AND udt_name = 'date'
  ) AS date_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'start_time' AND udt_name = 'time'
  ) AS start_time_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'end_time' AND udt_name = 'time'
  ) AS end_time_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'status'
  ) AS status_ok,
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

-- 3) CHECK de status (valores reais)
SELECT pg_get_constraintdef(c.oid) AS status_check_def
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'reservations'
  AND c.conname = 'reservations_status_check';

-- 4) extensão btree_gist
SELECT
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') AS btree_gist_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist')
      THEN 'EXISTS — OK'
    ELSE 'ABSENT — STOP / BLOCKED'
  END AS btree_gist_verdict;

-- 5) constraint alvo ainda ABSENT
SELECT
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'reservations'
      AND c.conname = 'reservations_area_date_slot_excl'
  ) AS exclusion_already_exists,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'reservations'
        AND c.conname = 'reservations_area_date_slot_excl'
    ) THEN 'EXISTS — STOP / BLOCKED (já aplicada?)'
    ELSE 'ABSENT — OK for CREATE'
  END AS exclusion_verdict;

-- 6) half-open semantics smoke (sem DDL)
SELECT
  (tsrange('2026-09-01 10:00', '2026-09-01 12:00', '[)')
    && tsrange('2026-09-01 11:00', '2026-09-01 13:00', '[)')) AS overlap_10_12_vs_11_13_expect_true,
  (tsrange('2026-09-01 10:00', '2026-09-01 12:00', '[)')
    && tsrange('2026-09-01 12:00', '2026-09-01 14:00', '[)')) AS overlap_10_12_vs_12_14_expect_false;

-- 7) conflitos existentes (pares ativos) — BLOCK se > 0
SELECT
  a.id AS reservation_a,
  b.id AS reservation_b,
  a.area_id,
  a."date",
  a.start_time AS a_start,
  a.end_time AS a_end,
  a.status AS a_status,
  b.start_time AS b_start,
  b.end_time AS b_end,
  b.status AS b_status
FROM public.reservations a
JOIN public.reservations b
  ON a.id < b.id
 AND a.area_id = b.area_id
 AND a."date" = b."date"
 AND a.status IN ('scheduled', 'active')
 AND b.status IN ('scheduled', 'active')
 AND tsrange(
       (a."date"::timestamp + a.start_time),
       (a."date"::timestamp + a.end_time),
       '[)'
     )
     &&
     tsrange(
       (b."date"::timestamp + b.start_time),
       (b."date"::timestamp + b.end_time),
       '[)'
     )
ORDER BY a."date", a.area_id, a.start_time;

SELECT COUNT(*)::bigint AS overlapping_active_pairs
FROM public.reservations a
JOIN public.reservations b
  ON a.id < b.id
 AND a.area_id = b.area_id
 AND a."date" = b."date"
 AND a.status IN ('scheduled', 'active')
 AND b.status IN ('scheduled', 'active')
 AND tsrange(
       (a."date"::timestamp + a.start_time),
       (a."date"::timestamp + a.end_time),
       '[)'
     )
     &&
     tsrange(
       (b."date"::timestamp + b.start_time),
       (b."date"::timestamp + b.end_time),
       '[)'
     );

SELECT COUNT(*)::bigint AS reservations_total FROM public.reservations;
SELECT status, COUNT(*)::bigint AS n
FROM public.reservations
GROUP BY status
ORDER BY n DESC;

-- 8) resumo
SELECT
  to_regclass('public.reservations') IS NOT NULL AS reservations_exists,
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') AS btree_gist_exists,
  NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'reservations'
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
      ON a.id < b.id
     AND a.area_id = b.area_id
     AND a."date" = b."date"
     AND a.status IN ('scheduled', 'active')
     AND b.status IN ('scheduled', 'active')
     AND tsrange(
           (a."date"::timestamp + a.start_time),
           (a."date"::timestamp + a.end_time),
           '[)'
         )
         &&
         tsrange(
           (b."date"::timestamp + b.start_time),
           (b."date"::timestamp + b.end_time),
           '[)'
         )
  ) = 0 AS no_overlapping_active_pairs,
  (
    to_regclass('public.reservations') IS NOT NULL
    AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'reservations'
        AND c.conname = 'reservations_area_date_slot_excl'
    )
    AND (
      SELECT COUNT(*)::bigint
      FROM public.reservations a
      JOIN public.reservations b
        ON a.id < b.id
       AND a.area_id = b.area_id
       AND a."date" = b."date"
       AND a.status IN ('scheduled', 'active')
       AND b.status IN ('scheduled', 'active')
       AND tsrange(
             (a."date"::timestamp + a.start_time),
             (a."date"::timestamp + a.end_time),
             '[)'
           )
           &&
           tsrange(
             (b."date"::timestamp + b.start_time),
             (b."date"::timestamp + b.end_time),
             '[)'
           )
    ) = 0
  ) AS m_g7c1_create_safe;
