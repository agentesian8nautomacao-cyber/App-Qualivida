export const runtime = 'nodejs';

import { withCoreExecution, type ExecuteHandlerDeps } from '../withCoreExecution';

export function createBoletosHandler(deps?: ExecuteHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withCoreExecution(request, ['GET'], 'get_boleto', deps);
    }
  };
}

export default createBoletosHandler();
