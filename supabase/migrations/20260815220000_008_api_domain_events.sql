-- =============================================================================
-- G7-J — 008_api_domain_events
-- =============================================================================
-- Nome lógico: 008_api_domain_events
-- Gate: G7-J / Event Store (auditoria operacional)
-- Status: PREPARED / NOT EXECUTED / AWAITING DEEP REVIEW + LIVE PRE-CHECK + APPLY
-- Project alvo (produção): zaemlxjwhzrfmowbckmk
-- Spec: docs/SENTINELA-AUT-G7-I-EVENT-STORE-DECISION.md
--       docs/SENTINELA-AUT-G7-J-EVENT-STORE.md
-- Pré-requisito: G7-I = PASS (EVENT STORE = NECESSÁRIO)
--                M1–M4 / G6-1 / G6-2 / G7-C CLOSED (não ALTER)
--
-- Objetivo:
--   Persistência append-only tenant-scoped de eventos de auditoria
--   da Sentinela API (observabilidade G7-G/H-A → sink futuro G7-J-W).
--
-- Cria:
--   public.api_domain_events
--
-- NÃO faz:
--   ALTER M1–M4 / G6-1 / G6-2 / G7-C / domínio operacional;
--   INSERT/UPDATE/DELETE/seed/backfill;
--   triggers de negócio; cron/purge;
--   wiring da API (G7-J-W = gate separado);
--   endpoint de consulta; n8n; WhatsApp;
--   USING (true) / policies permissivas.
--
-- Tenant:
--   organization_id + condominium_id NOT NULL + FKs ON DELETE RESTRICT
--   (padrão G6). Eventos SEM tenant validado NÃO entram nesta tabela
--   (permanecem em logs) — wiring G7-J-W.
--
-- Append-only (runtime):
--   INSERT apenas. Sem UPDATE/DELETE pela aplicação.
--   RLS ENABLED sem policies → anon/authenticated bloqueados;
--   service_role bypassa RLS (padrão Supabase) e é o único caminho server-side.
--
-- Persistidos (CHECK event_type):
--   request.rejected | request.denied | confirmation.required |
--   confirmation.consumed | idempotency.replay | core.failed |
--   operation.completed | operation.failed
--   (idempotency.created OMITIDO — volume; G7-I opcional)
--
-- Retenção (documental — sem cron nesta migration):
--   operacional 90d; segurança (rejected/denied) 180d → gate futuro.
--
-- Pré-check LIVE (READ-ONLY):
--   docs/evidence/M-G7J-EVENT-STORE-PRECHECK-LIVE.sql
--
-- NÃO executar sem: deep review PASS + pré-check live PASS + autorização APPLY.
-- Rollback: 20260815220000_008_api_domain_events.rollback.sql
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Guards fail-closed
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION
      'G7-J BLOCKED: public.organizations missing — M1 required';
  END IF;

  IF to_regclass('public.condominiums') IS NULL THEN
    RAISE EXCEPTION
      'G7-J BLOCKED: public.condominiums missing — M1 required';
  END IF;

  IF to_regclass('public.api_domain_events') IS NOT NULL THEN
    RAISE EXCEPTION
      'G7-J BLOCKED: public.api_domain_events already exists — investigate before APPLY';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- api_domain_events
