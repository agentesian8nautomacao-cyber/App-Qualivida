export const runtime = 'nodejs';

import { withCoreExecution, type ExecuteHandlerDeps } from '../../../withCoreExecution';

export function createOccurrencesHandler(deps?: ExecuteHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withCoreExecution(request, ['POST'], 'create_occurrence', deps);
    }
  };
}

export default createOccurrencesHandler();
