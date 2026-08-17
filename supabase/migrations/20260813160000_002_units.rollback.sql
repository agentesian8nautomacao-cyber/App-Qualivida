-- =============================================================================
-- M2 ROLLBACK — 002_units
-- =============================================================================
-- Status: PREPARED — NÃO executar sem autorização explícita
-- Project: zaemlxjwhzrfmowbckmk
-- Companion: 20260813160000_002_units.sql
--
-- Restaura ausência da tabela M2:
--   DROP TABLE public.units
--
-- Condição de segurança (FASE-1-MIGRATION-PLAN § M2):
--   Somente se ainda NÃO existirem FKs dependentes de M5+ (ex.: unit_id)
--   apontando para public.units.
--
-- NÃO usar CASCADE.
-- Se FKs posteriores existirem, o DROP falha (comportamento desejável).
-- NÃO altera: organizations, condominiums, tabelas operacionais, RLS, Storage.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS public.units;

COMMIT;
