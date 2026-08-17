-- =============================================================================
-- M3 ROLLBACK — 003_tenant_memberships
-- =============================================================================
-- Status: PREPARED — NÃO executar sem autorização explícita
-- Project: zaemlxjwhzrfmowbckmk
-- Companion: 20260814170000_003_tenant_memberships.sql
--
-- Restaura ausência da tabela M3:
--   DROP TABLE public.tenant_memberships
--
-- Condição de segurança:
--   Somente se M11 (dados) / M12+ (helpers/policies) ainda não dependerem
--   desta tabela.
--
-- NÃO usar CASCADE.
-- Se dependências posteriores existirem, o DROP falha (desejável).
-- NÃO altera: organizations, condominiums, roles, residents, staff, auth.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS public.tenant_memberships;

COMMIT;
