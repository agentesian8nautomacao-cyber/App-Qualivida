/**
 * G7-G — Event / observability readiness tests (no LIVE DB).
 */

import { describe, expect, it } from 'vitest';
import {
  assertNoSensitiveLeak,
  buildCorrelationChain,
  buildOperationalEvent,
  classifyRetry,
  createMemoryEventSink,
  describeRetryPolicy,
  observeOutcome,
  OperationalEventNames,
  PIPELINE_STAGES,
  redactObservabilityValue,
  operationalStatusFromErrorCode
} from './index';
import { ApiErrorCodes } from '../errors';
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
import { createFakePersistenceDb } from '../execution/fakePersistenceDb';
import { createSupabaseCorePersistence } from '../execution/supabasePersistence';
import { createSupabaseIdempotencyStore } from '../idempotency/supabaseStore';
import { createSupabaseConfirmationStore } from '../confirmations/supabaseStore';
import { createPackagesHandler } from '../handlers/operations/packages/index';
import { createPickupHandler } from '../handlers/operations/packages/pickup';
import { createReservationsHandler } from '../handlers/operations/reservations/index';
import { createIdentifyResidentHandler } from '../handlers/residents/identify';

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
  if (!persistenceResult.ok) throw new Error('persistence');
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

function postSigned(
  url: string,
  bodyObj: Record<string, unknown>,
  opts?: { idempotencyKey?: string; signature?: string | null; organizationId?: string; condominiumId?: string; clientId?: string }
) {
  const body = JSON.stringify(bodyObj);
  return new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders({
        method: 'POST',
        url,
        body,
        idempotencyKey: opts?.idempotencyKey,
        signature: opts?.signature,
        organizationId: opts?.organizationId,
        condominiumId: opts?.condominiumId,
        clientId: opts?.clientId
      })
    },
    body
  });
}

