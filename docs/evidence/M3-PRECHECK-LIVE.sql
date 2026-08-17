-- =============================================================================
-- M3 PRE-CHECK LIVE — SOMENTE LEITURA
-- =============================================================================
-- Status: DOCUMENTADO / NÃO EXECUTADO nesta tarefa de criação do SQL
-- Project alvo: zaemlxjwhzrfmowbckmk
-- Uso: SQL Editor (read-only) ANTES de qualquer APPLY de M3
--
-- Condição para M3 CREATE:
--   organizations EXISTS
--   condominiums  EXISTS
--   roles         EXISTS
--   residents     EXISTS  (FK opcional resident_id)
--   staff         EXISTS  (FK opcional staff_profile_id)
--   auth.users    EXISTS  (FK auth_user_id)
--   tenant_memberships ABSENT
--   → m3_create_safe = TRUE
--
-- Se tenant_memberships EXISTS → STOP / BLOCKED
-- Se dependência obrigatória ausente → STOP / BLOCKED
-- =============================================================================

-- 1) organizations
SELECT
  to_regclass('public.organizations') AS organizations_regclass,
  CASE
    WHEN to_regclass('public.organizations') IS NOT NULL THEN 'EXISTS — OK (M1)'
    ELSE 'ABSENT — STOP / BLOCKED'
  END AS organizations_verdict;

-- 2) condominiums
SELECT
  to_regclass('public.condominiums') AS condominiums_regclass,
  CASE
    WHEN to_regclass('public.condominiums') IS NOT NULL THEN 'EXISTS — OK (M1)'
    ELSE 'ABSENT — STOP / BLOCKED'
  END AS condominiums_verdict;

-- 3) roles
SELECT
  to_regclass('public.roles') AS roles_regclass,
  CASE
    WHEN to_regclass('public.roles') IS NOT NULL THEN 'EXISTS — OK (RBAC)'
    ELSE 'ABSENT — STOP / BLOCKED'
  END AS roles_verdict;

-- 4) residents (FK opcional M3)
SELECT
  to_regclass('public.residents') AS residents_regclass,
  CASE
    WHEN to_regclass('public.residents') IS NOT NULL THEN 'EXISTS — OK'
    ELSE 'ABSENT — STOP / BLOCKED (FK resident_id)'
  END AS residents_verdict;

-- 5) staff (FK opcional M3)
SELECT
  to_regclass('public.staff') AS staff_regclass,
  CASE
    WHEN to_regclass('public.staff') IS NOT NULL THEN 'EXISTS — OK'
    ELSE 'ABSENT — STOP / BLOCKED (FK staff_profile_id)'
  END AS staff_verdict;

-- 6) auth.users
SELECT
  to_regclass('auth.users') AS auth_users_regclass,
  CASE
    WHEN to_regclass('auth.users') IS NOT NULL THEN 'EXISTS — OK'
    ELSE 'ABSENT — STOP / BLOCKED'
  END AS auth_users_verdict;

-- 7) tenant_memberships
SELECT
  to_regclass('public.tenant_memberships') AS tenant_memberships_regclass,
  CASE
    WHEN to_regclass('public.tenant_memberships') IS NULL THEN 'ABSENT — OK for M3 CREATE'
    ELSE 'EXISTS — STOP / BLOCKED'
  END AS tenant_memberships_verdict;

-- 8) Resumo
SELECT
  to_regclass('public.organizations') IS NOT NULL AS organizations_exists,
  to_regclass('public.condominiums') IS NOT NULL AS condominiums_exists,
  to_regclass('public.roles') IS NOT NULL AS roles_exists,
  to_regclass('public.residents') IS NOT NULL AS residents_exists,
  to_regclass('public.staff') IS NOT NULL AS staff_exists,
  to_regclass('auth.users') IS NOT NULL AS auth_users_exists,
  to_regclass('public.tenant_memberships') IS NULL AS tenant_memberships_absent,
  (
    to_regclass('public.organizations') IS NOT NULL
    AND to_regclass('public.condominiums') IS NOT NULL
    AND to_regclass('public.roles') IS NOT NULL
    AND to_regclass('public.residents') IS NOT NULL
    AND to_regclass('public.staff') IS NOT NULL
    AND to_regclass('auth.users') IS NOT NULL
    AND to_regclass('public.tenant_memberships') IS NULL
  ) AS m3_create_safe;
