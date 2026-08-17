/**
 * G2 protect + G3 authorize + G4 confirmation gate.
 * Core execution is wired via withCoreExecution (G5) for READ/WRITE.
 * G7-H-A: observability emit (fail-safe, in-process).
 */

import { protectRequest, type ProtectDeps, type ProtectedContext } from './auth/protect';
import { createEnvCredentialStore } from './auth/credentials';
import { withFoundationHandler, type HandlerContext } from './handler';
import { ApiErrorCodes } from './errors';
import { jsonError } from './response';
import {
  authorizeOperation,
  type AuthorizedContext,
  type AuthorizeDeps
} from './authz/authorize';
import type { PermissionResolver } from './authz/permissionResolver';
import { classifyOperation, requiresConfirmation } from './ops/classification';
import {
  createConfirmationRequest,
  resolveConfirmationStore,
  validateConfirmation
} from './confirmations/service';
import type { ConfirmationStore, CreateConfirmationResult } from './confirmations/types';
import { createProductionApiDeps } from './composition/productionDeps';
import {
  createUnavailableEventStoreQuery,
  type EventStoreQueryPort
} from './observability/eventStoreQuery';
import {
  emitConfirmationConsumed,
  emitConfirmationRequired,
  emitOperationFailed,
  emitRequestAuthorized,
  emitRequestDenied,
  emitRequestReceived,
  emitRequestRejected,
  obsBaseFromAuthz
} from './observability/pipeline';

export type ApiHandlerDeps = ProtectDeps & {
  permissionResolver?: PermissionResolver;
  confirmationStore?: ConfirmationStore;
  /** When true, do not pull production confirmation store */
  skipProductionComposition?: boolean;
  /** G7-K Event Store query port (tests inject memory adapter) */
  eventStoreQuery?: EventStoreQueryPort;
};

export function resolveEventStoreQuery(deps?: ApiHandlerDeps): EventStoreQueryPort {
  if (deps?.eventStoreQuery) return deps.eventStoreQuery;
  if (deps?.skipProductionComposition) {
    return createUnavailableEventStoreQuery('event store query not configured in test');
  }
  return createProductionApiDeps(deps?.env).eventStoreQuery;
}

function resolveHandlerConfirmationStore(deps?: ApiHandlerDeps): ConfirmationStore {
  if (deps?.confirmationStore) return deps.confirmationStore;
  if (deps?.skipProductionComposition) return resolveConfirmationStore(null);
  return createProductionApiDeps(deps?.env).confirmationStore;
}

function header(req: Request, name: string): string | null {
  return req.headers.get(name) || req.headers.get(name.toLowerCase());
}

async function emitRejectFromResponse(
  request: Request,
  requestId: string,
  correlationId: string | null,
  operation: string | undefined,
  response: Response
): Promise<void> {
  try {
    const body = (await response.clone().json()) as {
      error?: { code?: string };
    };
    const code = body.error?.code || ApiErrorCodes.UNAUTHENTICATED;
    emitRequestRejected(
      {
        request_id: requestId,
        correlation_id: correlationId,
        client_id: header(request, 'X-Sentinela-Client-Id'),
        operation: operation || null
      },
      code,
      { trustTenant: false }
    );
    if (operation) {
      emitOperationFailed(
        {
          request_id: requestId,
          correlation_id: correlationId,
          client_id: header(request, 'X-Sentinela-Client-Id'),
          operation
        },
        code,
        { core_executed: false }
      );
    }
  } catch {
    /* fail-safe */
  }
}

export async function withProtectedHandler(
  request: Request,
  allowedMethods: string[],
  run: (ctx: HandlerContext & { auth: ProtectedContext }) => Promise<Response>,
  deps?: ApiHandlerDeps,
  obsOperation?: string
): Promise<Response> {
  return withFoundationHandler(request, allowedMethods, async (ctx) => {
    emitRequestReceived({
      request_id: ctx.request_id,
      correlation_id: ctx.correlation_id,
      client_id: header(ctx.request, 'X-Sentinela-Client-Id'),
      operation: obsOperation || null
    });

    const protectedResult = await protectRequest(
      ctx.request,
      ctx.request_id,
      ctx.correlation_id,
      deps
    );
    if (!protectedResult.ok) {
      await emitRejectFromResponse(
        ctx.request,
        ctx.request_id,
        ctx.correlation_id,
        obsOperation,
        protectedResult.response
      );
      return protectedResult.response;
    }
    return run({ ...ctx, auth: protectedResult.ctx });
  });
}

