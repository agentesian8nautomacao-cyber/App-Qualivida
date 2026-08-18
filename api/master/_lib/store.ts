import type { PlatformAdminRow } from './authorize';

export type OrganizationRow = {
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
  current_period_start?: string | null;
  current_period_end?: string | null;
  renewal_at?: string | null;
  grace_started_at?: string | null;
  grace_ends_at?: string | null;
  auto_block_enabled?: boolean | null;
  regularized_at?: string | null;
  regularized_by?: string | null;
  administrative_notes?: string | null;
};

export type SiteRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  vertical: string;
  status: string;
  profile?: Record<string, unknown> | null;
  blocked_at?: string | null;
  block_reason?: string | null;
  block_source?: string | null;
  scheduled_block_at?: string | null;
};

export type AuditInsert = {
  actor_user_id: string;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  metadata?: Record<string, unknown>;
};

export type MasterStore = {
  getAdminByUserId(userId: string): Promise<PlatformAdminRow | null>;
  listOrganizations(): Promise<OrganizationRow[]>;
  getOrganization(id: string): Promise<OrganizationRow | null>;
  createOrganization(input: {
    name: string;
    slug: string;
    status?: string;
    profile?: Record<string, unknown>;
    contract_starts_at?: string | null;
    contract_ends_at?: string | null;
  }): Promise<OrganizationRow | null>;
  updateOrganization(
    id: string,
    patch: Partial<OrganizationRow> & { name?: string; slug?: string; status?: string }
  ): Promise<OrganizationRow | null>;
  listSitesByOrg(organizationId: string): Promise<SiteRow[]>;
  createSite(input: {
    organization_id: string;
    name: string;
    slug: string;
    status?: string;
    profile?: Record<string, unknown>;
  }): Promise<SiteRow | null>;
  updateSite(
    id: string,
    patch: Partial<SiteRow> & { name?: string; slug?: string; status?: string }
  ): Promise<SiteRow | null>;
  countOrganizationsByStatus(): Promise<{ total: number; active: number; suspended: number }>;
  countSites(): Promise<number>;
  countSitesByStatus(): Promise<{ active: number; suspended: number }>;
  listAudit(resourceId?: string | null): Promise<AuditInsert[]>;
  insertAudit(event: AuditInsert): Promise<void>;
};

export function createMemoryMasterStore(seed?: {
  admins?: PlatformAdminRow[];
  organizations?: OrganizationRow[];
  sites?: SiteRow[];
}): MasterStore & { audits: AuditInsert[] } {
  const admins = [...(seed?.admins || [])];
  const organizations = [...(seed?.organizations || [])];
  const sites = [...(seed?.sites || [])];
  const audits: AuditInsert[] = [];

  return {
    audits,
    async getAdminByUserId(userId) {
      return admins.find((a) => a.user_id === userId) || null;
    },
    async listOrganizations() {
      return [...organizations];
    },
    async getOrganization(id) {
      return organizations.find((o) => o.id === id) || null;
    },
    async createOrganization(input) {
      const row: OrganizationRow = {
        id: crypto.randomUUID(),
        name: input.name,
        slug: input.slug,
        status: input.status || 'active',
        created_at: new Date().toISOString(),
        profile: input.profile || {},
        contract_starts_at: input.contract_starts_at || null,
        contract_ends_at: input.contract_ends_at || null
      };
      organizations.push(row);
      return { ...row };
    },
    async updateOrganization(id, patch) {
      const row = organizations.find((o) => o.id === id);
      if (!row) return null;
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.slug !== undefined) row.slug = patch.slug;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.profile !== undefined) row.profile = patch.profile;
      if (patch.blocked_at !== undefined) row.blocked_at = patch.blocked_at;
      if (patch.block_reason !== undefined) row.block_reason = patch.block_reason;
      if (patch.block_source !== undefined) row.block_source = patch.block_source;
      if (patch.scheduled_block_at !== undefined) row.scheduled_block_at = patch.scheduled_block_at;
      if (patch.contract_starts_at !== undefined) row.contract_starts_at = patch.contract_starts_at;
      if (patch.contract_ends_at !== undefined) row.contract_ends_at = patch.contract_ends_at;
      if (patch.subscription_status !== undefined) row.subscription_status = patch.subscription_status;
      if (patch.current_period_start !== undefined) row.current_period_start = patch.current_period_start;
      if (patch.current_period_end !== undefined) row.current_period_end = patch.current_period_end;
      if (patch.renewal_at !== undefined) row.renewal_at = patch.renewal_at;
      if (patch.grace_started_at !== undefined) row.grace_started_at = patch.grace_started_at;
      if (patch.grace_ends_at !== undefined) row.grace_ends_at = patch.grace_ends_at;
      if (patch.auto_block_enabled !== undefined) row.auto_block_enabled = patch.auto_block_enabled;
      if (patch.regularized_at !== undefined) row.regularized_at = patch.regularized_at;
      if (patch.regularized_by !== undefined) row.regularized_by = patch.regularized_by;
      if (patch.administrative_notes !== undefined) row.administrative_notes = patch.administrative_notes;
      return { ...row };
    },
    async listSitesByOrg(organizationId) {
      return sites.filter((s) => s.organization_id === organizationId);
    },
    async createSite(input) {
      const row: SiteRow = {
        id: crypto.randomUUID(),
        organization_id: input.organization_id,
        name: input.name,
        slug: input.slug,
        vertical: 'condominium',
        status: input.status || 'active',
        profile: input.profile || {}
      };
      sites.push(row);
      return { ...row };
    },
    async updateSite(id, patch) {
      const row = sites.find((s) => s.id === id);
      if (!row) return null;
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.slug !== undefined) row.slug = patch.slug;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.profile !== undefined) row.profile = patch.profile;
      if (patch.blocked_at !== undefined) row.blocked_at = patch.blocked_at;
      if (patch.block_reason !== undefined) row.block_reason = patch.block_reason;
      if (patch.block_source !== undefined) row.block_source = patch.block_source;
      if (patch.scheduled_block_at !== undefined) row.scheduled_block_at = patch.scheduled_block_at;
      return { ...row };
    },
    async countOrganizationsByStatus() {
      const total = organizations.length;
      const active = organizations.filter((o) => o.status === 'active').length;
      const suspended = organizations.filter((o) => o.status === 'suspended').length;
      return { total, active, suspended };
    },
    async countSites() {
      return sites.length;
    },
    async countSitesByStatus() {
      return {
        active: sites.filter((s) => s.status === 'active').length,
        suspended: sites.filter((s) => s.status === 'suspended').length
      };
    },
    async listAudit(resourceId) {
      if (!resourceId) return [...audits];
      return audits.filter((a) => a.resource_id === resourceId);
    },
    async insertAudit(event) {
      audits.push(event);
    }
  };
}
