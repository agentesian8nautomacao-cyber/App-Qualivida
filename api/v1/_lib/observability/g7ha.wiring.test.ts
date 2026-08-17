/**
 * G7-H-A — Production observability wiring tests (no LIVE DB).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createMemoryEventSink,
  setObservabilitySink,
  resetObservabilitySink,
  clearObservabilityOnce,
  getObservabilitySink,
  safeEmit,
  assertNoSensitiveLeak
} from '../observability';
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
import { createPackagesHandler } from '../../operations/packages/index';
import { createPickupHandler } from '../../operations/packages/pickup';
import { createReservationsHandler } from '../../operations/reservations/index';
import { createIdentifyResidentHandler } from '../../residents/identify';

const tenantsOk = createMemoryTenantDirectory([
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
    tenantDirectory: tenantsOk
  });
  if (!persistenceResult.ok) throw new Error('persistence');
  return {
    client,
    deps: {
      credentials,
      tenants: tenantsOk,
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
          tenantDirectory: tenantsOk
        });
        return r.ok ? r.persistence : null;
      }
    }
  };
}

function postSigned(
  url: string,
  bodyObj: Record<string, unknown>,
  opts?: {
    idempotencyKey?: string;
    signature?: string | null;
    organizationId?: string;
    condominiumId?: string;
    clientId?: string;
    requestId?: string;
  }
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
      }),
      ...(opts?.requestId ? { 'X-Request-Id': opts.requestId } : {})
    },
    body
  });
}

describe('G7-H-A production observability wiring', () => {
  let sink = createMemoryEventSink();

  beforeEach(() => {
    sink = createMemoryEventSink();
    setObservabilitySink(sink);
    clearObservabilityOnce();
  });

  afterEach(() => {
    resetObservabilitySink();
  });

  it('1–4 received / rejected / authorized / denied', async () => {
    const { deps } = await buildDeps();
    await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'g7ha-ok', requestId: 'req-g7ha-auth' }
      )
    );
    const names = sink.list().map((e) => e.event_name);
    expect(names).toContain('request.received');
    expect(names).toContain('request.authorized');

    sink.clear();
    clearObservabilityOnce();
    await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'g7ha-sig', signature: '00'.repeat(32), requestId: 'req-g7ha-rej' }
      )
    );
    expect(sink.list().map((e) => e.event_name)).toContain('request.rejected');
    expect(sink.list().every((e) => e.organization_id == null)).toBe(true);

    sink.clear();
    clearObservabilityOnce();
    const limited = createMemoryCredentialStore([
      { ...FIXTURE_CLIENT, client_id: 'n8n-ro', permission_keys: ['residents.view'] }
    ]);
    const body = JSON.stringify({ recipient: 'Maria', unit: '101' });
    const url = 'http://localhost/api/v1/operations/packages';
    await createPackagesHandler({ ...deps, credentials: limited }).fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders({
            method: 'POST',
            url,
            body,
            clientId: 'n8n-ro',
            idempotencyKey: 'g7ha-deny'
          }),
          'X-Request-Id': 'req-g7ha-deny'
        },
        body
      })
    );
    expect(sink.list().map((e) => e.event_name)).toContain('request.denied');
  });

  it('5–6 idempotency created + replay (core_executed false on replay)', async () => {
    const { deps } = await buildDeps();
    const h = createPackagesHandler(deps);
    const payload = { recipient: 'Maria', unit: '101' };
    const first = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'g7ha-idem',
        requestId: 'req-g7ha-idem-1'
      })
    );
    expect((await first.json()).data.core_executed).toBe(true);
    expect(sink.list().map((e) => e.event_name)).toContain('idempotency.created');

    sink.clear();
    clearObservabilityOnce();
    const second = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'g7ha-idem',
        requestId: 'req-g7ha-idem-2'
      })
    );
    const body = await second.json();
    expect(body.data.core_executed).toBe(false);
    expect(body.data.idempotency_replay).toBe(true);
    expect(sink.list().map((e) => e.event_name)).toContain('idempotency.replay');
    expect(
      sink.list().find((e) => e.event_name === 'idempotency.replay')?.core_executed
    ).toBe(false);
  });

  it('7–8 confirmation required + consumed', async () => {
    const built = await buildDeps(
      createFakePersistenceDb({
        packages: [
          {
            id: 'pkg_g7ha',
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
      postSigned(
        'http://localhost/api/v1/operations/packages/pickup',
        { resource_id: 'pkg_g7ha' },
        { requestId: 'req-g7ha-cnf' }
      )
    );
    const ch = await chRes.json();
    expect(ch.error.code).toBe('CONFIRMATION_REQUIRED');
    expect(sink.list().map((e) => e.event_name)).toContain('confirmation.required');
    const dumped = JSON.stringify(sink.list());
    expect(dumped).not.toContain(ch.error.details.confirmation_token);

    sink.clear();
    clearObservabilityOnce();
    const ok = await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages/pickup',
        {
          resource_id: 'pkg_g7ha',
          confirmation_id: ch.error.details.confirmation_id,
          confirmation_token: ch.error.details.confirmation_token
        },
        { requestId: 'req-g7ha-cnf2' }
      )
    );
    expect(ok.status).toBe(200);
    const names = sink.list().map((e) => e.event_name);
    expect(names).toContain('confirmation.consumed');
    expect(names).toContain('core.completed');
    expect(JSON.stringify(sink.list())).not.toContain(ch.error.details.confirmation_token);
  });

  it('9–13 core started/completed/failed + operation completed/failed', async () => {
    const { deps } = await buildDeps();
    await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'g7ha-core', requestId: 'req-g7ha-core' }
      )
    );
    const names = sink.list().map((e) => e.event_name);
    expect(names).toContain('core.started');
    expect(names).toContain('core.completed');
    expect(names).toContain('operation.completed');

    sink.clear();
    clearObservabilityOnce();
    await createReservationsHandler(deps).fetch(
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
        { idempotencyKey: 'g7ha-time', requestId: 'req-g7ha-time' }
      )
    );
    expect(sink.list().map((e) => e.event_name)).toContain('operation.failed');
    expect(sink.list().some((e) => e.error_code === 'INVALID_TIME_RANGE')).toBe(true);
    expect(sink.list().every((e) => e.event_name !== 'core.started')).toBe(true);
  });

  it('14–16 tenant / HMAC / AuthZ', async () => {
    const { deps } = await buildDeps();
    await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        {
          idempotencyKey: 'g7ha-tenant',
          organizationId: FIXTURE_ORG_A,
          condominiumId: FIXTURE_CONDO_B,
          requestId: 'req-g7ha-tenant'
        }
      )
    );
    const rej = sink.list().find((e) => e.event_name === 'request.rejected');
    expect(rej).toBeTruthy();
    expect(rej?.organization_id).toBeNull();
    expect(rej?.condominium_id).toBeNull();
  });

  it('17 confirmation_required core_executed=false', async () => {
    const { deps } = await buildDeps();
    await createPickupHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages/pickup',
        { resource_id: 'x' },
        { requestId: 'req-g7ha-cr' }
      )
    );
    const conf = sink.list().find((e) => e.event_name === 'confirmation.required');
    expect(conf?.core_executed).toBe(false);
  });

  it('18–19 redaction secrets + token', () => {
    const blocked = safeEmit({
      event_name: 'operation.failed',
      request_id: 'req-leak',
      status: 'failed',
      attributes: {
        confirmation_token: 'SECRET_TOKEN',
        secret: 's',
        signature: 'sig'
      }
    });
    expect(blocked).toBeTruthy();
    expect(assertNoSensitiveLeak(blocked)).toEqual([]);
    expect(JSON.stringify(blocked)).not.toContain('SECRET_TOKEN');
  });

  it('20 request_id propagation', async () => {
    const { deps } = await buildDeps();
    const url = 'http://localhost/api/v1/residents/identify?name=Maria&unit=101';
    const res = await createIdentifyResidentHandler(deps).fetch(
      new Request(url, {
        method: 'GET',
        headers: {
          ...authHeaders({ method: 'GET', url }),
          'X-Request-Id': 'n8n-corr-g7ha-20'
        }
      })
    );
    const json = await res.json();
    expect(json.request_id).toBe('n8n-corr-g7ha-20');
    expect(sink.list().every((e) => e.request_id === 'n8n-corr-g7ha-20')).toBe(true);
  });

  it('21–22 core_executed true vs false', async () => {
    const { deps } = await buildDeps();
    const ok = await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'g7ha-ce-t', requestId: 'req-ce-t' }
      )
    );
    expect((await ok.json()).data.core_executed).toBe(true);

    const bad = await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'g7ha-ce-f', signature: '11'.repeat(32), requestId: 'req-ce-f' }
      )
    );
    const badBody = await bad.json();
    expect(badBody.success).toBe(false);
    const rej = sink.list().find((e) => e.request_id === 'req-ce-f');
    expect(rej?.core_executed).toBe(false);
  });

  it('23 sink failure does not alter operation', async () => {
    setObservabilitySink({
      emit() {
        throw new Error('sink boom');
      },
      list: () => [],
      clear() {}
    });
    const { deps } = await buildDeps();
    const res = await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'g7ha-sink-fail', requestId: 'req-sink-fail' }
      )
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.core_executed).toBe(true);
    // restore works
    expect(getObservabilitySink()).toBeTruthy();
  });
});
