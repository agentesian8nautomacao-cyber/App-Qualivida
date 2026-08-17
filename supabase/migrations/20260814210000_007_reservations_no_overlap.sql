-- =============================================================================
-- M-G7C-1 — 007_reservations_no_overlap
-- =============================================================================
-- Nome lógico: 007_reservations_no_overlap
-- Gate: G7-C reservation exclusion constraint
-- Status: PREPARED / NOT EXECUTED / AWAITING REVIEW
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Spec: docs/SENTINELA-AUT-G7-INTEGRITY.md
-- Evidência schema LIVE: docs/evidence/results/SENTINELA-G7-C-CONSTRAINT-SQL-2026-08-14.txt
--
-- Objetivo:
--   Garantir no PostgreSQL (fonte de verdade) que reservas ativas no mesmo
--   recurso/área + mesma data NÃO se sobreponham no intervalo half-open [start,end).
--
-- Cria:
--   CONSTRAINT public.reservations_area_date_slot_excl
--     EXCLUDE USING gist (area_id =, date =, tsrange(...) &&)
--     WHERE status IN ('scheduled','active')
--
-- NÃO faz:
--   ADD COLUMN condominium_id / organization_id (ABSENT no LIVE — não inventar);
--   ALTER M1–M4 / G6-1 / G6-2;
--   INSERT/UPDATE/DELETE/seed/backfill de reservas;
--   DROP EXTENSION;
--   RLS / policies / triggers / cron;
--   Event Store; wiring API; n8n; WhatsApp; G7-D.
--
-- Schema LIVE confirmado (READ-ONLY 2026-08-14):
--   public.reservations (
--     id uuid PK,
--     area_id uuid NOT NULL → areas(id),
--     resident_id uuid NOT NULL → residents(id),
--     resident_name varchar NOT NULL,
--     unit varchar NOT NULL,
--     date date NOT NULL,
--     start_time time NOT NULL,
--     end_time time NOT NULL,
--     status varchar NOT NULL CHECK IN (scheduled, active, completed, canceled),
--     created_at / updated_at timestamptz
--   )
--   condominium_id em reservations = ABSENT
--   condominium_id em areas        = ABSENT
--   Isolamento cross-condo: implícito via area_id UUID distinto por área
--   (sem compartilhar area_id entre condomínios). Quando M5 adicionar
--   condominium_id, revisão futura pode estender o EXCLUDE.
--
-- Regra de domínio (preservar Core timesOverlap):
--   [start, end)
--   10:00–12:00 ∩ 11:00–13:00 = CONFLITO
--   10:00–12:00 ∩ 12:00–14:00 = PERMITIDO
--
-- Status relevantes (valores REAIS do CHECK LIVE — grafia "canceled"):
--   scheduled, active  → participam da constraint
--   completed, canceled → NÃO participam
--
-- Extensão:
--   btree_gist — já presente em public no LIVE (não DROP no rollback)
--
-- Pré-check LIVE (READ-ONLY — ANTES do APPLY):
--   docs/evidence/M-G7C-RESERVATION-EXCLUSION-PRECHECK-LIVE.sql
--   Se conflitos existentes > 0 → BLOCK APPLY (não resolver automaticamente)
--
-- NÃO executar sem: review PASS + pré-check live PASS + autorização APPLY.
-- Rollback: 20260814210000_007_reservations_no_overlap.rollback.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Guards fail-closed (schema real)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.reservations') IS NULL THEN
    RAISE EXCEPTION
      'M-G7C-1 BLOCKED: public.reservations missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'area_id' AND udt_name = 'uuid'
  ) THEN
    RAISE EXCEPTION
      'M-G7C-1 BLOCKED: public.reservations.area_id uuid required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'date' AND udt_name = 'date'
  ) THEN
    RAISE EXCEPTION
      'M-G7C-1 BLOCKED: public.reservations.date (date) required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'start_time' AND udt_name = 'time'
  ) THEN
    RAISE EXCEPTION
      'M-G7C-1 BLOCKED: public.reservations.start_time (time) required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'end_time' AND udt_name = 'time'
  ) THEN
    RAISE EXCEPTION
      'M-G7C-1 BLOCKED: public.reservations.end_time (time) required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reservations'
      AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION
      'M-G7C-1 BLOCKED: public.reservations.status required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    RAISE EXCEPTION
      'M-G7C-1 BLOCKED: extension btree_gist required (present on LIVE; do not invent)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'reservations'
      AND c.conname = 'reservations_area_date_slot_excl'
  ) THEN
    RAISE EXCEPTION
      'M-G7C-1 BLOCKED: constraint reservations_area_date_slot_excl already exists';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Pré-condição de dados: conflitos ativos devem ser ZERO
-- (mesma regra half-open; não resolve automaticamente)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  conflict_count bigint;
BEGIN
  SELECT COUNT(*) INTO conflict_count
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

  IF conflict_count > 0 THEN
    RAISE EXCEPTION
      'M-G7C-1 BLOCKED: % overlapping active reservation pair(s) exist — resolve manually before APPLY',
      conflict_count;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Exclusion constraint — half-open [start,end) on same area_id + date
-- ---------------------------------------------------------------------------
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_area_date_slot_excl
  EXCLUDE USING gist (
    area_id WITH =,
    "date" WITH =,
    tsrange(
      ("date"::timestamp + start_time),
      ("date"::timestamp + end_time),
      '[)'
    ) WITH &&
  )
  WHERE (status IN ('scheduled', 'active'));

COMMIT;
