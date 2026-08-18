/**
 * Live Master request — user JWT + anon key (RLS). Never service_role for identity.
 * I/O via Auth HTTP + PostgREST (sem SDK no bundle da Function).
 */

import { createMasterApiHandler } from './handler';
import { createRestMasterStore, getAuthUserFromJwt } from './restStore';

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
            has_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
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

    const user = await getAuthUserFromJwt(supabaseUrl, anonKey, token);
    if (!user?.id) {
      return json({ error: 'Sessão expirada ou inválida', code: 'UNAUTHENTICATED' }, 401);
    }

    const store = createRestMasterStore(supabaseUrl, anonKey, token);
    const handler = createMasterApiHandler({
      getUserFromAccessToken: async () => user,
      store
    });
    return handler.fetch(request);
  } catch (err: unknown) {
    const exception = err instanceof Error ? err.name : 'Error';
    console.error(
      JSON.stringify({
        src: 'master/live',
        stage: 'live',
        exception,
        has_SUPABASE_URL: Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
        has_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)
      })
    );
    return json(
      {
        error: 'MASTER_API_ERROR',
        message: 'Falha na API Master',
        code: 'INTERNAL_ERROR',
        stage: 'live',
        exception
      },
      500
    );
  }
}
