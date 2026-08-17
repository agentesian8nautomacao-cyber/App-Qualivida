/**
 * G7-G — Operational observability types (no Event Store / no migration).
 */

export type OperationClassification = 'READ' | 'WRITE' | 'SENSITIVE';

/** Minimal operational event names — do not explode into dozens. */
export const OperationalEventNames = [
  'request.received',
  'request.rejected',
  'request.authorized',
  'request.denied',
  'idempotency.replay',
  'idempotency.created',
  'confirmation.required',
  'confirmation.consumed',
  'core.started',
  'core.completed',
  'core.failed',
  'operation.completed',
  'operation.failed'
] as const;

export type OperationalEventName = (typeof OperationalEventNames)[number];

/**
 * Operational status vocabulary (observability layer).
 * Complements — does not replace — ApiErrorCodes / HTTP contract (G7-D/E).
 */
export const OperationalStatuses = [
  'accepted',
  'rejected',
  'authorized',
  'executed',
  'completed',
  'failed',
  'conflict',
  'confirmation_required',
  'confirmation_consumed',
  'duplicate',
  'needs_confirmation'
] as const;

export type OperationalStatus = (typeof OperationalStatuses)[number];

export type RetryClass = 'SAFE_RETRY' | 'CONTROLLED_RETRY' | 'NO_RETRY' | 'RETRY_AFTER_CHANGE';

/** Internal event envelope — safe for logs / future store. Never holds secrets. */
export type OperationalEventEnvelope = {
  event_id: string;
  event_name: OperationalEventName;
  occurred_at: string;
  request_id: string;
  correlation_id?: string | null;
  client_id?: string | null;
  organization_id?: string | null;
  condominium_id?: string | null;
  operation?: string | null;
  classification?: OperationClassification | null;
  status: OperationalStatus;
  http_status?: number | null;
  error_code?: string | null;
  retry_hint?: string | null;
  retry_class?: RetryClass | null;
  core_executed?: boolean | null;
  duration_ms?: number | null;
  /** Opaque external id hash / truncated — never full WhatsApp body */
  external_ref?: string | null;
  /** Non-sensitive attrs only */
  attributes?: Record<string, string | number | boolean | null>;
};

export type PipelineStage =
  | 'http'
  | 'hmac'
  | 'tenant'
  | 'authz'
  | 'classification'
  | 'idempotency'
  | 'confirmation'
  | 'core'
  | 'adapter'
  | 'database'
  | 'response';
