-- =============================================================================
-- R1 — Remediação packages: remover SOMENTE a policy global "Allow all"
-- =============================================================================
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Evidência: docs/evidence/results/D2-STORAGE-LIVE-2026-08-12.txt
-- Diagnóstico: docs/evidence/SECURITY-REMEDIATION-PLAN-2026-08-12.md §1
--
-- Escopo:
--   DROP POLICY "Allow all operations on packages" ON public.packages
--
-- NÃO faz:
--   alterar as 6 policies da migration 006;
--   outras tabelas; Storage; staff_invites; funções; dados.
--
-- Idempotente: DROP POLICY IF EXISTS
-- Rollback: ver docs/evidence/R1-PACKAGES-ALLOW-ALL-REMEDIATION.md
--             e arquivo sibling *.rollback.sql
--
-- NÃO executar em produção sem autorização explícita.
-- =============================================================================

BEGIN;

-- Pré-condição documental (operador deve validar via SQL antes/depois):
--   SELECT policyname FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'packages'
--   ORDER BY 1;
-- Esperado ANTES: Allow all + 6 policies 006
-- Esperado DEPOIS: apenas as 6 policies 006

DROP POLICY IF EXISTS "Allow all operations on packages" ON public.packages;

COMMIT;
