export const runtime = 'nodejs';

/**
 * POST /api/v1/operations/reservations/cancel
 * SENSITIVE — confirmation then Core (G7-B).
 */

import { withConfirmedOperation } from '../../../protectedHandler';
import { withCoreExecution, type ExecuteHandlerDeps } from '../../../withCoreExecution';
import { jsonError } from '../../../response';
import { ApiErrorCodes } from '../../../errors';
import { resolveConfirmationStore } from '../../../confirmations/service';

export function createCancelReservationHandler(deps?: ExecuteHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withConfirmedOperation(
        request,
        ['POST'],
        'cancel_reservation',
        async (ctx) => {
          const store = resolveConfirmationStore(deps?.confirmationStore);
          if (store.kind === 'unavailable') {
            return jsonError(
              ctx.request_id,
              ApiErrorCodes.CONFIRMATION_STORE_UNAVAILABLE,
              'Persistent confirmation store not configured. Core not executed.',
              {
                correlationId: ctx.correlation_id,
                operation: 'cancel_reservation',
                details: {
                  classification: 'SENSITIVE',
                  confirmation_id: ctx.confirmation_id,
                  core_executed: false
                }
              }
            );
          }
          return withCoreExecution(
            ctx.request,
            ['POST'],
            'cancel_reservation',
            { ...deps, skipProductionComposition: deps?.skipProductionComposition },
            { sensitiveConfirmed: true }
          );
        },
        deps
      );
    }
  };
}

export default createCancelReservationHandler();