describe('G7-G observability contract', () => {
  it('pipeline stages documented', () => {
    expect(PIPELINE_STAGES).toEqual([
      'http',
      'hmac',
      'tenant',
      'authz',
      'classification',
      'idempotency',
      'confirmation',
      'core',
      'adapter',
      'database',
      'response'
    ]);
    expect(OperationalEventNames.length).toBeLessThanOrEqual(16);
  });

  it('1 request recebido', () => {
    const sink = createMemoryEventSink();
    const events = observeOutcome(
      {
        request_id: 'req_recv',
        success: true,
        http_status: 200,
        operation: 'identify_resident',
        classification: 'READ',
        core_executed: true
      },
      sink
    );
    expect(events[0].event_name).toBe('request.received');
    expect(sink.list()[0].request_id).toBe('req_recv');
  });

  it('2 request rejeitado (HMAC)', async () => {
    const { deps } = await buildDeps();
    const res = await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'g7g-hmac', signature: 'ab'.repeat(32) }
      )
    );
    const body = await res.json();
    const events = observeOutcome({
      request_id: body.request_id,
      success: false,
      http_status: res.status,
      error_code: body.error.code,
      authRejected: true,
      operation: 'create_package',
      classification: 'WRITE'
    });
    expect(events.map((e) => e.event_name)).toContain('request.rejected');
    expect(operationalStatusFromErrorCode(body.error.code)).toBe('rejected');
  });

  it('3 AuthZ denied', async () => {
    const limited = createMemoryCredentialStore([
      { ...FIXTURE_CLIENT, client_id: 'n8n-ro', permission_keys: ['residents.view'] }
    ]);
    const { deps } = await buildDeps();
    const body = JSON.stringify({ recipient: 'Maria', unit: '101' });
    const url = 'http://localhost/api/v1/operations/packages';
    const res = await createPackagesHandler({ ...deps, credentials: limited }).fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders({
            method: 'POST',
            url,
            body,
            clientId: 'n8n-ro',
            idempotencyKey: 'g7g-authz'
          })
        },
        body
      })
    );
    const json = await res.json();
    const events = observeOutcome({
      request_id: json.request_id,
      success: false,
      http_status: res.status,
      error_code: json.error.code,
      authzDenied: true,
      operation: 'create_package',
      classification: 'WRITE'
    });
    expect(events.map((e) => e.event_name)).toEqual([
      'request.received',
      'request.denied',
      'operation.failed'
    ]);
  });

  it('4 tenant denied', async () => {
    const { deps } = await buildDeps();
    const res = await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        {
          idempotencyKey: 'g7g-tenant',
          organizationId: FIXTURE_ORG_A,
          condominiumId: FIXTURE_CONDO_B
        }
      )
    );
    const json = await res.json();
    expect([401, 403]).toContain(res.status);
    const events = observeOutcome({
      request_id: json.request_id,
      success: false,
      http_status: res.status,
      error_code: json.error?.code,
      authRejected: true,
      operation: 'create_package'
    });
    expect(events.some((e) => e.event_name === 'request.rejected')).toBe(true);
  });

  it('5 idempotency replay', async () => {
    const { deps } = await buildDeps();
    const h = createPackagesHandler(deps);
    const payload = { recipient: 'Maria', unit: '101' };
    await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'g7g-idem'
      })
    );
    const res = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'g7g-idem'
      })
    );
    const json = await res.json();
    const events = observeOutcome({
      request_id: json.request_id,
      success: true,
      http_status: 200,
      operation: 'create_package',
      classification: 'WRITE',
      core_executed: true,
      idempotencyReplay: true
    });
    expect(events.map((e) => e.event_name)).toContain('idempotency.replay');
    expect(events.some((e) => e.status === 'duplicate')).toBe(true);
  });

  it('6 confirmation required', async () => {
    const { deps } = await buildDeps();
    const res = await createPickupHandler(deps).fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_g7g'
      })
    );
    const json = await res.json();
    expect(json.error.code).toBe('CONFIRMATION_REQUIRED');
    const events = observeOutcome({
      request_id: json.request_id,
      success: false,
      http_status: 409,
      error_code: json.error.code,
      confirmationRequired: true,
      operation: 'pickup_package',
      classification: 'SENSITIVE',
      core_executed: false
    });
    expect(events.map((e) => e.event_name)).toContain('confirmation.required');
    // Token must not appear in observability envelope
    const dumped = JSON.stringify(events);
    expect(dumped).not.toContain(json.error.details.confirmation_token);
  });

  it('7 confirmation consumed', async () => {
    const built = await buildDeps(
      createFakePersistenceDb({
        packages: [
          {
            id: 'pkg_g7g_c',
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
    const ch = await (
      await h.fetch(
        postSigned('http://localhost/api/v1/operations/packages/pickup', {
          resource_id: 'pkg_g7g_c'
        })
      )
    ).json();
    const ok = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_g7g_c',
        confirmation_id: ch.error.details.confirmation_id,
        confirmation_token: ch.error.details.confirmation_token
      })
    );
    expect(ok.status).toBe(200);
    const json = await ok.json();
    const events = observeOutcome({
      request_id: json.request_id,
      success: true,
      http_status: 200,
      operation: 'pickup_package',
      classification: 'SENSITIVE',
      core_executed: true,
      confirmationConsumed: true
    });
    expect(events.map((e) => e.event_name)).toContain('confirmation.consumed');
    expect(events.map((e) => e.event_name)).toContain('core.completed');
  });

  it('8 Core success', async () => {
    const { deps } = await buildDeps();
    const res = await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'g7g-ok' }
      )
    );
    const json = await res.json();
    expect(json.data.core_executed).toBe(true);
    const events = observeOutcome({
      request_id: json.request_id,
      client_id: FIXTURE_CLIENT.client_id,
      organization_id: FIXTURE_ORG_A,
      condominium_id: FIXTURE_CONDO_A,
      success: true,
      http_status: 200,
      operation: 'create_package',
      classification: 'WRITE',
      core_executed: true,
      duration_ms: 50
    });
    expect(events.map((e) => e.event_name)).toContain('core.started');
    expect(events.map((e) => e.event_name)).toContain('operation.completed');
  });

  it('9 Core failure (invalid time)', async () => {
    const { deps } = await buildDeps();
    const res = await createReservationsHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/reservations',
        {
          area_id: 'a1',
          resident_id: 'r1',
          resident_name: 'Maria',
          unit: '101',
          date: '2026-10-01',
          start_time: '10:00',
          end_time: '10:00'
        },
        { idempotencyKey: 'g7g-time' }
      )
    );
    const json = await res.json();
    expect(json.error.code).toBe('INVALID_TIME_RANGE');
    const events = observeOutcome({
      request_id: json.request_id,
      success: false,
      http_status: 400,
      error_code: json.error.code,
      operation: 'create_reservation',
      classification: 'WRITE',
      core_executed: false
    });
    expect(events.map((e) => e.event_name)).toContain('operation.failed');
    expect(classifyRetry({ errorCode: json.error.code })).toBe('NO_RETRY');
  });

  it('10 conflict status mapping', () => {
    expect(operationalStatusFromErrorCode(ApiErrorCodes.CONFLICT)).toBe('conflict');
    expect(classifyRetry({ errorCode: ApiErrorCodes.CONFLICT })).toBe('RETRY_AFTER_CHANGE');
    const events = observeOutcome({
      request_id: 'req_c',
      success: false,
      http_status: 409,
      error_code: ApiErrorCodes.CONFLICT,
      retry_hint: 'try_another_time_slot',
      operation: 'create_reservation',
      classification: 'WRITE',
      core_executed: true
    });
    expect(events.some((e) => e.retry_hint === 'try_another_time_slot')).toBe(true);
    expect(events.some((e) => e.event_name === 'core.failed')).toBe(true);
  });

  it('11 invalid time → NO_RETRY', () => {
    expect(classifyRetry({ errorCode: ApiErrorCodes.INVALID_TIME_RANGE })).toBe('NO_RETRY');
    expect(classifyRetry({ errorCode: ApiErrorCodes.AUTHENTICATION_FAILED })).toBe('NO_RETRY');
    expect(classifyRetry({ errorCode: ApiErrorCodes.CONFIRMATION_REQUIRED })).toBe('NO_RETRY');
  });

  it('12 request_id propagation', async () => {
    const { deps } = await buildDeps();
    const url = 'http://localhost/api/v1/residents/identify?name=Maria&unit=101';
    const res = await createIdentifyResidentHandler(deps).fetch(
      new Request(url, {
        method: 'GET',
        headers: {
          ...authHeaders({ method: 'GET', url }),
          'X-Request-Id': 'n8n-corr-g7g-12'
        }
      })
    );
    const json = await res.json();
    expect(json.request_id).toBe('n8n-corr-g7g-12');
    expect(res.headers.get('X-Request-Id')).toBe('n8n-corr-g7g-12');
    const events = observeOutcome({
      request_id: json.request_id,
      success: res.status === 200,
      http_status: res.status,
      operation: 'identify_resident',
      classification: 'READ',
      core_executed: json.data?.core_executed === true
    });
    expect(events.every((e) => e.request_id === 'n8n-corr-g7g-12')).toBe(true);
  });

  it('13 retry classification matrix', () => {
    const policy = describeRetryPolicy();
    expect(policy.create_package.class).toBe('SAFE_RETRY');
    expect(policy.pickup_package.class).toBe('CONTROLLED_RETRY');
    expect(policy.INVALID_TIME_RANGE.class).toBe('NO_RETRY');
    expect(policy.CONFLICT.class).toBe('RETRY_AFTER_CHANGE');
    expect(classifyRetry({ errorCode: ApiErrorCodes.INTERNAL_ERROR })).toBe('SAFE_RETRY');
  });

  it('14 sensitive data redaction', () => {
    const dirty = {
      confirmation_token: 'plain-token-value',
      secret: 's3cr3t',
      signature: 'aabbcc',
      service_role: 'role-key',
      areaId: 'area-1',
      text: 'ok'
    };
    const clean = redactObservabilityValue(dirty) as Record<string, unknown>;
    expect(clean.confirmation_token).toBe('[redacted]');
    expect(clean.secret).toBe('[redacted]');
    expect(clean.signature).toBe('[redacted]');
    expect(clean.service_role).toBe('[redacted]');
    expect(clean.areaId).toBe('area-1');
    const evt = buildOperationalEvent({
      event_name: 'operation.failed',
      request_id: 'req_r',
      status: 'failed',
      attributes: dirty
    });
    expect(assertNoSensitiveLeak(evt)).toEqual([]);
    expect(JSON.stringify(evt)).not.toContain('plain-token-value');
  });

  it('15 n8n correlation chain', () => {
    const chain = buildCorrelationChain({
      whatsapp_message_id: 'wamid.ABC',
      n8n_execution_id: 'exec-1',
      request_id: 'req_api_1',
      correlation_id: 'corr-conv-1'
    });
    expect(chain.request_id).toBe('req_api_1');
    expect(chain.n8n_execution_id).toBe('exec-1');
    expect(chain.note).toMatch(/not a secret|não é um segredo|Neither is a secret/i);
  });
});