export async function withAuthorizedOperation(
  request: Request,
  allowedMethods: string[],
  operation: string,
  run: (
    ctx: HandlerContext & { auth: ProtectedContext; authz: AuthorizedContext }
  ) => Promise<Response>,
  deps?: ApiHandlerDeps
): Promise<Response> {
  return withProtectedHandler(
    request,
    allowedMethods,
    async (ctx) => {
      const store = deps?.credentials ?? createEnvCredentialStore(deps?.env);
      const credential = store.getByClientId(ctx.auth.client_id);

      const authzDeps: AuthorizeDeps = {
        permissionResolver: deps?.permissionResolver,
        env: deps?.env
      };

      const authz = await authorizeOperation(
        {
          operation,
          organizationId: ctx.auth.organization_id,
          condominiumId: ctx.auth.condominium_id,
          clientId: ctx.auth.client_id,
          credential
        },
        authzDeps
      );

      const base = obsBaseFromAuthz(
        ctx.request_id,
        ctx.correlation_id,
        {
          client_id: ctx.auth.client_id,
          organization_id: ctx.auth.organization_id,
          condominium_id: ctx.auth.condominium_id
        },
        operation
      );

      if (!authz.ok) {
        emitRequestDenied(base, authz.code);
        emitOperationFailed(base, authz.code, { core_executed: false });
        return jsonError(ctx.request_id, authz.code, authz.message, {
          correlationId: ctx.correlation_id,
          operation,
          details: authz.details
        });
      }

      emitRequestAuthorized(base);
      return run({ ...ctx, authz: authz.ctx });
    },
    deps,
    operation
  );
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const text = await request.clone().text();
    if (!text) return {};
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * After AuthZ: enforce confirmation for SENSITIVE ops.
 * Does NOT execute Core. Valid confirmation → caller may still get GATE_PENDING.
 */
export async function withConfirmedOperation(
  request: Request,
  allowedMethods: string[],
  operation: string,
  run: (
    ctx: HandlerContext & {
      auth: ProtectedContext;
      authz: AuthorizedContext;
      confirmation_id?: string;
    }
  ) => Promise<Response>,
  deps?: ApiHandlerDeps
): Promise<Response> {
  return withAuthorizedOperation(
    request,
    allowedMethods,
    operation,
    async (ctx) => {
      const opClass = classifyOperation(operation);
      const confStore = resolveHandlerConfirmationStore(deps);
      const base = obsBaseFromAuthz(
        ctx.request_id,
        ctx.correlation_id,
        ctx.authz,
        operation
      );

      if (!requiresConfirmation(operation)) {
        return run(ctx);
      }

      const body = await readJsonBody(ctx.request);
      const resourceId = String(
        body.resource_id || body.package_id || body.reservation_id || ''
      ).trim();
      const confirmationId = String(
        body.confirmation_id || header(ctx.request, 'X-Confirmation-Id') || ''
      ).trim();
      const confirmationToken = String(
        body.confirmation_token || header(ctx.request, 'X-Confirmation-Token') || ''
      ).trim();

      if (!confirmationId || !confirmationToken) {
        if (!resourceId) {
          emitConfirmationRequired(base);
          emitOperationFailed(base, ApiErrorCodes.CONFIRMATION_REQUIRED, {
            core_executed: false
          });
          return jsonError(
            ctx.request_id,
            ApiErrorCodes.CONFIRMATION_REQUIRED,
            'Sensitive operation requires confirmation. Provide resource_id to create a confirmation challenge, or confirmation_id + confirmation_token.',
            {
              correlationId: ctx.correlation_id,
              operation,
              details: {
                classification: opClass,
                requires_confirmation: true,
                fields: ['resource_id']
              }
            }
          );
        }

        const prompt =
          operation === 'pickup_package'
            ? `Confirmar retirada da encomenda ${resourceId}?`
            : `Confirma o cancelamento da reserva ${resourceId}?`;

        const created = await createConfirmationRequest(
          {
            organization_id: ctx.authz.organization_id,
            condominium_id: ctx.authz.condominium_id,
            client_id: ctx.authz.client_id,
            operation,
            resource_id: resourceId,
            prompt
          },
          confStore
        );

        if (!created.ok) {
          const code =
            created.code === 'CONFIRMATION_STORE_UNAVAILABLE'
              ? ApiErrorCodes.CONFIRMATION_STORE_UNAVAILABLE
              : ApiErrorCodes.INVALID_REQUEST;
          emitOperationFailed(base, code, { core_executed: false });
          return jsonError(ctx.request_id, code, created.message, {
            correlationId: ctx.correlation_id,
            operation,
            details: {
              classification: opClass,
              requires_confirmation: true,
              future_migration: 'persistent_confirmation_store',
              note: 'HMAC timestamp window is not confirmation. Memory is not production-safe.'
            }
          });
        }

        emitConfirmationRequired(base, created.data.confirmation_id);
        emitOperationFailed(base, ApiErrorCodes.CONFIRMATION_REQUIRED, {
          core_executed: false
        });
        return confirmationRequiredResponse(
          ctx.request_id,
          operation,
          created.data,
          ctx.correlation_id
        );
      }

      if (!resourceId) {
        emitOperationFailed(base, ApiErrorCodes.CONFIRMATION_INVALID, {
          core_executed: false
        });
        return jsonError(
          ctx.request_id,
          ApiErrorCodes.CONFIRMATION_INVALID,
          'resource_id required with confirmation',
          { correlationId: ctx.correlation_id, operation }
        );
      }

      const validated = await validateConfirmation(
        {
          confirmation_id: confirmationId,
          confirmation_token: confirmationToken,
          organization_id: ctx.authz.organization_id,
          condominium_id: ctx.authz.condominium_id,
          client_id: ctx.authz.client_id,
          operation,
          resource_id: resourceId
        },
        confStore
      );

      if (!validated.ok) {
        emitOperationFailed(base, validated.code, { core_executed: false });
        return jsonError(ctx.request_id, ApiErrorCodes[validated.code], validated.message, {
          correlationId: ctx.correlation_id,
          operation,
          details: { classification: opClass }
        });
      }

      emitConfirmationConsumed(base, validated.record.confirmation_id);
      return run({ ...ctx, confirmation_id: validated.record.confirmation_id });
    },
    deps
  );
}

export function confirmationRequiredResponse(
  requestId: string,
  operation: string,
  data: CreateConfirmationResult,
  correlationId?: string | null
): Response {
  return jsonError(
    requestId,
    ApiErrorCodes.CONFIRMATION_REQUIRED,
    'Confirmation required before sensitive operation can proceed',
    {
      correlationId,
      operation,
      details: {
        confirmation_id: data.confirmation_id,
        confirmation_token: data.confirmation_token,
        expires_at: data.expires_at,
        prompt: data.prompt,
        resource_id: data.resource_id,
        organization_id: data.organization_id,
        condominium_id: data.condominium_id,
        classification: 'SENSITIVE',
        note: 'Submit the same operation with confirmation_id + confirmation_token + resource_id. Token shown once.'
      }
    }
  );
}

export function gatePendingAfterAuthz(
  requestId: string,
  operation: string,
  correlationId?: string | null,
  authz?: Pick<
    AuthorizedContext,
    'client_id' | 'organization_id' | 'condominium_id' | 'permission' | 'role_name'
  >,
  extra?: Record<string, unknown>
): Response {
  return jsonError(
    requestId,
    ApiErrorCodes.GATE_PENDING,
    'Authorized path reached legacy GATE_PENDING helper (prefer withCoreExecution / sensitive block).',
    {
      correlationId,
      operation,
      details: {
        g2: 'pass',
        g3_authz: 'pass',
        g4_confirmation: requiresConfirmation(operation) ? 'pass' : 'not_required',
        classification: classifyOperation(operation),
        writes_enabled: false,
        n8n: false,
        whatsapp: false,
        client_id: authz?.client_id,
        organization_id: authz?.organization_id,
        condominium_id: authz?.condominium_id,
        permission: authz?.permission,
        role_name: authz?.role_name,
        next_gate: 'G6',
        database_changes: 0,
        ...extra
      }
    }
  );
}

/** @deprecated */
export function gatePendingAfterAuth(
  requestId: string,
  operation: string,
  correlationId?: string | null,
  auth?: Pick<ProtectedContext, 'client_id' | 'organization_id' | 'condominium_id'>
): Response {
  return gatePendingAfterAuthz(requestId, operation, correlationId, {
    client_id: auth?.client_id || '',
    organization_id: auth?.organization_id || '',
    condominium_id: auth?.condominium_id || '',
    permission: '',
    role_name: null
  });
}
