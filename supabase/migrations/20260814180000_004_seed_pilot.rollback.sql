-- =============================================================================
-- M4 ROLLBACK — 004_seed_pilot
-- =============================================================================
-- Status: PREPARED — NÃO executar sem autorização explícita
-- Project: zaemlxjwhzrfmowbckmk
-- Companion: 20260814180000_004_seed_pilot.sql
-- Decisões: DR6 (M4-DECISIONS-2026-08-14.txt)
-- Correção: M4-SQL-DEEP-REVIEW-2026-08-14 (BLOCKING — bind org+slug)
--
-- Objetivo:
--   Remover o seed piloto (1 condominium + 1 organization) enquanto NÃO
--   existirem dependências (units / tenant_memberships / M5+ FKs).
--
-- Identificação segura (anti cross-tenant):
--   1) organization: slug = 'qualivida-admin' (UNIQUE global) — exatamente 1
--   2) condominium:  organization_id = org piloto
--                    AND slug = 'qualivida-club-residence' — exatamente 1
--   NUNCA DELETE condominiums WHERE slug = … sem organization_id.
--
-- Ordem (RESTRICT):
--   1) DELETE condominiums (somente o do org piloto)
--   2) DELETE organizations (somente a org piloto)
--
-- NÃO usar CASCADE.
-- NÃO DELETE em tabelas dependentes.
--
-- Pré-requisitos:
--   - Snapshot/backup disponível
--   - Autorização explícita de rollback
--   - Sem dependentes apontando aos IDs piloto
--
-- PROIBIDO após M5+ ou quando existirem FKs/dependentes sobre esses registros.
-- Nesses casos: restore/snapshot — NÃO este script destrutivo.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_organization_id uuid;
  v_condominium_id uuid;
  v_org_count bigint;
  v_condo_count bigint;
  v_other_condos bigint;
  v_dep_units bigint := 0;
  v_dep_memberships bigint := 0;
  v_org_name text;
BEGIN
  -- -------------------------------------------------------------------------
  -- 1) Organization piloto — exatamente 1 por slug UNIQUE global
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_org_count
  FROM public.organizations
  WHERE slug = 'qualivida-admin';

  IF v_org_count = 0 THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: organization slug=qualivida-admin not found — refuse DELETE of any condominium';
  END IF;

  IF v_org_count <> 1 THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: expected exactly 1 organization slug=qualivida-admin, found % — investigate',
      v_org_count;
  END IF;

  SELECT id, name INTO v_organization_id, v_org_name
  FROM public.organizations
  WHERE slug = 'qualivida-admin';

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: failed to resolve organization_id for slug=qualivida-admin';
  END IF;

  -- Validação de name esperada (não frágil demais; alerta se divergir)
  IF v_org_name IS DISTINCT FROM 'Empresa/Administradora piloto' THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: organization slug=qualivida-admin name mismatch (got %, expected Empresa/Administradora piloto) — investigate before DELETE',
      v_org_name;
  END IF;

  -- -------------------------------------------------------------------------
  -- 2) Condominium piloto — SOMENTE sob organization_id resolvido + slug
  --    (NÃO localizar por slug global)
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_condo_count
  FROM public.condominiums
  WHERE organization_id = v_organization_id
    AND slug = 'qualivida-club-residence';

  IF v_condo_count = 0 THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: pilot condominium not found for org % (slug=qualivida-club-residence) — fail-closed; no DELETE',
      v_organization_id;
  END IF;

  IF v_condo_count <> 1 THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: expected exactly 1 pilot condominium under org %, found % — investigate',
      v_organization_id, v_condo_count;
  END IF;

  SELECT id INTO v_condominium_id
  FROM public.condominiums
  WHERE organization_id = v_organization_id
    AND slug = 'qualivida-club-residence';

  IF v_condominium_id IS NULL THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: failed to resolve condominium_id for pilot pair';
  END IF;

  -- -------------------------------------------------------------------------
  -- 3) Org não deve ter outros condominiums além do piloto esperado
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_other_condos
  FROM public.condominiums
  WHERE organization_id = v_organization_id
    AND id <> v_condominium_id;

  IF v_other_condos <> 0 THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: organization % has % extra condominium(s) beyond pilot — refuse org DELETE',
      v_organization_id, v_other_condos;
  END IF;

  -- -------------------------------------------------------------------------
  -- 4) Dependências (units / tenant_memberships / M5+ path)
  --    Sem CASCADE; sem DELETE em tabelas dependentes
  -- -------------------------------------------------------------------------
  IF to_regclass('public.units') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_dep_units
    FROM public.units
    WHERE condominium_id = v_condominium_id;
  END IF;

  IF to_regclass('public.tenant_memberships') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_dep_memberships
    FROM public.tenant_memberships
    WHERE condominium_id = v_condominium_id
       OR organization_id = v_organization_id;
  END IF;

  IF v_dep_units <> 0 OR v_dep_memberships <> 0 THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: dependents exist (units=%, tenant_memberships=%) — use snapshot restore; destructive rollback PROHIBITED after M5+/deps',
      v_dep_units, v_dep_memberships;
  END IF;

  -- -------------------------------------------------------------------------
  -- 5) DELETE ordenado — somente IDs do par piloto
  -- -------------------------------------------------------------------------
  DELETE FROM public.condominiums
  WHERE id = v_condominium_id
    AND organization_id = v_organization_id
    AND slug = 'qualivida-club-residence';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: condominium DELETE affected 0 rows — investigate';
  END IF;

  DELETE FROM public.organizations
  WHERE id = v_organization_id
    AND slug = 'qualivida-admin';

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'M4 ROLLBACK BLOCKED: organization DELETE affected 0 rows (possible FK RESTRICT from unknown dependent) — investigate / use snapshot';
  END IF;

  RAISE NOTICE 'M4_ROLLBACK_OK deleted condominium_id=% organization_id=%',
    v_condominium_id, v_organization_id;
END $$;

COMMIT;
