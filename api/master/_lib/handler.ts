/**
 * Master FASE C HTTP handler.
 * Auth: Bearer JWT → getUser. Never trusts body.user_id.
 */

import {
  authorizeMasterAction,
  PLATFORM_ACTIONS,
  redactAuditMetadata,
  type AuthUser,
  type PlatformAction
} from './authorize';
import type { MasterStore, OrganizationRow } from './store';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export type MasterHandlerDeps = {
  getUserFromAccessToken: (token: string) => Promise<AuthUser | null>;
  store: MasterStore;
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function bearerToken(request: Request): string | null {
  try {
    const headers = request.headers as Headers & Record<string, string | string[] | undefined>;
    let h = '';
    if (headers && typeof headers.get === 'function') {
      h = headers.get('Authorization') || headers.get('authorization') || '';
    } else {
      const direct = headers?.Authorization ?? headers?.authorization ?? '';
      h = Array.isArray(direct) ? direct.join(', ') : String(direct || '');
    }
    const m = /^Bearer\s+(\S+)/i.exec(h.trim());
    const token = m ? m[1] : '';
    if (!token || /[\r\n\0]/.test(token)) return null;
    return token;
  } catch {
    return null;
  }
}

function pathOf(request: Request): string {
  try {
    return new URL(request.url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return '/';
  }
}

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
    if (typeof v === 'string' || typeof v === 'number' || v === null) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

async function auditSafe(
  store: MasterStore,
  actor_user_id: string,
  action: string,
  resource_type?: string | null,
  resource_id?: string | null,
  metadata?: Record<string, unknown>
) {
  try {
    await store.insertAudit({
      actor_user_id,
      action,
      resource_type: resource_type ?? null,
      resource_id: resource_id ?? null,
      metadata: redactAuditMetadata(metadata)
    });
  } catch {
    // auditoria não bloqueia resposta de authz
  }
}

export function createMasterApiHandler(deps: MasterHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      const token = bearerToken(request);
      if (!token) {
        return json({ error: 'Não autenticado', code: 'UNAUTHENTICATED' }, 401);
      }

      const user = await deps.getUserFromAccessToken(token);
      if (!user?.id) {
        return json({ error: 'Sessão expirada ou inválida', code: 'UNAUTHENTICATED' }, 401);
      }

      const path = pathOf(request);
      const action = actionFor(request.method, path, request);
      if (!action) {
        return json({ error: 'Rota Master não encontrada', code: 'NOT_FOUND' }, 404);
      }

      const admin = await deps.store.getAdminByUserId(user.id);
      const authz = await authorizeMasterAction({ user, admin, action });
      if (authz.ok === false) {
        if (authz.status === 401) {
          return json({ error: 'Não autenticado', code: authz.code }, 401);
        }
        await auditSafe(deps.store, user.id, 'MASTER_ACCESS_DENIED', 'platform', null, {
          reason: authz.reason,
          action
        });
        return json(
          {
            error: 'Acesso Master negado',
            code: authz.code,
            reason: authz.reason
          },
          403
        );
      }

      if (path.endsWith('/session') && request.method === 'GET') {
        await auditSafe(deps.store, user.id, 'MASTER_LOGIN', 'platform_admins', authz.admin.id, {
          role: authz.admin.role
        });
        return json(
          {
            ok: true,
            admin: {
              id: authz.admin.id,
              role: authz.admin.role,
              status: authz.admin.status
            }
          },
          200
        );
      }

      if (path.endsWith('/dashboard') && request.method === 'GET') {
        const list = await deps.store.listOrganizations();
        const now = Date.now();
        for (const org of list) {
          if (
            org.status === 'active' &&
            org.scheduled_block_at &&
            Date.parse(org.scheduled_block_at) <= now
          ) {
            await deps.store.updateOrganization(org.id, {
              status: 'suspended',
              blocked_at: new Date().toISOString(),
              block_source: 'automatic',
              scheduled_block_at: null
            });
            await auditSafe(deps.store, user.id, 'OPERATION_BLOCK', 'organizations', org.id, {
              source: 'automatic',
              previous_status: 'active',
              new_status: 'suspended'
            });
          }
        }
        const refreshed = await deps.store.listOrganizations();
        const orgs = await deps.store.countOrganizationsByStatus();
        const siteStatus = await deps.store.countSitesByStatus();
        const scheduled = refreshed.filter((o) => o.scheduled_block_at).length;
        const withSites = [];
        for (const o of refreshed) {
          const sites = await deps.store.listSitesByOrg(o.id);
          withSites.push({
            id: o.id,
            name: o.name,
            status: o.status,
            scheduled_block_at: o.scheduled_block_at || null,
            blocked_at: o.blocked_at || null,
            sites_count: sites.length
          });
        }
        return json(
          {
            ok: true,
            metrics: {
              organizations_total: orgs.total,
              organizations_active: orgs.active,
              organizations_suspended: orgs.suspended,
              sites_operational: siteStatus.active,
              sites_blocked: siteStatus.suspended,
              operations_active: siteStatus.active,
              scheduled_blocks: scheduled,
              subscriptions_active: null,
              subscriptions_expired: null,
              trial: null,
              mrr: null
            },
            organizations: withSites,
            billing: 'Não configurado'
          },
          200
        );
      }

      const orgMatch = path.match(/\/organizations\/([0-9a-f-]{36})$/i);
      if (orgMatch && request.method === 'GET') {
        const id = orgMatch[1];
        const org = await deps.store.getOrganization(id);
        if (!org) return json({ error: 'Organização não encontrada', code: 'NOT_FOUND' }, 404);
        const sites = await deps.store.listSitesByOrg(id);
        const audit = await deps.store.listAudit(id);
        await auditSafe(deps.store, user.id, 'ORGANIZATION_VIEW', 'organizations', id);
        return json(
          {
            ok: true,
            organization: org,
            sites,
            audit,
            subscription: 'Não configurado',
            users: 'Não configurado'
          },
          200
        );
      }

      if (orgMatch && request.method === 'PATCH') {
        const id = orgMatch[1];
        let body: Record<string, unknown> = {};
        try {
          const raw = await request.json();
          body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        } catch {
          return json({ error: 'Body inválido', code: 'BAD_REQUEST' }, 400);
        }
        const patch: Record<string, unknown> = {};
        if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
        if (typeof body.slug === 'string' && body.slug.trim()) patch.slug = body.slug.trim();
        if (typeof body.status === 'string') {
          const st = body.status.trim().toLowerCase();
          if (st !== 'active' && st !== 'suspended') {
            return json({ error: 'Status inválido', code: 'BAD_REQUEST' }, 400);
          }
          patch.status = st;
        }
        const profile = asProfile(body.profile);
        if (profile) patch.profile = profile;
        if (typeof body.contract_starts_at === 'string') patch.contract_starts_at = body.contract_starts_at;
        if (typeof body.contract_ends_at === 'string' || body.contract_ends_at === null) {
          patch.contract_ends_at = body.contract_ends_at;
        }
        if (patch.status === 'suspended') {
          const extra = await authorizeMasterAction({
            user,
            admin: authz.admin,
            action: PLATFORM_ACTIONS.ORGANIZATIONS_SUSPEND
          });
          if (extra.ok === false) {
            await auditSafe(deps.store, user.id, 'MASTER_ACCESS_DENIED', 'organizations', id, {
              reason: extra.status === 403 ? extra.reason : 'ACTION_DENIED',
              action: PLATFORM_ACTIONS.ORGANIZATIONS_SUSPEND
            });
            return json({ error: 'Acesso Master negado', code: 'FORBIDDEN' }, 403);
          }
        }
        if (Object.keys(patch).length === 0) {
          return json({ error: 'Nenhum campo para atualizar', code: 'BAD_REQUEST' }, 400);
        }
        const updated = await deps.store.updateOrganization(id, patch);
        if (!updated) return json({ error: 'Organização não encontrada', code: 'NOT_FOUND' }, 404);
        await auditSafe(deps.store, user.id, 'ORGANIZATION_UPDATE', 'organizations', id, {
          fields: Object.keys(patch)
        });
        return json({ ok: true, organization: updated }, 200);
      }

      if (path.endsWith('/organizations') && request.method === 'POST') {
        let body: Record<string, unknown> = {};
        try {
          const raw = await request.json();
          body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        } catch {
          return json({ error: 'Body inválido', code: 'BAD_REQUEST' }, 400);
        }
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) return json({ error: 'Nome obrigatório', code: 'BAD_REQUEST' }, 400);
        const slug =
          typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(name);
        const created = await deps.store.createOrganization({
          name,
          slug,
          status: 'active',
          profile: asProfile(body.profile),
          contract_starts_at:
            typeof body.contract_starts_at === 'string' ? body.contract_starts_at : null,
          contract_ends_at:
            typeof body.contract_ends_at === 'string' ? body.contract_ends_at : null
        });
        if (!created) {
          return json(
            {
              error:
                'Não foi possível criar a organização. Aplique a migration Master ops (INSERT/RLS) quando aprovada.',
              code: 'SCHEMA_PENDING'
            },
            503
          );
        }
        await auditSafe(deps.store, user.id, 'ORGANIZATION_CREATE', 'organizations', created.id, {
          name
        });
        return json({ ok: true, organization: created }, 201);
      }

      const siteCreate = path.match(/\/organizations\/([0-9a-f-]{36})\/sites$/i);
      if (siteCreate && request.method === 'POST') {
        const orgId = siteCreate[1];
        const org = await deps.store.getOrganization(orgId);
        if (!org) return json({ error: 'Organização não encontrada', code: 'NOT_FOUND' }, 404);
        let body: Record<string, unknown> = {};
        try {
          const raw = await request.json();
          body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        } catch {
          return json({ error: 'Body inválido', code: 'BAD_REQUEST' }, 400);
        }
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        if (!name) return json({ error: 'Nome do site obrigatório', code: 'BAD_REQUEST' }, 400);
        const created = await deps.store.createSite({
          organization_id: orgId,
          name,
          slug: typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(name),
          status: 'active',
          profile: asProfile(body.profile)
        });
        if (!created) {
          return json(
            {
              error:
                'Não foi possível criar o site. Aplique a migration Master ops (INSERT em condominiums) quando aprovada.',
              code: 'SCHEMA_PENDING'
            },
            503
          );
        }
        await auditSafe(deps.store, user.id, 'SITE_CREATE', 'condominiums', created.id, {
          organization_id: orgId,
          name
        });
        return json({ ok: true, site: created }, 201);
      }

      const sitePatch = path.match(/\/sites\/([0-9a-f-]{36})$/i);
      if (sitePatch && request.method === 'PATCH') {
        const siteId = sitePatch[1];
        let body: Record<string, unknown> = {};
        try {
          const raw = await request.json();
          body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        } catch {
          return json({ error: 'Body inválido', code: 'BAD_REQUEST' }, 400);
        }
        const patch: Record<string, unknown> = {};
        if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
        if (typeof body.slug === 'string' && body.slug.trim()) patch.slug = slugify(body.slug);
        if (typeof body.status === 'string') {
          const st = body.status.trim().toLowerCase();
          if (st !== 'active' && st !== 'suspended') {
            return json({ error: 'Status inválido', code: 'BAD_REQUEST' }, 400);
          }
          patch.status = st;
        }
        const profile = asProfile(body.profile);
        if (profile) patch.profile = profile;
        if (Object.keys(patch).length === 0) {
          return json({ error: 'Nenhum campo para atualizar', code: 'BAD_REQUEST' }, 400);
        }
        const updated = await deps.store.updateSite(siteId, patch);
        if (!updated) return json({ error: 'Site não encontrado', code: 'NOT_FOUND' }, 404);
        await auditSafe(deps.store, user.id, 'SITE_UPDATE', 'condominiums', siteId, {
          fields: Object.keys(patch),
          organization_id: updated.organization_id
        });
        return json({ ok: true, site: updated }, 200);
      }

      const blockMatch = path.match(/\/organizations\/([0-9a-f-]{36})\/(block|unblock)$/i);
      if (blockMatch && request.method === 'POST') {
        const id = blockMatch[1];
        const kind = blockMatch[2].toLowerCase();
        const org = await deps.store.getOrganization(id);
        if (!org) return json({ error: 'Organização não encontrada', code: 'NOT_FOUND' }, 404);
        let body: Record<string, unknown> = {};
        try {
          const raw = await request.json();
          body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        } catch {
          body = {};
        }
        const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';
        if (!reason) return json({ error: 'Motivo obrigatório', code: 'BAD_REQUEST' }, 400);
        const immediate = body.immediate !== false;
        const scheduledAt =
          typeof body.scheduled_at === 'string' && body.scheduled_at.trim() ? body.scheduled_at : null;
        if (kind === 'block') {
          if (!immediate && scheduledAt) {
            const updated = await deps.store.updateOrganization(id, {
              scheduled_block_at: scheduledAt,
              block_reason: reason,
              block_source: 'automatic'
            });
            await auditSafe(deps.store, user.id, 'OPERATION_BLOCK_SCHEDULED', 'organizations', id, {
              reason,
              scheduled_at: scheduledAt,
              previous_status: org.status
            });
            return json({ ok: true, organization: updated || org }, 200);
          }
          const updated = await deps.store.updateOrganization(id, {
            status: 'suspended',
            blocked_at: new Date().toISOString(),
            block_reason: reason,
            block_source: 'manual',
            scheduled_block_at: null
          });
          await auditSafe(deps.store, user.id, 'OPERATION_BLOCK', 'organizations', id, {
            reason,
            source: 'manual',
            previous_status: org.status,
            new_status: 'suspended'
          });
          return json({ ok: true, organization: updated || org }, 200);
        }
        const updated = await deps.store.updateOrganization(id, {
          status: 'active',
          blocked_at: null,
          block_reason: null,
          block_source: null,
          scheduled_block_at: null
        });
        await auditSafe(deps.store, user.id, 'OPERATION_UNBLOCK', 'organizations', id, {
          reason,
          previous_status: org.status,
          new_status: 'active'
        });
        return json({ ok: true, organization: updated || org }, 200);
      }

      if (path.endsWith('/organizations') && request.method === 'GET') {
        const list = await deps.store.listOrganizations();
        const withSites: Array<OrganizationRow & { sites_count: number }> = [];
        for (const org of list) {
          const s = await deps.store.listSitesByOrg(org.id);
          withSites.push({ ...org, sites_count: s.length });
        }
        await auditSafe(deps.store, user.id, 'ORGANIZATION_VIEW', 'organizations', null, {
          count: withSites.length
        });
        return json(
          {
            ok: true,
            organizations: withSites,
            subscription: 'Não configurado',
            plan: 'Não configurado'
          },
          200
        );
      }

      return json({ error: 'Rota Master não encontrada', code: 'NOT_FOUND' }, 404);
    }
  };
}

