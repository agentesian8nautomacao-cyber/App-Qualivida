/**
 * Configuração server-side da API Master.
 * Prefere SUPABASE_URL / SUPABASE_ANON_KEY (runtime Vercel).
 * Fallback: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (mesmo valor da anon).
 * Nunca lê service_role.
 */

export type MasterServerConfig = {
  url: string;
  anonKey: string;
};

export function sanitizeMasterLog(raw: string): string {
  return String(raw || '')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]')
    .replace(/service_role|anon[_-]?key/gi, '[key]')
    .replace(/apikey[=:]\s*\S+/gi, 'apikey=[redacted]')
    .slice(0, 180);
}

/** Remove aspas, BOM, quebras de linha (cola no painel da Vercel). */
export function cleanEnvValue(raw: string | undefined | null): string {
  if (raw == null) return '';
  let v = String(raw).replace(/^\uFEFF/, '').trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1).trim();
  }
  return v.replace(/[\r\n]+/g, '').trim();
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function resolveMasterServerConfig(): MasterServerConfig | null {
  const url = cleanEnvValue(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(
    /\/+$/,
    ''
  );
  const anonKey = cleanEnvValue(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  if (!url || !anonKey || !isHttpUrl(url) || anonKey.length < 8) return null;
  return { url, anonKey };
}

export function masterEnvFlags() {
  return {
    has_SUPABASE_URL: Boolean(cleanEnvValue(process.env.SUPABASE_URL)),
    has_VITE_SUPABASE_URL: Boolean(cleanEnvValue(process.env.VITE_SUPABASE_URL)),
    has_SUPABASE_ANON_KEY: Boolean(cleanEnvValue(process.env.SUPABASE_ANON_KEY)),
    has_VITE_SUPABASE_ANON_KEY: Boolean(cleanEnvValue(process.env.VITE_SUPABASE_ANON_KEY))
  };
}
