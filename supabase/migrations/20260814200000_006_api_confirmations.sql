-- =============================================================================
-- M-G6-2 — 006_api_confirmations
-- =============================================================================
-- Nome lógico: 006_api_confirmations
-- Gate: M-G6-2 / G6 Confirmation Store
-- Status: PREPARED / NOT EXECUTED / AWAITING DEEP REVIEW
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Spec: docs/SENTINELA-AUT-G6-CONFIRMATIONS.md
-- Decisões: docs/evidence/results/SENTINELA-G6-2-DECISIONS-2026-08-14.txt (DR1–DR20 CLOSED)
-- Pré-requisito operacional: G6-1 CLOSED/PASS (api_idempotency_keys) — não ALTER
--
-- Objetivo:
--   Persistência tenant-scoped de confirmações single-use para SENSITIVE:
--     pickup_package, cancel_reservation
--
-- Cria:
--   public.api_confirmations
--
-- NÃO faz:
--   ALTER G6-1 / M1–M4 / domínio legado;
--   INSERT/UPDATE/DELETE/seed/backfill;
--   RLS / policies / triggers / cron;
--   Event Store; wiring API; n8n; WhatsApp;
--   clamp de TTL no DDL (TTL/clamp = API: default 300s, 30–3600);
--   persistência de confirmation_token plaintext.
--
-- Token:
--   Somente token_hash (SHA-256 hex). Plaintext nunca nesta tabela.
--
-- Fingerprint (DR5):
--   operation_fingerprint = SHA-256 canônico (API):
--     sentinela-confirm/v1 \n org \n condo \n operation \n resource_id
--
-- Consumo atômico (wiring futuro — NÃO é trigger):
--   UPDATE … SET status='consumed', consumed_at=$now
--   WHERE confirmation_id=$id AND org/condo match
--     AND status='pending' AND consumed_at IS NULL AND expires_at > $now
--   RETURNING *
--
-- Tenant:
--   organization_id + condominium_id obrigatórios.
--   FKs separadas ON DELETE RESTRICT (sem FK composta org↔condo).
--
-- RLS:
--   NÃO criado. Fail-closed na API. service-role server-side.
--
-- Pré-check LIVE (READ-ONLY — ANTES do APPLY):
--   Ver docs/evidence/M-G6-2-PRECHECK-LIVE.sql
--
-- NÃO executar sem: deep review PASS + pré-check live + autorização APPLY.
-- Rollback: 20260814200000_006_api_confirmations.rollback.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Guards fail-closed
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION
      'M-G6-2 BLOCKED: public.organizations missing — M1 required';
  END IF;

  IF to_regclass('public.condominiums') IS NULL THEN
    RAISE EXCEPTION
      'M-G6-2 BLOCKED: public.condominiums missing — M1 required';
  END IF;

  IF to_regclass('public.api_confirmations') IS NOT NULL THEN
    RAISE EXCEPTION
      'M-G6-2 BLOCKED: public.api_confirmations already exists — investigate before APPLY';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- api_confirmations
