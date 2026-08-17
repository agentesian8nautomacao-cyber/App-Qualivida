/**
 * G7-L — n8n workflow contract (code as documentation).
 * Orchestration rules only — no Core business logic, no SQL, no Supabase.
 */

import { classifyRetry } from '../observability/retryPolicy';
import type { RetryClass } from '../observability/types';
import { OPERATION_PERMISSION_MAP, type CoreOperationName } from '../authz/operations';
import { classifyOperation } from '../ops/classification';

export type N8nIntentStatus = 'supported' | 'not_supported' | 'needs_implementation';

export type N8nIntent =
  | 'IDENTIFY_RESIDENT'
  | 'IDENTIFY_UNIT'
  | 'GET_BOLETO'
  | 'CREATE_PACKAGE'
  | 'CREATE_OCCURRENCE'
  | 'UPDATE_OCCURRENCE'
  | 'CREATE_RESERVATION'
  | 'PICKUP_PACKAGE'
  | 'CANCEL_RESERVATION'
  | 'LIST_EVENTS'
  | 'PACKAGE_STATUS'
  | 'OCCURRENCE_STATUS'
  | 'RESERVATION_STATUS'
  | 'NOTIFICATION_QUERY'
  | 'NOTIFY_RESIDENT'
  | 'UNKNOWN';

export type ApiCallSpec = {
  intent: N8nIntent;
  status: N8nIntentStatus;
  operation: CoreOperationName | null;
  method: 'GET' | 'POST' | 'PATCH' | null;
  path: string | null;
  permission: string | null;
  classification: 'READ' | 'WRITE' | 'SENSITIVE' | null;
  idempotency_key: 'required' | 'forbidden' | 'n/a';
  confirmation: boolean;
  user_forwardable: boolean;
  notes: string;
};

const SUPPORTED: ApiCallSpec[] = [
  {
    intent: 'IDENTIFY_RESIDENT',
    status: 'supported',
    operation: 'identify_resident',
    method: 'GET',
    path: '/api/v1/residents/identify',
    permission: 'residents.view',
    classification: 'READ',
    idempotency_key: 'n/a',
    confirmation: false,
    user_forwardable: true,
    notes: 'Query: phone|name|unit|resident_id'
  },
  {
    intent: 'IDENTIFY_UNIT',
    status: 'supported',
    operation: 'identify_unit',
    method: 'GET',
    path: '/api/v1/units/identify',
    permission: 'residents.view',
    classification: 'READ',
    idempotency_key: 'n/a',
    confirmation: false,
    user_forwardable: true,
    notes: 'Query: unit'
  },
  {
    intent: 'GET_BOLETO',
    status: 'supported',
    operation: 'get_boleto',
    method: 'GET',
    path: '/api/v1/boletos',
    permission: 'boletos.view',
    classification: 'READ',
    idempotency_key: 'n/a',
    confirmation: false,
    user_forwardable: true,
    notes: 'Sem paths internos de arquivo'
  },
  {
    intent: 'CREATE_PACKAGE',
    status: 'supported',
    operation: 'create_package',
    method: 'POST',
    path: '/api/v1/operations/packages',
    permission: 'packages.create',
    classification: 'WRITE',
    idempotency_key: 'required',
    confirmation: false,
    user_forwardable: true,
    notes: 'WRITE — Idempotency-Key estável no retry'
  },
  {
    intent: 'CREATE_OCCURRENCE',
    status: 'supported',
    operation: 'create_occurrence',
    method: 'POST',
    path: '/api/v1/operations/occurrences',
    permission: 'occurrences.create',
    classification: 'WRITE',
    idempotency_key: 'required',
    confirmation: false,
    user_forwardable: true,
    notes: ''
  },
  {
    intent: 'UPDATE_OCCURRENCE',
    status: 'supported',
    operation: 'update_occurrence',
    method: 'PATCH',
    path: '/api/v1/operations/occurrences/update',
    permission: 'occurrences.update',
    classification: 'WRITE',
    idempotency_key: 'required',
    confirmation: false,
    user_forwardable: true,
    notes: ''
  },
  {
    intent: 'CREATE_RESERVATION',
    status: 'supported',
    operation: 'create_reservation',
    method: 'POST',
    path: '/api/v1/operations/reservations',
    permission: 'reservations.create',
    classification: 'WRITE',
    idempotency_key: 'required',
    confirmation: false,
    user_forwardable: true,
    notes: 'CONFLICT → mudar slot + nova key'
  },
  {
    intent: 'PICKUP_PACKAGE',
    status: 'supported',
    operation: 'pickup_package',
    method: 'POST',
    path: '/api/v1/operations/packages/pickup',
    permission: 'packages.update',
    classification: 'SENSITIVE',
    idempotency_key: 'forbidden',
    confirmation: true,
    user_forwardable: false,
    notes: 'Confirmation challenge; token one-shot; não encaminhar token ao canal'
  },
  {
    intent: 'CANCEL_RESERVATION',
    status: 'supported',
    operation: 'cancel_reservation',
    method: 'POST',
    path: '/api/v1/operations/reservations/cancel',
    permission: 'reservations.delete',
    classification: 'SENSITIVE',
    idempotency_key: 'forbidden',
    confirmation: true,
    user_forwardable: false,
    notes: 'Confirmation challenge'
  },
  {
    intent: 'LIST_EVENTS',
    status: 'supported',
    operation: 'list_events',
    method: 'GET',
    path: '/api/v1/events',
    permission: 'events.view',
    classification: 'READ',
    idempotency_key: 'n/a',
    confirmation: false,
    user_forwardable: false,
    notes: 'Admin/audit only — não é domínio; uso operacional excepcional'
  }
];

