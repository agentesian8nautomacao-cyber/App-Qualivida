/**
 * G7-J-W — Persistent Event Store sink wiring tests (no LIVE DB).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMemoryEventSink,
  setObservabilitySink,
  resetObservabilitySink,
  safeEmit,
  buildOperationalEvent,
  assertNoSensitiveLeak,
  persistOperationalEvent,
  mapEnvelopeToDomainEventRow,
  createMemoryPersistentEventStore,
  setPersistentEventPersister,
  resetPersistentEventPersister,
  isPersistableEventName,
  PERSISTABLE_EVENT_TYPES
} from '../observability';
import { createFakePersistenceDb } from '../execution/fakePersistenceDb';
import { createMemoryCredentialStore } from '../auth/credentials';
import { createMemoryTenantDirectory } from '../auth/tenant';
import { createMemoryPermissionResolver } from '../authz/permissionResolver';
import {
  FIXTURE_CLIENT,
  FIXTURE_CONDO_A,
  FIXTURE_ORG_A,
  authHeaders
} from '../auth/testFixtures';
import { createSupabaseCorePersistence } from '../execution/supabasePersistence';
import { createSupabaseIdempotencyStore } from '../idempotency/supabaseStore';
import { createSupabaseConfirmationStore } from '../confirmations/supabaseStore';
import { createPackagesHandler } from '../../operations/packages/index';
import { createPickupHandler } from '../../operations/packages/pickup';

const tenantsOk = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A }
]);
const resolver = createMemoryPermissionResolver({
  porteiro: FIXTURE_CLIENT.permission_keys || []
});
const credentials = createMemoryCredentialStore([{ ...FIXTURE_CLIENT }]);

function baseEnvelope(
  overrides: Partial<ReturnType<typeof buildOperationalEvent>> & {
    event_name: Parameters<typeof buildOperationalEvent>[0]['event_name'];
    status: Parameters<typeof buildOperationalEvent>[0]['status'];
  }
) {
  return buildOperationalEvent({
    event_name: overrides.event_name,
    request_id: overrides.request_id || `req_${Math.random().toString(16).slice(2)}`,
    client_id: FIXTURE_CLIENT.client_id,
    organization_id: FIXTURE_ORG_A,
    condominium_id: FIXTURE_CONDO_A,
    operation: overrides.operation ?? 'create_package',
    classification: overrides.classification ?? 'WRITE',
    status: overrides.status,
    http_status: overrides.http_status ?? 200,
    error_code: overrides.error_code ?? null,
    core_executed: overrides.core_executed ?? true,
    attributes: overrides.attributes
  });
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

describe('G7-J-W persistent Event Store sink', () => {
  let memoryStore = createMemoryPersistentEventStore();
  let localSink = createMemoryEventSink();

  beforeEach(() => {
    memoryStore = createMemoryPersistentEventStore();
    localSink = createMemoryEventSink();
    setObservabilitySink(localSink);
    setPersistentEventPersister(memoryStore.persister);
  });

  afterEach(() => {
    resetObservabilitySink();
    resetPersistentEventPersister();
  });

  it('A — persistable event is stored', async () => {
    const event = baseEnvelope({
      event_name: 'operation.completed',
      status: 'completed',
      core_executed: true
    });
    const r = await persistOperationalEvent(
      { from: () => ({ insert: async (row) => { memoryStore.rows.push(row); return { data: row, error: null }; } }) },
      event
    );
    expect(r.ok).toBe(true);
    expect(memoryStore.rows).toHaveLength(1);
    expect(memoryStore.rows[0].event_type).toBe('operation.completed');
  });

  it('B — redaction blocks secrets before persist', () => {
    const dirty = {
      ...baseEnvelope({ event_name: 'operation.failed', status: 'failed', core_executed: false }),
      attributes: { confirmation_token: 'secret-token-value', ok: true }
    };
    const leaks = assertNoSensitiveLeak(dirty);
    expect(leaks.length).toBeGreaterThan(0);
    const mapped = mapEnvelopeToDomainEventRow(dirty as never);
    expect('skip' in mapped).toBe(true);
  });

  it('C — tenant ids preserved on row', async () => {
    await memoryStore.persister(
      baseEnvelope({ event_name: 'operation.completed', status: 'completed' })
    );
    expect(memoryStore.rows[0].organization_id).toBe(FIXTURE_ORG_A);
    expect(memoryStore.rows[0].condominium_id).toBe(FIXTURE_CONDO_A);
  });

  it('D — invalid tenant is not persisted as valid', async () => {
    const event = buildOperationalEvent({
      event_name: 'request.rejected',
      request_id: 'req_no_tenant',
      client_id: FIXTURE_CLIENT.client_id,
      organization_id: null,
      condominium_id: null,
      status: 'rejected',
      error_code: 'INVALID_SIGNATURE',
      http_status: 401,
      core_executed: false
    });
    const r = await memoryStore.persister(event);
    expect(r.ok).toBe(true);
    expect(r.skipped).toBe(true);
    expect(r.reason).toBe('tenant_required');
    expect(memoryStore.rows).toHaveLength(0);
  });

  it('E/F — sink INSERT failure does not break Core success path', async () => {
    const client = createFakePersistenceDb({
      organizations: [{ id: FIXTURE_ORG_A }],
      condominiums: [{ id: FIXTURE_CONDO_A }]
    });
    client.setFail('api_domain_events', 'store down');
    setPersistentEventPersister((e) => persistOperationalEvent(client as never, e));

    const persistenceResult = await createSupabaseCorePersistence({
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      client,
      tenantDirectory: tenantsOk
    });
    expect(persistenceResult.ok).toBe(true);
    const handler = createPackagesHandler({
      credentials,
      tenants: tenantsOk,
      permissionResolver: resolver,
      windowSeconds: 300,
      skipProductionComposition: true,
      persistence: persistenceResult.ok ? persistenceResult.persistence : undefined,
      idempotencyStore: createSupabaseIdempotencyStore(client),
      confirmationStore: createSupabaseConfirmationStore(client),
      createPersistence: async () => (persistenceResult.ok ? persistenceResult.persistence : null)
    });

    const bodyObj = {
      recipient: 'G7-J-W-TEST',
      unit: '101',
      type: 'caixa',
      input_type: 'text',
      text: 'event sink fail-safe'
    };
    const body = JSON.stringify(bodyObj);
    const url = 'http://localhost/api/v1/operations/packages';
    const res = await handler.fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders({
            method: 'POST',
            url,
            body,
            idempotencyKey: `g7jw-fail-${Date.now()}`
          })
        },
        body
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data?.core_executed).toBe(true);
    await flushMicrotasks();
    expect(client.__db.api_domain_events.length).toBe(0);
  });

  it('G — core.failed is persistable', async () => {
    const event = baseEnvelope({
      event_name: 'core.failed',
      status: 'conflict',
      error_code: 'CONFLICT',
      http_status: 409,
      core_executed: true
    });
    await memoryStore.persister(event);
    expect(memoryStore.rows[0].event_type).toBe('core.failed');
    expect(memoryStore.rows[0].core_executed).toBe(true);
  });

  it('H — operation.failed is persistable', async () => {
    await memoryStore.persister(
      baseEnvelope({
        event_name: 'operation.failed',
        status: 'failed',
        error_code: 'INTERNAL_ERROR',
        http_status: 500,
        core_executed: false
      })
    );
    expect(memoryStore.rows[0].event_type).toBe('operation.failed');
  });

  it('I — operation.completed is persistable', async () => {
    await memoryStore.persister(
      baseEnvelope({ event_name: 'operation.completed', status: 'completed' })
    );
    expect(memoryStore.rows[0].event_type).toBe('operation.completed');
  });

  it('J — confirmation.required and confirmation.consumed', async () => {
    await memoryStore.persister(
      baseEnvelope({
        event_name: 'confirmation.required',
        status: 'confirmation_required',
        classification: 'SENSITIVE',
        operation: 'pickup_package',
        core_executed: false,
        http_status: 409,
        error_code: 'CONFIRMATION_REQUIRED',
        attributes: { confirmation_id: 'cnf_test_abc' }
      })
    );
    await memoryStore.persister(
      baseEnvelope({
        event_name: 'confirmation.consumed',
        status: 'confirmation_consumed',
        classification: 'SENSITIVE',
        operation: 'pickup_package',
        core_executed: false,
        attributes: { confirmation_id: 'cnf_test_abc' }
      })
    );
    expect(memoryStore.rows.map((r) => r.event_type)).toEqual([
      'confirmation.required',
      'confirmation.consumed'
    ]);
    expect(memoryStore.rows[0].confirmation_id).toBe('cnf_test_abc');
    expect(memoryStore.rows[0].attributes?.confirmation_id).toBeUndefined();
  });

  it('K — idempotency.replay with core_executed=false', async () => {
    await memoryStore.persister(
      baseEnvelope({
        event_name: 'idempotency.replay',
        status: 'duplicate',
        core_executed: false,
        http_status: 200
      })
    );
    expect(memoryStore.rows[0].event_type).toBe('idempotency.replay');
    expect(memoryStore.rows[0].core_executed).toBe(false);
  });

  it('L — runtime-only events do not INSERT', async () => {
    for (const name of ['request.received', 'request.authorized', 'core.started', 'core.completed'] as const) {
      expect(isPersistableEventName(name)).toBe(false);
      const r = await memoryStore.persister(
        buildOperationalEvent({
          event_name: name,
          request_id: `req_${name}`,
          organization_id: FIXTURE_ORG_A,
          condominium_id: FIXTURE_CONDO_A,
          status: name === 'request.received' ? 'accepted' : name === 'request.authorized' ? 'authorized' : 'executed',
          core_executed: name.startsWith('core')
        })
      );
      expect(r.skipped).toBe(true);
    }
    expect(memoryStore.rows).toHaveLength(0);
    expect(PERSISTABLE_EVENT_TYPES).not.toContain('idempotency.created');
  });

  it('M — concurrent emits do not corrupt envelopes', async () => {
    const a = baseEnvelope({
      event_name: 'operation.completed',
      status: 'completed',
      request_id: 'req_conc_a',
      operation: 'create_package'
    });
    const b = baseEnvelope({
      event_name: 'operation.failed',
      status: 'failed',
      request_id: 'req_conc_b',
      operation: 'create_reservation',
      error_code: 'CONFLICT',
      http_status: 409
    });
    await Promise.all([memoryStore.persister(a), memoryStore.persister(b)]);
    expect(memoryStore.rows).toHaveLength(2);
    const byReq = Object.fromEntries(memoryStore.rows.map((r) => [r.request_id, r]));
    expect(byReq.req_conc_a.operation).toBe('create_package');
    expect(byReq.req_conc_b.operation).toBe('create_reservation');
    expect(byReq.req_conc_a.event_id).not.toBe(byReq.req_conc_b.event_id);
  });

  it('queuePersistentPersist is fire-and-forget via safeEmit', async () => {
    safeEmit({
      event_name: 'request.denied',
      request_id: 'req_queue',
      client_id: FIXTURE_CLIENT.client_id,
      organization_id: FIXTURE_ORG_A,
      condominium_id: FIXTURE_CONDO_A,
      operation: 'create_package',
      classification: 'WRITE',
      status: 'rejected',
      error_code: 'FORBIDDEN',
      http_status: 403,
      core_executed: false
    });
    expect(localSink.list().some((e) => e.event_name === 'request.denied')).toBe(true);
    await flushMicrotasks();
    expect(memoryStore.rows.some((r) => r.event_type === 'request.denied')).toBe(true);
  });

  it('handler confirmation.required reaches memory store via queue', async () => {
    const client = createFakePersistenceDb({
      organizations: [{ id: FIXTURE_ORG_A }],
      condominiums: [{ id: FIXTURE_CONDO_A }]
    });
    setPersistentEventPersister((e) => persistOperationalEvent(client as never, e));
    const persistenceResult = await createSupabaseCorePersistence({
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      client,
      tenantDirectory: tenantsOk
    });
    const handler = createPickupHandler({
      credentials,
      tenants: tenantsOk,
      permissionResolver: resolver,
      windowSeconds: 300,
      skipProductionComposition: true,
      persistence: persistenceResult.ok ? persistenceResult.persistence : undefined,
      confirmationStore: createSupabaseConfirmationStore(client),
      createPersistence: async () => (persistenceResult.ok ? persistenceResult.persistence : null)
    });
    const bodyObj = { resource_id: 'pkg-missing-g7jw' };
    const body = JSON.stringify(bodyObj);
    const url = 'http://localhost/api/v1/operations/packages/pickup';
    const res = await handler.fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders({ method: 'POST', url, body })
        },
        body
      })
    );
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error?.code).toBe('CONFIRMATION_REQUIRED');
    await flushMicrotasks();
    const types = client.__db.api_domain_events.map((r) => r.event_type);
    expect(types).toContain('confirmation.required');
    expect(types).toContain('operation.failed');
    expect(types).not.toContain('request.received');
  });
});
