export const runtime = 'nodejs';

import { asVercelNodeHandler } from './_lib/vercelHandler';
import { routeLegacyApiRequest } from './_lib/legacyRouter';
import { handleLiveMasterRequest } from './master/_lib/live';
import { routeV1Request } from './v1/_lib/router';

function pathnameOf(request: Request): string {
  try {
    return new URL(request.url).pathname;
  } catch {
    return '/';
  }
}

async function dispatch(request: Request): Promise<Response> {
  const pathname = pathnameOf(request);

  if (pathname.startsWith('/api/master') || pathname.startsWith('/master/')) {
    return handleLiveMasterRequest(request);
  }
  if (pathname.startsWith('/api/v1') || pathname.startsWith('/v1/')) {
    return routeV1Request(request);
  }
  return routeLegacyApiRequest(request);
}

export default asVercelNodeHandler(dispatch);
