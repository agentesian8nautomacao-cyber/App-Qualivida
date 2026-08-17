export const runtime = 'nodejs';

import { withCoreExecution, type ExecuteHandlerDeps } from '../../_lib/withCoreExecution';

export function createReservationsHandler(deps?: ExecuteHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withCoreExecution(request, ['POST'], 'create_reservation', deps);
    }
  };
}

export default createReservationsHandler();
