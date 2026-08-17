-- =============================================================================
-- M4 — 004_seed_pilot
-- =============================================================================
-- Nome lógico: 004_seed_pilot (plano: 004_pilot_seed — mesmo escopo)
-- Status: PREPARED / NOT EXECUTED
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Spec: docs/FASE-1-MIGRATION-PLAN.md § M4
--       docs/FASE-1-ARQUITETURA-MULTITENANT.md §14
--       docs/OPERAUT-ARCHITECTURE-ADDENDUM.md (site = condominiums)
-- Decisões: docs/evidence/results/M4-DECISIONS-2026-08-14.txt (DR1–DR6 CLOSED)
-- Readiness: docs/evidence/results/M4-READINESS-REVIEW-2026-08-14.txt
--
-- Objetivo:
--   Seed Organization piloto + Operational Site piloto (1 org + 1 condo).
--   DML only — sem DDL / ALTER / RLS / memberships / units / backfill.
--
-- INSERTs:
--   organizations: name/slug/status (DR1/DR2)
--   condominiums:  org FK + name/vertical/slug/status (DR3 + §14)
--
-- IDs (DR4):
--   NÃO inventar UUIDs. Usar DEFAULT gen_random_uuid().
--   Capturar IDs reais via RETURNING + RAISE NOTICE (registrar no APPLY).
--
-- Guards (DR5):
--   Fail-closed. Sem ON CONFLICT DO NOTHING. Sem reexecução silenciosa.
--
-- NÃO faz:
--   ALTER legado; users/staff/residents/roles/permissions;
--   INSERT units / tenant_memberships; UPDATE/DELETE legado;
--   RLS / policies / triggers / functions; backfill; M5+.
--
-- Pré-check LIVE (READ-ONLY — ANTES do APPLY):
--   Ver docs/evidence/M4-PRECHECK-LIVE.sql
--
-- Pré-requisito operacional (DR6):
--   Snapshot/backup OBRIGATÓRIO antes do APPLY.
--
-- NÃO executar sem: revisão humana + pré-check live + autorização APPLY.
-- Rollback: 20260814180000_004_seed_pilot.rollback.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Guards fail-closed (DR5)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION
      'M4 BLOCKED: public.organizations missing — M1 required';
  END IF;

  IF to_regclass('public.condominiums') IS NULL THEN
    RAISE EXCEPTION
      'M4 BLOCKED: public.condominiums missing — M1 required';
  END IF;

  IF to_regclass('public.units') IS NULL THEN
    RAISE EXCEPTION
      'M4 BLOCKED: public.units missing — M2 required (dependency chain)';
  END IF;

  IF to_regclass('public.tenant_memberships') IS NULL THEN
    RAISE EXCEPTION
      'M4 BLOCKED: public.tenant_memberships missing — M3 required (dependency chain)';
  END IF;

  -- Seed ainda não deve existir (slugs piloto)
  IF EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = 'qualivida-admin'
  ) THEN
    RAISE EXCEPTION
      'M4 BLOCKED: organizations.slug=qualivida-admin already exists — refuse silent re-run';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.condominiums
    WHERE slug = 'qualivida-club-residence'
  ) THEN
    RAISE EXCEPTION
      'M4 BLOCKED: condominiums.slug=qualivida-club-residence already exists — refuse silent re-run';
  END IF;

  -- Piloto inicial: tabelas de seed devem estar vazias (estado esperado pós M1–M3)
  IF (SELECT COUNT(*) FROM public.organizations) <> 0 THEN
    RAISE EXCEPTION
      'M4 BLOCKED: organizations not empty (expected 0 rows before pilot seed) — investigate';
  END IF;

  IF (SELECT COUNT(*) FROM public.condominiums) <> 0 THEN
    RAISE EXCEPTION
      'M4 BLOCKED: condominiums not empty (expected 0 rows before pilot seed) — investigate';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Seed: 1 organization + 1 condominium (mesma TX)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_organization_id uuid;
  v_condominium_id uuid;
  v_org_count bigint;
  v_condo_count bigint;
BEGIN
  INSERT INTO public.organizations (name, slug, status)
  VALUES (
    'Empresa/Administradora piloto',  -- DR1
    'qualivida-admin',                -- DR2
    'active'
  )
  RETURNING id INTO v_organization_id;

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'M4 BLOCKED: organization INSERT did not return id';
  END IF;

  INSERT INTO public.condominiums (
    organization_id,
    name,
    vertical,
    slug,
    status
  )
  VALUES (
    v_organization_id,
    'Qualivida Club Residence',       -- arquitetura §14
    'condominium',
    'qualivida-club-residence',       -- DR3
    'active'
  )
  RETURNING id INTO v_condominium_id;

  IF v_condominium_id IS NULL THEN
    RAISE EXCEPTION 'M4 BLOCKED: condominium INSERT did not return id';
  END IF;

  -- Assert exatamente 1+1 com os slugs piloto
  SELECT COUNT(*) INTO v_org_count FROM public.organizations;
  SELECT COUNT(*) INTO v_condo_count FROM public.condominiums;

  IF v_org_count <> 1 OR v_condo_count <> 1 THEN
    RAISE EXCEPTION
      'M4 BLOCKED: unexpected row counts after seed (organizations=%, condominiums=%) — expected 1/1',
      v_org_count, v_condo_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.condominiums c
    WHERE c.id = v_condominium_id
      AND c.organization_id = v_organization_id
      AND c.slug = 'qualivida-club-residence'
      AND c.vertical = 'condominium'
  ) THEN
    RAISE EXCEPTION
      'M4 BLOCKED: condominium row invariant failed (org FK / slug / vertical)';
  END IF;

  -- Captura de IDs reais para evidência APPLY / runbook (DR4)
  RAISE NOTICE 'M4_SEED_OK organization_id=%', v_organization_id;
  RAISE NOTICE 'M4_SEED_OK condominium_id=%', v_condominium_id;
  RAISE NOTICE 'M4_SEED_OK organizations.slug=qualivida-admin';
  RAISE NOTICE 'M4_SEED_OK condominiums.slug=qualivida-club-residence';
END $$;

-- Pós-APPLY (validação manual; NÃO automática neste arquivo):
--   SELECT id, name, slug, status FROM public.organizations;
--   SELECT id, organization_id, name, vertical, slug, status FROM public.condominiums;
--   Registrar IDs em docs/evidence/results/M4-APPLY-….txt
--   units / tenant_memberships devem permanecer com 0 rows (M4 não os toca)

COMMIT;
