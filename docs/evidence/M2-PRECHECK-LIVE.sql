-- =============================================================================
-- M2 PRE-CHECK LIVE — SOMENTE LEITURA
-- =============================================================================
-- Status: DOCUMENTADO / NÃO EXECUTADO nesta tarefa de criação do SQL
-- Project alvo: zaemlxjwhzrfmowbckmk
-- Uso: SQL Editor (read-only) ANTES de qualquer APPLY de M2
--
-- Condição para M2 CREATE:
--   organizations = EXISTS
--   condominiums  = EXISTS
--   units         = ABSENT
--   → m2_create_safe = TRUE
--
-- Se units EXISTS → STOP / BLOCKED (não DROP; não corrigir; não APPLY)
-- Se pais M1 ausentes → STOP / BLOCKED (M1 incompleto)
-- =============================================================================

-- 1) organizations existe? (dependência M1)
SELECT
  to_regclass('public.organizations') AS organizations_regclass,
  CASE
    WHEN to_regclass('public.organizations') IS NOT NULL THEN 'EXISTS — OK (M1)'
    ELSE 'ABSENT — STOP / BLOCKED (M1 required)'
  END AS organizations_verdict;

-- 2) condominiums existe? (dependência M1)
SELECT
  to_regclass('public.condominiums') AS condominiums_regclass,
  CASE
    WHEN to_regclass('public.condominiums') IS NOT NULL THEN 'EXISTS — OK (M1)'
    ELSE 'ABSENT — STOP / BLOCKED (M1 required)'
  END AS condominiums_verdict;

-- 3) units já existe?
SELECT
  to_regclass('public.units') AS units_regclass,
  CASE
    WHEN to_regclass('public.units') IS NULL THEN 'ABSENT — OK for M2 CREATE'
    ELSE 'EXISTS — STOP / BLOCKED'
  END AS units_verdict;

-- 4) Resumo
SELECT
  to_regclass('public.organizations') IS NOT NULL AS organizations_exists,
  to_regclass('public.condominiums') IS NOT NULL AS condominiums_exists,
  to_regclass('public.units') IS NULL AS units_absent,
  (
    to_regclass('public.organizations') IS NOT NULL
    AND to_regclass('public.condominiums') IS NOT NULL
    AND to_regclass('public.units') IS NULL
  ) AS m2_create_safe;
