/**
 * Catch-all de /api/* sem pasta própria (staff-invite, etc.).
 * /api/master/* e /api/v1/* têm Functions explícitas: pastas _lib
 * impedem este catch-all de receber esses prefixos no Vercel.
 */
export const runtime = 'nodejs';

import { asVercelNodeHandler } from './_lib/vercelHandler';

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
    const { handleLiveMasterRequest } = await import('./master/_lib/live');
    return handleLiveMasterRequest(request);
  }
  if (pathname.startsWith('/api/v1') || pathname.startsWith('/v1/')) {
    const { routeV1Request } = await import('./v1/_lib/router');
    return routeV1Request(request);
  }
  const { routeLegacyApiRequest } = await import('./_lib/legacyRouter');
  return routeLegacyApiRequest(request);
}

export default asVercelNodeHandler(dispatch);
