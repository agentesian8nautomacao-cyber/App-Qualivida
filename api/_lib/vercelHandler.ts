/**
 * Adapter Vercel Node (req, res) + Web Request.
 * No Vercel, o runtime clássico de /api exige res.end(); devolver só Response
 * gera HTTP 500 HTML sem JSON — o frontend mascarava isso como falta de env.
 */

type FetchHandler = (request: Request) => Promise<Response>;

function isWebRequest(input: unknown): input is Request {
  if (!input || typeof input !== 'object') return false;
  const req = input as Request;
  return typeof req.headers?.get === 'function' && typeof req.clone === 'function';
}

async function fromNodeRequest(req: {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  [Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown>;
}): Promise<Request> {
  const host = String(req.headers.host || 'localhost');
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = (Array.isArray(protoHeader) ? protoHeader[0] : protoHeader) || 'https';
  const url = `${proto}://${host}${req.url || '/'}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
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

async function writeNodeResponse(
  res: {
    statusCode: number;
    setHeader: (k: string, v: string) => void;
    end: (b?: Buffer | string) => void;
  },
  response: Response
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

function jsonError(message: string, status = 500): Response {
  return new Response(JSON.stringify({ error: message, code: 'INTERNAL_ERROR' }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export function asVercelNodeHandler(fetchFn: FetchHandler) {
  return async function handler(req: unknown, res?: unknown): Promise<Response | void> {
    try {
      const request = isWebRequest(req) ? req : await fromNodeRequest(req as Parameters<typeof fromNodeRequest>[0]);
      const response = await fetchFn(request);
      if (res && typeof (res as { end?: unknown }).end === 'function') {
        await writeNodeResponse(res as Parameters<typeof writeNodeResponse>[0], response);
        return;
      }
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro interno na API';
      console.error('[vercel-handler]', message);
      const response = jsonError(message);
      if (res && typeof (res as { end?: unknown }).end === 'function') {
        await writeNodeResponse(res as Parameters<typeof writeNodeResponse>[0], response);
        return;
      }
      return response;
    }
  };
}
