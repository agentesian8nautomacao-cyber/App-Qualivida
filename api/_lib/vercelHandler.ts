/**
 * Adapter Vercel: aceita Web Request (fetch) e Node (req, res).
 * Evita 500 HTML quando o runtime Node não chama `export default { fetch }`.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

type FetchHandler = (request: Request) => Promise<Response>;

function isWebRequest(input: unknown): input is Request {
  return (
    typeof Request !== 'undefined' &&
    input instanceof Request
  );
}

function isNodeResponse(input: unknown): input is ServerResponse {
  return (
    typeof input === 'object' &&
    input !== null &&
    typeof (input as ServerResponse).end === 'function' &&
    typeof (input as ServerResponse).setHeader === 'function'
  );
}

async function fromNodeRequest(req: IncomingMessage): Promise<Request> {
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
  let body: Uint8Array | undefined;
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length) body = new Uint8Array(Buffer.concat(chunks));
  }
  return new Request(url, {
    method,
    headers,
    body: body ? body : undefined
  });
}

async function writeNodeResponse(res: ServerResponse, response: Response): Promise<void> {
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
  const handler = async (req: Request | IncomingMessage, res?: ServerResponse): Promise<Response | void> => {
    try {
      const request = isWebRequest(req) ? req : await fromNodeRequest(req as IncomingMessage);
      const response = await fetchFn(request);
      if (isNodeResponse(res)) {
        await writeNodeResponse(res, response);
        return;
      }
      return response;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro interno na API';
      console.error('[vercel-handler]', message);
      const response = jsonError(message);
      if (isNodeResponse(res)) {
        await writeNodeResponse(res, response);
        return;
      }
      return response;
    }
  };
  return handler;
}