const UNSUPPORTED: ApiCallSpec[] = [
  {
    intent: 'PACKAGE_STATUS',
    status: 'needs_implementation',
    operation: null,
    method: null,
    path: null,
    permission: null,
    classification: null,
    idempotency_key: 'n/a',
    confirmation: false,
    user_forwardable: true,
    notes: 'Sem endpoint v1 — NÃO inventar SQL/Dexie'
  },
  {
    intent: 'OCCURRENCE_STATUS',
    status: 'needs_implementation',
    operation: null,
    method: null,
    path: null,
    permission: null,
    classification: null,
    idempotency_key: 'n/a',
    confirmation: false,
    user_forwardable: true,
    notes: 'Sem endpoint v1'
  },
  {
    intent: 'RESERVATION_STATUS',
    status: 'needs_implementation',
    operation: null,
    method: null,
    path: null,
    permission: null,
    classification: null,
    idempotency_key: 'n/a',
    confirmation: false,
    user_forwardable: true,
    notes: 'Sem endpoint v1'
  },
  {
    intent: 'NOTIFICATION_QUERY',
    status: 'needs_implementation',
    operation: null,
    method: null,
    path: null,
    permission: null,
    classification: null,
    idempotency_key: 'n/a',
    confirmation: false,
    user_forwardable: true,
    notes: 'FUTURE'
  },
  {
    intent: 'NOTIFY_RESIDENT',
    status: 'not_supported',
    operation: 'notify_resident',
    method: null,
    path: null,
    permission: null,
    classification: 'WRITE',
    idempotency_key: 'n/a',
    confirmation: false,
    user_forwardable: true,
    notes: 'AuthZ DECISION_REQUIRED — blocked'
  },
  {
    intent: 'UNKNOWN',
    status: 'not_supported',
    operation: null,
    method: null,
    path: null,
    permission: null,
    classification: null,
    idempotency_key: 'n/a',
    confirmation: false,
    user_forwardable: true,
    notes: 'Pedir clarificação; não mutar'
  }
];

export const G7L_INTENT_CATALOG: ApiCallSpec[] = [...SUPPORTED, ...UNSUPPORTED];

export function resolveIntent(intent: string): ApiCallSpec {
  const key = String(intent || 'UNKNOWN').trim().toUpperCase() as N8nIntent;
  return (
    G7L_INTENT_CATALOG.find((x) => x.intent === key) ||
    G7L_INTENT_CATALOG.find((x) => x.intent === 'UNKNOWN')!
  );
}

/**
 * Stable Idempotency-Key for WRITE retries.
 * Same logical operation (same external message / attempt family) → same key.
 */
export function buildIdempotencyKey(opts: {
  clientId: string;
  intent: string;
  externalMessageId: string;
  attemptFamily?: string;
}): string {
  const client = opts.clientId.trim();
  const intent = opts.intent.trim().toUpperCase();
  const ext = opts.externalMessageId.trim();
  const family = (opts.attemptFamily || 'v1').trim();
  if (!client || !intent || !ext) {
    throw new Error('idempotency key requires clientId, intent, externalMessageId');
  }
  // Deterministic — NEVER Date.now() / random on retry
  return `n8n:${client}:${intent}:${ext}:${family}`.slice(0, 128);
}

export function shouldGenerateNewIdempotencyKey(opts: {
  isRetry: boolean;
  errorCode?: string | null;
}): boolean {
  if (opts.isRetry) return false;
  if (opts.errorCode === 'IDEMPOTENCY_FINGERPRINT_MISMATCH') return true;
  if (opts.errorCode === 'CONFLICT') return true; // new slot/resource = new operation
  return true; // new logical operation
}

export type WorkflowRetryDecision =
  | { action: 'retry_same_key'; reason: string }
  | { action: 'no_retry'; reason: string }
  | { action: 'retry_after_change'; reason: string }
  | { action: 'confirmation_flow'; reason: string }
  | { action: 're_sign'; reason: string };

