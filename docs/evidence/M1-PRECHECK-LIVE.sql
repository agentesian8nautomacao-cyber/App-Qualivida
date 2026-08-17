-- =============================================================================
-- M1 PRE-CHECK LIVE — SOMENTE LEITURA
-- =============================================================================
-- Status: DOCUMENTADO / NÃO EXECUTADO nesta tarefa de criação do SQL
-- Project alvo: zaemlxjwhzrfmowbckmk
-- Uso: SQL Editor (read-only) ANTES de qualquer APPLY de M1
--
-- Interpretação:
--   to_regclass IS NULL  → criação segura (PASS pré-check)
--   to_regclass NOT NULL → STOP / BLOCKED (investigar; não APPLY M1)
-- =============================================================================

-- 1) organizations já existe?
SELECT
  to_regclass('public.organizations') AS organizations_regclass,
  CASE
    WHEN to_regclass('public.organizations') IS NULL THEN 'ABSENT — OK for M1 CREATE'
    ELSE 'EXISTS — STOP / BLOCKED'
  END AS organizations_verdict;

-- 2) condominiums já existe?
SELECT
  to_regclass('public.condominiums') AS condominiums_regclass,
  CASE
    WHEN to_regclass('public.condominiums') IS NULL THEN 'ABSENT — OK for M1 CREATE'
    ELSE 'EXISTS — STOP / BLOCKED'
  END AS condominiums_verdict;

-- 3) Resumo único (opcional)
SELECT
  to_regclass('public.organizations') IS NULL AS organizations_absent,
  to_regclass('public.condominiums') IS NULL AS condominiums_absent,
  (
    to_regclass('public.organizations') IS NULL
    AND to_regclass('public.condominiums') IS NULL
  ) AS m1_create_safe;
