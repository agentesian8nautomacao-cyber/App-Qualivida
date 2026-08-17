-- =============================================================================
-- M3 — 003_tenant_memberships
-- =============================================================================
-- Nome lógico: 003_tenant_memberships
-- Status: PREPARED / NOT EXECUTED
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Spec: docs/FASE-1-MIGRATION-PLAN.md § M3
--       docs/FASE-1-ARQUITETURA-MULTITENANT.md (§5 TENANT_MEMBERSHIP)
-- Decisões: docs/evidence/results/M3-DECISIONS-2026-08-14.txt (DR1–DR7 CLOSED)
-- Readiness: docs/evidence/results/M3-READINESS-REVIEW-2026-08-14.txt
--
-- Objetivo:
--   Criar tenant_memberships: vínculo auth_user ↔ organization ↔
--   condominium/site ↔ role. Schema vazio; sem seed/backfill/RLS.
--
-- Tenant boundary:
--   condominium_id = site boundary
--   organization_id = parent organization (denormalizado)
--
-- Cria:
--   public.tenant_memberships
--
-- NÃO faz:
--   ALTER legado / organizations / condominiums / roles / residents / staff;
--   tenant_id; unit_id; FK composta org↔condo; seed; backfill;
--   RLS / policies; Functions; Triggers; M4+.
--
-- DR7 residual (aceito em M3):
--   membership.organization_id pode divergir de
--   condominiums.organization_id (sem constraint composta).
--   Enforcement: app + M4/M11; FK composta = fase futura (ALTER condo).
--
-- Pré-check LIVE (READ-ONLY — ANTES do APPLY):
--   Ver docs/evidence/M3-PRECHECK-LIVE.sql
--
-- NÃO executar sem: revisão humana + pré-check live + autorização APPLY.
-- Rollback: 20260814170000_003_tenant_memberships.rollback.sql
-- =============================================================================

BEGIN;

-- Guard: falha se tenant_memberships já existir (não usar IF NOT EXISTS)
DO $$
BEGIN
  IF to_regclass('public.tenant_memberships') IS NOT NULL THEN
    RAISE EXCEPTION
      'M3 BLOCKED: public.tenant_memberships already exists — investigate before APPLY';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- tenant_memberships — vínculo user ↔ org ↔ site ↔ role
-- UNIQUE (auth_user_id, condominium_id) — multi-site por user permitido
-- ---------------------------------------------------------------------------
CREATE TABLE public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  condominium_id uuid NOT NULL,
  role_id uuid NOT NULL,
  resident_id uuid NULL,
  staff_profile_id uuid NULL,
  status text NOT NULL DEFAULT 'active',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tenant_memberships_auth_user_id_fkey
    FOREIGN KEY (auth_user_id)
    REFERENCES auth.users (id)
    ON DELETE RESTRICT,
  CONSTRAINT tenant_memberships_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations (id)
    ON DELETE RESTRICT,
  CONSTRAINT tenant_memberships_condominium_id_fkey
    FOREIGN KEY (condominium_id)
    REFERENCES public.condominiums (id)
    ON DELETE RESTRICT,
  CONSTRAINT tenant_memberships_role_id_fkey
    FOREIGN KEY (role_id)
    REFERENCES public.roles (id)
    ON DELETE RESTRICT,
  CONSTRAINT tenant_memberships_resident_id_fkey
    FOREIGN KEY (resident_id)
    REFERENCES public.residents (id)
    ON DELETE RESTRICT,
  CONSTRAINT tenant_memberships_staff_profile_id_fkey
    FOREIGN KEY (staff_profile_id)
    REFERENCES public.staff (id)
    ON DELETE RESTRICT,
  CONSTRAINT tenant_memberships_auth_user_id_condominium_id_key
    UNIQUE (auth_user_id, condominium_id)
);

CREATE INDEX idx_tenant_memberships_condominium_id
  ON public.tenant_memberships (condominium_id);

COMMENT ON TABLE public.tenant_memberships IS
  'Membership: auth_user ↔ organization ↔ condominium/site ↔ role. Tenant boundary = condominium_id (site). M3 — sem RLS, sem seed/backfill.';

COMMENT ON COLUMN public.tenant_memberships.auth_user_id IS
  'FK → auth.users.id. Uma conta Auth, N memberships (sites/papéis diferentes).';

COMMENT ON COLUMN public.tenant_memberships.organization_id IS
  'FK → organizations.id (parent org). Denormalizado; deve coincidir com condominiums.organization_id (invariante app/M4/M11; sem FK composta em M3 — DR7).';

COMMENT ON COLUMN public.tenant_memberships.condominium_id IS
  'FK → condominiums.id (Operational Site). Tenant boundary operacional (= site_id no piloto).';

COMMENT ON COLUMN public.tenant_memberships.role_id IS
  'FK → roles.id (catálogo RBAC existente). Sem segundo RBAC.';

COMMENT ON COLUMN public.tenant_memberships.resident_id IS
  'Opcional FK → residents.id (morador). Preenchimento futuro (M11/app).';

COMMENT ON COLUMN public.tenant_memberships.staff_profile_id IS
  'Opcional FK → staff.id (perfil staff legado). Preenchimento futuro (M11/app).';

COMMENT ON COLUMN public.tenant_memberships.status IS
  'Estado da membership (default active). Valores documentados: active|invited|suspended. Sem ENUM/CHECK no M3.';

COMMENT ON COLUMN public.tenant_memberships.is_default IS
  'Sugere membership padrão ao login (default false). Contexto ativo = JWT/session (active_membership_id).';

-- Pós-APPLY (validação; NÃO parte automática deste arquivo):
--   to_regclass('public.tenant_memberships'); COUNT(*)=0
--   UNIQUE (auth_user_id, condominium_id); FKs ON DELETE RESTRICT
--   Sem seed/backfill/RLS policies neste SQL

COMMIT;
