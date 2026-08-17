/**
 * G7-G — Map API outcomes → operational status + event names.
 */

import { ApiErrorCodes } from '../errors';
import type { OperationalEventName, OperationalStatus } from './types';

export function operationalStatusFromErrorCode(
  errorCode: string | null | undefined
): OperationalStatus {
  if (!errorCode) return 'completed';
  switch (errorCode) {
    case ApiErrorCodes.CONFIRMATION_REQUIRED:
      return 'confirmation_required';
    case ApiErrorCodes.CONFIRMATION_ALREADY_CONSUMED:
    case ApiErrorCodes.CONFIRMATION_ALREADY_USED:
      return 'confirmation_consumed';
    case ApiErrorCodes.NEEDS_CONFIRMATION:
    case ApiErrorCodes.AMBIGUOUS_RESIDENT:
      return 'needs_confirmation';
    case ApiErrorCodes.CONFLICT:
      return 'conflict';
    case ApiErrorCodes.DUPLICATE_REQUEST:
    case ApiErrorCodes.IDEMPOTENCY_FINGERPRINT_MISMATCH:
      return 'duplicate';
    case ApiErrorCodes.FORBIDDEN:
    case ApiErrorCodes.OPERATION_NOT_ALLOWED:
    case ApiErrorCodes.TENANT_MISMATCH:
    case ApiErrorCodes.CREDENTIAL_TENANT_MISMATCH:
    case ApiErrorCodes.TENANT_REQUIRED:
    case ApiErrorCodes.TENANT_NOT_FOUND:
    case ApiErrorCodes.TENANT_INVALID:
    case ApiErrorCodes.UNAUTHENTICATED:
    case ApiErrorCodes.AUTHENTICATION_FAILED:
    case ApiErrorCodes.UNAUTHORIZED:
    case ApiErrorCodes.INVALID_SIGNATURE:
    case ApiErrorCodes.TIMESTAMP_EXPIRED:
      return 'rejected';
    case ApiErrorCodes.INVALID_REQUEST:
    case ApiErrorCodes.INVALID_TIME_RANGE:
    case ApiErrorCodes.IDEMPOTENCY_KEY_REQUIRED:
    case ApiErrorCodes.RESOURCE_NOT_FOUND:
    case ApiErrorCodes.RESIDENT_NOT_FOUND:
    case ApiErrorCodes.METHOD_NOT_ALLOWED:
      return 'rejected';
    default:
      return 'failed';
  }
}

export function eventsForOutcome(opts: {
  success: boolean;
  errorCode?: string | null;
  core_executed?: boolean | null;
  coreExecuted?: boolean | null;
  idempotencyReplay?: boolean;
  confirmationRequired?: boolean;
  confirmationConsumed?: boolean;
  authzDenied?: boolean;
  authRejected?: boolean;
}): OperationalEventName[] {
  const events: OperationalEventName[] = ['request.received'];
  const coreExecuted = opts.coreExecuted === true || opts.core_executed === true;

  if (opts.authRejected) {
    events.push('request.rejected');
    events.push('operation.failed');
    return events;
  }

  if (opts.authzDenied) {
    events.push('request.denied');
    events.push('operation.failed');
    return events;
  }

  events.push('request.authorized');

  if (opts.idempotencyReplay) {
    events.push('idempotency.replay');
    events.push('operation.completed');
    return events;
  }

  if (opts.confirmationRequired || opts.errorCode === ApiErrorCodes.CONFIRMATION_REQUIRED) {
    events.push('confirmation.required');
    events.push('operation.failed');
    return events;
  }

  if (opts.confirmationConsumed) {
    events.push('confirmation.consumed');
  }

  if (coreExecuted) {
    events.push('core.started');
    if (opts.success) {
      events.push('core.completed');
      events.push('idempotency.created');
      events.push('operation.completed');
    } else {
      events.push('core.failed');
      events.push('operation.failed');
    }
    return events;
  }

  if (opts.success) {
    events.push('operation.completed');
  } else {
    events.push('operation.failed');
  }
  return events;
}
