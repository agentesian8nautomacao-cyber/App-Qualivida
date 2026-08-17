import { describe, expect, it } from 'vitest';
import {
  normalizePublicSupabaseUrl,
  resolvePublicSupabaseConfig
} from './supabaseEnv';

describe('resolvePublicSupabaseConfig', () => {
  it('marca ausente como placeholder (erro controlado)', () => {
    const cfg = resolvePublicSupabaseConfig('', '');
    expect(cfg.isPlaceholder).toBe(true);
    expect(cfg.url).toBe('');
    expect(cfg.anonKey).toBe('');
  });

  it('rejeita placeholders de .env.example / .env.production', () => {
    expect(
      resolvePublicSupabaseConfig(
        'https://xxxx.supabase.co',
        'xxxx'
      ).isPlaceholder
    ).toBe(true);
    expect(
      resolvePublicSupabaseConfig(
        'https://SEU-PROJETO.supabase.co',
        'SEU_SUPABASE_ANON_KEY'
      ).isPlaceholder
    ).toBe(true);
  });

  it('aceita URL cloud https://<ref>.supabase.co com JWT anon longo', () => {
    const key = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${'a'.repeat(80)}.${'b'.repeat(40)}`;
    const cfg = resolvePublicSupabaseConfig(
      'https://abcdefghijklmnop.supabase.co/',
      key
    );
    expect(cfg.isPlaceholder).toBe(false);
    expect(cfg.url).toBe('https://abcdefghijklmnop.supabase.co');
    expect(cfg.anonKey).toBe(key);
  });

  it('aceita Supabase local/LAN http (não exige .supabase.co)', () => {
    const key = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${'a'.repeat(80)}.${'b'.repeat(40)}`;
    const cfg = resolvePublicSupabaseConfig('http://192.168.0.10:54321', key);
    expect(cfg.isPlaceholder).toBe(false);
    expect(cfg.url).toBe('http://192.168.0.10:54321');
  });
});

describe('normalizePublicSupabaseUrl', () => {
  it('força https no host *.supabase.co', () => {
    expect(normalizePublicSupabaseUrl('abcdefghijklmnop.supabase.co')).toBe(
      'https://abcdefghijklmnop.supabase.co'
    );
  });

  it('rejeita protocolo inválido', () => {
    expect(normalizePublicSupabaseUrl('ftp://x.supabase.co')).toBe('');
  });
});
