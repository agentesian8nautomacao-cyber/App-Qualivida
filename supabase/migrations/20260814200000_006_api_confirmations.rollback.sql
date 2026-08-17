-- =============================================================================
-- M-G6-2 ROLLBACK — 006_api_confirmations
-- =============================================================================
-- Status: PREPARED — NÃO executar sem autorização explícita
-- Project: zaemlxjwhzrfmowbckmk
-- Companion: 20260814200000_006_api_confirmations.sql
--
-- Remove SOMENTE:
--   DROP TABLE public.api_confirmations
--
-- Regras:
--   - SEM CASCADE (falha se houver dependências inesperadas)
--   - SEM IF EXISTS (falha se a tabela não existir — rollback intencional)
--   - NÃO altera M1–M4 / G6-1 (api_idempotency_keys) / domínio operacional
--   - NÃO DROP organizations / condominiums / outras tabelas
--
-- Pré-condição:
--   Nenhum objeto externo deve referenciar api_confirmations.
--   Se houver FK de outra tabela → DROP falha (desejado).
--
-- Guard documental:
--   Confirmar LIVE que to_regclass('public.api_confirmations') IS NOT NULL
--   e que nenhuma FK externa aponta para esta tabela antes do rollback.
-- =============================================================================

BEGIN;

DROP TABLE public.api_confirmations;

COMMIT;
