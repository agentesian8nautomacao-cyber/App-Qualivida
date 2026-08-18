-- =============================================================================
-- Master subscription/access admin — 012_master_subscription_admin
-- =============================================================================
-- Status: PREPARED / NOT EXECUTED
-- NÃO APPLY automático. Não altera M5 / platform_admins / is_platform_admin().
--
-- Complementa 011 com colunas de situação CONTRATUAL/ADMINISTRATIVA,
-- separadas do status OPERACIONAL (organizations.status).
--
-- NÃO cria:
--   pagamento, PIX, gateway, fatura, valor, banco, cartão, MRR.
-- =============================================================================

BEGIN;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS current_period_start date NULL,
  ADD COLUMN IF NOT EXISTS current_period_end date NULL,
  ADD COLUMN IF NOT EXISTS renewal_at date NULL,
  ADD COLUMN IF NOT EXISTS grace_started_at date NULL,
  ADD COLUMN IF NOT EXISTS grace_ends_at date NULL,
  ADD COLUMN IF NOT EXISTS auto_block_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regularized_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS regularized_by uuid NULL,
  ADD COLUMN IF NOT EXISTS administrative_notes text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_subscription_status_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_subscription_status_check
      CHECK (subscription_status IN (
        'active', 'overdue', 'grace', 'suspended', 'terminated', 'cancelled'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.organizations.subscription_status IS
  'Situação administrativa da assinatura. Independente de organizations.status (operação). Sem dado financeiro.';
COMMENT ON COLUMN public.organizations.auto_block_enabled IS
  'Se true, após fim da tolerância o Master aplica bloqueio operacional automático (block_source=automatic).';

COMMIT;
