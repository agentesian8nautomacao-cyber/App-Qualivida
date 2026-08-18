/**
 * Adapter Vercel.
 *
 * Rotas que funcionam neste projeto (staff-invite, etc.) exportam:
 *   export default { fetch(request: Request) { return new Response(...) } }
 *
 * Exportar uma função `(req, res)` faz o runtime clássico ignorar o `Response`
 * e responder HTTP 500 HTML — o frontend via isso como "erro interno".
 */

type FetchHandler = (request: Request) => Promise<Response>;

export type VercelFetchExport = {
  fetch: FetchHandler;
};

type NodeRes = {
  statusCode: number;
  setHeader: (k: string, v: string) => void;
  end: (b?: Buffer | string | Uint8Array) => void;
};

const FORBIDDEN_REQUEST_HEADERS = new Set([
  'accept-encoding',
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);

export function isWebRequest(input: unknown): input is Request {
  if (!input || typeof input !== 'object') return false;
  const req = input as Request;
  return (
    typeof req.headers?.get === 'function' &&
    typeof req.clone === 'function' &&
    typeof req.method === 'string' &&
    typeof req.url === 'string'
  );
}

function isNodeRes(input: unknown): input is NodeRes {
  if (!input || typeof input !== 'object') return false;
  const res = input as NodeRes;
  return typeof res.end === 'function' && typeof res.setHeader === 'function';
}

export async function fromNodeRequest(req: {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>;
}): Promise<Request> {
  const host = String(req.headers.host || req.headers.Host || 'localhost');
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || 'https';
  const rawUrl = String(req.url || '/');
  const url = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `${proto}://${host}${rawUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (FORBIDDEN_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    try {
      headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
    } catch {
      // header proibido pelo Fetch — ignorar
    }
  }
  const method = (req.method || 'GET').toUpperCase();
  const init: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const chunks: Uint8Array[] = [];
    if (typeof req[Symbol.asyncIterator] === 'function') {
      for await (const chunk of req as AsyncIterable<Uint8Array | string | Buffer>) {
        if (typeof chunk === 'string') chunks.push(new TextEncoder().encode(chunk));
        else chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      }
    }
    if (chunks.length) {
      const total = chunks.reduce((n, c) => n + c.byteLength, 0);
      const body = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        body.set(c, offset);
        offset += c.byteLength;
      }
      init.body = body;
    }
  }
  return new Request(url, init);
}

export async function writeNodeResponse(res: NodeRes, response: Response): Promise<void> {
  res.statusCode = response.status;
  res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/json');
  const origin = response.headers.get('Access-Control-Allow-Origin');
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  const methods = response.headers.get('Access-Control-Allow-Methods');
  if (methods) res.setHeader('Access-Control-Allow-Methods', methods);
  const allowHeaders = response.headers.get('Access-Control-Allow-Headers');
  if (allowHeaders) res.setHeader('Access-Control-Allow-Headers', allowHeaders);
  res.end(await response.text());
}

/** Formato Web Handler (obrigatório nas rotas `/api` deste projeto). */
export function asVercelFetchExport(fetchFn: FetchHandler): VercelFetchExport {
  return { fetch: fetchFn };
}

/**
 * Fallback do runtime Node clássico `(req, res)`.
 * Não usar como `export default` das rotas — o Vercel trata função como Node handler.
 */
export function asVercelNodeHandler(fetchFn: FetchHandler) {
  return async function handler(req: unknown, res?: unknown): Promise<Response | void> {
    try {
      const request = isWebRequest(req) ? req : await fromNodeRequest(req as Parameters<typeof fromNodeRequest>[0]);
      const response = await fetchFn(request);
      if (isNodeRes(res)) {
        await writeNodeResponse(res, response);
        return;
      }
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro interno na API';
      console.error('[vercel-handler]', message);
      const response = new Response(JSON.stringify({ error: message, code: 'INTERNAL_ERROR' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
      if (isNodeRes(res)) {
        try {
          await writeNodeResponse(res, response);
          return;
        } catch (writeErr: unknown) {
          console.error('[vercel-handler] write failed', writeErr);
        }
      }
      return response;
    }
  };
}
