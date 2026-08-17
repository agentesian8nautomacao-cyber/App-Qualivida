/**
 * GET /api/v1/health — public (no HMAC). G1+G2 status.
 */

export const runtime = 'nodejs';

import { FOUNDATION_GATES, API_VERSION } from './_lib/gates';
import { probeOperationalCore } from './_lib/coreProbe';
import { withFoundationHandler } from './_lib/handler';
import { jsonSuccess } from './_lib/response';

export default {
  async fetch(request: Request): Promise<Response> {
    return withFoundationHandler(request, ['GET'], async (ctx) => {
      const core = probeOperationalCore();

      return jsonSuccess(
        ctx.request_id,
        {
          service: 'sentinela-api',
          api_version: API_VERSION,
          stage: 'ETAPA_G7_H_B_N8N_PILOT',
          status: core.core_reachable ? 'ok' : 'degraded',
          gates: FOUNDATION_GATES,
          core,
          boundaries: {
            database_changes: 0,
            migrations_executed: 0,
            n8n: 0,
            n8n_pilot_local: 1,
            whatsapp: 0,
            public_operations: 0,
            authn: 'hmac_required_on_protected_routes',
            tenant: 'fail_closed_on_protected_routes',
            next_gate: 'g7i_or_whatsapp_decision',
            note: 'G7-H-B: local n8n pilot artifacts + HTTP pilot against API v1. No WhatsApp. No Event Store. n8n=0 means production channel not enabled.'
          },
          timestamp: new Date().toISOString()
        },
        { correlationId: ctx.correlation_id, operation: 'health' }
      );
    });
  }
};
