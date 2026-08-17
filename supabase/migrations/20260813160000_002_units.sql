-- =============================================================================
-- M2 — 002_units
-- =============================================================================
-- Nome lógico: 002_units
-- Status: PREPARED / NOT EXECUTED
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Spec: docs/FASE-1-MIGRATION-PLAN.md § M2
--       docs/FASE-1-ARQUITETURA-MULTITENANT.md (§ 4 UNIT)
--       docs/OPERAUT-ARCHITECTURE-ADDENDUM.md (UNIT = espaço do site)
-- Decisões: docs/evidence/results/M2-DECISIONS-2026-08-13.txt (DR1–DR7 CLOSED)
-- Readiness: docs/evidence/results/M2-READINESS-REVIEW-2026-08-13.txt
--
-- Objetivo:
--   Criar catálogo UNIT (espaços do Operational Site).
--   Tenant boundary: condominium_id (= site_id no piloto).
--   Schema vazio; sem seed/backfill.
--
-- Cadeia: organizations → condominiums → units
--
-- Cria:
--   public.units
--
-- NÃO faz:
--   ALTER organizations/condominiums/legado; organization_id em units;
--   tenant_id; memberships; users/staff; seed; backfill;
--   RLS / policies; Storage; Functions; Triggers; M3/M4.
--
-- Pré-check LIVE (READ-ONLY — ANTES do APPLY):
--   Ver docs/evidence/M2-PRECHECK-LIVE.sql
--   Esperado: organizations/condominiums EXISTS; units ABSENT.
--
-- NÃO executar sem: revisão humana + pré-check live + autorização APPLY.
-- Rollback: 20260813160000_002_units.rollback.sql
--   (somente se FKs M5+ / unit_id ainda não existirem)
-- =============================================================================

BEGIN;

-- Guard: falha se units já existir (não usar IF NOT EXISTS)
DO $$
BEGIN
  IF to_regclass('public.units') IS NOT NULL THEN
    RAISE EXCEPTION
      'M2 BLOCKED: public.units already exists — investigate before APPLY';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- units = UNIT do Operational Site (condominium_id ≡ site_id)
-- UNIQUE (condominium_id, code) — namespace por condomínio
-- ---------------------------------------------------------------------------
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL,
  code text NOT NULL,
  block text NULL,
  number text NULL,
  label text NULL,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT units_condominium_id_fkey
    FOREIGN KEY (condominium_id)
    REFERENCES public.condominiums (id)
    ON DELETE RESTRICT,
  CONSTRAINT units_condominium_id_code_key
    UNIQUE (condominium_id, code)
);

COMMENT ON TABLE public.units IS
  'UNIT — espaço físico/lógico do Operational Site. Tenant boundary: condominium_id (= site_id). M2 — sem RLS.';

COMMENT ON COLUMN public.units.condominium_id IS
  'FK → condominiums.id (Operational Site). Tenant boundary do catálogo units; cadeia org → condo → unit.';

COMMENT ON COLUMN public.units.code IS
  'Identificador da unidade, único dentro do condominium.';

COMMENT ON COLUMN public.units.block IS
  'Bloco/torre opcional; NULL quando o site não usa blocos.';

COMMENT ON COLUMN public.units.number IS
  'Número/identificador alfanumérico de apresentação (ex.: 101, 101A); NULL opcional.';

COMMENT ON COLUMN public.units.label IS
  'Rótulo auxiliar de apresentação; NULL opcional.';

COMMENT ON COLUMN public.units.status IS
  'Estado operacional da unit (default active). Sem ENUM/CHECK no M2.';

COMMENT ON COLUMN public.units.metadata IS
  'Metadados opcionais (jsonb); sem DEFAULT. Estrutura interna definida pelo app.';

-- Pós-APPLY (validação; NÃO parte automática deste arquivo):
--   to_regclass('public.units')
--   UNIQUE (condominium_id, code); FK ON DELETE RESTRICT
--   COUNT(*) = 0; legado inalterado
--   Sem seed aqui (M4 / backfill posteriores)

COMMIT;
