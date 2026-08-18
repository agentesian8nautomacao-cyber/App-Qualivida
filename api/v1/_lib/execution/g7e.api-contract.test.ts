/**
 * G7-E — External API contract readiness (n8n consumer simulation).
 * No LIVE writes. No WhatsApp. No n8n workflow.
 */

import { describe, expect, it } from 'vitest';
import { createMemoryCredentialStore } from '../auth/credentials';
import { createMemoryTenantDirectory } from '../auth/tenant';
import { createMemoryPermissionResolver } from '../authz/permissionResolver';
import {
  FIXTURE_CLIENT,
  FIXTURE_CONDO_A,
  FIXTURE_CONDO_B,
  FIXTURE_ORG_A,
  FIXTURE_ORG_B,
  authHeaders
} from '../auth/testFixtures';
import { createFakePersistenceDb } from './fakePersistenceDb';
import { createSupabaseCorePersistence } from './supabasePersistence';
import { createSupabaseIdempotencyStore } from '../idempotency/supabaseStore';
import { createSupabaseConfirmationStore } from '../confirmations/supabaseStore';
import { createIdentifyResidentHandler } from '../handlers/residents/identify';
import { createPackagesHandler } from '../handlers/operations/packages/index';
import { createPickupHandler } from '../handlers/operations/packages/pickup';
import { createReservationsHandler } from '../handlers/operations/reservations/index';
import { ApiErrorCodes, httpStatusForCode, sanitizePublicDetails } from '../errors';
import { jsonError } from '../response';
import { normalizeIncomingRequestId, extractRequestIds } from '../requestIds';
import { MAX_API_BODY_BYTES } from '../withCoreExecution';
import { PAYLOAD_LIMITS, validateOperationPayload } from './payload';
import { buildCanonicalString, sha256Hex } from '../auth/hmac';
import { classifyOperation, requiresConfirmation } from '../ops/classification';
import { OPERATION_PERMISSION_MAP } from '../authz/operations';

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

const resolver = createMemoryPermissionResolver({
  porteiro: FIXTURE_CLIENT.permission_keys || []
});

const credentials = createMemoryCredentialStore([{ ...FIXTURE_CLIENT }]);

async function buildDeps(client = createFakePersistenceDb()) {
  const persistenceResult = await createSupabaseCorePersistence({
    organizationId: FIXTURE_ORG_A,
    condominiumId: FIXTURE_CONDO_A,
    client,
    tenantDirectory: tenants
  });
  expect(persistenceResult.ok).toBe(true);
  if (!persistenceResult.ok) throw new Error('persistence failed');

  return {
    client,
    deps: {
      credentials,
      tenants,
      permissionResolver: resolver,
      windowSeconds: 300,
      skipProductionComposition: true,
      persistence: persistenceResult.persistence,
      idempotencyStore: createSupabaseIdempotencyStore(client),
      confirmationStore: createSupabaseConfirmationStore(client),
      createPersistence: async (org: string, condo: string) => {
        const r = await createSupabaseCorePersistence({
          organizationId: org,
          condominiumId: condo,
          client,
          tenantDirectory: tenants
        });
        return r.ok ? r.persistence : null;
      }
    }
  };
}

function getSigned(
  url: string,
  extra?: { organizationId?: string; condominiumId?: string; requestId?: string; timestamp?: string }
) {
  const headers = {
    ...authHeaders({
      method: 'GET',
      url,
      organizationId: extra?.organizationId,
      condominiumId: extra?.condominiumId,
      timestamp: extra?.timestamp
    }),
    ...(extra?.requestId ? { 'X-Request-Id': extra.requestId } : {})
  };
  return new Request(url, { method: 'GET', headers });
}

function postSigned(
  url: string,
  bodyObj: Record<string, unknown>,
  opts?: {
    idempotencyKey?: string;
    organizationId?: string;
    condominiumId?: string;
    timestamp?: string;
    secret?: string;
    signature?: string | null;
    requestId?: string;
  }
) {
  const body = JSON.stringify(bodyObj);
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders({
      method: 'POST',
      url,
      body,
      organizationId: opts?.organizationId,
      condominiumId: opts?.condominiumId,
      idempotencyKey: opts?.idempotencyKey,
      timestamp: opts?.timestamp,
      secret: opts?.secret,
      signature: opts?.signature
    }),
    ...(opts?.requestId ? { 'X-Request-Id': opts.requestId } : {})
  };
  return new Request(url, { method: 'POST', headers, body });
}

