/**
 * G7-H-A — Pipeline emit helpers (no business logic).
 */

import { classifyOperation } from '../ops/classification';
import { safeEmit, safeEmitOnce } from './runtime';
import type { OperationClassification, OperationalStatus } from './types';
import { operationalStatusFromErrorCode } from './statusMap';
import { httpStatusForCode, type ApiErrorCode } from '../errors';

export type ObsBase = {
  request_id: string;
  correlation_id?: string | null;
  client_id?: string | null;
  /** Only set after tenant validated */
  organization_id?: string | null;
  condominium_id?: string | null;
  operation?: string | null;
  classification?: OperationClassification | null;
  duration_ms?: number | null;
};

function classOf(operation?: string | null): OperationClassification | null {
  if (!operation) return null;
  return classifyOperation(operation);
}

export function emitRequestReceived(base: ObsBase): void {
  safeEmitOnce({
    event_name: 'request.received',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: base.classification ?? classOf(base.operation),
    status: 'accepted',
    core_executed: false
  });
}

export function emitRequestRejected(
  base: ObsBase,
  errorCode: string,
  opts?: { trustTenant?: boolean }
): void {
  safeEmitOnce({
    event_name: 'request.rejected',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: opts?.trustTenant ? base.organization_id : null,
    condominium_id: opts?.trustTenant ? base.condominium_id : null,
    operation: base.operation,
    classification: base.classification ?? classOf(base.operation),
    status: 'rejected',
    error_code: errorCode,
    http_status: httpStatusForCode(errorCode as ApiErrorCode),
    core_executed: false
  });
}

export function emitRequestAuthorized(base: ObsBase): void {
  safeEmitOnce({
    event_name: 'request.authorized',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: base.classification ?? classOf(base.operation),
    status: 'authorized',
    core_executed: false
  });
}

export function emitRequestDenied(base: ObsBase, errorCode: string): void {
  safeEmitOnce({
    event_name: 'request.denied',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: base.classification ?? classOf(base.operation),
    status: 'rejected',
    error_code: errorCode,
    http_status: httpStatusForCode(errorCode as ApiErrorCode),
    core_executed: false
  });
}

export function emitIdempotencyReplay(base: ObsBase): void {
  safeEmit({
    event_name: 'idempotency.replay',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: 'WRITE',
    status: 'duplicate',
    http_status: 200,
    core_executed: false,
    attributes: { idempotency: 'replay' }
  });
}

export function emitIdempotencyCreated(base: ObsBase): void {
  safeEmit({
    event_name: 'idempotency.created',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: 'WRITE',
    status: 'completed',
    core_executed: true,
    attributes: { idempotency: 'created' }
  });
}

export function emitConfirmationRequired(base: ObsBase, confirmationId?: string | null): void {
  safeEmit({
    event_name: 'confirmation.required',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: 'SENSITIVE',
    status: 'confirmation_required',
    error_code: 'CONFIRMATION_REQUIRED',
    http_status: 409,
    core_executed: false,
    attributes: confirmationId ? { confirmation_id: confirmationId } : undefined
  });
}

export function emitConfirmationConsumed(base: ObsBase, confirmationId?: string | null): void {
  safeEmit({
    event_name: 'confirmation.consumed',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: 'SENSITIVE',
    status: 'confirmation_consumed',
    core_executed: false,
    attributes: confirmationId ? { confirmation_id: confirmationId } : undefined
  });
}

export function emitCoreStarted(base: ObsBase): void {
  safeEmit({
    event_name: 'core.started',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: base.classification ?? classOf(base.operation),
    status: 'executed',
    core_executed: true
  });
}

export function emitCoreCompleted(base: ObsBase): void {
  safeEmit({
    event_name: 'core.completed',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: base.classification ?? classOf(base.operation),
    status: 'completed',
    http_status: 200,
    core_executed: true,
    duration_ms: base.duration_ms
  });
}

export function emitCoreFailed(base: ObsBase, errorCode: string, retryHint?: string | null): void {
  const status: OperationalStatus = operationalStatusFromErrorCode(errorCode);
  safeEmit({
    event_name: 'core.failed',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: base.classification ?? classOf(base.operation),
    status,
    error_code: errorCode,
    http_status: httpStatusForCode(errorCode as ApiErrorCode),
    retry_hint: retryHint ?? null,
    core_executed: true,
    duration_ms: base.duration_ms
  });
}

export function emitOperationCompleted(base: ObsBase, opts?: { core_executed?: boolean }): void {
  safeEmit({
    event_name: 'operation.completed',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: base.classification ?? classOf(base.operation),
    status: 'completed',
    http_status: 200,
    core_executed: opts?.core_executed ?? true,
    duration_ms: base.duration_ms
  });
}

export function emitOperationFailed(
  base: ObsBase,
  errorCode: string,
  opts?: { core_executed?: boolean; retry_hint?: string | null }
): void {
  safeEmit({
    event_name: 'operation.failed',
    request_id: base.request_id,
    correlation_id: base.correlation_id,
    client_id: base.client_id,
    organization_id: base.organization_id,
    condominium_id: base.condominium_id,
    operation: base.operation,
    classification: base.classification ?? classOf(base.operation),
    status: operationalStatusFromErrorCode(errorCode),
    error_code: errorCode,
    http_status: httpStatusForCode(errorCode as ApiErrorCode),
    retry_hint: opts?.retry_hint ?? null,
    core_executed: opts?.core_executed ?? false,
    duration_ms: base.duration_ms
  });
}

export function obsBaseFromAuthz(
  requestId: string,
  correlationId: string | null | undefined,
  authz: {
    client_id: string;
    organization_id: string;
    condominium_id: string;
  },
  operation: string
): ObsBase {
  return {
    request_id: requestId,
    correlation_id: correlationId,
    client_id: authz.client_id,
    organization_id: authz.organization_id,
    condominium_id: authz.condominium_id,
    operation,
    classification: classOf(operation)
  };
}
