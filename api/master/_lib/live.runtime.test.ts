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

  it('rota /api/master/session exporta função Node (req, res)', async () => {
    const mod = await import('../session');
    expect(typeof mod.default).toBe('function');
  });
});
