-- =============================================================================
-- M-G6-1 ROLLBACK — 005_api_idempotency_keys
-- =============================================================================
-- Status: PREPARED — NÃO executar sem autorização explícita
-- Project: zaemlxjwhzrfmowbckmk
-- Companion: 20260814190000_005_api_idempotency_keys.sql
--
-- Remove:
--   DROP TABLE public.api_idempotency_keys
--
-- Regras:
--   - SEM CASCADE (falha se houver dependências inesperadas)
--   - SEM IF EXISTS (falha se a tabela não existir — rollback intencional)
--   - NÃO altera M1–M4 / tabelas operacionais / RLS
--
-- Pré-condição:
--   Nenhum objeto externo deve referenciar api_idempotency_keys.
--   Se houver FK de outra tabela → DROP falha (desejado).
-- =============================================================================

BEGIN;

DROP TABLE public.api_idempotency_keys;

COMMIT;
