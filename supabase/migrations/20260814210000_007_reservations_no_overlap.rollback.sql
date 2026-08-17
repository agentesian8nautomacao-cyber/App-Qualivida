-- =============================================================================
-- M-G7C-1 ROLLBACK — 007_reservations_no_overlap
-- =============================================================================
-- Status: PREPARED — NÃO executar sem autorização explícita
-- Project: zaemlxjwhzrfmowbckmk
-- Companion: 20260814210000_007_reservations_no_overlap.sql
--
-- Remove SOMENTE:
--   ALTER TABLE public.reservations
--     DROP CONSTRAINT reservations_area_date_slot_excl;
--
-- Regras:
--   - SEM CASCADE
--   - SEM IF EXISTS (falha se a constraint não existir — rollback intencional)
--   - SEM DELETE / UPDATE de linhas em reservations
--   - SEM DROP TABLE
--   - SEM DROP EXTENSION btree_gist (compartilhada; não criada exclusivamente aqui)
--   - NÃO altera M1–M4 / G6-1 / G6-2 / demais colunas
--
-- Pré-condição:
--   Confirmar LIVE que a constraint existe antes do rollback.
-- =============================================================================

BEGIN;

ALTER TABLE public.reservations
  DROP CONSTRAINT reservations_area_date_slot_excl;

COMMIT;