-- ---------------------------------------------------------------------------
CREATE TABLE public.api_confirmations (
  confirmation_id text PRIMARY KEY,
  token_hash text NOT NULL,
  organization_id uuid NOT NULL,
  condominium_id uuid NOT NULL,
  client_id text NOT NULL,
  operation text NOT NULL,
  resource_id text NOT NULL,
  operation_fingerprint text NOT NULL,
  status text NOT NULL,
  prompt text NOT NULL,
  requester_identity text NULL,
  created_request_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,

  CONSTRAINT api_confirmations_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations (id)
    ON DELETE RESTRICT,

  CONSTRAINT api_confirmations_condominium_id_fkey
    FOREIGN KEY (condominium_id)
    REFERENCES public.condominiums (id)
    ON DELETE RESTRICT,

  CONSTRAINT api_confirmations_operation_check
    CHECK (operation IN ('pickup_package', 'cancel_reservation')),

  CONSTRAINT api_confirmations_status_check
    CHECK (status IN ('pending', 'consumed')),

  CONSTRAINT api_confirmations_pending_not_consumed_check
    CHECK (
      status <> 'pending'
      OR consumed_at IS NULL
    ),

  CONSTRAINT api_confirmations_consumed_coherence_check
    CHECK (
      status <> 'consumed'
      OR consumed_at IS NOT NULL
    ),

  CONSTRAINT api_confirmations_confirmation_id_nonempty_check
    CHECK (length(trim(confirmation_id)) > 0),

  CONSTRAINT api_confirmations_confirmation_id_prefix_check
    CHECK (confirmation_id LIKE 'cnf_%'),

  CONSTRAINT api_confirmations_token_hash_nonempty_check
    CHECK (length(trim(token_hash)) > 0),

  CONSTRAINT api_confirmations_client_id_nonempty_check
    CHECK (length(trim(client_id)) > 0),

  CONSTRAINT api_confirmations_resource_id_nonempty_check
    CHECK (length(trim(resource_id)) > 0),

  CONSTRAINT api_confirmations_fingerprint_nonempty_check
    CHECK (length(trim(operation_fingerprint)) > 0),

  CONSTRAINT api_confirmations_prompt_nonempty_check
    CHECK (length(trim(prompt)) > 0),

  CONSTRAINT api_confirmations_expires_after_created_check
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_api_confirmations_expires_at
  ON public.api_confirmations (expires_at);

CREATE INDEX idx_api_confirmations_tenant
  ON public.api_confirmations (organization_id, condominium_id);

COMMENT ON TABLE public.api_confirmations IS
  'Sentinela API Confirmation Store (G6-2). Tenant-scoped single-use for SENSITIVE ops. token plaintext NEVER stored (token_hash only). TTL/clamp in API (default 300s). Sem RLS/trigger/cron nesta migration. Consume atômico = wiring UPDATE pending→consumed.';

COMMENT ON COLUMN public.api_confirmations.confirmation_id IS
  'PK. Formato lógico cnf_… gerado na API. Nunca reutilizar após consumed.';

COMMENT ON COLUMN public.api_confirmations.token_hash IS
  'SHA-256 hex do confirmation_token. Plaintext NÃO persistido.';

COMMENT ON COLUMN public.api_confirmations.organization_id IS
  'FK → organizations.id. Parte do tenant boundary e do fingerprint.';

COMMENT ON COLUMN public.api_confirmations.condominium_id IS
  'FK → condominiums.id. Parte do tenant boundary e do fingerprint.';

COMMENT ON COLUMN public.api_confirmations.client_id IS
  'X-Sentinela-Client-Id da credential que criou o desafio.';

COMMENT ON COLUMN public.api_confirmations.operation IS
  'pickup_package | cancel_reservation only.';

COMMENT ON COLUMN public.api_confirmations.resource_id IS
  'Recurso alvo (package id / reservation id).';

COMMENT ON COLUMN public.api_confirmations.operation_fingerprint IS
  'SHA-256 canônico sentinela-confirm/v1 + org + condo + operation + resource_id. ≠ G6-1 idempotency fingerprint.';

COMMENT ON COLUMN public.api_confirmations.status IS
  'pending | consumed. Expiração lógica via expires_at (sem status expired).';

COMMENT ON COLUMN public.api_confirmations.prompt IS
  'Texto do desafio exibido ao canal/humano.';

COMMENT ON COLUMN public.api_confirmations.expires_at IS
  'Limite temporal. App: created_at + TTL (default 300s). Sem clamp no DDL.';

COMMENT ON COLUMN public.api_confirmations.consumed_at IS
  'Preenchido somente quando status=consumed. Mapeia used_at do contrato TypeScript G4.';

COMMENT ON COLUMN public.api_confirmations.created_request_id IS
  'Observabilidade opcional (request_id da create). Não é controle de segurança.';

COMMIT;
