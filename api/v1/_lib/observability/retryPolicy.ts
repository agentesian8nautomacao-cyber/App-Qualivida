/**
 * G7-G — Retry classification for automation (n8n) — documentation as code.
 */

import { ApiErrorCodes, type ApiErrorCode } from '../errors';
import type { OperationClassification, RetryClass } from './types';

export function classifyRetry(opts: {
  errorCode?: string | null;
  classification?: OperationClassification | null;
  httpStatus?: number | null;
}): RetryClass {
  const code = (opts.errorCode || '') as ApiErrorCode | string;

  // Success / empty → no automatic retry needed
  if (!code) return 'NO_RETRY';

  switch (code) {
    case ApiErrorCodes.INVALID_TIME_RANGE:
    case ApiErrorCodes.INVALID_REQUEST:
    case ApiErrorCodes.IDEMPOTENCY_KEY_REQUIRED:
    case ApiErrorCodes.IDEMPOTENCY_FINGERPRINT_MISMATCH:
    case ApiErrorCodes.AUTHENTICATION_FAILED:
    case ApiErrorCodes.UNAUTHENTICATED:
    case ApiErrorCodes.UNAUTHORIZED:
    case ApiErrorCodes.INVALID_SIGNATURE:
    case ApiErrorCodes.TIMESTAMP_EXPIRED:
    case ApiErrorCodes.FORBIDDEN:
    case ApiErrorCodes.OPERATION_NOT_ALLOWED:
    case ApiErrorCodes.TENANT_MISMATCH:
    case ApiErrorCodes.TENANT_REQUIRED:
    case ApiErrorCodes.TENANT_NOT_FOUND:
    case ApiErrorCodes.TENANT_INVALID:
    case ApiErrorCodes.CREDENTIAL_TENANT_MISMATCH:
    case ApiErrorCodes.RESOURCE_NOT_FOUND:
    case ApiErrorCodes.RESIDENT_NOT_FOUND:
    case ApiErrorCodes.METHOD_NOT_ALLOWED:
    case ApiErrorCodes.CONFIRMATION_REQUIRED:
    case ApiErrorCodes.CONFIRMATION_INVALID:
    case ApiErrorCodes.CONFIRMATION_EXPIRED:
    case ApiErrorCodes.CONFIRMATION_ALREADY_CONSUMED:
    case ApiErrorCodes.CONFIRMATION_ALREADY_USED:
    case ApiErrorCodes.NEEDS_CONFIRMATION:
    case ApiErrorCodes.DUPLICATE_REQUEST:
      return 'NO_RETRY';

    case ApiErrorCodes.CONFLICT:
      return 'RETRY_AFTER_CHANGE';

    case ApiErrorCodes.RATE_LIMITED:
    case ApiErrorCodes.INTERNAL_ERROR:
    case ApiErrorCodes.IDEMPOTENCY_STORE_UNAVAILABLE:
    case ApiErrorCodes.CONFIRMATION_STORE_UNAVAILABLE:
    case ApiErrorCodes.GATE_PENDING:
    case ApiErrorCodes.WRITES_DISABLED:
      return 'SAFE_RETRY';

    default:
      break;
  }

  if (opts.httpStatus && opts.httpStatus >= 500) return 'SAFE_RETRY';

  if (opts.classification === 'WRITE') return 'SAFE_RETRY'; // only with same Idempotency-Key
  if (opts.classification === 'SENSITIVE') return 'CONTROLLED_RETRY';
  return 'NO_RETRY';
}

export function describeRetryPolicy(): Record<
  string,
  { class: RetryClass; note: string }
> {
  return {
    create_package: {
      class: 'SAFE_RETRY',
      note: 'WRITE + Idempotency-Key — same key on timeout/5xx'
    },
    create_occurrence: {
      class: 'SAFE_RETRY',
      note: 'WRITE + Idempotency-Key'
    },
    update_occurrence: {
      class: 'SAFE_RETRY',
      note: 'WRITE + Idempotency-Key'
    },
    create_reservation: {
      class: 'SAFE_RETRY',
      note: 'WRITE + Idempotency-Key; CONFLICT → RETRY_AFTER_CHANGE'
    },
    pickup_package: {
      class: 'CONTROLLED_RETRY',
      note: 'SENSITIVE — never blind retry after confirmation consume'
    },
    cancel_reservation: {
      class: 'CONTROLLED_RETRY',
      note: 'SENSITIVE — never blind retry after confirmation consume'
    },
    identify_resident: {
      class: 'SAFE_RETRY',
      note: 'READ — safe to retry'
    },
    get_boleto: {
      class: 'SAFE_RETRY',
      note: 'READ — safe to retry'
    },
    INVALID_TIME_RANGE: {
      class: 'NO_RETRY',
      note: 'Fix payload with user'
    },
    AUTHENTICATION_FAILED: {
      class: 'NO_RETRY',
      note: 'Fix credentials; re-sign'
    },
    CONFIRMATION_REQUIRED: {
      class: 'NO_RETRY',
      note: 'Follow challenge flow — not automatic retry'
    },
    CONFLICT: {
      class: 'RETRY_AFTER_CHANGE',
      note: 'Change slot/resource then new Idempotency-Key'
    }
  };
}
