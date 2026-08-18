/**
 * Runtime Vercel — export `{ fetch }` e conversão Node sem headers proibidos.
 */

import { describe, expect, it } from 'vitest';
import {
  asVercelFetchExport,
  asVercelNodeHandler,
  fromNodeRequest
} from './vercelHandler';

describe('asVercelFetchExport', () => {
  it('exporta objeto { fetch }, não uma função (req, res)', () => {
    const exp = asVercelFetchExport(async () => new Response('ok'));
    expect(typeof exp).toBe('object');
    expect(typeof exp.fetch).toBe('function');
    expect(Array.isArray(exp) || typeof exp === 'function').toBe(false);
  });
});

describe('fromNodeRequest', () => {
  it('não copia header Host (proibido no Fetch / Node 18+)', async () => {
    const request = await fromNodeRequest({
      method: 'GET',
      url: '/api/master/session',
      headers: {
        host: 'app.example.vercel.app',
        authorization: 'Bearer test-token',
        connection: 'keep-alive',
        'content-length': '0'
      }
    });
    expect(request.url).toContain('/api/master/session');
    expect(request.headers.get('authorization')).toBe('Bearer test-token');
    expect(request.headers.get('host')).toBeNull();
    expect(request.headers.get('connection')).toBeNull();
  });
});

describe('asVercelNodeHandler fallback', () => {
  it('escreve JSON no res.end quando o runtime passa (req, res) Node', async () => {
    const handler = asVercelNodeHandler(async () => {
      return new Response(JSON.stringify({ error: 'Não autenticado', code: 'UNAUTHENTICATED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: '',
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      end(b?: Buffer | string | Uint8Array) {
        this.body = typeof b === 'string' ? b : Buffer.from(b || []).toString('utf8');
      }
    };
    await handler(
      {
        method: 'GET',
        url: '/api/master/session',
        headers: { host: 'localhost', authorization: 'Bearer x' }
      },
      res
    );
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).code).toBe('UNAUTHENTICATED');
  });
});
