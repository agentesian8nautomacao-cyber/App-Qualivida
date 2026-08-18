/**
 * GET/PATCH /api/master/* — Function Node autossuficiente.
 * ZERO imports: import estático/dinâmico derruba o lambda na Vercel
 * (FUNCTION_INVOCATION_FAILED / stage entry MODULE_NOT_FOUND).
 * Sem SDK Supabase. Sem .fetch. Sem service_role.
 */
export default async function handler(req: unknown, res?: unknown) {
  const request_id = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let stage = 'MASTER_SESSION_START';
  const method = String((req as { method?: string })?.method || 'GET').toUpperCase();
  const path = pathOf(req);

  const send = (status: number, body: Record<string, unknown>) => {
    const payload = JSON.stringify({ ...body, request_id });
    const node = res as { statusCode?: number; setHeader?: (k: string, v: string) => void; end?: (b?: string) => void } | undefined;
    if (node && typeof node.end === 'function') {
      node.statusCode = status;
      try {
        node.setHeader?.('Content-Type', 'application/json');
        node.setHeader?.('Access-Control-Allow-Origin', '*');
      } catch {
        /* ignore */
      }
      node.end(payload);
      return;
    }
    return new Response(payload, {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  };

  try {
    if (method === 'OPTIONS') {
      return send(204, { ok: true });
    }

    stage = 'SUPABASE_CLIENT_INIT';
    const cfg = resolveConfig();
    if (!cfg) {
      return send(500, {
        error:
          'Configuração indisponível na API Master. No Vercel: Settings → Environment Variables, crie SUPABASE_URL e SUPABASE_ANON_KEY (cópia da anon) e faça Redeploy.',
        code: 'CONFIG_MISSING',
        stage,
        details: envFlags()
      });
    }

    stage = 'AUTH_HEADER_CHECK';
    const token = readBearer(req);
    if (!token) {
      return send(401, { error: 'Não autenticado', code: 'UNAUTHENTICATED' });
    }

    stage = 'GET_AUTH_USER';
    const user = await fetchAuthUser(cfg.url, cfg.anonKey, token);
    if (!user?.id) {
      return send(401, { error: 'Sessão expirada ou inválida', code: 'UNAUTHENTICATED' });
    }

    stage = 'PLATFORM_ADMIN_LOOKUP';
    const admin = await fetchPlatformAdmin(cfg.url, cfg.anonKey, token, user.id);

    stage = 'PLATFORM_ADMIN_STATUS_CHECK';
    if (!admin || admin.user_id !== user.id) {
      await auditSafe(cfg, token, user.id, 'MASTER_ACCESS_DENIED', 'platform', null, {
        reason: 'NOT_MASTER'
      });
      return send(403, { error: 'Acesso Master negado', code: 'FORBIDDEN', reason: 'NOT_MASTER' });
    }
    if (admin.status !== 'active') {
      await auditSafe(cfg, token, user.id, 'MASTER_ACCESS_DENIED', 'platform', null, {
        reason: 'SUSPENDED'
      });
      return send(403, { error: 'Acesso Master negado', code: 'FORBIDDEN', reason: 'SUSPENDED' });
    }
    if (admin.role !== 'platform_owner' && admin.role !== 'platform_admin') {
      return send(403, { error: 'Acesso Master negado', code: 'FORBIDDEN', reason: 'ACTION_DENIED' });
    }

    stage = 'MASTER_SESSION_RESPONSE';
    if (path.endsWith('/session') && method === 'GET') {
      await auditSafe(cfg, token, user.id, 'MASTER_LOGIN', 'platform_admins', admin.id, {
        role: admin.role
      });
      return send(200, {
        ok: true,
        admin: { id: admin.id, role: admin.role, status: admin.status }
      });
    }

    if (path.endsWith('/dashboard') && method === 'GET') {
      const orgs = await fetchOrganizations(cfg, token);
      const sites = await fetchSitesCount(cfg, token);
      return send(200, {
        ok: true,
        metrics: {
          organizations_total: orgs.length,
          organizations_active: orgs.filter((o) => o.status === 'active').length,
          organizations_suspended: orgs.filter((o) => o.status === 'suspended').length,
          sites_operational: sites,
          subscriptions_active: null,
          subscriptions_expired: null,
          trial: null,
          mrr: null
        },
        billing: 'Não configurado'
      });
    }

    const orgMatch = path.match(/\/organizations\/([0-9a-f-]{36})$/i);
    if (orgMatch && method === 'GET') {
      const org = await fetchOrganization(cfg, token, orgMatch[1]);
      if (!org) return send(404, { error: 'Organização não encontrada', code: 'NOT_FOUND' });
      const sites = await fetchSitesByOrg(cfg, token, orgMatch[1]);
      await auditSafe(cfg, token, user.id, 'ORGANIZATION_VIEW', 'organizations', orgMatch[1]);
      return send(200, {
        ok: true,
        organization: org,
        sites,
        subscription: 'Não configurado',
        users: 'Não configurado',
        audit: []
      });
    }

    if (orgMatch && method === 'PATCH') {
      if (admin.role !== 'platform_owner' && admin.role !== 'platform_admin') {
        return send(403, { error: 'Acesso Master negado', code: 'FORBIDDEN' });
      }
      const body = await readJsonBody(req);
      const patch: { name?: string; slug?: string; status?: string } = {};
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
      if (typeof body.slug === 'string' && body.slug.trim()) patch.slug = body.slug.trim();
      if (typeof body.status === 'string') {
        const st = body.status.trim().toLowerCase();
        if (st !== 'active' && st !== 'suspended') {
          return send(400, { error: 'Status inválido', code: 'BAD_REQUEST' });
        }
        patch.status = st;
      }
      if (Object.keys(patch).length === 0) {
        return send(400, { error: 'Nenhum campo para atualizar', code: 'BAD_REQUEST' });
      }
      const updated = await patchOrganization(cfg, token, orgMatch[1], patch);
      if (!updated) return send(404, { error: 'Organização não encontrada', code: 'NOT_FOUND' });
      await auditSafe(cfg, token, user.id, 'ORGANIZATION_UPDATE', 'organizations', orgMatch[1], {
        fields: Object.keys(patch)
      });
      return send(200, { ok: true, organization: updated });
    }

    if (path.endsWith('/organizations') && method === 'GET') {
      const list = await fetchOrganizations(cfg, token);
      const withSites = [];
      for (const org of list) {
        const s = await fetchSitesByOrg(cfg, token, org.id);
        withSites.push({ ...org, sites_count: s.length });
      }
      await auditSafe(cfg, token, user.id, 'ORGANIZATION_VIEW', 'organizations', null, {
        count: withSites.length
      });
      return send(200, {
        ok: true,
        organizations: withSites,
        subscription: 'Não configurado',
        plan: 'Não configurado'
      });
    }

    return send(404, { error: 'Rota Master não encontrada', code: 'NOT_FOUND' });
  } catch (err: unknown) {
    const exception = err instanceof Error ? err.name : 'Error';
    const code = (err as { code?: string } | null)?.code;
    const message = sanitize(err instanceof Error ? err.message : String(err));
    console.error(
      JSON.stringify({
        src: 'master-session',
        request_id,
        method,
        path,
        stage,
        exception,
        code,
        message,
        ...envFlags()
      })
    );
    return send(500, {
      error: 'MASTER_API_ERROR',
      message: 'Falha na API Master',
      code: 'INTERNAL_ERROR',
      stage,
      exception
    });
  }
}

type Cfg = { url: string; anonKey: string };
type AdminRow = { id: string; user_id: string; role: string; status: string };
type OrgRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
};

function sanitize(raw: string): string {
  return String(raw || '')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]')
    .replace(/service_role|anon[_-]?key/gi, '[key]')
    .replace(/apikey[=:]\s*\S+/gi, 'apikey=[redacted]')
    .slice(0, 180);
}

