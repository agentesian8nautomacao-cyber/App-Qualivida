-- =============================================================================
-- M4 PRE-CHECK LIVE — SOMENTE LEITURA
-- =============================================================================
-- Status: DOCUMENTADO / NÃO EXECUTADO nesta tarefa de criação do SQL
-- Project alvo: zaemlxjwhzrfmowbckmk
-- Uso: SQL Editor (read-only) ANTES de qualquer APPLY de M4
--
-- Condição para M4 SEED:
--   organizations EXISTS e rows = 0 (sem slug qualivida-admin)
--   condominiums  EXISTS e rows = 0 (sem slug qualivida-club-residence)
--   units EXISTS
--   tenant_memberships EXISTS
--   → m4_seed_safe = TRUE
--
-- Se slug piloto já existir → STOP / BLOCKED
-- Se org/condo não vazios → STOP / BLOCKED (estado inesperado)
-- Se dependência M1–M3 ausente → STOP / BLOCKED
--
-- NÃO executa INSERT/UPDATE/DELETE/DDL.
-- =============================================================================

-- 1) organizations EXISTS
SELECT
  to_regclass('public.organizations') AS organizations_regclass,
  CASE
    WHEN to_regclass('public.organizations') IS NOT NULL THEN 'EXISTS — OK (M1)'
    ELSE 'ABSENT — STOP / BLOCKED'
  END AS organizations_verdict;

-- 2) condominiums EXISTS
SELECT
  to_regclass('public.condominiums') AS condominiums_regclass,
  CASE
    WHEN to_regclass('public.condominiums') IS NOT NULL THEN 'EXISTS — OK (M1)'
    ELSE 'ABSENT — STOP / BLOCKED'
  END AS condominiums_verdict;

-- 3) units EXISTS
SELECT
  to_regclass('public.units') AS units_regclass,
  CASE
    WHEN to_regclass('public.units') IS NOT NULL THEN 'EXISTS — OK (M2)'
    ELSE 'ABSENT — STOP / BLOCKED'
  END AS units_verdict;

-- 4) tenant_memberships EXISTS
SELECT
  to_regclass('public.tenant_memberships') AS tenant_memberships_regclass,
  CASE
    WHEN to_regclass('public.tenant_memberships') IS NOT NULL THEN 'EXISTS — OK (M3)'
    ELSE 'ABSENT — STOP / BLOCKED'
  END AS tenant_memberships_verdict;

-- 5) Contagens (esperado: org/condo = 0; units/memberships = 0 no piloto atual)
SELECT
  (SELECT COUNT(*) FROM public.organizations) AS organizations_rows,
  (SELECT COUNT(*) FROM public.condominiums) AS condominiums_rows,
  (SELECT COUNT(*) FROM public.units) AS units_rows,
  (SELECT COUNT(*) FROM public.tenant_memberships) AS tenant_memberships_rows;

-- 6) Conflito slug organization
SELECT
  EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = 'qualivida-admin'
  ) AS org_slug_qualivida_admin_exists,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.organizations WHERE slug = 'qualivida-admin'
    ) THEN 'EXISTS — STOP / BLOCKED'
    ELSE 'ABSENT — OK'
  END AS org_slug_verdict;

-- 7) Conflito slug condominium
SELECT
  EXISTS (
    SELECT 1 FROM public.condominiums WHERE slug = 'qualivida-club-residence'
  ) AS condo_slug_qualivida_club_residence_exists,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.condominiums WHERE slug = 'qualivida-club-residence'
    ) THEN 'EXISTS — STOP / BLOCKED'
    ELSE 'ABSENT — OK'
  END AS condo_slug_verdict;

-- 8) Resumo — m4_seed_safe
SELECT
  to_regclass('public.organizations') IS NOT NULL AS organizations_exists,
  to_regclass('public.condominiums') IS NOT NULL AS condominiums_exists,
  to_regclass('public.units') IS NOT NULL AS units_exists,
  to_regclass('public.tenant_memberships') IS NOT NULL AS tenant_memberships_exists,
  (SELECT COUNT(*) FROM public.organizations) = 0 AS organizations_empty,
  (SELECT COUNT(*) FROM public.condominiums) = 0 AS condominiums_empty,
  NOT EXISTS (
    SELECT 1 FROM public.organizations WHERE slug = 'qualivida-admin'
  ) AS org_slug_absent,
  NOT EXISTS (
    SELECT 1 FROM public.condominiums WHERE slug = 'qualivida-club-residence'
  ) AS condo_slug_absent,
  (
    to_regclass('public.organizations') IS NOT NULL
    AND to_regclass('public.condominiums') IS NOT NULL
    AND to_regclass('public.units') IS NOT NULL
    AND to_regclass('public.tenant_memberships') IS NOT NULL
    AND (SELECT COUNT(*) FROM public.organizations) = 0
    AND (SELECT COUNT(*) FROM public.condominiums) = 0
    AND NOT EXISTS (
      SELECT 1 FROM public.organizations WHERE slug = 'qualivida-admin'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.condominiums WHERE slug = 'qualivida-club-residence'
    )
  ) AS m4_seed_safe;
