export const runtime = 'nodejs';

import { withCoreExecution, type ExecuteHandlerDeps } from '../../../withCoreExecution';

export function createPackagesHandler(deps?: ExecuteHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withCoreExecution(request, ['POST'], 'create_package', deps);
    }
  };
}

export default createPackagesHandler();