function cleanEnv(raw: string | undefined): string {
  if (!raw) return '';
  let v = String(raw).replace(/^\uFEFF/, '').trim();
  if (
    (v.startsWith('"') && v.endsWith('"') && v.length >= 2) ||
    (v.startsWith("'") && v.endsWith("'") && v.length >= 2)
  ) {
    v = v.slice(1, -1).trim();
  }
  return v.replace(/[\r\n]+/g, '').trim();
}

function envFlags() {
  return {
    has_SUPABASE_URL: Boolean(cleanEnv(process.env.SUPABASE_URL)),
    has_VITE_SUPABASE_URL: Boolean(cleanEnv(process.env.VITE_SUPABASE_URL)),
    has_SUPABASE_ANON_KEY: Boolean(cleanEnv(process.env.SUPABASE_ANON_KEY)),
    has_VITE_SUPABASE_ANON_KEY: Boolean(cleanEnv(process.env.VITE_SUPABASE_ANON_KEY))
  };
}

function resolveConfig(): Cfg | null {
  const url = cleanEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/+$/, '');
  const anonKey = cleanEnv(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  } catch {
    return null;
  }
  if (!anonKey || anonKey.length < 8) return null;
  return { url, anonKey };
}

function pathOf(req: unknown): string {
  const raw = String((req as { url?: string })?.url || '/');
  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return new URL(raw).pathname.replace(/\/$/, '') || '/';
    }
  } catch {
    /* ignore */
  }
  return (raw.split('?')[0] || '/').replace(/\/$/, '') || '/';
}

function headerOf(req: unknown, name: string): string {
  try {
    const headers = (req as { headers?: unknown })?.headers as
      | { get?: (n: string) => string | null }
      | Record<string, string | string[] | undefined>
      | undefined;
    if (!headers) return '';
    if (typeof (headers as { get?: unknown }).get === 'function') {
      const g = headers as { get: (n: string) => string | null };
      return g.get(name) || g.get(name.toLowerCase()) || '';
    }
    const o = headers as Record<string, string | string[] | undefined>;
    const v = o[name] ?? o[name.toLowerCase()];
    if (Array.isArray(v)) return v.join(', ');
    return v ? String(v) : '';
  } catch {
    return '';
  }
}

