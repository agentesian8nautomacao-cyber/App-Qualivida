/**
 * Runner da Function — importado só de dentro do handler (depois do cold start).
 * Diagnóstico sem secrets / JWT / cookies.
 */

type NodeRes = {
  statusCode: number;
  setHeader?: (k: string, v: string) => void;
  end: (b?: string) => void;
};

function requestId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitize(raw: string): string {
  return raw
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]')
    .replace(/service_role|anon[_-]?key/gi, '[key]')
    .slice(0, 180);
}

function envFlags() {
  return {
    has_SUPABASE_URL: Boolean(String(process.env.SUPABASE_URL || '').trim()),
    has_VITE_SUPABASE_URL: Boolean(String(process.env.VITE_SUPABASE_URL || '').trim()),
    has_SUPABASE_ANON_KEY: Boolean(String(process.env.SUPABASE_ANON_KEY || '').trim()),
    has_VITE_SUPABASE_ANON_KEY: Boolean(String(process.env.VITE_SUPABASE_ANON_KEY || '').trim())
  };
}

function sendJson(
  res: unknown,
  status: number,
  body: Record<string, unknown>
): Response | void {
  const payload = JSON.stringify(body);
  const node = res as NodeRes | undefined;
  if (node && typeof node.end === 'function') {
    node.statusCode = status;
    try {
      node.setHeader?.('Content-Type', 'application/json');
      node.setHeader?.('Access-Control-Allow-Origin', '*');
    } catch {
      /* ignore */
    }
    node.end(payload);
    return;
  }
  return new Response(payload, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function pathOf(req: unknown): string {
  const raw = String((req as { url?: string })?.url || '');
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return new URL(raw).pathname;
    }
  } catch {
    /* ignore */
  }
  return raw.split('?')[0] || '/';
}

export async function runSafeApiHandler(
  req: unknown,
  res?: unknown,
  scope: 'master' | 'v1' | 'legacy' | 'auto' = 'auto'
): Promise<Response | void> {
  const id = requestId();
  const method = String((req as { method?: string })?.method || 'GET').toUpperCase();
  const path = pathOf(req);
  const flags = envFlags();

  const fail = (stage: string, err: unknown, status = 500) => {
    const exception = err instanceof Error ? err.name : 'Error';
    const message = sanitize(err instanceof Error ? err.message : String(err));
    console.error(
      JSON.stringify({
        src: 'master-api',
        request_id: id,
        method,
        path,
        stage,
        exception,
        message,
        ...flags
      })
    );
    return sendJson(res, status, {
      error: 'MASTER_API_ERROR',
      message: 'Falha na API Master',
      request_id: id,
      stage,
      exception
    });
  };

  try {
    if (method === 'OPTIONS') {
      return sendJson(res, 204, { ok: true });
    }

    const { isWebRequest, fromNodeRequest } = await import('./vercelHandler');
    const request = isWebRequest(req) ? req : await fromNodeRequest((req || {}) as Parameters<typeof fromNodeRequest>[0]);

    let response: Response;
    const useMaster =
      scope === 'master' ||
      (scope === 'auto' && (path.startsWith('/api/master') || path.startsWith('/master/')));
    const useV1 =
      scope === 'v1' || (scope === 'auto' && (path.startsWith('/api/v1') || path.startsWith('/v1/')));

    if (useMaster) {
      const { handleLiveMasterRequest } = await import('../master/_lib/live');
      response = await handleLiveMasterRequest(request);
    } else if (useV1) {
      const { routeV1Request } = await import('../v1/_lib/router');
      response = await routeV1Request(request);
    } else {
      const { routeLegacyApiRequest } = await import('./legacyRouter');
      response = await routeLegacyApiRequest(request);
    }

    const text = await response.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      parsed = { error: 'MASTER_API_ERROR', message: 'Resposta não JSON' };
    }
    if (typeof parsed.request_id !== 'string') parsed.request_id = id;
    return sendJson(res, response.status, parsed);
  } catch (err: unknown) {
    return fail('invoke', err);
  }
}
