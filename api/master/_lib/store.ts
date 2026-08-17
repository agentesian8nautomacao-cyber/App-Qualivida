import type { PlatformAdminRow } from './authorize';

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
};

export type SiteRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  vertical: string;
  status: string;
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
  updateOrganization(
    id: string,
    patch: { name?: string; slug?: string; status?: string }
  ): Promise<OrganizationRow | null>;
  listSitesByOrg(organizationId: string): Promise<SiteRow[]>;
  countOrganizationsByStatus(): Promise<{ total: number; active: number; suspended: number }>;
  countSites(): Promise<number>;
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
    async updateOrganization(id, patch) {
      const row = organizations.find((o) => o.id === id);
      if (!row) return null;
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.slug !== undefined) row.slug = patch.slug;
      if (patch.status !== undefined) row.status = patch.status;
      return { ...row };
    },
    async listSitesByOrg(organizationId) {
      return sites.filter((s) => s.organization_id === organizationId);
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
    async insertAudit(event) {
      audits.push(event);
    }
  };
}
