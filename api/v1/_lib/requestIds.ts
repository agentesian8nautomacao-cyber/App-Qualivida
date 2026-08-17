/**
 * SENTINELA API v1 — request / correlation ids (G7-E)
 *
 * Policy:
 * - Server always ensures a request_id.
 * - Client may supply X-Request-Id for orchestration correlation (n8n).
 * - Accepted only if safe charset + length; otherwise regenerated (no collision guarantee across nodes —
 *   UUID preferred; do not treat as security boundary).
 * - Correlation id is optional observability only.
 */

const REQUEST_ID_RE = /^[A-Za-z0-9_.:-]{8,128}$/;
const CORRELATION_ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;

export function newRequestId(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `req_${rand}`;
}

export function normalizeIncomingRequestId(raw: string | null | undefined): string {
  const t = (raw || '').trim();
  if (t && REQUEST_ID_RE.test(t)) return t;
  return newRequestId();
}

export function normalizeCorrelationId(raw: string | null | undefined): string | null {
  const t = (raw || '').trim();
  if (!t) return null;
  if (!CORRELATION_ID_RE.test(t)) return null;
  return t;
}

export function extractRequestIds(request: Request): {
  request_id: string;
  correlation_id: string | null;
} {
  const incomingReq =
    request.headers.get('X-Request-Id')?.trim() ||
    request.headers.get('x-request-id')?.trim();
  const correlation =
    request.headers.get('X-Correlation-Id')?.trim() ||
    request.headers.get('x-correlation-id')?.trim() ||
    null;
  return {
    request_id: normalizeIncomingRequestId(incomingReq),
    correlation_id: normalizeCorrelationId(correlation)
  };
}