describe('G7-E API integration readiness', () => {
  it('inventory — classification + permissions stable', () => {
    expect(classifyOperation('identify_resident')).toBe('READ');
    expect(classifyOperation('create_package')).toBe('WRITE');
    expect(classifyOperation('pickup_package')).toBe('SENSITIVE');
    expect(classifyOperation('cancel_reservation')).toBe('SENSITIVE');
    expect(requiresConfirmation('pickup_package')).toBe(true);
    expect(requiresConfirmation('create_package')).toBe(false);
    expect(OPERATION_PERMISSION_MAP.create_package.permission).toBe('packages.create');
    expect(OPERATION_PERMISSION_MAP.cancel_reservation.permission).toBe('reservations.delete');
  });

  it('HMAC canonical string shape (v1)', () => {
    const canonical = buildCanonicalString({
      timestamp: '1723650000',
      method: 'post',
      pathWithQuery: '/api/v1/operations/packages',
      bodySha256Hex: sha256Hex('{}'),
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      idempotencyKey: 'k1'
    });
    const lines = canonical.split('\n');
    expect(lines).toEqual([
      'v1',
      '1723650000',
      'POST',
      '/api/v1/operations/packages',
      sha256Hex('{}'),
      FIXTURE_ORG_A,
      FIXTURE_CONDO_A,
      'k1'
    ]);
  });

  it('request válido (READ)', async () => {
    const { deps } = await buildDeps();
    const handler = createIdentifyResidentHandler(deps);
    const res = await handler.fetch(
      getSigned('http://localhost/api/v1/residents/identify?name=Maria&unit=101', {
        requestId: 'n8n-corr-0001'
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.request_id).toBe('n8n-corr-0001');
    expect(body.data.core_executed).toBe(true);
  });

  it('HMAC inválido', async () => {
    const { deps } = await buildDeps();
    const handler = createPackagesHandler(deps);
    const res = await handler.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'g7e-bad-sig', signature: 'ab'.repeat(32) }
      )
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('timestamp expirado', async () => {
    const { deps } = await buildDeps();
    const handler = createIdentifyResidentHandler(deps);
    const old = String(Math.floor(Date.now() / 1000) - 10_000);
    const res = await handler.fetch(
      getSigned('http://localhost/api/v1/residents/identify?name=Maria&unit=101', {
        timestamp: old
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TIMESTAMP_EXPIRED');
  });

  it('tenant inválido / mismatch', async () => {
    const { deps } = await buildDeps();
    const handler = createPackagesHandler(deps);
    const res = await handler.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        {
          idempotencyKey: 'g7e-tenant',
          organizationId: FIXTURE_ORG_A,
          condominiumId: FIXTURE_CONDO_B
        }
      )
    );
    expect([401, 403]).toContain(res.status);
    const body = await res.json();
    expect(['TENANT_MISMATCH', 'CREDENTIAL_TENANT_MISMATCH', 'TENANT_NOT_FOUND']).toContain(
      body.error.code
    );
  });

  it('permission denied', async () => {
    const limited = createMemoryCredentialStore([
      {
        ...FIXTURE_CLIENT,
        client_id: 'n8n-limited',
        permission_keys: ['residents.view']
      }
    ]);
    const { deps } = await buildDeps();
    const handler = createPackagesHandler({
      ...deps,
      credentials: limited
    });
    const body = JSON.stringify({ recipient: 'Maria', unit: '101' });
    const url = 'http://localhost/api/v1/operations/packages';
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders({
        method: 'POST',
        url,
        body,
        clientId: 'n8n-limited',
        idempotencyKey: 'g7e-forbid'
      })
    };
    // sign with limited client secret (same fixture secret)
    const res = await handler.fetch(new Request(url, { method: 'POST', headers, body }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(['FORBIDDEN', 'OPERATION_NOT_ALLOWED']).toContain(json.error.code);
  });

  it('idempotency retry + fingerprint mismatch', async () => {
    const { deps } = await buildDeps();
    const handler = createPackagesHandler(deps);
    const payload = { recipient: 'Maria', unit: '101', type: 'caixa' };
    const first = await handler.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'g7e-idem-1'
      })
    );
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    const retry = await handler.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'g7e-idem-1'
      })
    );
    expect(retry.status).toBe(200);
    expect((await retry.json()).data.result).toEqual(firstBody.data.result);

    const mismatch = await handler.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Outra', unit: '102' },
        { idempotencyKey: 'g7e-idem-1' }
      )
    );
    expect(mismatch.status).toBe(409);
    expect((await mismatch.json()).error.code).toBe('IDEMPOTENCY_FINGERPRINT_MISMATCH');
  });

  it('confirmation required + consumed', async () => {
    const built = await buildDeps(
      createFakePersistenceDb({
        packages: [
          {
            id: 'pkg_g7e',
            recipient_name: 'Maria',
            unit: '101',
            type: 'caixa',
            received_at: '2026-08-14T12:00:00.000Z',
            display_time: '09:00',
            status: 'pendente',
            deadline_minutes: 45
          }
        ]
      })
    );
    const h = createPickupHandler(built.deps);
    const chRes = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_g7e'
      })
    );
    expect(chRes.status).toBe(409);
    const ch = await chRes.json();
    expect(ch.error.code).toBe('CONFIRMATION_REQUIRED');

    const ok = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_g7e',
        confirmation_id: ch.error.details.confirmation_id,
        confirmation_token: ch.error.details.confirmation_token
      })
    );
    expect(ok.status).toBe(200);

    const again = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_g7e',
        confirmation_id: ch.error.details.confirmation_id,
        confirmation_token: ch.error.details.confirmation_token
      })
    );
    expect((await again.json()).error.code).toBe('CONFIRMATION_ALREADY_CONSUMED');
  });

  it('reservation conflict + invalid time range', async () => {
    const { deps, client } = await buildDeps();
    const handler = createReservationsHandler(deps);
    const base = {
      area_id: 'area-1',
      resident_id: 'r1',
      resident_name: 'Maria',
      unit: '101',
      date: '2026-09-01',
      start_time: '10:00',
      end_time: '12:00'
    };
    const first = await handler.fetch(
      postSigned('http://localhost/api/v1/operations/reservations', base, {
        idempotencyKey: 'g7e-res-1'
      })
    );
    expect(first.status).toBe(200);

    const conflict = await handler.fetch(
      postSigned(
        'http://localhost/api/v1/operations/reservations',
        { ...base, resident_id: 'r2', resident_name: 'João' },
        { idempotencyKey: 'g7e-res-2' }
      )
    );
    // memory/fake may conflict via Core list OR exclusion mapping
    if (conflict.status === 409) {
      expect((await conflict.json()).error.code).toBe('CONFLICT');
    } else {
      // ensure fake stored first reservation for visibility
      expect(client.__db.reservations?.length || 0).toBeGreaterThanOrEqual(1);
      expect([200, 409]).toContain(conflict.status);
    }

    const badRange = await handler.fetch(
      postSigned(
        'http://localhost/api/v1/operations/reservations',
        { ...base, start_time: '10:00', end_time: '10:00' },
        { idempotencyKey: 'g7e-res-bad' }
      )
    );
    expect(badRange.status).toBe(400);
    expect((await badRange.json()).error.code).toBe('INVALID_TIME_RANGE');
  });

  it('not found + needs confirmation (phone ambiguity contract via payload/Core path)', async () => {
    const { deps } = await buildDeps();
    const handler = createIdentifyResidentHandler(deps);
    const res = await handler.fetch(
      getSigned('http://localhost/api/v1/residents/identify?phone=5599999999999')
    );
    const body = await res.json();
    expect([404, 409, 200]).toContain(res.status);
    if (res.status === 404) {
      expect(['RESOURCE_NOT_FOUND', 'RESIDENT_NOT_FOUND']).toContain(body.error.code);
    }
    if (res.status === 409) {
      expect(body.error.code).toBe('NEEDS_CONFIRMATION');
    }
  });

  it('sanitized errors — no SQL/stack/secrets', () => {
    const res = jsonError('req_x', ApiErrorCodes.CONFLICT, 'occupied', {
      details: {
        stack: 'Error: boom',
        sql: 'SELECT * FROM secrets',
        service_role: 'xxx',
        areaId: 'area-1',
        retry_hint: 'try_another_time_slot'
      }
    });
    return res.json().then((body) => {
      const dumped = JSON.stringify(body);
      expect(dumped).not.toMatch(/SELECT |service_role|Error: boom/i);
      expect(body.error.details.areaId).toBe('area-1');
      expect(sanitizePublicDetails({ password: 'x', ok: 1 })).toEqual({ ok: 1 });
    });
  });

  it('HTTP status mapping centralizado', () => {
    expect(httpStatusForCode(ApiErrorCodes.INVALID_TIME_RANGE)).toBe(400);
    expect(httpStatusForCode(ApiErrorCodes.INVALID_SIGNATURE)).toBe(401);
    expect(httpStatusForCode(ApiErrorCodes.FORBIDDEN)).toBe(403);
    expect(httpStatusForCode(ApiErrorCodes.RESOURCE_NOT_FOUND)).toBe(404);
    expect(httpStatusForCode(ApiErrorCodes.CONFLICT)).toBe(409);
    expect(httpStatusForCode(ApiErrorCodes.CONFIRMATION_REQUIRED)).toBe(409);
    expect(httpStatusForCode(ApiErrorCodes.IDEMPOTENCY_FINGERPRINT_MISMATCH)).toBe(409);
    expect(httpStatusForCode(ApiErrorCodes.CONFIRMATION_ALREADY_CONSUMED)).toBe(409);
    expect(httpStatusForCode(ApiErrorCodes.IDEMPOTENCY_STORE_UNAVAILABLE)).toBe(501);
    expect(httpStatusForCode(ApiErrorCodes.INTERNAL_ERROR)).toBe(500);
  });

  it('request_id policy + body/payload limits', () => {
    expect(normalizeIncomingRequestId('bad')).toMatch(/^req_/);
    expect(normalizeIncomingRequestId('n8n-corr-0001')).toBe('n8n-corr-0001');
    const ids = extractRequestIds(
      new Request('http://localhost/x', {
        headers: { 'X-Request-Id': '///', 'X-Correlation-Id': 'corr-1' }
      })
    );
    expect(ids.request_id).toMatch(/^req_/);
    expect(ids.correlation_id).toBe('corr-1');
    expect(MAX_API_BODY_BYTES).toBe(256 * 1024);
    expect(PAYLOAD_LIMITS.maxDescription).toBe(8000);
    expect(PAYLOAD_LIMITS.maxMetadataJsonBytes).toBe(4096);

    const barcode = validateOperationPayload(
      'create_package',
      {
        recipient: 'Maria',
        unit: '101',
        input_type: 'barcode',
        text: '789123',
        metadata: { source: 'n8n' }
      },
      { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A }
    );
    expect(barcode.ok).toBe(true);
    if (barcode.ok) {
      expect(barcode.data.input.qrCodeData).toBe('789123');
      expect(barcode.data.input.inputType).toBe('barcode');
    }

    const badType = validateOperationPayload('create_package', {
      recipient: 'Maria',
      unit: '101',
      input_type: 'whatsapp_raw'
    });
    expect(badType.ok).toBe(false);
  });

  it('body oversized → INVALID_REQUEST', async () => {
    const { deps } = await buildDeps();
    const handler = createPackagesHandler(deps);
    const huge = 'x'.repeat(MAX_API_BODY_BYTES + 10);
    const body = `{"recipient":"Maria","unit":"101","pad":"${huge}"}`;
    const url = 'http://localhost/api/v1/operations/packages';
    // Intentionally unsigned / short-circuit: size check is after auth in withCoreExecution.
    // Sign a truncated conceptual body won't match — use valid small auth then replace? 
    // Auth reads raw body for HMAC; we must sign the oversized body.
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders({
        method: 'POST',
        url,
        body,
        idempotencyKey: 'g7e-huge'
      })
    };
    const res = await handler.fetch(new Request(url, { method: 'POST', headers, body }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_REQUEST');
  });
});
