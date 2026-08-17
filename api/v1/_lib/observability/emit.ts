/**
 * G7-G — Build / emit operational events (in-process sink only).
 * NOT a production Event Store. NOT a database table.
 */

import { redactObservabilityValue } from './redact';
import { classifyRetry } from './retryPolicy';
import { eventsForOutcome, operationalStatusFromErrorCode } from './statusMap';
import type {
  OperationalEventEnvelope,
  OperationalEventName,
  OperationClassification,
  OperationalStatus
} from './types';

function newEventId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `evt_${rand}`;
}

export type EmitSink = {
  emit(event: OperationalEventEnvelope): void;
  list(): OperationalEventEnvelope[];
  clear(): void;
};

/** Test / local sink — never use as production audit authority. */
export function createMemoryEventSink(): EmitSink {
  const events: OperationalEventEnvelope[] = [];
  return {
    emit(event) {
      events.push(event);
    },
    list() {
      return [...events];
    },
    clear() {
      events.length = 0;
    }
  };
}

export type BuildEventInput = {
  event_name: OperationalEventName;
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
  core_executed?: boolean | null;
  duration_ms?: number | null;
  external_ref?: string | null;
  attributes?: Record<string, unknown>;
  occurred_at?: string;
};

export function buildOperationalEvent(input: BuildEventInput): OperationalEventEnvelope {
  const attrs = input.attributes
    ? (redactObservabilityValue(input.attributes) as Record<
        string,
        string | number | boolean | null
      >)
    : undefined;

  return {
    event_id: newEventId(),
    event_name: input.event_name,
    occurred_at: input.occurred_at || new Date().toISOString(),
    request_id: input.request_id,
    correlation_id: input.correlation_id ?? null,
    client_id: input.client_id ?? null,
    organization_id: input.organization_id ?? null,
    condominium_id: input.condominium_id ?? null,
    operation: input.operation ?? null,
    classification: input.classification ?? null,
    status: input.status,
    http_status: input.http_status ?? null,
    error_code: input.error_code ?? null,
    retry_hint: input.retry_hint ?? null,
    retry_class: classifyRetry({
      errorCode: input.error_code,
      classification: input.classification,
      httpStatus: input.http_status
    }),
    core_executed: input.core_executed ?? null,
    duration_ms: input.duration_ms ?? null,
    external_ref: input.external_ref ?? null,
    ...(attrs ? { attributes: attrs } : {})
  };
}

export type OutcomeObservation = {
  request_id: string;
  correlation_id?: string | null;
  client_id?: string | null;
  organization_id?: string | null;
  condominium_id?: string | null;
  operation?: string | null;
  classification?: OperationClassification | null;
  success: boolean;
  http_status: number;
  error_code?: string | null;
  retry_hint?: string | null;
  core_executed?: boolean | null;
  duration_ms?: number | null;
  external_ref?: string | null;
  idempotencyReplay?: boolean;
  confirmationRequired?: boolean;
  confirmationConsumed?: boolean;
  authzDenied?: boolean;
  authRejected?: boolean;
};

/** Derive the minimal event sequence for one API outcome. */
export function observeOutcome(
  outcome: OutcomeObservation,
  sink?: EmitSink
): OperationalEventEnvelope[] {
  const names = eventsForOutcome(outcome);
  const status = outcome.success
    ? outcome.idempotencyReplay
      ? 'duplicate'
      : outcome.core_executed
        ? 'executed'
        : 'completed'
    : operationalStatusFromErrorCode(outcome.error_code);

  // Refine success statuses
  let finalStatus = status;
  if (outcome.success && outcome.core_executed) finalStatus = 'completed';
  if (outcome.idempotencyReplay) finalStatus = 'duplicate';
  if (outcome.confirmationConsumed && outcome.success) finalStatus = 'confirmation_consumed';

  const built = names.map((event_name) =>
    buildOperationalEvent({
      event_name,
      request_id: outcome.request_id,
      correlation_id: outcome.correlation_id,
      client_id: outcome.client_id,
      organization_id: outcome.organization_id,
      condominium_id: outcome.condominium_id,
      operation: outcome.operation,
      classification: outcome.classification,
      status:
        event_name === 'confirmation.required'
          ? 'confirmation_required'
          : event_name === 'confirmation.consumed'
            ? 'confirmation_consumed'
            : event_name === 'request.denied' || event_name === 'request.rejected'
              ? 'rejected'
              : event_name === 'idempotency.replay'
                ? 'duplicate'
                : event_name.endsWith('.failed')
                  ? operationalStatusFromErrorCode(outcome.error_code)
                  : finalStatus,
      http_status: outcome.http_status,
      error_code: outcome.error_code,
      retry_hint: outcome.retry_hint,
      core_executed: outcome.core_executed,
      duration_ms: outcome.duration_ms,
      external_ref: outcome.external_ref
    })
  );

  if (sink) {
    for (const e of built) sink.emit(e);
  }
  return built;
}

/** Correlation chain helper (document as code). */
export function buildCorrelationChain(opts: {
  whatsapp_message_id?: string | null;
  n8n_execution_id?: string | null;
  request_id: string;
  correlation_id?: string | null;
}): {
  whatsapp_message_id: string | null;
  n8n_execution_id: string | null;
  request_id: string;
  correlation_id: string | null;
  note: string;
} {
  return {
    whatsapp_message_id: opts.whatsapp_message_id ?? null,
    n8n_execution_id: opts.n8n_execution_id ?? null,
    request_id: opts.request_id,
    correlation_id: opts.correlation_id ?? null,
    note: 'request_id correlates API↔Core↔response; correlation_id groups conversation/retries. Neither is a secret.'
  };
}

export const PIPELINE_STAGES = [
  'http',
  'hmac',
  'tenant',
  'authz',
  'classification',
  'idempotency',
  'confirmation',
  'core',
  'adapter',
  'database',
  'response'
] as const;
