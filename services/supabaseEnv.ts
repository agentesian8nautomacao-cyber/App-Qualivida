/**
 * Resolução pública (frontend) de URL + anon key.
 * Sem secrets hardcoded. Sem service_role.
 */

const MIN_ANON_KEY_LEN = 30;

function isPlaceholderKey(key: string): boolean {
  const t = key.trim();
  if (!t) return true;
  if (t.length < MIN_ANON_KEY_LEN) return true;
  if (/^(xxxx+|seu_supabase_anon_key|your-anon-key|placeholder-key)$/i.test(t)) {
    return true;
  }
  return false;
}

function isPlaceholderUrl(url: string): boolean {
  const t = url.trim().toLowerCase();
  if (!t) return true;
  if (t.includes('xxxx.supabase.co')) return true;
  if (t.includes('seu-projeto.supabase.co')) return true;
  if (t.includes('placeholder.supabase.co')) return true;
  return false;
}

/**
 * Normaliza URL pública do Supabase.
 * Cloud: https://<ref>.supabase.co
 * Local/LAN: http(s)://host:port (self-hosted)
 */
export function normalizePublicSupabaseUrl(raw: string): string {
  const input = (raw || '').trim();
  if (!input) return '';
  try {
    const withProto = input.includes('://') ? input : `https://${input}`;
    const u = new URL(withProto);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (u.hostname.toLowerCase().endsWith('.supabase.co')) {
      return `https://${u.hostname}`;
    }
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
  isPlaceholder: boolean;
};

export function resolvePublicSupabaseConfig(
  rawUrl: string,
  rawKey: string
): PublicSupabaseConfig {
  const url = normalizePublicSupabaseUrl(rawUrl);
  const anonKey = (rawKey || '').trim();
  const isPlaceholder = isPlaceholderUrl(url) || isPlaceholderKey(anonKey);
  return {
    url: isPlaceholder ? '' : url,
    anonKey: isPlaceholder ? '' : anonKey,
    isPlaceholder
  };
}
