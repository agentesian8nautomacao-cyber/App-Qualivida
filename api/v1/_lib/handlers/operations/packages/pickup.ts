export const runtime = 'nodejs';

/**
 * SENSITIVE — confirmation gate then Core (G7-B).
 * Fail-closed if confirmation store unavailable.
 */

import { withConfirmedOperation } from '../../../protectedHandler';
import { withCoreExecution, type ExecuteHandlerDeps } from '../../../withCoreExecution';
import { jsonError } from '../../../response';
import { ApiErrorCodes } from '../../../errors';
import { resolveConfirmationStore } from '../../../confirmations/service';

export function createPickupHandler(deps?: ExecuteHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withConfirmedOperation(
        request,
        ['POST'],
        'pickup_package',
        async (ctx) => {
          const store = resolveConfirmationStore(deps?.confirmationStore);
          if (store.kind === 'unavailable') {
            return jsonError(
              ctx.request_id,
              ApiErrorCodes.CONFIRMATION_STORE_UNAVAILABLE,
              'Persistent confirmation store not configured. Core not executed.',
              {
                correlationId: ctx.correlation_id,
                operation: 'pickup_package',
                details: {
                  classification: 'SENSITIVE',
                  confirmation_id: ctx.confirmation_id,
                  core_executed: false
                }
              }
            );
          }
          // Re-enter via withCoreExecution with confirmation already consumed
          return withCoreExecution(
            ctx.request,
            ['POST'],
            'pickup_package',
            { ...deps, skipProductionComposition: deps?.skipProductionComposition },
            { sensitiveConfirmed: true }
          );
        },
        deps
      );
    }
  };
}

export default createPickupHandler();
