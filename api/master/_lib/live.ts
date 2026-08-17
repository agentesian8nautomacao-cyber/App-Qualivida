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

export async function handleLiveMasterRequest(request: Request): Promise<Response> {
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

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !anonKey) {
    return json({ error: 'Configuração indisponível', code: 'CONFIG_MISSING' }, 500);
  }

  const auth = request.headers.get('Authorization') || '';
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
}
