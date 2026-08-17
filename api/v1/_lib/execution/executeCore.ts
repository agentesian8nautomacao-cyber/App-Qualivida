/**
 * Execute Core operations from API (G5 + G7-B) — no business rules in API layer.
 */

import { sha256Hex } from '../auth/hmac';
import type { Resident, Occurrence } from '../../../../types';
import {
  identifyResident,
  identifyUnit,
  createPackage,
  createOccurrence,
  updateOccurrence,
  createReservation,
  cancelReservation,
  pickupPackage,
  getBoleto,
  type CorePersistence,
  type OperationContext,
  type OperationResult
} from '../../../../sentinela/core';
import type { AuthorizedContext } from '../authz/authorize';
import { classifyOperation } from '../ops/classification';
import { validateOperationPayload } from './payload';
import {
  resolveIdempotencyStore,
  type IdempotencyStore
} from '../idempotency/store';
import { ApiErrorCodes, type ApiErrorCode } from '../errors';
import type { PersistenceFactory } from '../composition/productionDeps';
import {
  emitCoreCompleted,
  emitCoreFailed,
  emitCoreStarted,
  emitIdempotencyCreated,
  emitIdempotencyReplay,
  obsBaseFromAuthz
} from '../observability/pipeline';
import type { ObsBase } from '../observability/pipeline';

export type ResidentsProvider = {
  listResidents(): Promise<Resident[]>;
};

export type ExecutionDeps = {
  persistence?: CorePersistence;
  residentsProvider?: ResidentsProvider;
  idempotencyStore?: IdempotencyStore;
  createPersistence?: PersistenceFactory;
};

const OPS_NEEDING_PERSISTENCE = new Set([
  'get_boleto',
  'create_package',
  'create_occurrence',
  'update_occurrence',
  'create_reservation',
  'pickup_package',
  'cancel_reservation'
]);

export type ExecutionSuccess = {
  ok: true;
  operation: string;
  data: unknown;
  warnings?: string[];
  /** true only when Core ran in this hop (false on idempotency replay) */
  core_executed: boolean;
  events?: unknown[];
  /** Observability: idempotency replay this hop */
  idempotency_replay?: boolean;
};

export type ExecutionFailure = {
  ok: false;
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
  /** true when Core ran and returned an error; false when rejected before Core */
  core_executed: boolean;
};

function toOperationContext(authz: AuthorizedContext): OperationContext {
  return {
    channel: 'system',
    organizationId: authz.organization_id,
    condominiumId: authz.condominium_id,
    actorRole: 'integration',
    actorDisplayName: authz.core_operation_context.actorDisplayName
  };
}

function mapCoreFail(result: OperationResult): ExecutionFailure {
  if (result.success) {
    return {
      ok: false,
      code: ApiErrorCodes.INTERNAL_ERROR,
      message: 'unexpected',
      core_executed: false
    };
  }
  const codeMap: Record<string, ApiErrorCode> = {
    VALIDATION_ERROR: ApiErrorCodes.INVALID_REQUEST,
    INVALID_TIME_RANGE: ApiErrorCodes.INVALID_TIME_RANGE,
    NOT_FOUND: ApiErrorCodes.RESOURCE_NOT_FOUND,
    AUTHORIZATION_ERROR: ApiErrorCodes.FORBIDDEN,
    DUPLICATE: ApiErrorCodes.CONFLICT,
    CONFLICT: ApiErrorCodes.CONFLICT,
    CLARIFICATION_REQUIRED: ApiErrorCodes.NEEDS_CONFIRMATION,
    OPERATIONAL_ERROR: ApiErrorCodes.INTERNAL_ERROR
  };
  return {
    ok: false,
    code: codeMap[result.error.code] || ApiErrorCodes.INTERNAL_ERROR,
    message: result.error.message,
    details: result.error.details,
    // Core ran and returned a domain error
    core_executed: true
  };
}

