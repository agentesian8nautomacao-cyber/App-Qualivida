/**
 * Tenant directory — fail-closed validation (G2).
 * READ-only against known catalog / Supabase. No DDL. No writes.
 *
 * Env catalog (server-side, for tests/pilot without live round-trip):
 *   SENTINELA_TENANT_CATALOG='[{"organization_id":"...","condominium_id":"..."}]'
 *
 * Production prefer: Supabase SELECT on organizations + condominiums (M1/M4).
 */

export type TenantOrg = { id: string };
export type TenantCondo = { id: string; organization_id: string };

export type TenantDirectory = {
  getOrganization(id: string): Promise<TenantOrg | null>;
  getCondominium(id: string): Promise<TenantCondo | null>;
};

export type TenantValidationOk = {
  ok: true;
  organization_id: string;
  condominium_id: string;
};

export type TenantValidationFail = {
  ok: false;
  code: 'TENANT_REQUIRED' | 'TENANT_NOT_FOUND' | 'TENANT_MISMATCH';
  message: string;
};

export async function validateTenantBinding(
  directory: TenantDirectory,
  organizationId: string | null | undefined,
  condominiumId: string | null | undefined
): Promise<TenantValidationOk | TenantValidationFail> {
  const orgId = (organizationId || '').trim();
  const condoId = (condominiumId || '').trim();

  if (!orgId || !condoId) {
    return {
      ok: false,
      code: 'TENANT_REQUIRED',
      message: 'organization_id and condominium_id are required'
    };
  }

  const org = await directory.getOrganization(orgId);
  if (!org) {
    return { ok: false, code: 'TENANT_NOT_FOUND', message: 'organization not found' };
  }

  const condo = await directory.getCondominium(condoId);
  if (!condo) {
    return { ok: false, code: 'TENANT_NOT_FOUND', message: 'condominium not found' };
  }

  if (condo.organization_id !== org.id) {
    return {
      ok: false,
      code: 'TENANT_MISMATCH',
      message: 'condominium does not belong to organization'
    };
  }

  return { ok: true, organization_id: org.id, condominium_id: condo.id };
}

export function createMemoryTenantDirectory(
  rows: Array<{ organization_id: string; condominium_id: string }>
): TenantDirectory {
  const orgs = new Map<string, TenantOrg>();
  const condos = new Map<string, TenantCondo>();
  for (const r of rows) {
    orgs.set(r.organization_id, { id: r.organization_id });
    condos.set(r.condominium_id, {
      id: r.condominium_id,
      organization_id: r.organization_id
    });
  }
  return {
    async getOrganization(id: string) {
      return orgs.get(id) ?? null;
    },
    async getCondominium(id: string) {
      return condos.get(id) ?? null;
    }
  };
}

export function createEnvCatalogTenantDirectory(
  env: NodeJS.ProcessEnv = process.env
): TenantDirectory | null {
  const raw = (env.SENTINELA_TENANT_CATALOG || '').trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const rows: Array<{ organization_id: string; condominium_id: string }> = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const organization_id = String(r.organization_id || '').trim();
      const condominium_id = String(r.condominium_id || '').trim();
      if (organization_id && condominium_id) rows.push({ organization_id, condominium_id });
    }
    return createMemoryTenantDirectory(rows);
  } catch {
    console.error('[sentinela-api] invalid SENTINELA_TENANT_CATALOG (value not logged)');
    return null;
  }
}

/** Live READ against M1/M4 tables. No writes. */
export function createSupabaseTenantDirectory(env: NodeJS.ProcessEnv = process.env): TenantDirectory {
  return {
    async getOrganization(id: string) {
      const client = await getAdminClient(env);
      if (!client) return null;
      const { data, error } = await client.from('organizations').select('id').eq('id', id).maybeSingle();
      if (error || !data) return null;
      return { id: String(data.id) };
    },
    async getCondominium(id: string) {
      const client = await getAdminClient(env);
      if (!client) return null;
      const { data, error } = await client
        .from('condominiums')
        .select('id, organization_id')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return null;
      return { id: String(data.id), organization_id: String(data.organization_id) };
    }
  };
}

async function getAdminClient(env: NodeJS.ProcessEnv) {
  const { createServerSupabaseClient } = await import('../supabase/adminClient');
  return createServerSupabaseClient(env);
}

/**
 * Resolve directory: explicit override → env catalog → supabase → empty (fail-closed).
 */
export function resolveTenantDirectory(
  override?: TenantDirectory | null,
  env: NodeJS.ProcessEnv = process.env
): TenantDirectory {
  if (override) return override;
  const fromEnv = createEnvCatalogTenantDirectory(env);
  if (fromEnv) return fromEnv;
  return createSupabaseTenantDirectory(env);
}
