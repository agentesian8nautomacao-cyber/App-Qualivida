/**
 * Master live I/O via PostgREST + Auth HTTP.
 * Sem SDK no bundle da Function (evita crash no Vercel).
 * JWT do usuário + anon key; RLS / is_platform_admin() continuam no banco.
 */

import { sanitizeMasterLog } from './env';
import type { PlatformAdminRow } from './authorize';
import type { MasterStore, OrganizationRow, SiteRow } from './store';

export type AuthUserRow = { id: string; email?: string | null };

export class MasterStageError extends Error {
  readonly stage: string;
  readonly exception: string;
  constructor(stage: string, cause: unknown) {
    const exception = cause instanceof Error ? cause.name : typeof cause;
    const message = sanitizeMasterLog(cause instanceof Error ? cause.message : String(cause));
    super(message);
    this.name = 'MasterStageError';
    this.stage = stage;
    this.exception = String(exception || 'Error');
  }
}

function restHeaders(anonKey: string, token: string, withJsonBody = false): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  };
  if (withJsonBody) headers['Content-Type'] = 'application/json';
  return headers;
}

async function safeFetch(url: string, init: RequestInit, stage: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err: unknown) {
    throw new MasterStageError(stage, err);
  }
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

function firstOrNull<T>(data: T | T[] | null): T | null {
  if (data == null) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function getAuthUserFromJwt(
  supabaseUrl: string,
  anonKey: string,
  token: string
): Promise<AuthUserRow | null> {
  const res = await safeFetch(
    `${supabaseUrl}/auth/v1/user`,
    { method: 'GET', headers: restHeaders(anonKey, token) },
    'AUTH_GET_USER'
  );
  const data = await parseJson<{ id?: string; email?: string | null }>(res);
  if (!data?.id) return null;
  return { id: data.id, email: data.email ?? null };
}

export function createRestMasterStore(
  supabaseUrl: string,
  anonKey: string,
  token: string
): MasterStore {
  const headers = restHeaders(anonKey, token);
  const jsonHeaders = restHeaders(anonKey, token, true);
  const rest = `${supabaseUrl}/rest/v1`;

  return {
    async getAdminByUserId(userId) {
      const url = `${rest}/platform_admins?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,role,status`;
      const res = await safeFetch(url, { method: 'GET', headers }, 'PLATFORM_ADMIN_CHECK');
      const data = await parseJson<PlatformAdminRow[] | PlatformAdminRow>(res);
      return firstOrNull(data);
    },
    async listOrganizations() {
      const res = await safeFetch(
        `${rest}/organizations?select=id,name,slug,status,created_at,updated_at&order=created_at.desc`,
        { method: 'GET', headers },
        'ORGANIZATIONS_LIST'
      );
      const data = await parseJson<OrganizationRow[]>(res);
      return Array.isArray(data) ? data : [];
    },
    async getOrganization(id) {
      const res = await safeFetch(
        `${rest}/organizations?id=eq.${encodeURIComponent(id)}&select=id,name,slug,status,created_at,updated_at`,
        { method: 'GET', headers },
        'ORGANIZATION_GET'
      );
      const data = await parseJson<OrganizationRow[] | OrganizationRow>(res);
      return firstOrNull(data);
    },
    async updateOrganization(id, patch) {
      const res = await safeFetch(
        `${rest}/organizations?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { ...jsonHeaders, Prefer: 'return=representation' },
          body: JSON.stringify(patch)
        },
        'ORGANIZATION_UPDATE'
      );
      const data = await parseJson<OrganizationRow[] | OrganizationRow>(res);
      return firstOrNull(data);
    },
    async listSitesByOrg(organizationId) {
      const res = await safeFetch(
        `${rest}/condominiums?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,organization_id,name,slug,vertical,status`,
        { method: 'GET', headers },
        'SITES_LIST'
      );
      const data = await parseJson<SiteRow[]>(res);
      return Array.isArray(data) ? data : [];
    },
    async countOrganizationsByStatus() {
      const list = await this.listOrganizations();
      return {
        total: list.length,
        active: list.filter((o) => o.status === 'active').length,
        suspended: list.filter((o) => o.status === 'suspended').length
      };
    },
    async countSites() {
      const res = await safeFetch(`${rest}/condominiums?select=id`, { method: 'GET', headers }, 'SITES_COUNT');
      const data = await parseJson<{ id: string }[]>(res);
      return Array.isArray(data) ? data.length : 0;
    },
    async insertAudit(event) {
      try {
        await safeFetch(
          `${rest}/platform_audit_events`,
          {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              actor_user_id: event.actor_user_id,
              action: event.action,
              resource_type: event.resource_type ?? null,
              resource_id: event.resource_id ?? null,
              metadata: event.metadata || {}
            })
          },
          'AUDIT_INSERT'
        );
      } catch {
        // auditoria não bloqueia authz
      }
    }
  };
}
