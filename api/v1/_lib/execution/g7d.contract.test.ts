/**
 * G7-D — Operational contract hardening tests (no LIVE writes).
 */

import { describe, expect, it } from 'vitest';
import {
  createReservation,
  validateReservationTimeRange,
  isReservationCanceledStatus,
  isExclusionViolationError,
  RESERVATION_STATUS_CANCELED
} from '../../../../sentinela/core';
import { createMemoryCorePersistence } from './memoryPersistence';
import { executeCoreOperation } from './executeCore';
import { ApiErrorCodes, httpStatusForCode, sanitizePublicDetails } from '../errors';
import { jsonError } from '../response';
import {
  FIXTURE_CLIENT,
  FIXTURE_CONDO_A,
  FIXTURE_ORG_A
} from '../auth/testFixtures';
import type { AuthorizedContext } from '../authz/authorize';
import { createSupabaseIdempotencyStore } from '../idempotency/supabaseStore';
import { createFakePersistenceDb } from './fakePersistenceDb';
import { createMemoryCredentialStore } from '../auth/credentials';
import { createMemoryTenantDirectory } from '../auth/tenant';
import { createMemoryPermissionResolver } from '../authz/permissionResolver';
import { createIdentifyResidentHandler } from '../handlers/residents/identify';
import { createPackagesHandler } from '../handlers/operations/packages/index';
import { authHeaders } from '../auth/testFixtures';
import { FIXTURE_CONDO_B } from '../auth/testFixtures';
import type { Resident } from '../../../../types';

function authz(): AuthorizedContext {
  return {
    operation: 'create_reservation',
    permission: 'reservations.create',
    client_id: FIXTURE_CLIENT.client_id,
    organization_id: FIXTURE_ORG_A,
    condominium_id: FIXTURE_CONDO_A,
    role_name: 'porteiro',
    permission_keys: FIXTURE_CLIENT.permission_keys || [],
    core_operation_context: {
      channel: 'system',
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      actorRole: 'integration',
      actorDisplayName: 'n8n-pilot'
    }
  };
}

describe('G7-D reservation time + conflict contract', () => {
  it('23P01 / exclusion → CONFLICT (no SQL leak)', async () => {
    const { persistence } = createMemoryCorePersistence();
    const wrapped = {
      ...persistence,
      async saveReservation() {
        return {
          success: false as const,
          error: 'conflicting key value violates exclusion constraint "reservations_area_date_slot_excl"',
          errorCode: '23P01'
        };
      },
      async listReservationSlots() {
        return [];
      }
    };
    const res = await createReservation(
      {
        areaId: 'area-1',
        residentId: 'r1',
        residentName: 'Maria',
        unit: '101',
        date: '2026-09-01',
        startTime: '10:00',
        endTime: '12:00'
      },
      { channel: 'system', organizationId: FIXTURE_ORG_A, condominiumId: FIXTURE_CONDO_A },
      wrapped
    );
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.code).toBe('CONFLICT');
      expect(JSON.stringify(res.error)).not.toMatch(/BEGIN|SELECT |password/i);
      expect(res.error.details?.retry_hint).toBe('try_another_time_slot');
      expect(res.error.details?.areaId).toBe('area-1');
    }
    expect(isExclusionViolationError('x', '23P01')).toBe(true);
  });

  it('start=end → INVALID_TIME_RANGE (blocked before Core persist)', async () => {
    const range = validateReservationTimeRange('10:00', '10:00');
    expect(range.ok).toBe(false);
    if (!range.ok) expect(range.details.reason).toBe('empty');

    const { persistence } = createMemoryCorePersistence();
    let saved = 0;
    const wrapped = {
      ...persistence,
      async saveReservation(r: Parameters<typeof persistence.saveReservation>[0]) {
        saved++;
        return persistence.saveReservation(r);
      }
    };
    const res = await createReservation(
      {
        areaId: 'a',
        residentId: 'r',
        residentName: 'X',
        unit: '1',
        date: '2026-09-01',
        startTime: '10:00',
        endTime: '10:00'
      },
      { channel: 'system' },
      wrapped
    );
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('INVALID_TIME_RANGE');
    expect(saved).toBe(0);
  });

  it('end<start → INVALID_TIME_RANGE', async () => {
    const range = validateReservationTimeRange('12:00', '10:00');
    expect(range.ok).toBe(false);
    if (!range.ok) expect(range.details.reason).toBe('inverted');

    const exec = await executeCoreOperation({
      operation: 'create_reservation',
      authz: authz(),
      body: {
        area_id: 'a',
        resident_id: 'r',
        resident_name: 'X',
        unit: '1',
        date: '2026-09-01',
        start_time: '12:00',
        end_time: '10:00'
      },
      idempotencyKey: 'res-inv',
      rawBodyForFingerprint: '{}',
      deps: {
        persistence: createMemoryCorePersistence().persistence,
        idempotencyStore: createSupabaseIdempotencyStore(createFakePersistenceDb())
      }
    });
    expect(exec.ok).toBe(false);
    if (!exec.ok) {
      expect(exec.code).toBe('INVALID_TIME_RANGE');
      expect(exec.core_executed).toBe(false);
    }
  });

  it('official status is canceled; legacy aliases only for filters', () => {
    expect(RESERVATION_STATUS_CANCELED).toBe('canceled');
    expect(isReservationCanceledStatus('canceled')).toBe(true);
    expect(isReservationCanceledStatus('cancelled')).toBe(true);
    expect(isReservationCanceledStatus('cancelada')).toBe(true);
    expect(isReservationCanceledStatus('scheduled')).toBe(false);
  });
});

