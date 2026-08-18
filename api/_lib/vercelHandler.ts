/**
 * Adapter do runtime Node da Vercel: `export default async function (req, res)`.
 *
 * `{ fetch }` só funciona como módulo interno. Como export da Function, o runtime
 * Node tenta invocar o default e quebra com FUNCTION_INVOCATION_FAILED.
 */

type FetchHandler = (request: Request) => Promise<Response>;

type NodeRes = {
  statusCode: number;
  setHeader?: (k: string, v: string) => void;
  end: (b?: string | Uint8Array) => void;
  status?: (n: number) => NodeRes;
  send?: (b: string) => void;
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
  return typeof res.end === 'function';
}

export async function fromNodeRequest(req: {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>;
}): Promise<Request> {
  const rawHeaders = req.headers || {};
  const host = String(rawHeaders.host || rawHeaders.Host || 'localhost');
  const protoHeader = rawHeaders['x-forwarded-proto'];
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || 'https';
  const rawUrl = String(req.url || '/');
  const url = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') ? rawUrl : `${proto}://${host}${rawUrl}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value == null) continue;
    if (FORBIDDEN_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    try {
      headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
    } catch {
      // header proibido pelo Fetch
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

function sendNode(res: NodeRes, status: number, text: string, contentType: string) {
  res.statusCode = status;
  try {
    res.setHeader?.('Content-Type', contentType);
    res.setHeader?.('Access-Control-Allow-Origin', '*');
  } catch {
    // ignore
  }
  if (typeof res.status === 'function' && typeof res.send === 'function') {
    res.status(status).send(text);
    return;
  }
  res.end(text);
}

export async function writeNodeResponse(res: NodeRes, response: Response): Promise<void> {
  const contentType = response.headers.get('Content-Type') || 'application/json';
  sendNode(res, response.status, await response.text(), contentType);
}

function jsonErrorPayload(message: string) {
  return JSON.stringify({ error: message, code: 'INTERNAL_ERROR' });
}

export function createLazyFetchHandler(load: () => Promise<FetchHandler>) {
  return asVercelNodeHandler(async (request) => {
    const fetchFn = await load();
    return fetchFn(request);
  });
}

/**
 * Default export das Functions `/api`: função (req, res) que sempre chama res.end().
 */
export function asVercelNodeHandler(fetchFn: FetchHandler) {
  const handler = async function vercelApi(req: unknown, res?: unknown): Promise<Response | void> {
    try {
      const request = isWebRequest(req) ? req : await fromNodeRequest((req || {}) as Parameters<typeof fromNodeRequest>[0]);
      const response = await fetchFn(request);
      if (isNodeRes(res)) {
        await writeNodeResponse(res, response);
        return;
      }
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro interno na API';
      console.error('[vercel-handler]', message);
      if (isNodeRes(res)) {
        try {
          sendNode(res, 500, jsonErrorPayload(message), 'application/json');
          return;
        } catch (writeErr: unknown) {
          console.error('[vercel-handler] write failed', writeErr);
        }
      }
      return new Response(jsonErrorPayload(message), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  };
  (handler as { fetch: FetchHandler }).fetch = async (request: Request) => {
    try {
      return await fetchFn(request);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro interno na API';
      return new Response(jsonErrorPayload(message), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  };
  return handler;
}
