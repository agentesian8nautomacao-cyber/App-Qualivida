-- =============================================================================
-- M-G6-1 — 005_api_idempotency_keys  (REVISED — R1 LAZY RECLAIM)
-- =============================================================================
-- Nome lógico: 005_api_idempotency_keys
-- Gate: M-G6-1 / G6 Idempotency Store
-- Status: REVISED / NOT EXECUTED / AWAITING DEEP REVIEW
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Spec: docs/SENTINELA-AUT-G6-IDEMPOTENCY.md
-- Deep review: SENTINELA-G6-1-IDEMPOTENCY-DEEP-REVIEW-2026-08-14.txt (NEEDS REVISION)
-- Revision:  SENTINELA-G6-1-IDEMPOTENCY-REVISION-2026-08-14.txt
-- Decisão: R1 LAZY RECLAIM (não R2 exclusion; não R3 single-use permanente)
--
-- Objetivo:
--   Persistência tenant-scoped de Idempotency-Key para operações WRITE
--   da Sentinela API (proteção contra retries n8n/WhatsApp).
--
-- Cria:
--   public.api_idempotency_keys
--
-- NÃO faz:
--   Confirmation Store; Event Store; M5+; ALTER legado;
--   INSERT/UPDATE/DELETE/seed/backfill; RLS/policies;
--   triggers; cron/cleanup; alteração M1–M4;
--   wiring da API; n8n; WhatsApp.
--
-- UNIQUE (MANTIDA):
--   (organization_id, condominium_id, idempotency_key)
--   → serializa concorrência; impede duas rows ativas da mesma key no tenant.
--
-- TTL lógico (48h):
--   expires_at NOT NULL; app define created_at + 48 hours.
--   expires_at NÃO remove nem libera automaticamente a chave.
--   A UNIQUE permanece após expires_at até LAZY RECLAIM (API).
--   Sem cron / trigger / job nesta migration.
--
-- R1 — LAZY RECLAIM (contrato para wiring futuro da API — NÃO é trigger):
--   Antes de claim/create (sempre tenant-scoped):
--     1) SELECT pela chave (organization_id, condominium_id, idempotency_key)
--     2) Se NÃO existe → INSERT in_progress
--     3) Se existe E expires_at > now() → chave ATIVA:
--          fingerprint igual → replay conforme status (in_progress/completed/failed)
--          fingerprint diferente → DUPLICATE_REQUEST (não reclaim)
--     4) Se existe E expires_at <= now() → chave EXPIRADA:
--          DELETE tenant-scoped da row expirada
--            WHERE organization_id = $org
--              AND condominium_id = $condo
--              AND idempotency_key = $key
--              AND expires_at <= now()
--          NUNCA DELETE só por idempotency_key
--          depois tentar INSERT da nova operação
--   Concorrência: executar reclaim+INSERT em TRANSAÇÃO; tratar unique_violation
--     com re-SELECT (outro worker pode ter reclamado/inserido primeiro).
--   Ver docs/SENTINELA-AUT-G6-IDEMPOTENCY.md § Lazy Reclaim.
--
-- Tenant:
--   organization_id + condominium_id obrigatórios (sem tenant_id genérico).
--   FKs separadas (padrão M3). Consistência org↔condo = API (residual M3 DR7).
--
-- RLS:
--   NÃO criado. Fail-closed na API. Acesso: service-role server-side only.
--
-- Pré-check LIVE (READ-ONLY — ANTES do APPLY):
--   Ver docs/evidence/M-G6-1-PRECHECK-LIVE.sql
--
-- NÃO executar sem: deep review PASS + pré-check live + autorização APPLY.
-- Rollback: 20260814190000_005_api_idempotency_keys.rollback.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Guards fail-closed
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION
      'M-G6-1 BLOCKED: public.organizations missing — M1 required';
  END IF;

  IF to_regclass('public.condominiums') IS NULL THEN
    RAISE EXCEPTION
      'M-G6-1 BLOCKED: public.condominiums missing — M1 required';
  END IF;

  IF to_regclass('public.api_idempotency_keys') IS NOT NULL THEN
    RAISE EXCEPTION
      'M-G6-1 BLOCKED: public.api_idempotency_keys already exists — investigate before APPLY';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- api_idempotency_keys
