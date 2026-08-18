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
      let orgs = await fetchOrganizations(cfg, token);
      const now = Date.now();
      for (const org of orgs) {
        const p = org.profile && typeof org.profile === 'object' ? org.profile : {};
        const graceEnd = org.grace_ends_at || (typeof p.grace_ends_at === 'string' ? p.grace_ends_at : null);
        const autoBlock = org.auto_block_enabled === true || p.auto_block_enabled === true;
        const sub = String(org.subscription_status || p.subscription_status || 'active');
        if (
          org.status === 'active' &&
          org.scheduled_block_at &&
          Date.parse(String(org.scheduled_block_at)) <= now
        ) {
          await patchOrganization(cfg, token, org.id, {
            status: 'suspended',
            blocked_at: new Date().toISOString(),
            block_source: 'automatic',
            scheduled_block_at: null
          });
          await auditSafe(cfg, token, user.id, 'OPERATION_BLOCK', 'organizations', org.id, {
            source: 'automatic',
            previous_status: 'active',
            new_status: 'suspended'
          });
        } else if (
          org.status === 'active' &&
          autoBlock &&
          graceEnd &&
          Date.parse(String(graceEnd)) < now &&
          (sub === 'overdue' || sub === 'grace')
        ) {
          await patchOrganization(cfg, token, org.id, {
            status: 'suspended',
            blocked_at: new Date().toISOString(),
            block_reason: 'Período de tolerância encerrado',
            block_source: 'automatic',
            scheduled_block_at: null,
            profile: { ...p, subscription_status: 'overdue' }
          });
          await auditSafe(cfg, token, user.id, 'GRACE_PERIOD_EXPIRED', 'organizations', org.id, {
            auto_block: true
          });
          await auditSafe(cfg, token, user.id, 'OPERATION_BLOCK', 'organizations', org.id, {
            source: 'automatic',
            reason: 'Período de tolerância encerrado'
          });
        }
      }
      orgs = await fetchOrganizations(cfg, token);
      const siteRows = await fetchAllSites(cfg, token);
      const subOf = (o: OrgRow) => {
        const p = o.profile && typeof o.profile === 'object' ? o.profile : {};
        return String(o.subscription_status || p.subscription_status || 'active');
      };
      const alerts = orgs.flatMap((o) => {
        const p = o.profile && typeof o.profile === 'object' ? o.profile : {};
        const items: Array<Record<string, string>> = [];
        const graceEnd = o.grace_ends_at || (typeof p.grace_ends_at === 'string' ? p.grace_ends_at : '');
        if (graceEnd && Date.parse(graceEnd) < now && o.status !== 'suspended') {
          items.push({
            level: 'red',
            code: 'GRACE_EXPIRED',
            title: 'Organização com tolerância vencida',
            organization_id: o.id,
            organization_name: o.name
          });
        }
        return items;
      });
      return send(200, {
        ok: true,
        metrics: {
          organizations_total: orgs.length,
          organizations_active: orgs.filter((o) => o.status === 'active').length,
          organizations_suspended: orgs.filter((o) => o.status === 'suspended').length,
          sites_operational: siteRows.filter((s) => s.status === 'active').length,
          sites_blocked: siteRows.filter((s) => s.status === 'suspended').length,
          operations_active: siteRows.filter((s) => s.status === 'active').length,
          scheduled_blocks: orgs.filter((o) => o.scheduled_block_at).length,
          subscriptions_active: orgs.filter((o) => subOf(o) === 'active').length,
          subscriptions_overdue: orgs.filter((o) => subOf(o) === 'overdue').length,
          subscriptions_grace: orgs.filter((o) => subOf(o) === 'grace').length,
          subscriptions_suspended: orgs.filter((o) => subOf(o) === 'suspended').length,
          contracts_near_expiry: 0,
          subscriptions_expired: null,
          trial: null,
          mrr: null
        },
        alerts,
        organizations: orgs.map((o) => ({
          id: o.id,
          name: o.name,
          status: o.status,
          subscription_status: subOf(o),
          scheduled_block_at: o.scheduled_block_at || null,
          blocked_at: o.blocked_at || null,
          sites_count: siteRows.filter((s) => s.organization_id === o.id).length,
          profile: o.profile || null,
          contract_ends_at: o.contract_ends_at || null
        })),
        billing: 'Não configurado'
      });
    }

    if (path.endsWith('/organizations') && method === 'POST') {
      const body = await readJsonBody(req);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return send(400, { error: 'Nome obrigatório', code: 'BAD_REQUEST' });
      const created = await postOrganization(cfg, token, {
        name,
        slug: typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(name),
        status: 'active',
        profile: asProfile(body.profile),
        contract_starts_at: typeof body.contract_starts_at === 'string' ? body.contract_starts_at : null,
        contract_ends_at: typeof body.contract_ends_at === 'string' ? body.contract_ends_at : null
      });
      if (!created) {
        return send(503, {
          error:
            'Não foi possível criar a organização. Aplique a migration Master ops quando aprovada.',
          code: 'SCHEMA_PENDING'
        });
      }
      await auditSafe(cfg, token, user.id, 'ORGANIZATION_CREATE', 'organizations', created.id, { name });
      return send(201, { ok: true, organization: created });
    }

    const siteCreate = path.match(/\/organizations\/([0-9a-f-]{36})\/sites$/i);
    if (siteCreate && method === 'POST') {
      const body = await readJsonBody(req);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return send(400, { error: 'Nome do site obrigatório', code: 'BAD_REQUEST' });
      const created = await postSite(cfg, token, {
        organization_id: siteCreate[1],
        name,
        slug: typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(name),
        status: 'active',
        profile: asProfile(body.profile)
      });
      if (!created) {
        return send(503, {
          error: 'Não foi possível criar o site. Aplique a migration Master ops quando aprovada.',
          code: 'SCHEMA_PENDING'
        });
      }
      await auditSafe(cfg, token, user.id, 'SITE_CREATE', 'condominiums', created.id, {
        organization_id: siteCreate[1],
        name
      });
      return send(201, { ok: true, site: created });
    }

    const sitePatch = path.match(/\/sites\/([0-9a-f-]{36})$/i);
    if (sitePatch && method === 'PATCH') {
      const body = await readJsonBody(req);
      const patch: Record<string, unknown> = {};
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
      if (typeof body.slug === 'string' && body.slug.trim()) patch.slug = slugify(body.slug);
      if (typeof body.status === 'string') {
        const st = body.status.trim().toLowerCase();
        if (st !== 'active' && st !== 'suspended') {
          return send(400, { error: 'Status inválido', code: 'BAD_REQUEST' });
        }
        patch.status = st;
      }
      const profile = asProfile(body.profile);
      if (profile) patch.profile = profile;
      if (Object.keys(patch).length === 0) {
        return send(400, { error: 'Nenhum campo para atualizar', code: 'BAD_REQUEST' });
      }
      const updated = await patchSite(cfg, token, sitePatch[1], patch);
      if (!updated) return send(404, { error: 'Site não encontrado', code: 'NOT_FOUND' });
      await auditSafe(cfg, token, user.id, 'SITE_UPDATE', 'condominiums', sitePatch[1], {
        fields: Object.keys(patch),
        organization_id: updated.organization_id
      });
      return send(200, { ok: true, site: updated });
    }

    const blockMatch = path.match(/\/organizations\/([0-9a-f-]{36})\/(block|unblock)$/i);
    if (blockMatch && method === 'POST') {
      const org = await fetchOrganization(cfg, token, blockMatch[1]);
      if (!org) return send(404, { error: 'Organização não encontrada', code: 'NOT_FOUND' });
      const body = await readJsonBody(req);
      const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
      if (!reason) return send(400, { error: 'Motivo obrigatório', code: 'BAD_REQUEST' });
      const kind = blockMatch[2].toLowerCase();
      const immediate = body.immediate !== false;
      const scheduledAt =
        typeof body.scheduled_at === 'string' && body.scheduled_at.trim() ? body.scheduled_at : null;
      if (kind === 'block' && !immediate && scheduledAt) {
        const updated = await patchOrganization(cfg, token, org.id, {
          scheduled_block_at: scheduledAt,
          block_reason: reason,
          block_source: 'automatic'
        });
        await auditSafe(cfg, token, user.id, 'OPERATION_BLOCK_SCHEDULED', 'organizations', org.id, {
          reason,
          scheduled_at: scheduledAt,
          previous_status: org.status
        });
        return send(200, { ok: true, organization: updated || org });
      }
      if (kind === 'block') {
        const updated = await patchOrganization(cfg, token, org.id, {
          status: 'suspended',
          blocked_at: new Date().toISOString(),
          block_reason: reason,
          block_source: 'manual',
          scheduled_block_at: null
        });
        await auditSafe(cfg, token, user.id, 'OPERATION_BLOCK', 'organizations', org.id, {
          reason,
          source: 'manual',
          previous_status: org.status,
          new_status: 'suspended'
        });
        return send(200, { ok: true, organization: updated || org });
      }
      const updated = await patchOrganization(cfg, token, org.id, {
        status: 'active',
        blocked_at: null,
        block_reason: null,
        block_source: null,
        scheduled_block_at: null
      });
      await auditSafe(cfg, token, user.id, 'OPERATION_UNBLOCK', 'organizations', org.id, {
        reason,
        previous_status: org.status,
        new_status: 'active'
      });
      return send(200, { ok: true, organization: updated || org });
    }

    const adminAct = path.match(
      /\/organizations\/([0-9a-f-]{36})\/(delay|grace|regularize|contract-suspend|contract-terminate|auto-block)$/i
    );
    if (adminAct && method === 'POST') {
      const org = await fetchOrganization(cfg, token, adminAct[1]);
      if (!org) return send(404, { error: 'Organização não encontrada', code: 'NOT_FOUND' });
      const body = await readJsonBody(req);
      void body.user_id;
      const p = org.profile && typeof org.profile === 'object' ? { ...org.profile } : {};
      const kind = adminAct[2].toLowerCase();
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      const nowIso = new Date().toISOString();
      let auditAction = 'CONTRACT_UPDATED';
      const extra: Record<string, unknown> = {};
      if (kind === 'delay') {
        if (!reason) return send(400, { error: 'Motivo obrigatório', code: 'BAD_REQUEST' });
        extra.subscription_status = 'overdue';
        extra.administrative_notes = reason;
        extra.delay_identified_at = typeof body.identified_at === 'string' ? body.identified_at : nowIso;
        extra.delay_reference = typeof body.reference === 'string' ? body.reference : null;
        auditAction = 'SUBSCRIPTION_STATUS_CHANGED';
      } else if (kind === 'grace') {
        let start = typeof body.grace_started_at === 'string' ? body.grace_started_at : nowIso.slice(0, 10);
        let end = typeof body.grace_ends_at === 'string' ? body.grace_ends_at : '';
        const days = Number(body.grace_days);
        if (!end && Number.isFinite(days) && days > 0) {
          const d = new Date(start);
          d.setUTCDate(d.getUTCDate() + days);
          end = d.toISOString().slice(0, 10);
        }
        if (!end) return send(400, { error: 'Informe o fim da tolerância ou a quantidade de dias', code: 'BAD_REQUEST' });
        extra.subscription_status = 'grace';
        extra.grace_started_at = start;
        extra.grace_ends_at = end;
        auditAction = 'GRACE_PERIOD_STARTED';
      } else if (kind === 'regularize') {
        const current = String(p.subscription_status || org.subscription_status || 'active');
        if (current !== 'overdue' && current !== 'grace') {
          return send(400, {
            error: 'Somente organizações em atraso ou em tolerância podem ser regularizadas',
            code: 'BAD_REQUEST'
          });
        }
        if (!reason) return send(400, { error: 'Observação obrigatória', code: 'BAD_REQUEST' });
        extra.subscription_status = 'active';
        extra.regularized_at = typeof body.regularized_at === 'string' ? body.regularized_at : nowIso;
        extra.regularized_by = user.id;
        extra.administrative_notes = reason;
        extra.grace_started_at = null;
        extra.grace_ends_at = null;
        auditAction = 'SUBSCRIPTION_REGULARIZED';
      } else if (kind === 'contract-suspend' || kind === 'contract-terminate') {
        if (!reason) return send(400, { error: 'Motivo obrigatório', code: 'BAD_REQUEST' });
        extra.subscription_status = kind === 'contract-suspend' ? 'suspended' : 'terminated';
        extra.administrative_notes = reason;
        auditAction = kind === 'contract-suspend' ? 'CONTRACT_SUSPENDED' : 'CONTRACT_TERMINATED';
      } else {
        extra.auto_block_enabled = body.enabled !== false;
        auditAction = 'CONTRACT_UPDATED';
      }
      const updated = await patchOrganization(cfg, token, org.id, {
        ...extra,
        profile: { ...p, ...extra }
      });
      await auditSafe(cfg, token, user.id, auditAction, 'organizations', org.id, {
        reason: reason || null,
        to: extra.subscription_status || extra.auto_block_enabled
      });
      return send(200, { ok: true, organization: updated || org });
    }

    const orgMatch = path.match(/\/organizations\/([0-9a-f-]{36})$/i);
    if (orgMatch && method === 'GET') {
      const org = await fetchOrganization(cfg, token, orgMatch[1]);
      if (!org) return send(404, { error: 'Organização não encontrada', code: 'NOT_FOUND' });
      const sites = await fetchSitesByOrg(cfg, token, orgMatch[1]);
      const audit = await fetchAudit(cfg, token, orgMatch[1]);
      await auditSafe(cfg, token, user.id, 'ORGANIZATION_VIEW', 'organizations', orgMatch[1]);
      return send(200, {
        ok: true,
        organization: org,
        sites,
        audit,
        subscription:
          org.subscription_status ||
          (org.profile && typeof org.profile === 'object' ? org.profile.subscription_status : null) ||
          'active',
        users: 'Não configurado'
      });
    }

    if (orgMatch && method === 'PATCH') {
      const body = await readJsonBody(req);
      const patch: Record<string, unknown> = {};
      if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
      if (typeof body.slug === 'string' && body.slug.trim()) patch.slug = body.slug.trim();
      if (typeof body.status === 'string') {
        const st = body.status.trim().toLowerCase();
        if (st !== 'active' && st !== 'suspended') {
          return send(400, { error: 'Status inválido', code: 'BAD_REQUEST' });
        }
        patch.status = st;
      }
      const profile = asProfile(body.profile);
      if (profile) patch.profile = profile;
      if (typeof body.contract_starts_at === 'string') patch.contract_starts_at = body.contract_starts_at;
      if (typeof body.contract_ends_at === 'string' || body.contract_ends_at === null) {
        patch.contract_ends_at = body.contract_ends_at;
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
  profile?: Record<string, unknown> | null;
  blocked_at?: string | null;
  block_reason?: string | null;
  block_source?: string | null;
  scheduled_block_at?: string | null;
  contract_starts_at?: string | null;
  contract_ends_at?: string | null;
  subscription_status?: string | null;
  grace_ends_at?: string | null;
  auto_block_enabled?: boolean | null;
};

type SiteRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  vertical: string;
  status: string;
};

