/**
 * Runtime Vercel — função (req, res) e conversão sem headers proibidos.
 */

import { describe, expect, it } from 'vitest';
import { asVercelNodeHandler, fromNodeRequest } from './vercelHandler';

describe('asVercelNodeHandler', () => {
  it('exporta função (req, res), não objeto { fetch }', () => {
    const handler = asVercelNodeHandler(async () => new Response('ok'));
    expect(typeof handler).toBe('function');
  });

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
      end(b?: string | Uint8Array) {
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

  it('erro no fetchFn vira JSON 500 no res.end, não throw', async () => {
    const handler = asVercelNodeHandler(async () => {
      throw new Error('boom-test');
    });
    const res = {
      statusCode: 0,
      body: '',
      setHeader() {},
      end(b?: string | Uint8Array) {
        this.body = typeof b === 'string' ? b : Buffer.from(b || []).toString('utf8');
      }
    };
    await handler({ method: 'GET', url: '/api/master/session', headers: { host: 'localhost' } }, res);
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body) as { error: string; code: string };
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.error).toContain('boom-test');
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
