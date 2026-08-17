/**
 * SENTINELA API v1 — small handler helpers
 */

import { ApiErrorCodes } from './errors';
import { extractRequestIds } from './requestIds';
import { jsonError, jsonOptions } from './response';

export type HandlerContext = {
  request_id: string;
  correlation_id: string | null;
  request: Request;
};

export async function withFoundationHandler(
  request: Request,
  allowedMethods: string[],
  run: (ctx: HandlerContext) => Promise<Response>
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return jsonOptions();
  }

  const ids = extractRequestIds(request);

  if (!allowedMethods.includes(request.method)) {
    return jsonError(ids.request_id, ApiErrorCodes.METHOD_NOT_ALLOWED, 'Method not allowed', {
      correlationId: ids.correlation_id,
      details: { allowed: allowedMethods }
    });
  }

  try {
    return await run({
      request_id: ids.request_id,
      correlation_id: ids.correlation_id,
      request
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sentinela-api/v1]', ids.request_id, msg);
    return jsonError(ids.request_id, ApiErrorCodes.INTERNAL_ERROR, 'Internal error', {
      correlationId: ids.correlation_id
    });
  }
}

/** Standard 501 for ops not enabled (G3+) */
export function gatePendingResponse(
  requestId: string,
  operation: string,
  correlationId?: string | null
): Response {
  return jsonError(
    requestId,
    ApiErrorCodes.GATE_PENDING,
    'Business operation is not enabled yet (awaiting G3 authz/ops).',
    {
      correlationId,
      operation,
      details: {
        g2_authn: true,
        g3_authz_ops: false,
        writes_enabled: false,
        n8n: false,
        whatsapp: false,
        next_gate: 'G3_authz_and_operations',
        database_changes: 0
      }
    }
  );
}
