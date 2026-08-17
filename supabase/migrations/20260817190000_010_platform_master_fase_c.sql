-- =============================================================================
-- FASE C — Platform Master (010_platform_master_fase_c)
-- =============================================================================
-- Status: PREPARED / NOT EXECUTED (não APPLY automático)
-- Project alvo: zaemlxjwhzrfmowbckmk
-- Spec: docs/MASTER-ARCHITECTURE.md
--
-- Cria:
--   public.platform_admins
--   public.platform_audit_events
--   public.is_platform_admin()   -- usa SOMENTE auth.uid(); sem UUID de cliente
--
-- Policies ADITIVAS em organizations / condominiums (SELECT/UPDATE Master).
--
-- NÃO faz:
--   ALTER residents / users / roles / tenant_memberships;
--   platform_plans / organization_subscriptions;
--   M5; M8; seed de senhas; INSERT de e-mails.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.platform_admins') IS NOT NULL THEN
    RAISE EXCEPTION
      'MASTER FASE C BLOCKED: public.platform_admins already exists';
  END IF;
  IF to_regclass('public.platform_audit_events') IS NOT NULL THEN
    RAISE EXCEPTION
      'MASTER FASE C BLOCKED: public.platform_audit_events already exists';
  END IF;
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION
      'MASTER FASE C BLOCKED: public.organizations missing — M1 required';
  END IF;
  IF to_regclass('public.condominiums') IS NULL THEN
    RAISE EXCEPTION
      'MASTER FASE C BLOCKED: public.condominiums missing — M1 required';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- platform_admins — IAM de plataforma (NÃO é public.roles / membership)
-- user_id = auth.users.id (unicidade). Sem condominium_id. Sem senha/token.
-- ---------------------------------------------------------------------------
CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  CONSTRAINT platform_admins_user_id_key UNIQUE (user_id),
  CONSTRAINT platform_admins_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  CONSTRAINT platform_admins_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users (id)
    ON DELETE SET NULL,
  CONSTRAINT platform_admins_role_check
    CHECK (role IN ('platform_owner', 'platform_admin')),
  CONSTRAINT platform_admins_status_check
    CHECK (status IN ('active', 'suspended'))
);

CREATE INDEX idx_platform_admins_status ON public.platform_admins (status);

COMMENT ON TABLE public.platform_admins IS
  'Platform IAM. Separado de public.roles e tenant_memberships. Sem condominium_id.';
COMMENT ON COLUMN public.platform_admins.user_id IS
  'FK auth.users.id. Identidade Master. UNIQUE.';
COMMENT ON COLUMN public.platform_admins.status IS
  'active autoriza Master; suspended permanece na tabela mas NÃO autoriza.';

-- ---------------------------------------------------------------------------
-- is_platform_admin — SOMENTE sessão JWT (auth.uid()). Sem argumento.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
      AND pa.status = 'active'
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'True se auth.uid() é platform_admin/owner com status=active. Não aceita UUID do cliente.';

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM anon;

-- ---------------------------------------------------------------------------
-- platform_audit_events
-- ---------------------------------------------------------------------------
CREATE TABLE public.platform_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL,
  resource_type text NULL,
  resource_id text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT platform_audit_events_actor_user_id_fkey
    FOREIGN KEY (actor_user_id)
    REFERENCES auth.users (id)
    ON DELETE RESTRICT
);

CREATE INDEX idx_platform_audit_events_occurred_at
  ON public.platform_audit_events (occurred_at DESC);
CREATE INDEX idx_platform_audit_events_actor
  ON public.platform_audit_events (actor_user_id);
CREATE INDEX idx_platform_audit_events_action
  ON public.platform_audit_events (action);

COMMENT ON TABLE public.platform_audit_events IS
  'Trilha Master. Sem senha/token/JWT. Distinta de admin_audit_logs operacional.';

-- ---------------------------------------------------------------------------
-- RLS novas tabelas — sem USING true; sem role anon
-- ---------------------------------------------------------------------------
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_admins_select_self
  ON public.platform_admins
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY platform_audit_select_admin
  ON public.platform_audit_events
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY platform_audit_insert_admin
  ON public.platform_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND public.is_platform_admin()
  );

CREATE POLICY platform_audit_insert_access_denied
  ON public.platform_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    actor_user_id = auth.uid()
    AND action = 'MASTER_ACCESS_DENIED'
  );

-- ---------------------------------------------------------------------------
-- organizations / condominiums — policies ADITIVAS (não DROP)
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.condominiums ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select_platform_admin
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY organizations_update_platform_admin
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

CREATE POLICY condominiums_select_platform_admin
  ON public.condominiums
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

-- Grants: sem anon. authenticated só o necessário; RLS continua fail-closed.
REVOKE ALL ON public.platform_admins FROM PUBLIC;
REVOKE ALL ON public.platform_admins FROM anon;
REVOKE ALL ON public.platform_audit_events FROM PUBLIC;
REVOKE ALL ON public.platform_audit_events FROM anon;
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT SELECT, INSERT ON public.platform_audit_events TO authenticated;
GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT ON public.condominiums TO authenticated;

COMMIT;