function slugify(raw: string): string {
  const s = String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || `item-${Date.now().toString(36)}`;
}

function asProfile(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null) {
      if (/pix|boleto|gateway|stripe|asaas|payment|amount|invoice|bank_|card_|mrr/i.test(k)) continue;
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

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
    `${cfg.url}/rest/v1/organizations?select=id,name,slug,status,created_at,updated_at,profile,blocked_at,block_reason,block_source,scheduled_block_at,contract_starts_at,contract_ends_at&order=created_at.desc`,
    { method: 'GET', headers: restHeaders(cfg.anonKey, token) }
  );
  if (!res.ok) {
    const fallback = await fetch(
      `${cfg.url}/rest/v1/organizations?select=id,name,slug,status,created_at,updated_at&order=created_at.desc`,
      { method: 'GET', headers: restHeaders(cfg.anonKey, token) }
    );
    const data = await parseJson<OrgRow[]>(fallback);
    return Array.isArray(data) ? data : [];
  }
  const data = await parseJson<OrgRow[]>(res);
  return Array.isArray(data) ? data : [];
}

async function fetchOrganization(cfg: Cfg, token: string, id: string): Promise<OrgRow | null> {
  const res = await fetch(
    `${cfg.url}/rest/v1/organizations?id=eq.${encodeURIComponent(id)}&select=id,name,slug,status,created_at,updated_at,profile,blocked_at,block_reason,block_source,scheduled_block_at,contract_starts_at,contract_ends_at`,
    { method: 'GET', headers: restHeaders(cfg.anonKey, token) }
  );
  const data = await parseJson<OrgRow[] | OrgRow>(res);
  if (!data) {
    const fallback = await fetch(
      `${cfg.url}/rest/v1/organizations?id=eq.${encodeURIComponent(id)}&select=id,name,slug,status,created_at,updated_at`,
      { method: 'GET', headers: restHeaders(cfg.anonKey, token) }
    );
    const core = await parseJson<OrgRow[] | OrgRow>(fallback);
    if (!core) return null;
    return Array.isArray(core) ? core[0] ?? null : core;
  }
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function patchOrganization(
  cfg: Cfg,
  token: string,
  id: string,
  patch: Record<string, unknown>
): Promise<OrgRow | null> {
  const res = await fetch(`${cfg.url}/rest/v1/organizations?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...restHeaders(cfg.anonKey, token, true), Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  const data = await parseJson<OrgRow[] | OrgRow>(res);
  if (!data) {
    const core: Record<string, unknown> = {};
    if (typeof patch.name === 'string') core.name = patch.name;
    if (typeof patch.slug === 'string') core.slug = patch.slug;
    if (typeof patch.status === 'string') core.status = patch.status;
    if (!Object.keys(core).length) return null;
    const retry = await fetch(`${cfg.url}/rest/v1/organizations?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { ...restHeaders(cfg.anonKey, token, true), Prefer: 'return=representation' },
      body: JSON.stringify(core)
    });
    const again = await parseJson<OrgRow[] | OrgRow>(retry);
    if (!again) return null;
    return Array.isArray(again) ? again[0] ?? null : again;
  }
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function postOrganization(
  cfg: Cfg,
  token: string,
  input: {
    name: string;
    slug: string;
    status: string;
    profile?: Record<string, unknown>;
    contract_starts_at?: string | null;
    contract_ends_at?: string | null;
  }
): Promise<OrgRow | null> {
  const payload: Record<string, unknown> = { name: input.name, slug: input.slug, status: input.status };
  if (input.profile) payload.profile = input.profile;
  if (input.contract_starts_at) payload.contract_starts_at = input.contract_starts_at;
  if (input.contract_ends_at) payload.contract_ends_at = input.contract_ends_at;
  const res = await fetch(`${cfg.url}/rest/v1/organizations`, {
    method: 'POST',
    headers: { ...restHeaders(cfg.anonKey, token, true), Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const data = await parseJson<OrgRow[] | OrgRow>(res);
  if (!data && input.profile) {
    delete payload.profile;
    const retry = await fetch(`${cfg.url}/rest/v1/organizations`, {
      method: 'POST',
      headers: { ...restHeaders(cfg.anonKey, token, true), Prefer: 'return=representation' },
      body: JSON.stringify(payload)
    });
    const again = await parseJson<OrgRow[] | OrgRow>(retry);
    if (!again) return null;
    return Array.isArray(again) ? again[0] ?? null : again;
  }
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function fetchSitesByOrg(cfg: Cfg, token: string, organizationId: string): Promise<SiteRow[]> {
  const res = await fetch(
    `${cfg.url}/rest/v1/condominiums?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,organization_id,name,slug,vertical,status`,
    { method: 'GET', headers: restHeaders(cfg.anonKey, token) }
  );
  const data = await parseJson<SiteRow[]>(res);
  return Array.isArray(data) ? data : [];
}

async function fetchAllSites(cfg: Cfg, token: string): Promise<SiteRow[]> {
  const res = await fetch(`${cfg.url}/rest/v1/condominiums?select=id,organization_id,name,slug,vertical,status`, {
    method: 'GET',
    headers: restHeaders(cfg.anonKey, token)
  });
  const data = await parseJson<SiteRow[]>(res);
  return Array.isArray(data) ? data : [];
}

async function postSite(
  cfg: Cfg,
  token: string,
  input: { organization_id: string; name: string; slug: string; status: string; profile?: Record<string, unknown> }
): Promise<SiteRow | null> {
  const payload: Record<string, unknown> = {
    organization_id: input.organization_id,
    name: input.name,
    slug: input.slug,
    vertical: 'condominium',
    status: input.status
  };
  if (input.profile) payload.profile = input.profile;
  const res = await fetch(`${cfg.url}/rest/v1/condominiums`, {
    method: 'POST',
    headers: { ...restHeaders(cfg.anonKey, token, true), Prefer: 'return=representation' },
    body: JSON.stringify(payload)
  });
  const data = await parseJson<SiteRow[] | SiteRow>(res);
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function patchSite(
  cfg: Cfg,
  token: string,
  id: string,
  patch: Record<string, unknown>
): Promise<SiteRow | null> {
  const res = await fetch(`${cfg.url}/rest/v1/condominiums?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...restHeaders(cfg.anonKey, token, true), Prefer: 'return=representation' },
    body: JSON.stringify(patch)
  });
  const data = await parseJson<SiteRow[] | SiteRow>(res);
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

async function fetchAudit(cfg: Cfg, token: string, resourceId: string) {
  const res = await fetch(
    `${cfg.url}/rest/v1/platform_audit_events?resource_id=eq.${encodeURIComponent(resourceId)}&select=actor_user_id,action,resource_type,resource_id,metadata,occurred_at&order=occurred_at.desc&limit=80`,
    { method: 'GET', headers: restHeaders(cfg.anonKey, token) }
  );
  const data = await parseJson<Array<Record<string, unknown>>>(res);
  return Array.isArray(data) ? data : [];
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