describe('G7-D API envelope + codes', () => {
  it('error envelope has success/operation/request_id/code/message; sanitized details', async () => {
    const res = jsonError('req-1', ApiErrorCodes.CONFLICT, 'occupied', {
      operation: 'create_reservation',
      details: {
        areaId: 'a1',
        stack: 'Error: boom',
        sql: 'SELECT * FROM secrets',
        password: 'x',
        retry_hint: 'try_another_time_slot'
      }
    });
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.ok).toBe(false);
    expect(body.request_id).toBe('req-1');
    expect(body.operation).toBe('create_reservation');
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toBe('occupied');
    expect(body.error.details?.areaId).toBe('a1');
    expect(body.error.details?.retry_hint).toBe('try_another_time_slot');
    expect(body.error.details?.stack).toBeUndefined();
    expect(body.error.details?.sql).toBeUndefined();
    expect(body.error.details?.password).toBeUndefined();
    expect(httpStatusForCode(ApiErrorCodes.INVALID_TIME_RANGE)).toBe(400);
    expect(httpStatusForCode(ApiErrorCodes.CONFIRMATION_ALREADY_CONSUMED)).toBe(409);
    expect(httpStatusForCode(ApiErrorCodes.IDEMPOTENCY_FINGERPRINT_MISMATCH)).toBe(409);
    expect(sanitizePublicDetails({ stack: 'x', areaId: 'a' })).toEqual({ areaId: 'a' });
  });

  it('tenant mismatch + forbidden + identify NOT_FOUND / NEEDS_CONFIRMATION', async () => {
    const tenants = createMemoryTenantDirectory([
      { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
      { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_B }
    ]);
    const credentials = createMemoryCredentialStore([{ ...FIXTURE_CLIENT }]);
    const resolver = createMemoryPermissionResolver({
      porteiro: FIXTURE_CLIENT.permission_keys || []
    });
    const residents: Resident[] = [
      {
        id: 'r1',
        name: 'Ana',
        unit: '101',
        email: '',
        phone: '11955550001',
        whatsapp: '11955550001'
      },
      {
        id: 'r2',
        name: 'Bia',
        unit: '102',
        email: '',
        phone: '11955550001',
        whatsapp: '11955550001'
      }
    ];
    const deps = {
      credentials,
      tenants,
      permissionResolver: resolver,
      windowSeconds: 300,
      skipProductionComposition: true,
      residentsProvider: { async listResidents() { return residents; } }
    };
    const idHandler = createIdentifyResidentHandler(deps);

    const missing = await idHandler.fetch(
      new Request('http://localhost/api/v1/residents/identify?phone=11900000000', {
        method: 'GET',
        headers: authHeaders({
          method: 'GET',
          url: 'http://localhost/api/v1/residents/identify?phone=11900000000'
        })
      })
    );
    expect(missing.status).toBe(404);
    expect((await missing.json()).error.code).toBe('RESOURCE_NOT_FOUND');

    const amb = await idHandler.fetch(
      new Request('http://localhost/api/v1/residents/identify?phone=11955550001', {
        method: 'GET',
        headers: authHeaders({
          method: 'GET',
          url: 'http://localhost/api/v1/residents/identify?phone=11955550001'
        })
      })
    );
    expect(amb.status).toBe(409);
    expect((await amb.json()).error.code).toBe('NEEDS_CONFIRMATION');

    const cross = await idHandler.fetch(
      new Request('http://localhost/api/v1/residents/identify?phone=11955550001', {
        method: 'GET',
        headers: authHeaders({
          method: 'GET',
          url: 'http://localhost/api/v1/residents/identify?phone=11955550001',
          condominiumId: FIXTURE_CONDO_B
        })
      })
    );
    expect([401, 403]).toContain(cross.status);

    const noPerm = createIdentifyResidentHandler({
      ...deps,
      credentials: createMemoryCredentialStore([
        { ...FIXTURE_CLIENT, client_id: 'nop', permission_keys: [] }
      ])
    });
    const url = 'http://localhost/api/v1/residents/identify?phone=11955550001';
    const forbidden = await noPerm.fetch(
      new Request(url, {
        method: 'GET',
        headers: authHeaders({ method: 'GET', url, clientId: 'nop' })
      })
    );
    expect(forbidden.status).toBe(403);
  });

  it('idempotency fingerprint mismatch + store unavailable', async () => {
    const { createUnavailableIdempotencyStore } = await import('../idempotency/store');
    const fail = await executeCoreOperation({
      operation: 'create_package',
      authz: { ...authz(), operation: 'create_package', permission: 'packages.create' },
      body: { recipient: 'A', unit: '1' },
      idempotencyKey: 'k',
      rawBodyForFingerprint: '{}',
      deps: { idempotencyStore: createUnavailableIdempotencyStore() }
    });
    expect(fail.ok).toBe(false);
    if (!fail.ok) {
      expect(fail.code).toBe('IDEMPOTENCY_STORE_UNAVAILABLE');
      expect(fail.core_executed).toBe(false);
    }

    const credentials = createMemoryCredentialStore([{ ...FIXTURE_CLIENT }]);
    const tenants = createMemoryTenantDirectory([
      { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A }
    ]);
    const resolver = createMemoryPermissionResolver({
      porteiro: FIXTURE_CLIENT.permission_keys || []
    });
    const client = createFakePersistenceDb();
    const { createSupabaseCorePersistence } = await import('./supabasePersistence');
    const pers = await createSupabaseCorePersistence({
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      client,
      tenantDirectory: tenants
    });
    expect(pers.ok).toBe(true);
    if (!pers.ok) throw new Error('pers');
    const handler = createPackagesHandler({
      credentials,
      tenants,
      permissionResolver: resolver,
      windowSeconds: 300,
      skipProductionComposition: true,
      persistence: pers.persistence,
      idempotencyStore: createSupabaseIdempotencyStore(client)
    });
    const body1 = JSON.stringify({ recipient: 'Maria', unit: '101', type: 'caixa' });
    const h1 = {
      'Content-Type': 'application/json',
      ...authHeaders({
        method: 'POST',
        url: 'http://localhost/api/v1/operations/packages',
        body: body1,
        idempotencyKey: 'fp-1'
      })
    };
    await handler.fetch(
      new Request('http://localhost/api/v1/operations/packages', {
        method: 'POST',
        headers: h1,
        body: body1
      })
    );
    const body2 = JSON.stringify({ recipient: 'Outra', unit: '101', type: 'caixa' });
    const h2 = {
      'Content-Type': 'application/json',
      ...authHeaders({
        method: 'POST',
        url: 'http://localhost/api/v1/operations/packages',
        body: body2,
        idempotencyKey: 'fp-1'
      })
    };
    const mismatch = await handler.fetch(
      new Request('http://localhost/api/v1/operations/packages', {
        method: 'POST',
        headers: h2,
        body: body2
      })
    );
    expect(mismatch.status).toBe(409);
    expect((await mismatch.json()).error.code).toBe('IDEMPOTENCY_FINGERPRINT_MISMATCH');
  });
});
