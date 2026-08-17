/**
 * Execute authorized READ/WRITE via Core (G5 + G7-B wiring).
 */

import {
  withAuthorizedOperation,
  type ApiHandlerDeps
} from './protectedHandler';
import { jsonSuccess, jsonError } from './response';
import { executeCoreOperation, type ExecutionDeps, type ResidentsProvider } from './execution/executeCore';
import type { IdempotencyStore } from './idempotency/store';
import type { ConfirmationStore } from './confirmations/types';
import type { CorePersistence } from '../../../sentinela/core';
import {
  createProductionApiDeps,
  type PersistenceFactory
} from './composition/productionDeps';
import { ApiErrorCodes } from './errors';
import {
  emitOperationCompleted,
  emitOperationFailed,
  obsBaseFromAuthz
} from './observability/pipeline';

/** Max raw JSON body for API ops (G7-E). Multimedia binaries must NOT be posted here. */
export const MAX_API_BODY_BYTES = 256 * 1024;

export type ExecuteHandlerDeps = ApiHandlerDeps & {
  persistence?: CorePersistence;
  residentsProvider?: ResidentsProvider;
  idempotencyStore?: IdempotencyStore;
  confirmationStore?: ConfirmationStore;
  createPersistence?: PersistenceFactory;
  /** When true, do not merge production composition (tests). */
  skipProductionComposition?: boolean;
};

function header(req: Request, name: string): string | null {
  return req.headers.get(name) || req.headers.get(name.toLowerCase());
}

async function parseBody(request: Request): Promise<
  | { ok: true; body: Record<string, unknown>; raw: string }
  | { ok: false; code: typeof ApiErrorCodes.INVALID_REQUEST; message: string }
> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    const url = new URL(request.url);
    const body: Record<string, unknown> = {};
    url.searchParams.forEach((v, k) => {
      body[k] = v;
    });
    return { ok: true, body, raw: '' };
  }
  const raw = await request.clone().text();
  if (raw.length > MAX_API_BODY_BYTES) {
    return {
      ok: false,
      code: ApiErrorCodes.INVALID_REQUEST,
      message: `Request body exceeds ${MAX_API_BODY_BYTES} bytes`
    };
  }
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    const body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    return { ok: true, body, raw };
  } catch {
    return { ok: false, code: ApiErrorCodes.INVALID_REQUEST, message: 'Invalid JSON body' };
  }
}

export function resolveExecuteDeps(deps?: ExecuteHandlerDeps): ExecuteHandlerDeps {
  if (deps?.skipProductionComposition) return deps || {};
  const hasExplicit =
    deps?.persistence ||
    deps?.idempotencyStore ||
    deps?.confirmationStore ||
    deps?.createPersistence ||
    deps?.credentials;
  if (hasExplicit && deps) {
    // Tests / overrides: keep explicit stores; fill missing from production only if none of the stores set
    if (deps.idempotencyStore || deps.confirmationStore || deps.persistence || deps.createPersistence) {
      return deps;
    }
  }
  const prod = createProductionApiDeps(deps?.env);
  return {
    ...deps,
    idempotencyStore: deps?.idempotencyStore ?? prod.idempotencyStore,
    confirmationStore: deps?.confirmationStore ?? prod.confirmationStore,
    createPersistence: deps?.createPersistence ?? prod.createPersistence,
    residentsProvider: deps?.residentsProvider ?? prod.residentsProvider
  };
}

export async function withCoreExecution(
  request: Request,
  allowedMethods: string[],
  operation: string,
  deps?: ExecuteHandlerDeps,
  options?: { sensitiveConfirmed?: boolean }
): Promise<Response> {
  const merged = resolveExecuteDeps(deps);
  return withAuthorizedOperation(
    request,
    allowedMethods,
    operation,
    async (ctx) => {
      const startedAt = Date.now();
      const parsed = await parseBody(ctx.request);
      const base = obsBaseFromAuthz(
        ctx.request_id,
        ctx.correlation_id,
        ctx.authz,
        operation
      );

      if (parsed.ok === false) {
        emitOperationFailed(base, parsed.code, { core_executed: false });
        return jsonError(ctx.request_id, parsed.code, parsed.message, {
          correlationId: ctx.correlation_id,
          operation
        });
      }
      const { body, raw } = parsed;
      const idempotencyKey = header(ctx.request, 'Idempotency-Key');

      const execDeps: ExecutionDeps = {
        persistence: merged.persistence,
        residentsProvider: merged.residentsProvider,
        idempotencyStore: merged.idempotencyStore,
        createPersistence: merged.createPersistence
      };

      const result = await executeCoreOperation({
        operation,
        authz: ctx.authz,
        body,
        idempotencyKey,
        rawBodyForFingerprint: raw,
        deps: execDeps,
        sensitiveConfirmed: options?.sensitiveConfirmed,
        requestId: ctx.request_id,
        correlationId: ctx.correlation_id
      });

      const duration_ms = Date.now() - startedAt;

      if (result.ok === false) {
        const hint =
          typeof result.details?.retry_hint === 'string' ? result.details.retry_hint : null;
        emitOperationFailed(
          { ...base, duration_ms },
          result.code,
          { core_executed: result.core_executed, retry_hint: hint }
        );
        return jsonError(ctx.request_id, result.code, result.message, {
          correlationId: ctx.correlation_id,
          operation,
          details: { ...result.details, core_executed: result.core_executed }
        });
      }

      emitOperationCompleted(
        { ...base, duration_ms },
        { core_executed: result.core_executed }
      );

      return jsonSuccess(
        ctx.request_id,
        {
          ok: true,
          operation: result.operation,
          core_executed: result.core_executed,
          result: result.data,
          warnings: result.warnings,
          events: result.events,
          ...(result.idempotency_replay ? { idempotency_replay: true } : {})
        },
        { correlationId: ctx.correlation_id, operation }
      );
    },
    merged
  );
}
