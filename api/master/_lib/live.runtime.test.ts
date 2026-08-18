/**
 * API Master live — contratos HTTP sem JWT real e sem service_role.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { handleLiveMasterRequest } from './live';

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function snapshotEnv() {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const v = saved[key];
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  }
}

describe('handleLiveMasterRequest', () => {
  snapshotEnv();
  afterEach(() => restoreEnv());

  it('sem env serverless retorna CONFIG_MISSING (500 JSON, não 403)', async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const res = await handleLiveMasterRequest(new Request('https://x/api/master/session'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('CONFIG_MISSING');
  });

  it('com env e sem Bearer retorna 401, não 500', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-test-key-not-a-secret';
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    const res = await handleLiveMasterRequest(new Request('https://x/api/master/session'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('UNAUTHENTICATED');
  });

  it('rota /api/master/session é função Node sem import estático', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../session.ts'), 'utf8');
    expect(src).not.toMatch(/^import /m);
    expect(src).toMatch(/export default async function handler/);
    const mod = await import('../session');
    expect(typeof mod.default).toBe('function');
    expect((mod.default as { fetch?: unknown }).fetch).toBeUndefined();
  });

  it('handler Node sem Bearer devolve JSON 401, não throw', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-test-key-not-a-secret';
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    const mod = await import('../session');
    const res = {
      statusCode: 0,
      body: '',
      setHeader() {},
      end(b?: string) {
        this.body = typeof b === 'string' ? b : '';
      }
    };
    await mod.default({ method: 'GET', url: '/api/master/session', headers: { host: 'localhost' } }, res);
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body) as { code?: string };
    expect(body.code).toBe('UNAUTHENTICATED');
  });

  it('URL Supabase inválida + token não derruba a Function', async () => {
    process.env.SUPABASE_URL = 'not-a-valid-url';
    process.env.SUPABASE_ANON_KEY = 'anon-test-key-not-a-secret';
    const res = await handleLiveMasterRequest(
      new Request('https://x/api/master/session', { headers: { Authorization: 'Bearer abc' } })
    );
    expect([401, 500]).toContain(res.status);
    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe('string');
  });

  it('live/handler Master não importam @supabase/supabase-js', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));
    const live = readFileSync(join(here, 'live.ts'), 'utf8');
    const handler = readFileSync(join(here, 'handler.ts'), 'utf8');
    const rest = readFileSync(join(here, 'restStore.ts'), 'utf8');
    expect(live).not.toMatch(/@supabase\/supabase-js/);
    expect(handler).not.toMatch(/@supabase\/supabase-js/);
    expect(rest).not.toMatch(/@supabase\/supabase-js/);
  });
});
