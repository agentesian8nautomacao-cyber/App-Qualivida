export const runtime = 'nodejs';

import { withCoreExecution, type ExecuteHandlerDeps } from '../../../withCoreExecution';

export function createUpdateOccurrenceHandler(deps?: ExecuteHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withCoreExecution(request, ['PATCH'], 'update_occurrence', deps);
    }
  };
}

export default createUpdateOccurrenceHandler();
