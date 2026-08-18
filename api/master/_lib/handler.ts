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
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
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
  const h = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  const m = /^Bearer\s+(\S+)/i.exec(h.trim());
  return m ? m[1] : null;
}

function pathOf(request: Request): string {
  try {
    return new URL(request.url).pathname.replace(/\/$/, '') || '/';
  } catch {
    return '/';
  }
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
        const orgs = await deps.store.countOrganizationsByStatus();
        const sites = await deps.store.countSites();
        return json(
          {
            ok: true,
            metrics: {
              organizations_total: orgs.total,
              organizations_active: orgs.active,
              organizations_suspended: orgs.suspended,
              sites_operational: sites,
              subscriptions_active: null,
              subscriptions_expired: null,
              trial: null,
              mrr: null
            },
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
        await auditSafe(deps.store, user.id, 'ORGANIZATION_VIEW', 'organizations', id);
        return json(
          {
            ok: true,
            organization: org,
            sites,
            subscription: 'Não configurado',
            users: 'Não configurado',
            audit: []
          },
          200
        );
      }

      if (orgMatch && request.method === 'PATCH') {
        const id = orgMatch[1];
        let body: { name?: string; slug?: string; status?: string } = {};
        try {
          const raw = await request.json();
          body = raw && typeof raw === 'object' ? raw : {};
        } catch {
          return json({ error: 'Body inválido', code: 'BAD_REQUEST' }, 400);
        }
        const patch: { name?: string; slug?: string; status?: string } = {};
        if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim();
        if (typeof body.slug === 'string' && body.slug.trim()) patch.slug = body.slug.trim();
        if (typeof body.status === 'string') {
          const st = body.status.trim().toLowerCase();
          if (st !== 'active' && st !== 'suspended') {
            return json({ error: 'Status inválido', code: 'BAD_REQUEST' }, 400);
          }
          patch.status = st;
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
  void request;
  return null;
}
