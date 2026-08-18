/**
 * Master live I/O via PostgREST + Auth HTTP.
 * Sem SDK no bundle da Function (evita crash no Vercel).
 * JWT do usuário + anon key; RLS / is_platform_admin() continuam no banco.
 */

import type { PlatformAdminRow } from './authorize';
import type { MasterStore, OrganizationRow, SiteRow } from './store';

export type AuthUserRow = { id: string; email?: string | null };

function restHeaders(anonKey: string, token: string): Record<string, string> {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
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
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: restHeaders(anonKey, token)
  });
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
  const rest = `${supabaseUrl}/rest/v1`;

  return {
    async getAdminByUserId(userId) {
      const url = `${rest}/platform_admins?user_id=eq.${encodeURIComponent(userId)}&select=id,user_id,role,status`;
      const res = await fetch(url, { headers });
      const data = await parseJson<PlatformAdminRow[] | PlatformAdminRow>(res);
      return firstOrNull(data);
    },
    async listOrganizations() {
      const res = await fetch(
        `${rest}/organizations?select=id,name,slug,status,created_at,updated_at&order=created_at.desc`,
        { headers }
      );
      const data = await parseJson<OrganizationRow[]>(res);
      return Array.isArray(data) ? data : [];
    },
    async getOrganization(id) {
      const res = await fetch(
        `${rest}/organizations?id=eq.${encodeURIComponent(id)}&select=id,name,slug,status,created_at,updated_at`,
        { headers }
      );
      const data = await parseJson<OrganizationRow[] | OrganizationRow>(res);
      return firstOrNull(data);
    },
    async updateOrganization(id, patch) {
      const res = await fetch(`${rest}/organizations?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(patch)
      });
      const data = await parseJson<OrganizationRow[] | OrganizationRow>(res);
      return firstOrNull(data);
    },
    async listSitesByOrg(organizationId) {
      const res = await fetch(
        `${rest}/condominiums?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,organization_id,name,slug,vertical,status`,
        { headers }
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
      const res = await fetch(`${rest}/condominiums?select=id`, { headers });
      const data = await parseJson<{ id: string }[]>(res);
      return Array.isArray(data) ? data.length : 0;
    },
    async insertAudit(event) {
      await fetch(`${rest}/platform_audit_events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          actor_user_id: event.actor_user_id,
          action: event.action,
          resource_type: event.resource_type ?? null,
          resource_id: event.resource_id ?? null,
          metadata: event.metadata || {}
        })
      });
    }
  };
}