function replayFromRecord(record: { response_body: unknown }): ExecutionSuccess | ExecutionFailure {
  const body = record.response_body as ExecutionSuccess | ExecutionFailure | null;
  if (body && typeof body === 'object' && 'ok' in body) {
    if (body.ok === true) {
      return {
        ...body,
        ok: true,
        core_executed: false,
        idempotency_replay: true
      };
    }
    return { ...body, ok: false, core_executed: false };
  }
  return {
    ok: true,
    operation: 'unknown',
    data: body,
    core_executed: false,
    idempotency_replay: true
  };
}

export async function executeCoreOperation(opts: {
  operation: string;
  authz: AuthorizedContext;
  body: Record<string, unknown>;
  idempotencyKey: string | null;
  rawBodyForFingerprint: string;
  deps: ExecutionDeps;
  /** Set true only after confirmation validate+consume succeeded */
  sensitiveConfirmed?: boolean;
  requestId?: string;
  correlationId?: string | null;
}): Promise<ExecutionSuccess | ExecutionFailure> {
  const startedAt = Date.now();
  const obs: ObsBase = obsBaseFromAuthz(
    opts.requestId || opts.authz.client_id,
    opts.correlationId,
    opts.authz,
    opts.operation
  );

  const opClass = classifyOperation(opts.operation);
  if (!opClass) {
    return {
      ok: false,
      code: ApiErrorCodes.OPERATION_NOT_ALLOWED,
      message: 'unknown operation',
      core_executed: false
    };
  }

  if (opClass === 'SENSITIVE' && !opts.sensitiveConfirmed) {
    return {
      ok: false,
      code: ApiErrorCodes.CONFIRMATION_REQUIRED,
      message: 'Sensitive operations require a validated confirmation before Core execution',
      details: { core_executed: false },
      core_executed: false
    };
  }

  const validated = validateOperationPayload(opts.operation, opts.body, {
    organization_id: opts.authz.organization_id,
    condominium_id: opts.authz.condominium_id
  });
  if (!validated.ok) {
    const detailCode = validated.details?.code;
    const tenantMismatch = detailCode === 'TENANT_MISMATCH';
    const invalidTime = detailCode === 'INVALID_TIME_RANGE';
    return {
      ok: false,
      code: tenantMismatch
        ? ApiErrorCodes.TENANT_MISMATCH
        : invalidTime
          ? ApiErrorCodes.INVALID_TIME_RANGE
          : ApiErrorCodes.INVALID_REQUEST,
      message: validated.message,
      details: validated.details,
      core_executed: false
    };
  }

  const idStore = resolveIdempotencyStore(opts.deps.idempotencyStore);
  const fingerprint = sha256Hex(opts.rawBodyForFingerprint || '');
  let writeKey: string | null = null;

  if (opClass === 'WRITE') {
    if (!opts.idempotencyKey || !opts.idempotencyKey.trim()) {
      return {
        ok: false,
        code: ApiErrorCodes.IDEMPOTENCY_KEY_REQUIRED,
        message: 'Idempotency-Key header is required for WRITE operations',
        core_executed: false
      };
    }
    if (idStore.kind === 'unavailable') {
      return {
        ok: false,
        code: ApiErrorCodes.IDEMPOTENCY_STORE_UNAVAILABLE,
        message:
          'Persistent idempotency store not configured. WRITE blocked — memory is not production-safe.',
        core_executed: false
      };
    }

    writeKey = opts.idempotencyKey.trim();
    if (idStore.claim) {
      const claim = await idStore.claim({
        key: writeKey,
        organization_id: opts.authz.organization_id,
        condominium_id: opts.authz.condominium_id,
        client_id: opts.authz.client_id,
        operation: opts.operation,
        fingerprint,
        request_id: opts.requestId || opts.authz.client_id
      });
      if (claim.outcome === 'duplicate') {
        return {
          ok: false,
          code: ApiErrorCodes.IDEMPOTENCY_FINGERPRINT_MISMATCH,
          message: 'Idempotency-Key reused with different payload/operation',
          details: { reason: 'fingerprint_or_operation_mismatch' },
          core_executed: false
        };
      }
      if (claim.outcome === 'replay') {
        emitIdempotencyReplay(obs);
        return replayFromRecord(claim.record);
      }
      if (claim.outcome === 'in_progress') {
        return {
          ok: false,
          code: ApiErrorCodes.CONFLICT,
          message: 'Idempotency-Key request still in progress',
          core_executed: false
        };
      }
    } else {
      const existing = await idStore.get(
        writeKey,
        opts.authz.organization_id,
        opts.authz.condominium_id
      );
      if (existing) {
        if (existing.request_fingerprint !== fingerprint || existing.operation !== opts.operation) {
          return {
            ok: false,
            code: ApiErrorCodes.IDEMPOTENCY_FINGERPRINT_MISMATCH,
            message: 'Idempotency-Key reused with different payload/operation',
            details: { reason: 'fingerprint_or_operation_mismatch' },
            core_executed: false
          };
        }
        emitIdempotencyReplay(obs);
        return replayFromRecord(existing);
      }
    }
  }

  let persistence = opts.deps.persistence;
  if (!persistence && opts.deps.createPersistence) {
    persistence =
      (await opts.deps.createPersistence(
        opts.authz.organization_id,
        opts.authz.condominium_id
      )) || undefined;
  }

  if (OPS_NEEDING_PERSISTENCE.has(opts.operation) && !persistence) {
    return {
      ok: false,
      code: ApiErrorCodes.INTERNAL_ERROR,
      message: 'Core persistence adapter not configured for this runtime',
      details: { core_executed: false, adapter: 'missing' },
      core_executed: false
    };
  }

  const ctx = toOperationContext(opts.authz);
  const input = validated.data.input;
  let result: OperationResult;

  emitCoreStarted(obs);

  try {
    switch (opts.operation) {
      case 'identify_resident': {
        const residents =
          (await opts.deps.residentsProvider?.listResidents()) ??
          ((input.residents as Resident[]) || []);
        result = identifyResident(
          {
            residentId: (input.residentId as string) || null,
            name: (input.name as string) || null,
            unit: (input.unit as string) || null,
            phone: (input.phone as string) || null,
            residents
          },
          ctx
        );
        break;
      }
      case 'identify_unit': {
        result = identifyUnit({ unit: input.unit as string }, ctx);
        break;
      }
      case 'get_boleto': {
        result = await getBoleto(
          {
            boletoId: input.boletoId as string | undefined,
            residentId: input.residentId as string | undefined,
            unit: input.unit as string | undefined
          },
          ctx,
          persistence!
        );
        break;
      }
      case 'create_package': {
        const residents = (await opts.deps.residentsProvider?.listResidents()) ?? [];
        result = await createPackage(
          {
            recipient: (input.recipient as string) || null,
            unit: (input.unit as string) || null,
            recipientId: (input.recipientId as string) || null,
            type: (input.type as string) || null,
            residentPhone: (input.residentPhone as string) || null,
            imageUrl: (input.imageUrl as string) || null,
            qrCodeData: (input.qrCodeData as string) || null,
            receivedByName: (input.receivedByName as string) || null,
            residents
          },
          ctx,
          persistence!
        );
        break;
      }
      case 'create_occurrence': {
        const residents = (await opts.deps.residentsProvider?.listResidents()) ?? [];
        result = await createOccurrence(
          {
            description: input.description as string,
            residentName: (input.residentName as string) || null,
            unit: (input.unit as string) || null,
            residentId: (input.residentId as string) || null,
            reportedBy: (input.reportedBy as string) || null,
            imageUrl: (input.imageUrl as string) || null,
            residents
          },
          ctx,
          persistence!
        );
        break;
      }
      case 'update_occurrence': {
        result = await updateOccurrence(
          { occurrence: input.occurrence as Occurrence },
          ctx,
          persistence!
        );
        break;
      }
      case 'create_reservation': {
        // G7-C: do NOT pass client existingSlots — Core loads via persistence.listReservationSlots
        result = await createReservation(
          {
            areaId: input.areaId as string,
            areaName: (input.areaName as string) || undefined,
            residentId: input.residentId as string,
            residentName: input.residentName as string,
            unit: input.unit as string,
            date: input.date as string,
            startTime: input.startTime as string,
            endTime: input.endTime as string,
            status: (input.status as string) || 'scheduled'
          },
          ctx,
          persistence!
        );
        break;
      }
      case 'pickup_package': {
        const packageId = String(input.packageId || '');
        const loaded = await persistence!.getPackageById?.(packageId);
        if (!loaded) {
          const dur = Date.now() - startedAt;
          emitCoreFailed({ ...obs, duration_ms: dur }, ApiErrorCodes.RESOURCE_NOT_FOUND);
          return {
            ok: false,
            code: ApiErrorCodes.RESOURCE_NOT_FOUND,
            message: 'package not found',
            core_executed: true
          };
        }
        result = await pickupPackage(
          {
            packageId,
            package: loaded,
            deliveredBy: (input.deliveredBy as string) || null
          },
          ctx,
          persistence!
        );
        break;
      }
      case 'cancel_reservation': {
        result = await cancelReservation(
          { reservationId: String(input.reservationId || '') },
          ctx,
          persistence!
        );
        break;
      }
      default: {
        const dur = Date.now() - startedAt;
        emitCoreFailed({ ...obs, duration_ms: dur }, ApiErrorCodes.OPERATION_NOT_ALLOWED);
        return {
          ok: false,
          code: ApiErrorCodes.OPERATION_NOT_ALLOWED,
          message: 'operation not enabled',
          core_executed: true
        };
      }
    }
  } catch (err) {
    if (opClass === 'WRITE' && writeKey && idStore.fail && idStore.kind !== 'unavailable') {
      await idStore.fail({
        key: writeKey,
        organization_id: opts.authz.organization_id,
        condominium_id: opts.authz.condominium_id,
        client_id: opts.authz.client_id,
        operation: opts.operation,
        fingerprint,
        response_status: 500,
        response_body: { ok: false, message: 'adapter error' }
      });
    }
    const dur = Date.now() - startedAt;
    emitCoreFailed({ ...obs, duration_ms: dur }, ApiErrorCodes.INTERNAL_ERROR);
    return {
      ok: false,
      code: ApiErrorCodes.INTERNAL_ERROR,
      message: err instanceof Error ? err.message : 'execution failed',
      core_executed: true
    };
  }

  if (!result.success) {
    const failure = mapCoreFail(result);
    if (opClass === 'WRITE' && writeKey && idStore.fail && idStore.kind !== 'unavailable') {
      await idStore.fail({
        key: writeKey,
        organization_id: opts.authz.organization_id,
        condominium_id: opts.authz.condominium_id,
        client_id: opts.authz.client_id,
        operation: opts.operation,
        fingerprint,
        response_status: 400,
        response_body: failure
      });
    }
    const dur = Date.now() - startedAt;
    const hint =
      typeof failure.details?.retry_hint === 'string' ? failure.details.retry_hint : null;
    emitCoreFailed({ ...obs, duration_ms: dur }, failure.code, hint);
    return failure;
  }

  const success: ExecutionSuccess = {
    ok: true,
    operation: opts.operation,
    data: result.data,
    warnings: result.warnings,
    core_executed: true,
    events: result.events
  };

  if (opClass === 'WRITE' && writeKey && idStore.kind !== 'unavailable') {
    if (idStore.complete) {
      await idStore.complete({
        key: writeKey,
        organization_id: opts.authz.organization_id,
        condominium_id: opts.authz.condominium_id,
        client_id: opts.authz.client_id,
        operation: opts.operation,
        fingerprint,
        response_body: success,
        response_status: 200,
        request_id: opts.requestId || opts.authz.client_id
      });
    } else {
      await idStore.put({
        key: writeKey,
        organization_id: opts.authz.organization_id,
        condominium_id: opts.authz.condominium_id,
        client_id: opts.authz.client_id,
        operation: opts.operation,
        request_fingerprint: fingerprint,
        response_body: success,
        created_at: new Date().toISOString()
      });
    }
    emitIdempotencyCreated(obs);
  }

  const dur = Date.now() - startedAt;
  emitCoreCompleted({ ...obs, duration_ms: dur });
  return success;
}
