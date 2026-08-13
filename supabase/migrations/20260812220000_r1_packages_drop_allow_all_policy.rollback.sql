-- =============================================================================
-- R1 ROLLBACK — recriar policy global "Allow all operations on packages"
-- =============================================================================
-- Usar SOMENTE se a remoção R1 causar regressão crítica e for necessário
-- restaurar o comportamento anterior (aberto).
--
-- ATENÇÃO: recria postura insegura (USING/WITH CHECK true para public).
-- Preferir restore de backup se outras mudanças tiverem ocorrido.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "Allow all operations on packages" ON public.packages;

CREATE POLICY "Allow all operations on packages"
  ON public.packages
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

COMMIT;
