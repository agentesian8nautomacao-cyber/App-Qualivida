-- =============================================================================
-- M1 — 001_platform_org_condo
-- =============================================================================
-- Nome lógico: 001_platform_org_condo
-- Status: PREPARED / NOT EXECUTED
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Spec: docs/FASE-1-MIGRATION-PLAN.md § M1
--       docs/FASE-1-ARQUITETURA-MULTITENANT.md (§ Organization / Condominium)
--       docs/OPERAUT-ARCHITECTURE-ADDENDUM.md (§ site = condominiums)
-- Readiness: docs/evidence/results/M1-READINESS-CHECK-2026-08-13.txt
--
-- Objetivo:
--   Criar Organization + Operational Site (tabela condominiums, vertical
--   condomínio) como raiz de isolamento. Schema vazio; sem seed/backfill.
--
-- Cria:
--   public.organizations
--   public.condominiums  (COMMENT: Operational Site — vertical condominium)
--
-- NÃO faz:
--   ALTER em tabelas operacionais; tenant_id / condominium_id em legado;
--   seed (M4); backfill; memberships; users/staff/roles/permissions;
--   RLS / policies; Storage; Functions; Triggers; event tables;
--   operational_sites genérica.
--
-- Pré-check LIVE (READ-ONLY — executar no SQL Editor ANTES do APPLY):
--   Ver docs/evidence/M1-PRECHECK-LIVE.sql
--   Se to_regclass(...) IS NOT NULL → STOP / BLOCKED.
--
-- NÃO executar sem: revisão humana + pré-check live + autorização APPLY.
-- Rollback: 20260813150000_001_platform_org_condo.rollback.sql
--   (somente se M4 ainda não populou FKs dependentes)
-- =============================================================================

BEGIN;

-- Guard: falha se tabelas já existirem (evita CREATE silencioso / IF NOT EXISTS)
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NOT NULL THEN
    RAISE EXCEPTION
      'M1 BLOCKED: public.organizations already exists — investigate before APPLY';
  END IF;
  IF to_regclass('public.condominiums') IS NOT NULL THEN
    RAISE EXCEPTION
      'M1 BLOCKED: public.condominiums already exists — investigate before APPLY';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- organizations (Organization / B2B)
-- Campos: id, name, slug, status, timestamps
--   (FASE-1-ARQUITETURA-MULTITENANT.md § 2)
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_key UNIQUE (slug)
);

CREATE INDEX idx_organizations_status ON public.organizations (status);

COMMENT ON TABLE public.organizations IS
  'Organization (B2B). Raiz de isolamento; 1 → N Operational Sites (condominiums). M1 — sem RLS.';

COMMENT ON COLUMN public.organizations.slug IS
  'Identificador URL-safe único global.';

COMMENT ON COLUMN public.organizations.status IS
  'Estado operacional da org (default active). Valores de domínio: app/M posteriores.';

-- ---------------------------------------------------------------------------
-- condominiums = Operational Site — vertical condominium
-- Campos: organization_id, name, vertical, slug, status, timestamps
--   (FASE-1-MIGRATION-PLAN § M1; OPERAUT-ARCHITECTURE-ADDENDUM § M1)
-- name: inclusão por simetria com organizations + identificação humana
--   (piloto Qualivida); ver M1-SQL-CREATION-REVIEW se precisar aprovação.
-- ---------------------------------------------------------------------------
CREATE TABLE public.condominiums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  vertical text NOT NULL DEFAULT 'condominium',
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT condominiums_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations (id)
    ON DELETE RESTRICT,
  CONSTRAINT condominiums_organization_id_slug_key
    UNIQUE (organization_id, slug),
  CONSTRAINT condominiums_vertical_check
    CHECK (vertical = 'condominium')
);

CREATE INDEX idx_condominiums_organization_id
  ON public.condominiums (organization_id);

CREATE INDEX idx_condominiums_status
  ON public.condominiums (status);

-- idx_condominiums_vertical removido: vertical fixo por CHECK (= 'condominium');
-- sem seletividade útil no piloto. Ver M1-SQL-REVISION-2026-08-13.txt.

COMMENT ON TABLE public.condominiums IS
  'Operational Site — vertical condominium. No piloto, condominium_id ≡ site_id. M1 — sem RLS.';

COMMENT ON COLUMN public.condominiums.organization_id IS
  'FK → organizations.id (cardinalidade org 1 → N sites).';

COMMENT ON COLUMN public.condominiums.vertical IS
  'Vertical Operaut; M1 fixa condominium (CHECK). Outras verticais = fora de M1–M16.';

COMMENT ON COLUMN public.condominiums.slug IS
  'Identificador URL-safe único dentro da organization.';

COMMENT ON COLUMN public.condominiums.status IS
  'Estado operacional do site (default active).';

-- Pós-APPLY (validação; NÃO parte automática deste arquivo):
--   SELECT to_regclass('public.organizations'), to_regclass('public.condominiums');
--   -- FK / UNIQUE / CHECK vertical via information_schema / pg_constraint
--   -- Smoke app legado inalterado
--   -- Sem seed aqui (M4)

COMMIT;
