-- =============================================================================
-- G7-J ROLLBACK — 008_api_domain_events
-- =============================================================================
-- Status: PREPARED — NÃO executar sem autorização explícita
-- Project: zaemlxjwhzrfmowbckmk
-- Companion: 20260815220000_008_api_domain_events.sql
--
-- Remove SOMENTE:
--   DROP TABLE public.api_domain_events
--
-- Regras:
--   - SEM CASCADE (falha se houver dependências inesperadas)
--   - SEM IF EXISTS (falha se a tabela não existir — rollback intencional)
--   - NÃO altera M1–M4 / G6-1 / G6-2 / G7-C / domínio operacional
--   - NÃO DROP organizations / condominiums / outras tabelas
--
-- Pré-condição:
--   Nenhum objeto externo deve referenciar api_domain_events.
--   Wiring G7-J-W NÃO deve estar ativo em produção sem plano de remoção.
-- =============================================================================

BEGIN;

DROP TABLE public.api_domain_events;

COMMIT;