-- ---------------------------------------------------------------------------
CREATE TABLE public.api_domain_events (
  event_id text PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  request_id text NOT NULL,
  organization_id uuid NOT NULL,
  condominium_id uuid NOT NULL,
  client_id text NULL,
  correlation_id text NULL,
  operation text NULL,
  event_type text NOT NULL,
  status text NOT NULL,
  source text NOT NULL DEFAULT 'api.v1',
  classification text NULL,
  http_status integer NULL,
  error_code text NULL,
  retry_class text NULL,
  core_executed boolean NOT NULL DEFAULT false,
  duration_ms integer NULL,
  external_ref text NULL,
  confirmation_id text NULL,
  attributes jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT api_domain_events_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations (id)
    ON DELETE RESTRICT,

  CONSTRAINT api_domain_events_condominium_id_fkey
    FOREIGN KEY (condominium_id)
    REFERENCES public.condominiums (id)
    ON DELETE RESTRICT,

  CONSTRAINT api_domain_events_event_id_nonempty_check
    CHECK (length(trim(event_id)) > 0),

  CONSTRAINT api_domain_events_event_id_prefix_check
    CHECK (event_id LIKE 'evt_%'),

  CONSTRAINT api_domain_events_request_id_nonempty_check
    CHECK (length(trim(request_id)) > 0),

  CONSTRAINT api_domain_events_event_type_check
    CHECK (event_type IN (
      'request.rejected',
      'request.denied',
      'confirmation.required',
      'confirmation.consumed',
      'idempotency.replay',
      'core.failed',
      'operation.completed',
      'operation.failed'
    )),

  CONSTRAINT api_domain_events_status_nonempty_check
    CHECK (length(trim(status)) > 0),

  CONSTRAINT api_domain_events_source_nonempty_check
    CHECK (length(trim(source)) > 0),

  CONSTRAINT api_domain_events_classification_check
    CHECK (
      classification IS NULL
      OR classification IN ('READ', 'WRITE', 'SENSITIVE')
    ),

  CONSTRAINT api_domain_events_confirmation_id_prefix_check
    CHECK (
      confirmation_id IS NULL
      OR confirmation_id LIKE 'cnf_%'
    ),

  CONSTRAINT api_domain_events_duration_ms_nonneg_check
    CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

-- Painel / feed recente por tenant
CREATE INDEX idx_api_domain_events_tenant_occurred
  ON public.api_domain_events (organization_id, condominium_id, occurred_at DESC);

-- Correlação ponta a ponta (mesmo request pode ter N eventos)
CREATE INDEX idx_api_domain_events_request_id
  ON public.api_domain_events (request_id);

-- Filtro painel por tipo (falhas, confirmações, etc.)
CREATE INDEX idx_api_domain_events_tenant_type_occurred
  ON public.api_domain_events (organization_id, condominium_id, event_type, occurred_at DESC);

-- Fail-closed para clientes PostgREST: RLS on + zero policies.
-- service_role bypassa RLS (somente server-side / API admin futura).
ALTER TABLE public.api_domain_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.api_domain_events IS
  'Sentinela API Event Store (G7-J). Append-only auditoria operacional. NÃO é domínio. NÃO usado pelo Core para regras. Sem cron/purge nesta migration. RLS ON sem policies (anon/auth bloqueados). Wiring = G7-J-W.';

COMMENT ON COLUMN public.api_domain_events.event_id IS
  'PK. Formato evt_… (mesmo envelope observability).';

COMMENT ON COLUMN public.api_domain_events.occurred_at IS
  'Timestamp do evento no envelope (UTC).';

COMMENT ON COLUMN public.api_domain_events.request_id IS
  'Correlação API↔Core↔resposta. Não é segredo. Não UNIQUE (N eventos / request).';

COMMENT ON COLUMN public.api_domain_events.organization_id IS
  'FK → organizations.id. Obrigatório. Fail-closed tenant.';

COMMENT ON COLUMN public.api_domain_events.condominium_id IS
  'FK → condominiums.id. Obrigatório. Fail-closed tenant.';

COMMENT ON COLUMN public.api_domain_events.event_type IS
  'Subset G7-I persistido. Intermediate events (received/authorized/core.started|completed) = logs only.';

COMMENT ON COLUMN public.api_domain_events.attributes IS
  'JSONB já redacted (whitelist). Sem HMAC/token/body/mídia/SQL/stack.';

COMMENT ON COLUMN public.api_domain_events.confirmation_id IS
  'Id cnf_… somente. Nunca confirmation_token nem hash de token.';

COMMENT ON COLUMN public.api_domain_events.external_ref IS
  'Referência opaca/truncada (ex. hash wamid). Nunca payload WhatsApp bruto.';

COMMENT ON COLUMN public.api_domain_events.core_executed IS
  'Semântica G7-H-A: true se Core rodou; false em reject/deny/replay/confirmation_required.';

COMMIT;
