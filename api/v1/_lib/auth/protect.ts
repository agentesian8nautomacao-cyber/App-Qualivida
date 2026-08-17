/**
 * G2 protect middleware — authn HMAC + tenant fail-closed.
 * Does NOT grant business authorization (G3).
 */

import { ApiErrorCodes } from '../errors';
import { jsonError } from '../response';
import {
  createEnvCredentialStore,
  type CredentialStore,
  type IntegrationCredential
} from './credentials';
import {
  buildCanonicalString,
  pathWithQueryFromUrl,
  sha256Hex,
  verifySignature
} from './hmac';
import { checkTimestamp, getTimestampWindowSeconds } from './timestamp';
import {
  resolveTenantDirectory,
  validateTenantBinding,
  type TenantDirectory
} from './tenant';

export type ProtectedContext = {
  request_id: string;
  correlation_id: string | null;
  client_id: string;
  organization_id: string;
  condominium_id: string;
  /** Prepared for G3 — empty until authz profile */
  permission_keys: string[];
  /** Explicit Core-bound tenant context (API never omits these) */
  core_operation_context: {
    channel: 'system';
    organizationId: string;
    condominiumId: string;
    actorRole: 'integration';
    actorDisplayName: string;
  };
};

export type ProtectDeps = {
  credentials?: CredentialStore;
  tenants?: TenantDirectory;
  nowMs?: number;
  windowSeconds?: number;
  env?: NodeJS.ProcessEnv;
};

export type ProtectResult =
  | { ok: true; ctx: ProtectedContext }
  | { ok: false; response: Response };

function header(req: Request, name: string): string | null {
  return req.headers.get(name) || req.headers.get(name.toLowerCase());
}

/**
 * Authenticate integration + validate tenant. Fail-closed.
 * Never logs secrets.
 */
export async function protectRequest(
  request: Request,
  requestId: string,
  correlationId: string | null,
  deps: ProtectDeps = {}
): Promise<ProtectResult> {
  const env = deps.env ?? process.env;
  const credentials = deps.credentials ?? createEnvCredentialStore(env);
  const tenants = resolveTenantDirectory(deps.tenants, env);
  const windowSeconds = deps.windowSeconds ?? getTimestampWindowSeconds(env);
  const nowMs = deps.nowMs ?? Date.now();

  const clientId = (header(request, 'X-Sentinela-Client-Id') || '').trim();
  const timestamp = (header(request, 'X-Sentinela-Timestamp') || '').trim();
  const signature = (header(request, 'X-Sentinela-Signature') || '').trim();
  const organizationId = (header(request, 'X-Organization-Id') || '').trim();
  const condominiumId = (header(request, 'X-Condominium-Id') || '').trim();
  const idempotencyKey = (header(request, 'Idempotency-Key') || '').trim();

  if (!clientId) {
    return {
      ok: false,
      response: jsonError(requestId, ApiErrorCodes.UNAUTHENTICATED, 'client_id required', {
        correlationId,
        details: { header: 'X-Sentinela-Client-Id' }
      })
    };
  }

  const cred = credentials.getByClientId(clientId);
  if (!cred) {
    return {
      ok: false,
      response: jsonError(requestId, ApiErrorCodes.UNAUTHENTICATED, 'unknown client_id', {
        correlationId
      })
    };
  }

  if (!signature) {
    return {
      ok: false,
      response: jsonError(requestId, ApiErrorCodes.INVALID_SIGNATURE, 'signature required', {
        correlationId,
        details: { header: 'X-Sentinela-Signature' }
      })
    };
  }

  const tsCheck = checkTimestamp(timestamp, nowMs, windowSeconds);
  if (!tsCheck.ok) {
    const code =
      tsCheck.reason === 'expired' || tsCheck.reason === 'future'
        ? ApiErrorCodes.TIMESTAMP_EXPIRED
        : ApiErrorCodes.INVALID_REQUEST;
    const message =
      tsCheck.reason === 'missing'
        ? 'timestamp required'
        : tsCheck.reason === 'invalid'
          ? 'timestamp invalid'
          : tsCheck.reason === 'expired'
            ? 'timestamp outside window (too old)'
            : 'timestamp outside window (too far in future)';
    return {
      ok: false,
      response: jsonError(requestId, code, message, {
        correlationId,
        details: { header: 'X-Sentinela-Timestamp', window_seconds: windowSeconds }
      })
    };
  }

  if (!organizationId || !condominiumId) {
    return {
      ok: false,
      response: jsonError(
        requestId,
        ApiErrorCodes.TENANT_REQUIRED,
        'organization_id and condominium_id are required',
        {
          correlationId,
          details: {
            headers: ['X-Organization-Id', 'X-Condominium-Id']
          }
        }
      )
    };
  }

  // Credential scope must match declared tenant (no cross-tenant with valid HMAC of another condo)
  if (
    cred.organization_id !== organizationId ||
    cred.condominium_id !== condominiumId
  ) {
    return {
      ok: false,
      response: jsonError(
        requestId,
        ApiErrorCodes.TENANT_MISMATCH,
        'credential is not scoped to the requested tenant',
        { correlationId }
      )
    };
  }

  const tenant = await validateTenantBinding(tenants, organizationId, condominiumId);
  if (!tenant.ok) {
    const code =
      tenant.code === 'TENANT_REQUIRED'
        ? ApiErrorCodes.TENANT_REQUIRED
        : tenant.code === 'TENANT_MISMATCH'
          ? ApiErrorCodes.TENANT_MISMATCH
          : ApiErrorCodes.TENANT_NOT_FOUND;
    return {
      ok: false,
      response: jsonError(requestId, code, tenant.message, { correlationId })
    };
  }

  const url = new URL(request.url);
  const rawBody = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text();
  const bodyHash = sha256Hex(rawBody || '');

  const canonical = buildCanonicalString({
    timestamp,
    method: request.method,
    pathWithQuery: pathWithQueryFromUrl(url),
    bodySha256Hex: bodyHash,
    organizationId,
    condominiumId,
    idempotencyKey
  });

  const secrets = [cred.secret, cred.secret_previous].filter(Boolean) as string[];
  if (!verifySignature(secrets, canonical, signature)) {
    return {
      ok: false,
      response: jsonError(requestId, ApiErrorCodes.INVALID_SIGNATURE, 'invalid signature', {
        correlationId
      })
    };
  }

  return {
    ok: true,
    ctx: {
      request_id: requestId,
      correlation_id: correlationId,
      client_id: cred.client_id,
      organization_id: tenant.organization_id,
      condominium_id: tenant.condominium_id,
      permission_keys: [],
      core_operation_context: {
        channel: 'system',
        organizationId: tenant.organization_id,
        condominiumId: tenant.condominium_id,
        actorRole: 'integration',
        actorDisplayName: `integration:${cred.client_id}`
      }
    }
  };
}

/** Test helper: never expose secret fields */
export function publicCredentialView(cred: IntegrationCredential) {
  return {
    client_id: cred.client_id,
    organization_id: cred.organization_id,
    condominium_id: cred.condominium_id
  };
}
