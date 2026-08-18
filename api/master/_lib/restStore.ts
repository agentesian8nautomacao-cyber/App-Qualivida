/**
 * Master live I/O via PostgREST + Auth HTTP.
 * Sem SDK no bundle da Function (evita crash no Vercel).
 * JWT do usuário + anon key; RLS / is_platform_admin() continuam no banco.
 */

import { sanitizeMasterLog } from './env';
import type { PlatformAdminRow } from './authorize';
import type { AuditInsert, MasterStore, OrganizationRow, SiteRow } from './store';

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
        `${rest}/organizations?select=id,name,slug,status,created_at,updated_at,profile,blocked_at,block_reason,block_source,scheduled_block_at,contract_starts_at,contract_ends_at&order=created_at.desc`,
        { method: 'GET', headers },
        'ORGANIZATIONS_LIST'
      );
      if (!res.ok) {
        const fallback = await safeFetch(
          `${rest}/organizations?select=id,name,slug,status,created_at,updated_at&order=created_at.desc`,
          { method: 'GET', headers },
          'ORGANIZATIONS_LIST'
        );
        const data = await parseJson<OrganizationRow[]>(fallback);
        return Array.isArray(data) ? data : [];
      }
      const data = await parseJson<OrganizationRow[]>(res);
      return Array.isArray(data) ? data : [];
    },
    async getOrganization(id) {
      const urlFull = `${rest}/organizations?id=eq.${encodeURIComponent(id)}&select=id,name,slug,status,created_at,updated_at,profile,blocked_at,block_reason,block_source,scheduled_block_at,contract_starts_at,contract_ends_at`;
      let res = await safeFetch(urlFull, { method: 'GET', headers }, 'ORGANIZATION_GET');
      if (!res.ok) {
        res = await safeFetch(
          `${rest}/organizations?id=eq.${encodeURIComponent(id)}&select=id,name,slug,status,created_at,updated_at`,
          { method: 'GET', headers },
          'ORGANIZATION_GET'
        );
      }
      const data = await parseJson<OrganizationRow[] | OrganizationRow>(res);
      return firstOrNull(data);
    },
    async createOrganization(input) {
      const payload: Record<string, unknown> = {
        name: input.name,
        slug: input.slug,
        status: input.status || 'active'
      };
      if (input.profile) payload.profile = input.profile;
      if (input.contract_starts_at) payload.contract_starts_at = input.contract_starts_at;
      if (input.contract_ends_at) payload.contract_ends_at = input.contract_ends_at;
      let res = await safeFetch(
        `${rest}/organizations`,
        {
          method: 'POST',
          headers: { ...jsonHeaders, Prefer: 'return=representation' },
          body: JSON.stringify(payload)
        },
        'ORGANIZATION_CREATE'
      );
      if (!res.ok && input.profile) {
        delete payload.profile;
        res = await safeFetch(
          `${rest}/organizations`,
          {
            method: 'POST',
            headers: { ...jsonHeaders, Prefer: 'return=representation' },
            body: JSON.stringify(payload)
          },
          'ORGANIZATION_CREATE'
        );
      }
      const data = await parseJson<OrganizationRow[] | OrganizationRow>(res);
      return firstOrNull(data);
    },
    async updateOrganization(id, patch) {
      let res = await safeFetch(
        `${rest}/organizations?id=eq.${encodeURIComponent(id)}`,
        {
          method: 'PATCH',
          headers: { ...jsonHeaders, Prefer: 'return=representation' },
          body: JSON.stringify(patch)
        },
        'ORGANIZATION_UPDATE'
      );
      let data = await parseJson<OrganizationRow[] | OrganizationRow>(res);
      let row = firstOrNull(data);
      if (!row) {
        const core: Record<string, unknown> = {};
        const profileExtra: Record<string, unknown> = {};
        const profileKeys = [
          'subscription_status',
          'current_period_start',
          'current_period_end',
          'renewal_at',
          'grace_started_at',
          'grace_ends_at',
          'auto_block_enabled',
          'regularized_at',
          'regularized_by',
          'administrative_notes'
        ];
        for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
          if (k === 'profile' && v && typeof v === 'object') {
            Object.assign(profileExtra, v as Record<string, unknown>);
          } else if (profileKeys.includes(k)) {
            profileExtra[k] = v;
          } else {
            core[k] = v;
          }
        }
        const current = await this.getOrganization(id);
        if (Object.keys(profileExtra).length) {
          core.profile = { ...(current?.profile || {}), ...profileExtra };
        }
        if (!Object.keys(core).length) return current;
        res = await safeFetch(
          `${rest}/organizations?id=eq.${encodeURIComponent(id)}`,
          {
            method: 'PATCH',
            headers: { ...jsonHeaders, Prefer: 'return=representation' },
            body: JSON.stringify(core)
          },
          'ORGANIZATION_UPDATE'
        );
        data = await parseJson<OrganizationRow[] | OrganizationRow>(res);
        row = firstOrNull(data);
      }
      return row;
    },
    async listSitesByOrg(organizationId) {
      const res = await safeFetch(
        `${rest}/condominiums?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,organization_id,name,slug,vertical,status,profile,blocked_at,block_reason,block_source,scheduled_block_at`,
        { method: 'GET', headers },
        'SITES_LIST'
      );
      if (!res.ok) {
        const fallback = await safeFetch(
          `${rest}/condominiums?organization_id=eq.${encodeURIComponent(organizationId)}&select=id,organization_id,name,slug,vertical,status`,
          { method: 'GET', headers },
          'SITES_LIST'
        );
        const data = await parseJson<SiteRow[]>(fallback);
        return Array.isArray(data) ? data : [];
      }
      const data = await parseJson<SiteRow[]>(res);
      return Array.isArray(data) ? data : [];
    },
    async createSite(input) {
      const payload: Record<string, unknown> = {
        organization_id: input.organization_id,
        name: input.name,
        slug: input.slug,
        vertical: 'condominium',
        status: input.status || 'active'
      };
      if (input.profile) payload.profile = input.profile;
      let res = await safeFetch(
        `${rest}/condominiums`,
        {
          method: 'POST',
          headers: { ...jsonHeaders, Prefer: 'return=representation' },
          body: JSON.stringify(payload)
        },
        'SITE_CREATE'
      );
      if (!res.ok && input.profile) {
        delete payload.profile;
        res = await safeFetch(
          `${rest}/condominiums`,
          {
            method: 'POST',
            headers: { ...jsonHeaders, Prefer: 'return=representation' },
            body: JSON.stringify(payload)
          },
          'SITE_CREATE'
        );
      }
      const data = await parseJson<SiteRow[] | SiteRow>(res);
      return firstOrNull(data);
    },
    async updateSite(id, patch) {
      const res = await safeFetch(`${rest}/condominiums?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { ...jsonHeaders, Prefer: 'return=representation' },
        body: JSON.stringify(patch)
      }, 'SITE_UPDATE');
      const data = await parseJson<SiteRow[] | SiteRow>(res);
      return firstOrNull(data);
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
      const res = await safeFetch(`${rest}/condominiums?select=id,status`, { method: 'GET', headers }, 'SITES_COUNT');
      const data = await parseJson<{ id: string; status?: string }[]>(res);
      return Array.isArray(data) ? data.length : 0;
    },
    async countSitesByStatus() {
      const res = await safeFetch(`${rest}/condominiums?select=id,status`, { method: 'GET', headers }, 'SITES_COUNT');
      const data = await parseJson<{ id: string; status?: string }[]>(res);
      const list = Array.isArray(data) ? data : [];
      return {
        active: list.filter((s) => s.status === 'active').length,
        suspended: list.filter((s) => s.status === 'suspended').length
      };
    },
    async listAudit(resourceId) {
      const q = resourceId
        ? `${rest}/platform_audit_events?resource_id=eq.${encodeURIComponent(resourceId)}&select=actor_user_id,action,resource_type,resource_id,metadata,occurred_at&order=occurred_at.desc&limit=80`
        : `${rest}/platform_audit_events?select=actor_user_id,action,resource_type,resource_id,metadata,occurred_at&order=occurred_at.desc&limit=80`;
      const res = await safeFetch(q, { method: 'GET', headers }, 'AUDIT_LIST');
      const data = await parseJson<AuditInsert[]>(res);
      return Array.isArray(data) ? data : [];
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
