export const runtime = 'nodejs';

import { withCoreExecution, type ExecuteHandlerDeps } from '../_lib/withCoreExecution';

export function createIdentifyUnitHandler(deps?: ExecuteHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withCoreExecution(request, ['GET'], 'identify_unit', deps);
    }
  };
}

export default createIdentifyUnitHandler();
