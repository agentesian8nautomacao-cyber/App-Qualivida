/**
 * Vercel Hobby — single serverless entry for legacy /api/* staff & auth routes.
 */

type RouteHandler = { fetch: (request: Request) => Promise<Response> };

const ROUTES: Record<string, () => Promise<{ default: RouteHandler }>> = {
  '/staff-invite': () => import('./handlers/legacy/staff-invite'),
  '/accept-staff-invite': () => import('./handlers/legacy/accept-staff-invite'),
  '/send-invite-email': () => import('./handlers/legacy/send-invite-email'),
  '/create-auth-user': () => import('./handlers/legacy/create-auth-user')
};

function normalizePathname(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  return p.startsWith('/api') ? p.slice('/api'.length) || '/' : p;
}

export async function routeLegacyApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const subpath = normalizePathname(url.pathname);
  const loader = ROUTES[subpath];

  if (!loader) {
    return Response.json(
      { error: 'Not found', code: 'NOT_FOUND' },
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const mod = await loader();
  return mod.default.fetch(request);
}