function actionFor(method: string, path: string, request: Request): PlatformAction | null {
  if (path.endsWith('/session') && method === 'GET') return PLATFORM_ACTIONS.SESSION;
  if (path.endsWith('/dashboard') && method === 'GET') {
    return PLATFORM_ACTIONS.ORGANIZATIONS_READ;
  }
  if (path.endsWith('/organizations') && method === 'GET') {
    return PLATFORM_ACTIONS.ORGANIZATIONS_READ;
  }
  if (/\/organizations\/[0-9a-f-]{36}$/i.test(path) && method === 'GET') {
    return PLATFORM_ACTIONS.ORGANIZATIONS_READ;
  }
  if (/\/organizations\/[0-9a-f-]{36}$/i.test(path) && method === 'PATCH') {
    return PLATFORM_ACTIONS.ORGANIZATIONS_UPDATE;
  }
  if (path.endsWith('/organizations') && method === 'POST') {
    return PLATFORM_ACTIONS.ORGANIZATIONS_UPDATE;
  }
  if (/\/organizations\/[0-9a-f-]{36}\/sites$/i.test(path) && method === 'POST') {
    return PLATFORM_ACTIONS.ORGANIZATIONS_UPDATE;
  }
  if (/\/sites\/[0-9a-f-]{36}$/i.test(path) && method === 'PATCH') {
    return PLATFORM_ACTIONS.ORGANIZATIONS_UPDATE;
  }
  if (/\/organizations\/[0-9a-f-]{36}\/block$/i.test(path) && method === 'POST') {
    return PLATFORM_ACTIONS.ORGANIZATIONS_SUSPEND;
  }
  if (/\/organizations\/[0-9a-f-]{36}\/unblock$/i.test(path) && method === 'POST') {
    return PLATFORM_ACTIONS.ORGANIZATIONS_UPDATE;
  }
  void request;
  return null;
}
