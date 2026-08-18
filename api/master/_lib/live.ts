/**
 * Live Master request — user JWT + anon key (RLS). Never service_role for identity.
 * I/O via Auth HTTP + PostgREST (sem SDK no bundle da Function).
 */

import { masterEnvFlags, resolveMasterServerConfig, sanitizeMasterLog } from './env';
import { createMasterApiHandler } from './handler';
import { createRestMasterStore, getAuthUserFromJwt, MasterStageError } from './restStore';

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

function requestId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pathOf(request: Request): string {
  try {
    return new URL(request.url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return String((request as { url?: string }).url || '/').split('?')[0] || '/';
  }
}

function getHeader(request: Request, name: string): string {
  try {
    const headers = request.headers as Headers & Record<string, string | string[] | undefined>;
    if (typeof headers?.get === 'function') {
      return headers.get(name) || headers.get(name.toLowerCase()) || '';
    }
    const direct = headers?.[name] ?? headers?.[name.toLowerCase()];
    if (Array.isArray(direct)) return direct.join(', ');
    return direct ? String(direct) : '';
  } catch {
    return '';
  }
}

function readBearerToken(request: Request): string | null {
  const auth = getHeader(request, 'Authorization');
  const token = /^Bearer\s+(\S+)/i.exec(auth.trim())?.[1] || '';
  if (!token || /[\r\n\0]/.test(token)) return null;
  return token;
}

function failLog(input: {
  request_id: string;
  method: string;
  path: string;
  stage: string;
  exception: string;
  message: string;
}) {
  console.error(
    JSON.stringify({
      src: 'master/live',
      request_id: input.request_id,
      method: input.method,
      path: input.path,
      stage: input.stage,
      exception: input.exception,
      message: sanitizeMasterLog(input.message),
      ...masterEnvFlags()
    })
  );
}

export async function handleLiveMasterRequest(request: Request): Promise<Response> {
  const id = requestId();
  const method = String(request.method || 'GET').toUpperCase();
  const path = pathOf(request);
  let stage = 'MASTER_SESSION_START';

  try {
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    stage = 'SUPABASE_CLIENT_INIT';
    const cfg = resolveMasterServerConfig();
    if (!cfg) {
      return json(
        {
          error:
            'Configuração indisponível na API Master. No Vercel: Settings → Environment Variables, crie SUPABASE_URL e SUPABASE_ANON_KEY (podem copiar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) e faça Redeploy.',
          code: 'CONFIG_MISSING',
          request_id: id,
          stage,
          details: masterEnvFlags()
        },
        500
      );
    }

    stage = 'AUTH_READ_TOKEN';
    const token = readBearerToken(request);
    if (!token) {
      return json({ error: 'Não autenticado', code: 'UNAUTHENTICATED', request_id: id }, 401);
    }

    stage = 'AUTH_GET_USER';
    const user = await getAuthUserFromJwt(cfg.url, cfg.anonKey, token);
    if (!user?.id) {
      return json({ error: 'Sessão expirada ou inválida', code: 'UNAUTHENTICATED', request_id: id }, 401);
    }

    stage = 'PLATFORM_ADMIN_CHECK';
    const store = createRestMasterStore(cfg.url, cfg.anonKey, token);
    const handler = createMasterApiHandler({
      getUserFromAccessToken: async () => user,
      store
    });

    stage = 'MASTER_DISPATCH';
    const response = await handler.fetch(request);
    return response;
  } catch (err: unknown) {
    const staged = err instanceof MasterStageError ? err.stage : stage;
    const exception = err instanceof MasterStageError ? err.exception : err instanceof Error ? err.name : 'Error';
    const message = err instanceof Error ? err.message : String(err);
    failLog({
      request_id: id,
      method,
      path,
      stage: staged,
      exception,
      message
    });
    return json(
      {
        error: 'MASTER_API_ERROR',
        message: 'Falha na API Master',
        code: 'INTERNAL_ERROR',
        request_id: id,
        stage: staged,
        exception
      },
      500
    );
  }
}
