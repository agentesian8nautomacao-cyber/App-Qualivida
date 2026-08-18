/**
 * Live Master request — user JWT + anon key (RLS). Never service_role for identity.
 */

import { createMasterApiHandler, createLiveMasterStore, createUserScopedClient } from './handler';

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    }
  });
}

function getHeader(request: Request, name: string): string {
  const headers = request.headers as Headers & Record<string, string | string[] | undefined>;
  if (typeof headers?.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase()) || '';
  }
  const direct = headers?.[name] ?? headers?.[name.toLowerCase()];
  if (Array.isArray(direct)) return direct.join(', ');
  return direct ? String(direct) : '';
}

export async function handleLiveMasterRequest(request: Request): Promise<Response> {
  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    const supabaseUrl = String(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    )
      .trim()
      .replace(/\/$/, '');
    const anonKey = String(
      process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    ).trim();
    if (!supabaseUrl || !anonKey) {
      return json(
        {
          error:
            'Configuração indisponível na API Master. No Vercel: Settings → Environment Variables, crie SUPABASE_URL e SUPABASE_ANON_KEY (podem copiar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) e faça Redeploy.',
          code: 'CONFIG_MISSING',
          details: {
            has_SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
            has_VITE_SUPABASE_URL: Boolean(process.env.VITE_SUPABASE_URL),
            has_SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
            has_VITE_SUPABASE_ANON_KEY: Boolean(process.env.VITE_SUPABASE_ANON_KEY)
          }
        },
        500
      );
    }

    const auth = getHeader(request, 'Authorization');
    const token = /^Bearer\s+(\S+)/i.exec(auth.trim())?.[1] || '';
    if (!token) {
      return json({ error: 'Não autenticado', code: 'UNAUTHENTICATED' }, 401);
    }

    const userClient = createUserScopedClient(supabaseUrl, anonKey, token);
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data.user?.id) {
      return json({ error: 'Sessão expirada ou inválida', code: 'UNAUTHENTICATED' }, 401);
    }

    const store = await createLiveMasterStore(userClient);
    const handler = createMasterApiHandler({
      getUserFromAccessToken: async () => ({
        id: data.user!.id,
        email: data.user!.email
      }),
      store
    });
    return handler.fetch(request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[master/live]', message);
    return json({ error: `Erro interno na API Master: ${message}`, code: 'INTERNAL_ERROR' }, 500);
  }
}
