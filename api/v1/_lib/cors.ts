/**
 * SENTINELA API v1 — CORS policy (server-to-server)
 * DR17: do NOT use Access-Control-Allow-Origin: *
 */

export const sentinelaCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Sentinela-Client-Id, X-Sentinela-Timestamp, X-Sentinela-Signature, X-Organization-Id, X-Condominium-Id, Idempotency-Key, X-Correlation-Id, X-Request-Id',
  'Access-Control-Max-Age': '86400'
  // No Access-Control-Allow-Origin — not a browser public API in G1
};

export function withCors(headers: Record<string, string> = {}): Record<string, string> {
  return { ...sentinelaCorsHeaders, ...headers };
}
