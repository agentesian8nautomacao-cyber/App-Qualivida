export const runtime = 'nodejs';

import { withCoreExecution, type ExecuteHandlerDeps } from '../_lib/withCoreExecution';

export function createIdentifyResidentHandler(deps?: ExecuteHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withCoreExecution(request, ['GET'], 'identify_resident', deps);
    }
  };
}

export default createIdentifyResidentHandler();
