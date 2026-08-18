/**
 * Adapter Node da Function Master.
 * Import estático para o bundler da Vercel incluir o grafo (import() dinâmico
 * ficava de fora do lambda e quebrava em stage entry / ERR_MODULE_NOT_FOUND).
 * Sem SDK Supabase. Sem propriedade .fetch no handler.
 */

import { fromNodeRequest, isWebRequest } from '../../_lib/vercelHandler';
import { masterEnvFlags, sanitizeMasterLog } from './env';
import { handleLiveMasterRequest } from './live';

type NodeRes = {
  statusCode: number;
  setHeader?: (k: string, v: string) => void;
  end: (b?: string) => void;
};

function requestId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

function sendJson(res: unknown, status: number, body: Record<string, unknown>): Response | void {
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

function exceptionInfo(err: unknown): { exception: string; code?: string; message: string } {
  const anyErr = err as { name?: string; code?: string; message?: string } | null;
  const exception =
    err instanceof Error ? err.name : typeof anyErr?.name === 'string' ? anyErr.name : 'Error';
  const code = typeof anyErr?.code === 'string' ? anyErr.code : undefined;
  const message = sanitizeMasterLog(err instanceof Error ? err.message : String(err));
  return { exception, code, message };
}

export async function runMasterNodeHandler(req: unknown, res?: unknown): Promise<Response | void> {
  const id = requestId();
  const method = String((req as { method?: string })?.method || 'GET').toUpperCase();
  const path = pathOf(req);

  try {
    if (method === 'OPTIONS') {
      return sendJson(res, 204, { ok: true, request_id: id });
    }

    const request = isWebRequest(req)
      ? req
      : await fromNodeRequest((req || {}) as Parameters<typeof fromNodeRequest>[0]);
    const response = await handleLiveMasterRequest(request);
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
    const { exception, code, message } = exceptionInfo(err);
    console.error(
      JSON.stringify({
        src: 'master/nodeEntry',
        request_id: id,
        method,
        path,
        stage: 'NODE_DISPATCH',
        exception,
        code,
        message,
        ...masterEnvFlags()
      })
    );
    return sendJson(res, 500, {
      error: 'MASTER_API_ERROR',
      message: 'Falha na API Master',
      request_id: id,
      stage: 'NODE_DISPATCH',
      exception,
      code
    });
  }
}
