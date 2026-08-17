/**
 * Master FASE C — authorization (server-side).
 * Identity comes from verified JWT only. Client user_id is ignored.
 */

export const PLATFORM_ACTIONS = {
  SESSION: 'platform.session',
  ORGANIZATIONS_READ: 'platform.organizations.read',
  ORGANIZATIONS_UPDATE: 'platform.organizations.update',
  ORGANIZATIONS_SUSPEND: 'platform.organizations.suspend',
  SUBSCRIPTIONS_READ: 'platform.subscriptions.read',
  SUBSCRIPTIONS_UPDATE: 'platform.subscriptions.update',
  AUDIT_READ: 'platform.audit.read',
  ADMINS_READ: 'platform.admins.read',
  ADMINS_MANAGE: 'platform.admins.manage'
} as const;

export type PlatformAction = (typeof PLATFORM_ACTIONS)[keyof typeof PLATFORM_ACTIONS];

/** Actions implemented in FASE C. Unknown actions fail-closed. */
const PHASE_C_IMPLEMENTED: ReadonlySet<string> = new Set([
  PLATFORM_ACTIONS.SESSION,
  PLATFORM_ACTIONS.ORGANIZATIONS_READ,
  PLATFORM_ACTIONS.ORGANIZATIONS_UPDATE,
  PLATFORM_ACTIONS.ORGANIZATIONS_SUSPEND
]);

export type PlatformAdminRole = 'platform_owner' | 'platform_admin';
export type PlatformAdminStatus = 'active' | 'suspended';

export type PlatformAdminRow = {
  id: string;
  user_id: string;
  role: PlatformAdminRole;
  status: PlatformAdminStatus;
};

export type AuthUser = {
  id: string;
  email?: string | null;
};

export function isPlatformActionImplemented(action: string): boolean {
  return PHASE_C_IMPLEMENTED.has(action);
}

/**
 * Being a platform admin does not grant every action.
 * FASE C: owner and admin share the implemented allowlist; others DENY.
 */
export function isActionAllowedForAdmin(
  admin: PlatformAdminRow,
  action: string
): boolean {
  if (admin.status !== 'active') return false;
  if (admin.role !== 'platform_owner' && admin.role !== 'platform_admin') {
    return false;
  }
  return isPlatformActionImplemented(action);
}

export type MasterAuthFailure =
  | { ok: false; status: 401; code: 'UNAUTHENTICATED' }
  | { ok: false; status: 403; code: 'FORBIDDEN'; reason: 'NOT_MASTER' | 'SUSPENDED' | 'ACTION_DENIED' };

export type MasterAuthOk = {
  ok: true;
  user: AuthUser;
  admin: PlatformAdminRow;
  action: string;
};

export async function authorizeMasterAction(input: {
  user: AuthUser | null;
  admin: PlatformAdminRow | null;
  action: string;
}): Promise<MasterAuthOk | MasterAuthFailure> {
  if (!input.user?.id) {
    return { ok: false, status: 401, code: 'UNAUTHENTICATED' };
  }
  if (!input.admin || input.admin.user_id !== input.user.id) {
    return { ok: false, status: 403, code: 'FORBIDDEN', reason: 'NOT_MASTER' };
  }
  if (input.admin.status !== 'active') {
    return { ok: false, status: 403, code: 'FORBIDDEN', reason: 'SUSPENDED' };
  }
  if (!isActionAllowedForAdmin(input.admin, input.action)) {
    return { ok: false, status: 403, code: 'FORBIDDEN', reason: 'ACTION_DENIED' };
  }
  return {
    ok: true,
    user: input.user,
    admin: input.admin,
    action: input.action
  };
}

const SENSITIVE_KEY =
  /password|passwd|token|secret|authorization|jwt|service_role|anon.?key|access_token|refresh_token/i;

export function redactAuditMetadata(
  input: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(k)) continue;
    if (typeof v === 'string' && v.split('.').length === 3 && v.length > 40) {
      continue;
    }
    out[k] = v;
  }
  return out;
}
