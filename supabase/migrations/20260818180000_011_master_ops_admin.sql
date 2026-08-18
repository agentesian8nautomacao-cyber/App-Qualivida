-- =============================================================================
-- Master ops admin — 011_master_ops_admin
-- =============================================================================
-- Status: PREPARED / NOT EXECUTED
-- NÃO APPLY automático. Não altera M5 / platform_admins / is_platform_admin().
--
-- Objetivo:
--   Campos de perfil/contrato/bloqueio operacional em organizations e
--   condominiums + INSERT/UPDATE para platform admin (JWT + RLS).
--
-- NÃO cria:
--   módulo financeiro, gateway, cobrança, PIX, faturas.
-- =============================================================================

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS block_reason text NULL,
  ADD COLUMN IF NOT EXISTS block_source text NULL,
  ADD COLUMN IF NOT EXISTS scheduled_block_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS contract_starts_at date NULL,
  ADD COLUMN IF NOT EXISTS contract_ends_at date NULL;

ALTER TABLE public.condominiums
  ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS block_reason text NULL,
  ADD COLUMN IF NOT EXISTS block_source text NULL,
  ADD COLUMN IF NOT EXISTS scheduled_block_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_block_source_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_block_source_check
      CHECK (block_source IS NULL OR block_source IN ('manual', 'automatic'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'condominiums_block_source_check'
  ) THEN
    ALTER TABLE public.condominiums
      ADD CONSTRAINT condominiums_block_source_check
      CHECK (block_source IS NULL OR block_source IN ('manual', 'automatic'));
  END IF;
END $$;

DROP POLICY IF EXISTS organizations_insert_platform_admin ON public.organizations;
CREATE POLICY organizations_insert_platform_admin
  ON public.organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS condominiums_insert_platform_admin ON public.condominiums;
CREATE POLICY condominiums_insert_platform_admin
  ON public.condominiums
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS condominiums_update_platform_admin ON public.condominiums;
CREATE POLICY condominiums_update_platform_admin
  ON public.condominiums
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

GRANT INSERT ON public.organizations TO authenticated;
GRANT INSERT, UPDATE ON public.condominiums TO authenticated;

COMMENT ON COLUMN public.organizations.profile IS
  'Dados cadastrais da empresa contratante (não financeiro).';
COMMENT ON COLUMN public.organizations.block_source IS
  'manual | automatic — decisão do Master, sem gateway de pagamento.';

COMMIT;
