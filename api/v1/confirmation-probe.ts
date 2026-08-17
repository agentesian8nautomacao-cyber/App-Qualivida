/**
 * GET/POST /api/v1/confirmation-probe
 * G4 technical probe for confirmation contracts (no Core execution).
 *
 * GET  ?operation=identify_resident → classification (after auth)
 * POST body for sensitive create/validate flows
 */

export const runtime = 'nodejs';

import { FOUNDATION_GATES, API_VERSION } from './_lib/gates';
import {
  withAuthorizedOperation,
  withConfirmedOperation,
  type ApiHandlerDeps
} from './_lib/protectedHandler';
import { jsonSuccess, jsonError } from './_lib/response';
import { ApiErrorCodes } from './_lib/errors';
import { classifyOperation, requiresConfirmation } from './_lib/ops/classification';
import { isCoreOperationName } from './_lib/authz/operations';

export function createConfirmationProbeHandler(deps?: ApiHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const operation = (url.searchParams.get('operation') || '').trim();

      if (request.method === 'GET') {
        if (!isCoreOperationName(operation)) {
          return withAuthorizedOperation(
            request,
            ['GET'],
            'identify_resident',
            async (ctx) =>
              jsonError(ctx.request_id, ApiErrorCodes.INVALID_REQUEST, 'operation query required', {
                correlationId: ctx.correlation_id
              }),
            deps
          );
        }

        return withAuthorizedOperation(
          request,
          ['GET'],
          operation,
          async (ctx) =>
            jsonSuccess(
              ctx.request_id,
              {
                service: 'sentinela-api',
                api_version: API_VERSION,
                stage: 'ETAPA_6_G4_CONFIRMATION',
                probe: 'confirmation_classify',
                operation,
                classification: classifyOperation(operation),
                requires_confirmation: requiresConfirmation(operation),
                authorized: true,
                gates: FOUNDATION_GATES,
                note: 'Classification only. Sensitive ops need POST with resource_id / confirmation.'
              },
              { correlationId: ctx.correlation_id, operation: 'confirmation_probe' }
            ),
          deps
        );
      }

      if (!isCoreOperationName(operation)) {
        return jsonError('req_local', ApiErrorCodes.INVALID_REQUEST, 'operation query required');
      }

      return withConfirmedOperation(
        request,
        ['POST'],
        operation,
        async (ctx) =>
          jsonSuccess(
            ctx.request_id,
            {
              service: 'sentinela-api',
              api_version: API_VERSION,
              stage: 'ETAPA_6_G4_CONFIRMATION',
              probe: 'confirmation_gate',
              operation,
              classification: classifyOperation(operation),
              confirmation_id: ctx.confirmation_id || null,
              would_reach_core: false,
              core_executed: false,
              gates: FOUNDATION_GATES,
              note: 'Confirmation gate passed for sensitive op (or not required). Core not executed (G5).'
            },
            { correlationId: ctx.correlation_id, operation: 'confirmation_probe' }
          ),
        deps
      );
    }
  };
}

export default createConfirmationProbeHandler();
