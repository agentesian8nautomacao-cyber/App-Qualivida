export const runtime = 'nodejs';

import { routeLegacyApiRequest } from './_lib/legacyRouter';
import { handleLiveMasterRequest } from './master/_lib/live';
import { routeV1Request } from './v1/_lib/router';

async function dispatch(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (pathname.startsWith('/api/master')) {
    return handleLiveMasterRequest(request);
  }
  if (pathname.startsWith('/api/v1')) {
    return routeV1Request(request);
  }
  return routeLegacyApiRequest(request);
}

export default {
  fetch: dispatch
};
