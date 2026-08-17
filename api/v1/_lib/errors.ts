/**
 * SENTINELA API v1 — error codes (G1–G7-D)
 */

export const ApiErrorCodes = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  /** Reservation empty/inverted time range (G7-D) */
  INVALID_TIME_RANGE: 'INVALID_TIME_RANGE',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  /** Alias G4 naming */
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  /** @deprecated prefer UNAUTHENTICATED */
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  TIMESTAMP_EXPIRED: 'TIMESTAMP_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  TENANT_REQUIRED: 'TENANT_REQUIRED',
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  /** Credential org/condo vs request headers (alias of TENANT_MISMATCH) */
  CREDENTIAL_TENANT_MISMATCH: 'CREDENTIAL_TENANT_MISMATCH',
  /** Alias G4 naming */
  TENANT_INVALID: 'TENANT_INVALID',
  RESIDENT_NOT_FOUND: 'RESIDENT_NOT_FOUND',
  AMBIGUOUS_RESIDENT: 'AMBIGUOUS_RESIDENT',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
  CONFIRMATION_REQUIRED: 'CONFIRMATION_REQUIRED',
  CONFIRMATION_INVALID: 'CONFIRMATION_INVALID',
  CONFIRMATION_EXPIRED: 'CONFIRMATION_EXPIRED',
  /** @deprecated prefer CONFIRMATION_ALREADY_CONSUMED */
  CONFIRMATION_ALREADY_USED: 'CONFIRMATION_ALREADY_USED',
  CONFIRMATION_ALREADY_CONSUMED: 'CONFIRMATION_ALREADY_CONSUMED',
  /** Persistent confirmation/idempotency store not configured (prod) */
  CONFIRMATION_STORE_UNAVAILABLE: 'CONFIRMATION_STORE_UNAVAILABLE',
  IDEMPOTENCY_KEY_REQUIRED: 'IDEMPOTENCY_KEY_REQUIRED',
  IDEMPOTENCY_STORE_UNAVAILABLE: 'IDEMPOTENCY_STORE_UNAVAILABLE',
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  /** Same Idempotency-Key, different body fingerprint */
  IDEMPOTENCY_FINGERPRINT_MISMATCH: 'IDEMPOTENCY_FINGERPRINT_MISMATCH',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  GATE_PENDING: 'GATE_PENDING',
  WRITES_DISABLED: 'WRITES_DISABLED'
} as const;

export type ApiErrorCode = (typeof ApiErrorCodes)[keyof typeof ApiErrorCodes];

export function httpStatusForCode(code: ApiErrorCode): number {
  switch (code) {
    case ApiErrorCodes.INVALID_REQUEST:
    case ApiErrorCodes.INVALID_TIME_RANGE:
    case ApiErrorCodes.TENANT_REQUIRED:
    case ApiErrorCodes.TENANT_INVALID:
    case ApiErrorCodes.IDEMPOTENCY_KEY_REQUIRED:
      return 400;
    case ApiErrorCodes.UNAUTHENTICATED:
    case ApiErrorCodes.AUTHENTICATION_FAILED:
    case ApiErrorCodes.UNAUTHORIZED:
    case ApiErrorCodes.INVALID_SIGNATURE:
    case ApiErrorCodes.TIMESTAMP_EXPIRED:
      return 401;
    case ApiErrorCodes.FORBIDDEN:
    case ApiErrorCodes.OPERATION_NOT_ALLOWED:
    case ApiErrorCodes.TENANT_MISMATCH:
    case ApiErrorCodes.CREDENTIAL_TENANT_MISMATCH:
      return 403;
    case ApiErrorCodes.TENANT_NOT_FOUND:
    case ApiErrorCodes.RESIDENT_NOT_FOUND:
    case ApiErrorCodes.RESOURCE_NOT_FOUND:
      return 404;
    case ApiErrorCodes.CONFLICT:
    case ApiErrorCodes.DUPLICATE_REQUEST:
    case ApiErrorCodes.IDEMPOTENCY_FINGERPRINT_MISMATCH:
    case ApiErrorCodes.AMBIGUOUS_RESIDENT:
    case ApiErrorCodes.NEEDS_CONFIRMATION:
    case ApiErrorCodes.CONFIRMATION_REQUIRED:
    case ApiErrorCodes.CONFIRMATION_INVALID:
    case ApiErrorCodes.CONFIRMATION_EXPIRED:
    case ApiErrorCodes.CONFIRMATION_ALREADY_USED:
    case ApiErrorCodes.CONFIRMATION_ALREADY_CONSUMED:
      return 409;
    case ApiErrorCodes.RATE_LIMITED:
      return 429;
    case ApiErrorCodes.METHOD_NOT_ALLOWED:
      return 405;
    case ApiErrorCodes.GATE_PENDING:
    case ApiErrorCodes.WRITES_DISABLED:
    case ApiErrorCodes.CONFIRMATION_STORE_UNAVAILABLE:
    case ApiErrorCodes.IDEMPOTENCY_STORE_UNAVAILABLE:
      return 501;
    case ApiErrorCodes.INTERNAL_ERROR:
    default:
      return 500;
  }
}

const SENSITIVE_DETAIL_KEYS = new Set([
  'stack',
  'sql',
  'query',
  'hint',
  'password',
  'secret',
  'token',
  'service_role',
  'serviceRole',
  'authorization',
  'pg_detail',
  'detail',
  'schema',
  'table',
  'constraint',
  'file',
  'routine'
]);

/** Strip internals before returning details to n8n/external consumers. */
export function sanitizePublicDetails(
  details?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!details) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    const key = k.toLowerCase();
    if (SENSITIVE_DETAIL_KEYS.has(key)) continue;
    if (typeof v === 'string' && /password|service.role|BEGIN|SELECT |INSERT /i.test(v)) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}