function readBearer(req: unknown): string | null {
  const token = /^Bearer\s+(\S+)/i.exec(headerOf(req, 'Authorization').trim())?.[1] || '';
  if (!token || /[\r\n\0]/.test(token)) return null;
  return token;
}

function restHeaders(anonKey: string, token: string, jsonBody = false): Record<string, string> {
  const h: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  };
  if (jsonBody) h['Content-Type'] = 'application/json';
  return h;
}

async function parseJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!res.ok || !text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function fetchAuthUser(url: string, anonKey: string, token: string): Promise<{ id: string } | null> {
  const res = await fetch(`${url}/auth/v1/user`, { method: 'GET', headers: restHeaders(anonKey, token) });
  const data = await parseJson<{ id?: string }>(res);
  return data?.id ? { id: data.id } : null;
}

async function fetchPlatformAdmin(
  url: string,
  anonKey: string,
  token: string,
  userId: string
): Promise<AdminRow | null> {
  const q = `${url}/rest/v1/platform_admins?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,role,status`;
  const res = await fetch(q, { method: 'GET', headers: restHeaders(anonKey, token) });
  const data = await parseJson<AdminRow[] | AdminRow>(res);
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function fetchOrganizations(cfg: Cfg, token: string): Promise<OrgRow[]> {
  const res = await fetch(
    `${cfg.url}/rest/v1/organizations?select=id,name,slug,status,created_at,updated_at&order=created_at.desc`,
    { method: 'GET', headers: restHeaders(cfg.anonKey, token) }
  );
  const data = await parseJson<OrgRow[]>(res);
  return Array.isArray(data) ? data : [];
}

async function fetchOrganization(cfg: Cfg, token: string, id: string): Promise<OrgRow | null> {
  const res = await fetch(
    `${cfg.url}/rest/v1/organizations?id=eq.${encodeURIComponent(id)}&select=id,name,slug,status,created_at,updated_at`,
    { method: 'GET', headers: restHeaders(cfg.anonKey, token) }
  );
  const data = await parseJson<OrgRow[] | OrgRow>(res);
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function patchOrganization(
  cfg: Cfg,
  token: string,
  id: string,
  patch: { name?: string; slug?: string; status?: string }
): Promise<OrgRow | null> {
  const res = await fetch(`${cfg.url}/rest/v1/organizations?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...restHeaders(cfg.anonKey, token, true), Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  const data = await parseJson<OrgRow[] | OrgRow>(res);
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function fetchSitesByOrg(cfg: Cfg, token: string, organizationId: string) {
  const res = await fetch(
    `${cfg.url}/rest/v1/condominiums?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,organization_id,name,slug,vertical,status`,
    { method: 'GET', headers: restHeaders(cfg.anonKey, token) }
  );
  const data = await parseJson<Array<Record<string, unknown>>>(res);
  return Array.isArray(data) ? data : [];
}

async function fetchSitesCount(cfg: Cfg, token: string): Promise<number> {
  const res = await fetch(`${cfg.url}/rest/v1/condominiums?select=id`, {
    method: 'GET',
    headers: restHeaders(cfg.anonKey, token)
  });
  const data = await parseJson<{ id: string }[]>(res);
  return Array.isArray(data) ? data.length : 0;
}

async function auditSafe(
  cfg: Cfg,
  token: string,
  actor_user_id: string,
  action: string,
  resource_type: string | null,
  resource_id: string | null,
  metadata: Record<string, unknown>
) {
  try {
    await fetch(`${cfg.url}/rest/v1/platform_audit_events`, {
      method: 'POST',
      headers: restHeaders(cfg.anonKey, token, true),
      body: JSON.stringify({
        actor_user_id,
        action,
        resource_type,
        resource_id,
        metadata
      })
    });
  } catch {
    /* auditoria não bloqueia */
  }
}

async function readJsonBody(req: unknown): Promise<Record<string, unknown>> {
  try {
    const r = req as { json?: () => Promise<unknown>; [Symbol.asyncIterator]?: () => AsyncIterableIterator<unknown> };
    if (typeof r.json === 'function') {
      const raw = await r.json();
      return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    }
    if (typeof r[Symbol.asyncIterator] === 'function') {
      const chunks: Uint8Array[] = [];
      for await (const chunk of r as AsyncIterable<Uint8Array | string | Buffer>) {
        if (typeof chunk === 'string') chunks.push(new TextEncoder().encode(chunk));
        else chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      }
      if (!chunks.length) return {};
      const total = chunks.reduce((n, c) => n + c.byteLength, 0);
      const body = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        body.set(c, offset);
        offset += c.byteLength;
      }
      const text = new TextDecoder().decode(body);
      const parsed = text ? JSON.parse(text) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
  } catch {
    return {};
  }
  return {};
}
