-- =============================================================================
-- M1 ROLLBACK — 001_platform_org_condo
-- =============================================================================
-- Status: PREPARED — NÃO executar sem autorização explícita
-- Project: zaemlxjwhzrfmowbckmk
-- Companion: 20260813150000_001_platform_org_condo.sql
--
-- Restaura ausência das tabelas M1:
--   DROP condominiums (primeiro — FK)
--   DROP organizations
--
-- Condição do plano (FASE-1-MIGRATION-PLAN § M1):
--   Somente se M4 ainda NÃO tiver populado FKs dependentes
--   (units / memberships / seed piloto).
--
-- NÃO altera: tabelas operacionais, RLS, Storage, roles, seed legado.
-- =============================================================================

BEGIN;

-- Guard: se existirem FKs de outras tabelas apontando para estas,
-- o DROP falha (seguro). Não usar CASCADE.
DROP TABLE IF EXISTS public.condominiums;
DROP TABLE IF EXISTS public.organizations;

COMMIT;
