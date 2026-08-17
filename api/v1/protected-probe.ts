/**
 * GET /api/v1/protected-probe
 * G2 technical endpoint — HMAC + tenant required. No DB writes. No business ops.
 */

export const runtime = 'nodejs';

import { FOUNDATION_GATES, API_VERSION } from './_lib/gates';
import { withProtectedHandler } from './_lib/protectedHandler';
import { jsonSuccess } from './_lib/response';
import type { ProtectDeps } from './_lib/auth/protect';

export function createProtectedProbeHandler(deps?: ProtectDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withProtectedHandler(
        request,
        ['GET'],
        async (ctx) => {
          return jsonSuccess(
            ctx.request_id,
            {
              service: 'sentinela-api',
              api_version: API_VERSION,
              stage: 'ETAPA_4_G2_AUTH_TENANT',
              probe: 'protected',
              authenticated: true,
              client_id: ctx.auth.client_id,
              organization_id: ctx.auth.organization_id,
              condominium_id: ctx.auth.condominium_id,
              permission_keys: ctx.auth.permission_keys,
              core_context_bound: {
                channel: ctx.auth.core_operation_context.channel,
                organizationId: ctx.auth.core_operation_context.organizationId,
                condominiumId: ctx.auth.core_operation_context.condominiumId,
                actorRole: ctx.auth.core_operation_context.actorRole
              },
              gates: FOUNDATION_GATES,
              note: 'No secrets returned. No business operation executed. G3 not started.'
            },
            { correlationId: ctx.correlation_id, operation: 'protected_probe' }
          );
        },
        deps
      );
    }
  };
}

export default createProtectedProbeHandler();