export function decideWorkflowRetry(opts: {
  httpStatus?: number | null;
  errorCode?: string | null;
  classification?: 'READ' | 'WRITE' | 'SENSITIVE' | null;
  networkError?: boolean;
  confirmationAlreadyConsumed?: boolean;
}): WorkflowRetryDecision {
  if (opts.confirmationAlreadyConsumed) {
    return {
      action: 'no_retry',
      reason: 'SENSITIVE confirmation already consumed — requires new user decision'
    };
  }

  const code = opts.errorCode || '';
  if (code === 'CONFIRMATION_REQUIRED' || code === 'NEEDS_CONFIRMATION') {
    return { action: 'confirmation_flow', reason: code };
  }
  if (
    code === 'INVALID_SIGNATURE' ||
    code === 'TIMESTAMP_EXPIRED' ||
    code === 'UNAUTHENTICATED' ||
    code === 'AUTHENTICATION_FAILED'
  ) {
    return { action: 're_sign', reason: code };
  }

  if (opts.networkError) {
    return {
      action: 'retry_same_key',
      reason: 'network failure — WRITE must keep Idempotency-Key'
    };
  }

  if (
    opts.httpStatus === 502 ||
    opts.httpStatus === 503 ||
    opts.httpStatus === 504 ||
    opts.httpStatus === 500
  ) {
    return {
      action: 'retry_same_key',
      reason: `${opts.httpStatus} — SAFE_RETRY with same Idempotency-Key for WRITE`
    };
  }

  const cls = classifyRetry({
    errorCode: opts.errorCode,
    httpStatus: opts.httpStatus,
    classification: opts.classification || null
  });

  if (cls === 'SAFE_RETRY') {
    return { action: 'retry_same_key', reason: `retry_class=${cls}` };
  }
  if (cls === 'RETRY_AFTER_CHANGE') {
    return { action: 'retry_after_change', reason: `retry_class=${cls}` };
  }
  if (cls === 'CONTROLLED_RETRY') {
    return {
      action: 'no_retry',
      reason: 'SENSITIVE CONTROLLED_RETRY — no automatic blind retry'
    };
  }
  return { action: 'no_retry', reason: `retry_class=${cls as RetryClass}` };
}

export function assertOperationAligned(intent: N8nIntent): void {
  const spec = resolveIntent(intent);
  if (spec.status !== 'supported' || !spec.operation) return;
  const op = spec.operation;
  const binding = OPERATION_PERMISSION_MAP[op];
  if (binding.status === 'mapped' && binding.permission !== spec.permission) {
    throw new Error(`permission mismatch for ${op}`);
  }
  const cls = classifyOperation(op);
  if (cls !== spec.classification) {
    throw new Error(`classification mismatch for ${op}`);
  }
}

/** Forbidden substrings in workflow JSON (SQL / supabase / whatsapp prod) */
export const WORKFLOW_FORBIDDEN_PATTERNS = [
  /n8n-nodes-base\.postgres/i,
  /n8n-nodes-base\.supabase/i,
  /\bSELECT\s+\*/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+\w+\s+SET\b/i,
  /\bDELETE\s+FROM\b/i,
  /db\.[\w-]+\.supabase\.co/i,
  /SERVICE_ROLE_KEY/i,
  /createClient\s*\(/i,
  /from\(\s*['"]api_domain_events['"]\s*\)/i,
  /graph\.facebook\.com/i,
  /whatsapp\.cloud/i
];

export function auditWorkflowJson(raw: string): { ok: boolean; findings: string[] } {
  const findings: string[] = [];
  let parsed: { active?: boolean; nodes?: unknown[]; name?: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, findings: ['invalid_json'] };
  }
  if (parsed.active !== false) findings.push('active_must_be_false');
  if (!String(parsed.name || '').includes('G7-L')) findings.push('name_missing_G7-L');
  for (const re of WORKFLOW_FORBIDDEN_PATTERNS) {
    if (re.test(raw)) findings.push(`forbidden_pattern:${re}`);
  }
  const text = raw.toLowerCase();
  if (text.includes('sentinela_n8n_secret') && text.includes('"value":')) {
    // hardcoded secret values — env refs are ok
    if (/["']sk_|["'][a-f0-9]{32,}["']/i.test(raw)) findings.push('possible_hardcoded_secret');
  }
  return { ok: findings.length === 0, findings };
}

export const G7L_HMAC_HEADERS = [
  'X-Sentinela-Client-Id',
  'X-Sentinela-Timestamp',
  'X-Sentinela-Signature',
  'X-Organization-Id',
  'X-Condominium-Id',
  'X-Request-Id',
  'Idempotency-Key'
] as const;

export const G7L_HTTP_TIMEOUT_MS = 30_000;
