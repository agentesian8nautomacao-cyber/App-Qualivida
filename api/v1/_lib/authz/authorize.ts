/**
 * authorizeOperation — central AuthZ for Sentinela API (G3)
 * Fail-closed. No role hardcoded bypass. No UI dependency.
 */

import { ApiErrorCodes, type ApiErrorCode } from '../errors';
import type { IntegrationCredential } from '../auth/credentials';
import { filterKnownPermissionKeys, isKnownPermissionKey } from './catalog';
import {
  isCoreOperationName,
  OPERATION_PERMISSION_MAP,
  type CoreOperationName
} from './operations';
import {
  resolveDefaultPermissionResolver,
  type PermissionResolver
} from './permissionResolver';

export type AuthorizeInput = {
  operation: string;
  organizationId: string;
  condominiumId: string;
  clientId: string;
  /** Credential already loaded by G2 (scoped). Required — authz must not trust client_id alone. */
  credential: IntegrationCredential | null;
};

export type AuthorizedContext = {
  operation: CoreOperationName;
  permission: string;
  organization_id: string;
  condominium_id: string;
  client_id: string;
  role_name: string | null;
  permission_keys: string[];
  core_operation_context: {
    channel: 'system';
    organizationId: string;
    condominiumId: string;
    actorRole: 'integration';
    actorDisplayName: string;
  };
};

export type AuthorizeDeny = {
  ok: false;
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type AuthorizeAllow = {
  ok: true;
  ctx: AuthorizedContext;
};

export type AuthorizeDeps = {
  permissionResolver?: PermissionResolver;
  env?: NodeJS.ProcessEnv;
};

function intersect(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((k) => setB.has(k));
}

/**
 * Resolve effective permission keys for an integration profile.
 * - neither role_name nor permission_keys → empty (deny later)
 * - role only → role keys
 * - keys only → filtered known keys
 * - both → intersection (least privilege)
 */
export async function resolveProfilePermissionKeys(
  credential: IntegrationCredential,
  resolver: PermissionResolver
): Promise<{ keys: string[]; role_name: string | null; reason?: string }> {
  const roleName = credential.role_name?.trim().toLowerCase() || null;
  const explicit = filterKnownPermissionKeys(credential.permission_keys || []);

  if (!roleName && explicit.length === 0) {
    return { keys: [], role_name: null, reason: 'profile_missing' };
  }

  let roleKeys: string[] = [];
  if (roleName) {
    roleKeys = await resolver.getKeysForRoleName(roleName);
  }

  if (roleName && explicit.length > 0) {
    return { keys: intersect(roleKeys, explicit), role_name: roleName };
  }
  if (roleName) {
    return { keys: roleKeys, role_name: roleName };
  }
  return { keys: explicit, role_name: null };
}

/**
 * Central authorization. Deny by default.
 * Does NOT execute Core. Does NOT bypass SINDICO/PORTEIRO.
 */
export async function authorizeOperation(
  input: AuthorizeInput,
  deps: AuthorizeDeps = {}
): Promise<AuthorizeAllow | AuthorizeDeny> {
  const orgId = (input.organizationId || '').trim();
  const condoId = (input.condominiumId || '').trim();
  const clientId = (input.clientId || '').trim();

  if (!clientId) {
    return {
      ok: false,
      code: ApiErrorCodes.UNAUTHENTICATED,
      message: 'client_id required for authorization'
    };
  }

  if (!orgId || !condoId) {
    return {
      ok: false,
      code: ApiErrorCodes.TENANT_REQUIRED,
      message: 'tenant required for authorization'
    };
  }

  if (!input.credential) {
    return {
      ok: false,
      code: ApiErrorCodes.FORBIDDEN,
      message: 'no integration profile for client',
      details: { reason: 'client_without_profile' }
    };
  }

  // Never authorize on client_id alone — credential object required and scoped
  if (input.credential.client_id !== clientId) {
    return {
      ok: false,
      code: ApiErrorCodes.FORBIDDEN,
      message: 'credential/client mismatch',
      details: { reason: 'client_mismatch' }
    };
  }

  if (
    input.credential.organization_id !== orgId ||
    input.credential.condominium_id !== condoId
  ) {
    return {
      ok: false,
      code: ApiErrorCodes.TENANT_MISMATCH,
      message: 'profile tenant does not match request tenant',
      details: { reason: 'profile_tenant_mismatch' }
    };
  }

  if (!isCoreOperationName(input.operation)) {
    return {
      ok: false,
      code: ApiErrorCodes.FORBIDDEN,
      message: 'unknown or unauthorized operation',
      details: { reason: 'unknown_operation', operation: input.operation }
    };
  }

  const binding = OPERATION_PERMISSION_MAP[input.operation];
  if (binding.status === 'decision_required' || !binding.permission) {
    return {
      ok: false,
      code: ApiErrorCodes.FORBIDDEN,
      message: 'operation blocked pending permission decision',
      details: {
        reason: 'decision_required',
        operation: binding.operation,
        decision: 'DECISION REQUIRED — notify_resident permission key',
        note: 'reason' in binding ? binding.reason : undefined
      }
    };
  }

  const required = binding.permission;
  if (!isKnownPermissionKey(required)) {
    return {
      ok: false,
      code: ApiErrorCodes.FORBIDDEN,
      message: 'permission mapping invalid',
      details: { reason: 'unknown_permission', permission: required }
    };
  }

  const resolver = resolveDefaultPermissionResolver(deps.permissionResolver, deps.env);
  const profile = await resolveProfilePermissionKeys(input.credential, resolver);

  if (profile.reason === 'profile_missing' || profile.keys.length === 0) {
    return {
      ok: false,
      code: ApiErrorCodes.FORBIDDEN,
      message: 'integration profile has no permissions',
      details: {
        reason: profile.reason || 'empty_permissions',
        role_name: profile.role_name
      }
    };
  }

  if (!profile.keys.includes(required)) {
    return {
      ok: false,
      code: ApiErrorCodes.FORBIDDEN,
      message: 'permission denied for operation',
      details: {
        reason: 'missing_permission',
        operation: input.operation,
        required_permission: required,
        role_name: profile.role_name
        // never echo full key list in production logs if sensitive — OK in API details for deny debug
      }
    };
  }

  // Explicit anti-bypass: role name alone never grants access
  const roleUpper = (profile.role_name || '').toUpperCase();
  if (
    (roleUpper === 'SINDICO' || roleUpper === 'PORTEIRO') &&
    !profile.keys.includes(required)
  ) {
    return {
      ok: false,
      code: ApiErrorCodes.FORBIDDEN,
      message: 'role bypass forbidden',
      details: { reason: 'no_hardcoded_role_bypass' }
    };
  }

  return {
    ok: true,
    ctx: {
      operation: input.operation,
      permission: required,
      organization_id: orgId,
      condominium_id: condoId,
      client_id: clientId,
      role_name: profile.role_name,
      permission_keys: profile.keys,
      core_operation_context: {
        channel: 'system',
        organizationId: orgId,
        condominiumId: condoId,
        actorRole: 'integration',
        actorDisplayName: `integration:${clientId}`
      }
    }
  };
}
