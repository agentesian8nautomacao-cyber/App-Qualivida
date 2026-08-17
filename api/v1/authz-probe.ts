/**
 * GET /api/v1/authz-probe?operation=create_package
 * G3 technical probe — HMAC + tenant + authorizeOperation.
 * Does not execute Core. No DB writes.
 */

export const runtime = 'nodejs';

import { FOUNDATION_GATES, API_VERSION } from './_lib/gates';
import { withProtectedHandler, type ApiHandlerDeps } from './_lib/protectedHandler';
import { jsonSuccess, jsonError } from './_lib/response';
import { ApiErrorCodes } from './_lib/errors';
import { createEnvCredentialStore } from './_lib/auth/credentials';
import { authorizeOperation } from './_lib/authz/authorize';
import { isCoreOperationName } from './_lib/authz/operations';

export function createAuthzProbeHandler(deps?: ApiHandlerDeps) {
  return {
    async fetch(request: Request): Promise<Response> {
      return withProtectedHandler(
        request,
        ['GET'],
        async (ctx) => {
          const url = new URL(request.url);
          const operation = (url.searchParams.get('operation') || '').trim();

          if (!isCoreOperationName(operation)) {
            return jsonError(
              ctx.request_id,
              ApiErrorCodes.INVALID_REQUEST,
              'operation query param required (Core operation name)',
              {
                correlationId: ctx.correlation_id,
                details: { example: '?operation=create_package' }
              }
            );
          }

          const store = deps?.credentials ?? createEnvCredentialStore(deps?.env);
          const credential = store.getByClientId(ctx.auth.client_id);
          const authz = await authorizeOperation(
            {
              operation,
              organizationId: ctx.auth.organization_id,
              condominiumId: ctx.auth.condominium_id,
              clientId: ctx.auth.client_id,
              credential
            },
            { permissionResolver: deps?.permissionResolver, env: deps?.env }
          );

          if (authz.ok === false) {
            return jsonError(ctx.request_id, authz.code, authz.message, {
              correlationId: ctx.correlation_id,
              operation,
              details: authz.details
            });
          }

          return jsonSuccess(
            ctx.request_id,
            {
              service: 'sentinela-api',
              api_version: API_VERSION,
              stage: 'ETAPA_5_G3_AUTHZ',
              probe: 'authz',
              authorized: true,
              operation: authz.ctx.operation,
              permission: authz.ctx.permission,
              client_id: authz.ctx.client_id,
              organization_id: authz.ctx.organization_id,
              condominium_id: authz.ctx.condominium_id,
              role_name: authz.ctx.role_name,
              core_context_bound: authz.ctx.core_operation_context,
              gates: FOUNDATION_GATES,
              note: 'AuthZ pass only. No Core execution. No secrets returned. G4 not started.'
            },
            { correlationId: ctx.correlation_id, operation: 'authz_probe' }
          );
        },
        deps
      );
    }
  };
}

export default createAuthzProbeHandler();