-- ---------------------------------------------------------------------------
CREATE TABLE public.api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  condominium_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  fingerprint text NOT NULL,
  operation text NOT NULL,
  request_id text NOT NULL,
  status text NOT NULL,
  response_status integer NULL,
  response_body jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  completed_at timestamptz NULL,

  CONSTRAINT api_idempotency_keys_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations (id)
    ON DELETE RESTRICT,

  CONSTRAINT api_idempotency_keys_condominium_id_fkey
    FOREIGN KEY (condominium_id)
    REFERENCES public.condominiums (id)
    ON DELETE RESTRICT,

  CONSTRAINT api_idempotency_keys_org_condo_key_key
    UNIQUE (organization_id, condominium_id, idempotency_key),

  CONSTRAINT api_idempotency_keys_status_check
    CHECK (status IN ('in_progress', 'completed', 'failed')),

  CONSTRAINT api_idempotency_keys_idempotency_key_nonempty_check
    CHECK (length(trim(idempotency_key)) > 0),

  CONSTRAINT api_idempotency_keys_fingerprint_nonempty_check
    CHECK (length(trim(fingerprint)) > 0),

  CONSTRAINT api_idempotency_keys_operation_nonempty_check
    CHECK (length(trim(operation)) > 0),

  CONSTRAINT api_idempotency_keys_request_id_nonempty_check
    CHECK (length(trim(request_id)) > 0),

  CONSTRAINT api_idempotency_keys_expires_after_created_check
    CHECK (expires_at > created_at),

  -- Coerência de estado terminal (D2 deep review)
  CONSTRAINT api_idempotency_keys_completed_coherence_check
    CHECK (
      status <> 'completed'
      OR (
        response_body IS NOT NULL
        AND response_status IS NOT NULL
        AND completed_at IS NOT NULL
      )
    ),

  CONSTRAINT api_idempotency_keys_failed_coherence_check
    CHECK (
      status <> 'failed'
      OR (
        response_status IS NOT NULL
        AND completed_at IS NOT NULL
      )
    )
);

-- Índice para localizar expiradas no lazy reclaim (sem cron)
CREATE INDEX idx_api_idempotency_keys_expires_at
  ON public.api_idempotency_keys (expires_at);

CREATE INDEX idx_api_idempotency_keys_tenant
  ON public.api_idempotency_keys (organization_id, condominium_id);

COMMENT ON TABLE public.api_idempotency_keys IS
  'Sentinela API Idempotency Store (G6-1 REVISED). Tenant-scoped UNIQUE. TTL lógico 48h via expires_at NÃO libera sozinho — R1 lazy reclaim na API (DELETE tenant-scoped se expires_at<=now() antes de novo INSERT). Sem trigger/cron/RLS nesta migration.';

COMMENT ON COLUMN public.api_idempotency_keys.organization_id IS
  'FK → organizations.id. Obrigatório. Sem fallback global. Parte do escopo UNIQUE e do DELETE de reclaim.';

COMMENT ON COLUMN public.api_idempotency_keys.condominium_id IS
  'FK → condominiums.id (site). Obrigatório. Parte do escopo UNIQUE e do DELETE de reclaim.';

COMMENT ON COLUMN public.api_idempotency_keys.idempotency_key IS
  'Header Idempotency-Key. Único por (organization_id, condominium_id). Nunca reclaim/DELETE só por esta coluna.';

COMMENT ON COLUMN public.api_idempotency_keys.fingerprint IS
  'SHA-256 hex do raw body. Key ativa + fingerprint diferente = conflito (não reclaim).';

COMMENT ON COLUMN public.api_idempotency_keys.operation IS
  'Nome da operação Core (ex.: create_package).';

COMMENT ON COLUMN public.api_idempotency_keys.request_id IS
  'request_id da requisição que criou/completou o registro.';

COMMENT ON COLUMN public.api_idempotency_keys.status IS
  'in_progress | completed | failed. completed exige response_body+response_status+completed_at; failed exige response_status+completed_at.';

COMMENT ON COLUMN public.api_idempotency_keys.response_status IS
  'HTTP status cacheado; obrigatório em completed/failed; NULL em in_progress.';

COMMENT ON COLUMN public.api_idempotency_keys.response_body IS
  'Envelope JSON cacheado (sem secrets). Obrigatório em completed; opcional em failed; NULL em in_progress.';

COMMENT ON COLUMN public.api_idempotency_keys.expires_at IS
  'Retenção lógica (app: created_at+48h). NÃO remove/libera a key automaticamente. Reclaim = API DELETE tenant-scoped quando expires_at<=now().';

COMMENT ON COLUMN public.api_idempotency_keys.completed_at IS
  'Obrigatório quando status IN (completed, failed); NULL em in_progress.';

COMMIT;
