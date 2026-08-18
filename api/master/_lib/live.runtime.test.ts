/**
 * API Master live — contratos HTTP sem JWT real e sem service_role.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { handleLiveMasterRequest } from './live';

const ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
const originalFetch = globalThis.fetch;

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

function setServerEnv() {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-test-key-not-a-secret';
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.VITE_SUPABASE_ANON_KEY;
}

function mockSupabase(opts: {
  throwAuth?: boolean;
  throwAdmin?: boolean;
  user?: { id: string; email?: string | null } | null;
  admin?: { id: string; user_id: string; role: string; status: string } | null;
}) {
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/auth/v1/user')) {
      if (opts.throwAuth) throw new TypeError('fetch failed');
      if (!opts.user) {
        return new Response(JSON.stringify({ message: 'invalid claim' }), { status: 401 });
      }
      return new Response(JSON.stringify(opts.user), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url.includes('platform_admins')) {
      if (opts.throwAdmin) throw new TypeError('fetch failed');
      const rows = opts.admin ? [opts.admin] : [];
      return new Response(JSON.stringify(rows), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (url.includes('platform_audit_events')) {
      return new Response('', { status: 201 });
    }
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
}

describe('handleLiveMasterRequest', () => {
  snapshotEnv();
  afterEach(() => {
    restoreEnv();
    globalThis.fetch = originalFetch;
  });

  it('sem env serverless retorna CONFIG_MISSING (500 JSON, não 403)', async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const res = await handleLiveMasterRequest(new Request('https://x/api/master/session'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code?: string; stage?: string };
    expect(body.code).toBe('CONFIG_MISSING');
    expect(body.stage).toBe('SUPABASE_CLIENT_INIT');
  });

  it('com env e sem Bearer retorna 401, não 500', async () => {
    setServerEnv();
    const res = await handleLiveMasterRequest(new Request('https://x/api/master/session'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('UNAUTHENTICATED');
  });

  it('JWT inválido (Auth 401) retorna 401, não 500', async () => {
    setServerEnv();
    mockSupabase({ user: null });
    const res = await handleLiveMasterRequest(
      new Request('https://x/api/master/session', { headers: { Authorization: 'Bearer not-a-real-jwt' } })
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('UNAUTHENTICATED');
  });

  it('usuário autenticado mas não Master retorna 403', async () => {
    setServerEnv();
    mockSupabase({
      user: { id: 'user-common-1', email: 'user@example.com' },
      admin: null
    });
    const res = await handleLiveMasterRequest(
      new Request('https://x/api/master/session', { headers: { Authorization: 'Bearer user-jwt' } })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string; reason?: string };
    expect(body.code).toBe('FORBIDDEN');
    expect(body.reason).toBe('NOT_MASTER');
  });

  it('Master ativo retorna 200 com admin', async () => {
    setServerEnv();
    mockSupabase({
      user: { id: 'user-master-1', email: 'master@example.com' },
      admin: {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: 'user-master-1',
        role: 'platform_owner',
        status: 'active'
      }
    });
    const res = await handleLiveMasterRequest(
      new Request('https://x/api/master/session', { headers: { Authorization: 'Bearer master-jwt' } })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok?: boolean; admin?: { role?: string; status?: string } };
    expect(body.ok).toBe(true);
    expect(body.admin?.role).toBe('platform_owner');
    expect(body.admin?.status).toBe('active');
  });

  it('Master suspenso retorna 403 SUSPENDED', async () => {
    setServerEnv();
    mockSupabase({
      user: { id: 'user-master-1', email: 'master@example.com' },
      admin: {
        id: '11111111-1111-4111-8111-111111111111',
        user_id: 'user-master-1',
        role: 'platform_owner',
        status: 'suspended'
      }
    });
    const res = await handleLiveMasterRequest(
      new Request('https://x/api/master/session', { headers: { Authorization: 'Bearer master-jwt' } })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { reason?: string };
    expect(body.reason).toBe('SUSPENDED');
  });

  it('rota /api/master/session é função Node com import estático (sem .fetch)', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../session.ts'), 'utf8');
    expect(src).toMatch(/from '\.\/_lib\/nodeEntry'/);
    expect(src).not.toMatch(/await import\(/);
    expect(src).toMatch(/export default async function handler/);
    expect(src).not.toMatch(/@supabase\/supabase-js/);
    const mod = await import('../session');
    expect(typeof mod.default).toBe('function');
    expect((mod.default as { fetch?: unknown }).fetch).toBeUndefined();
  });

  it('handler Node sem Bearer devolve JSON 401, não throw', async () => {
    setServerEnv();
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

  it('URL Supabase inválida não chama fetch e retorna CONFIG_MISSING', async () => {
    process.env.SUPABASE_URL = 'not-a-valid-url';
    process.env.SUPABASE_ANON_KEY = 'anon-test-key-not-a-secret';
    const res = await handleLiveMasterRequest(
      new Request('https://x/api/master/session', { headers: { Authorization: 'Bearer abc' } })
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code?: string; stage?: string };
    expect(body.code).toBe('CONFIG_MISSING');
    expect(body.stage).toBe('SUPABASE_CLIENT_INIT');
  });

  it('env com aspas (painel Vercel) ainda autentica o contrato 401 sem Bearer', async () => {
    process.env.SUPABASE_URL = '"https://example.supabase.co"';
    process.env.SUPABASE_ANON_KEY = '"anon-test-key-not-a-secret"';
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    const res = await handleLiveMasterRequest(new Request('https://x/api/master/session'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('UNAUTHENTICATED');
  });

  it('falha de rede no Auth registra etapa AUTH_GET_USER (500 MASTER_API_ERROR)', async () => {
    setServerEnv();
    mockSupabase({ throwAuth: true });
    const res = await handleLiveMasterRequest(
      new Request('https://x/api/master/session', { headers: { Authorization: 'Bearer abc' } })
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string; stage?: string; exception?: string };
    expect(body.error).toBe('MASTER_API_ERROR');
    expect(body.stage).toBe('AUTH_GET_USER');
    expect(body.exception).toBe('TypeError');
  });

  it('falha de rede em platform_admins registra etapa PLATFORM_ADMIN_CHECK', async () => {
    setServerEnv();
    mockSupabase({
      throwAdmin: true,
      user: { id: 'user-1', email: 'a@b.c' }
    });
    const res = await handleLiveMasterRequest(
      new Request('https://x/api/master/session', { headers: { Authorization: 'Bearer abc' } })
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string; stage?: string; exception?: string };
    expect(body.error).toBe('MASTER_API_ERROR');
    expect(body.stage).toBe('PLATFORM_ADMIN_CHECK');
    expect(body.exception).toBe('TypeError');
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
    const nodeEntry = readFileSync(join(here, 'nodeEntry.ts'), 'utf8');
    expect(nodeEntry).not.toMatch(/@supabase\/supabase-js/);
  });
});
