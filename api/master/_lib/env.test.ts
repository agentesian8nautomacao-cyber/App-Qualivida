/**
 * Config Master — sanitiza env da Vercel sem expor secrets.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanEnvValue, resolveMasterServerConfig } from './env';

const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY'
] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function snapshot() {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
}
function restore() {
  for (const key of ENV_KEYS) {
    const v = saved[key];
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  }
}

describe('resolveMasterServerConfig', () => {
  snapshot();
  afterEach(restore);

  it('cleanEnvValue remove aspas e quebras de linha', () => {
    expect(cleanEnvValue('"https://x.supabase.co"')).toBe('https://x.supabase.co');
    expect(cleanEnvValue('https://x.supabase.co\n')).toBe('https://x.supabase.co');
  });

  it('prefere SUPABASE_URL/ANON_KEY e ignora URL inválida', () => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.SUPABASE_URL = '"https://proj.supabase.co/"';
    process.env.SUPABASE_ANON_KEY = '"anon-key-xx"';
    const cfg = resolveMasterServerConfig();
    expect(cfg?.url).toBe('https://proj.supabase.co');
    expect(cfg?.anonKey).toBe('anon-key-xx');
  });

  it('não lê SERVICE_ROLE_KEY da env', () => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sr-should-be-ignored';
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = 'sr-should-be-ignored';
    expect(resolveMasterServerConfig()).toBeNull();
    process.env.SUPABASE_URL = 'https://proj.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'anon-key-xx';
    const cfg = resolveMasterServerConfig();
    expect(cfg?.anonKey).toBe('anon-key-xx');
    expect(cfg?.anonKey).not.toContain('sr-');
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  });
});
