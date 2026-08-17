/**
 * G7-K — GET /api/v1/events (events.view)
 * Auth / tenant / AuthZ / filters / pagination / redaction / read-only.
 * No LIVE writes. No migrations. No Core.
 */

import { describe, expect, it, beforeEach } from 'vitest';
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
import { createEventsHandler } from '../../events';
import {
  createMemoryEventStoreQuery,
  EVENTS_PAGE_DEFAULT,
  EVENTS_PAGE_MAX,
  type EventStoreRow
} from './eventStoreQuery';
import { assertNoSensitiveLeak } from './redact';
import { OPERATION_PERMISSION_MAP } from '../authz/operations';
import { classifyOperation } from '../ops/classification';
import { resetPersistentEventPersister } from './persistentEventStore';

const URL = 'http://localhost/api/v1/events';

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

function seedRow(partial: Partial<EventStoreRow> & Pick<EventStoreRow, 'event_id'>): EventStoreRow {
  return {
    occurred_at: partial.occurred_at ?? '2026-08-16T12:00:00.000Z',
    created_at: partial.created_at ?? '2026-08-16T12:00:01.000Z',
    request_id: partial.request_id ?? 'req_seed',
    organization_id: partial.organization_id ?? FIXTURE_ORG_A,
    condominium_id: partial.condominium_id ?? FIXTURE_CONDO_A,
    client_id: partial.client_id ?? 'n8n-pilot-test',
    correlation_id: partial.correlation_id ?? null,
    operation: partial.operation ?? 'create_package',
    event_type: partial.event_type ?? 'operation.completed',
    status: partial.status ?? 'completed',
    source: partial.source ?? 'api.v1',
    classification: partial.classification ?? 'WRITE',
    http_status: partial.http_status ?? 200,
    error_code: partial.error_code ?? null,
    retry_class: partial.retry_class ?? 'NO_RETRY',
    core_executed: partial.core_executed ?? true,
    duration_ms: partial.duration_ms ?? 12,
    external_ref: partial.external_ref ?? null,
    confirmation_id: partial.confirmation_id ?? null,
    attributes: partial.attributes ?? null,
    event_id: partial.event_id
  };
}

const SEED: EventStoreRow[] = [
  seedRow({
    event_id: 'evt_a1',
    occurred_at: '2026-08-16T15:00:00.000Z',
    request_id: 'req_a1',
    event_type: 'operation.completed',
    operation: 'create_package',
    status: 'completed'
  }),
  seedRow({
    event_id: 'evt_a2',
    occurred_at: '2026-08-16T14:00:00.000Z',
    request_id: 'req_a2',
    event_type: 'operation.failed',
    operation: 'pickup_package',
    status: 'rejected',
    http_status: 409,
    error_code: 'CONFIRMATION_REQUIRED',
    core_executed: false
  }),
  seedRow({
    event_id: 'evt_b1',
    occurred_at: '2026-08-16T16:00:00.000Z',
    request_id: 'req_b1',
    organization_id: FIXTURE_ORG_B,
    condominium_id: FIXTURE_CONDO_B,
    event_type: 'operation.completed',
    operation: 'create_package',
    status: 'completed'
  }),
  seedRow({
    event_id: 'evt_secretish',
    occurred_at: '2026-08-16T13:00:00.000Z',
    request_id: 'req_sec',
    event_type: 'request.denied',
    operation: 'list_events',
    status: 'rejected',
    attributes: {
      secret: 'should-never-appear',
      token: 'tok_x',
      hmac: 'deadbeef'
    }
  })
];

function cred(role: string, keys: string[]) {
  return {
    ...FIXTURE_CLIENT,
    role_name: role,
    permission_keys: keys
  };
}

function buildHandler(opts?: {
  role?: string;
  keys?: string[];
  roleMap?: Record<string, string[]>;
  seed?: EventStoreRow[];
}) {
  const role = opts?.role ?? 'sindico';
  const keys = opts?.keys ?? ['events.view', 'packages.create'];
  const credentials = createMemoryCredentialStore([cred(role, keys)]);
  const permissionResolver = createMemoryPermissionResolver(
    opts?.roleMap ?? {
      sindico: ['events.view', 'packages.create', 'sentinela.view'],
      administradora: ['events.view', 'packages.create'],
      porteiro: ['packages.create', 'sentinela.view'],
      cabo_turma: ['packages.create'],
      morador: ['residents.view']
    }
  );
  const eventStoreQuery = createMemoryEventStoreQuery(opts?.seed ?? SEED);
  return createEventsHandler({
    credentials,
    tenants,
    permissionResolver,
    eventStoreQuery,
    skipProductionComposition: true,
    windowSeconds: 300
  });
}

async function getEvents(
  handler: ReturnType<typeof createEventsHandler>,
  query = '',
  headerOpts: Parameters<typeof authHeaders>[0] = { method: 'GET', url: URL }
) {
  const url = query ? `${URL}?${query}` : URL;
  const headers = authHeaders({ ...headerOpts, method: 'GET', url });
  return handler.fetch(new Request(url, { method: 'GET', headers }));
}

describe('G7-K GET /api/v1/events', () => {
  beforeEach(() => {
    resetPersistentEventPersister();
  });

  it('operation list_events maps to events.view and READ', () => {
    expect(OPERATION_PERMISSION_MAP.list_events.permission).toBe('events.view');
    expect(classifyOperation('list_events')).toBe('READ');
  });

  // --- Auth ---
  it('1. HMAC válido → 200', async () => {
    const res = await getEvents(buildHandler());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.operation).toBe('list_events');
    expect(body.data.core_executed).toBe(false);
  });

  it('2. HMAC inválido → 401', async () => {
    const res = await getEvents(buildHandler(), '', {
      method: 'GET',
      url: URL,
      signature: 'deadbeef'
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('3. timestamp expirado → 401', async () => {
    const expired = String(Math.floor(Date.now() / 1000) - 10_000);
    const res = await getEvents(buildHandler(), '', {
      method: 'GET',
      url: URL,
      timestamp: expired
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TIMESTAMP_EXPIRED');
  });

  // --- Tenant ---
  it('4. tenant válido → 200', async () => {
    const res = await getEvents(buildHandler());
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids = body.data.events.map((e: { event_id: string }) => e.event_id);
    expect(ids).toContain('evt_a1');
    expect(ids).not.toContain('evt_b1');
  });

  it('5. tenant inválido → 403/404', async () => {
    const res = await getEvents(buildHandler(), '', {
      method: 'GET',
      url: URL,
      organizationId: '99999999-9999-9999-9999-999999999999',
      condominiumId: '88888888-8888-8888-8888-888888888888'
    });
    expect([403, 404]).toContain(res.status);
  });

  it('6. tenant A não retorna eventos de B', async () => {
    const res = await getEvents(buildHandler());
    const body = await res.json();
    expect(body.data.events.every((e: { event_id: string }) => e.event_id.startsWith('evt_a') || e.event_id === 'evt_secretish')).toBe(true);
    expect(body.data.events.some((e: { event_id: string }) => e.event_id === 'evt_b1')).toBe(false);
  });

  it('7. query organization_id/condominium_id NÃO substitui tenant', async () => {
    const q = `organization_id=${FIXTURE_ORG_B}&condominium_id=${FIXTURE_CONDO_B}`;
    const res = await getEvents(buildHandler(), q);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.events.some((e: { event_id: string }) => e.event_id === 'evt_b1')).toBe(false);
    expect(body.data.events.some((e: { event_id: string }) => e.event_id === 'evt_a1')).toBe(true);
  });

  // --- AuthZ ---
  it('8. events.view → 200', async () => {
    const res = await getEvents(buildHandler({ keys: ['events.view'], role: 'sindico' }));
    expect(res.status).toBe(200);
  });

  it('9. sem events.view → 403', async () => {
    const res = await getEvents(
      buildHandler({
        role: 'porteiro',
        keys: ['packages.create'],
        roleMap: { porteiro: ['packages.create'] }
      })
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('10. sentinela.view sozinho → 403', async () => {
    const res = await getEvents(
      buildHandler({
        role: 'sindico',
        keys: ['sentinela.view'],
        roleMap: { sindico: ['sentinela.view'] }
      })
    );
    expect(res.status).toBe(403);
  });

  // --- Roles ---
  it('11. sindico autorizado', async () => {
    expect((await getEvents(buildHandler({ role: 'sindico' }))).status).toBe(200);
  });

  it('12. administradora autorizada', async () => {
    expect(
      (
        await getEvents(
          buildHandler({
            role: 'administradora',
            keys: ['events.view'],
            roleMap: { administradora: ['events.view'] }
          })
        )
      ).status
    ).toBe(200);
  });

  it('13. porteiro negado', async () => {
    expect(
      (
        await getEvents(
          buildHandler({
            role: 'porteiro',
            keys: ['packages.create'],
            roleMap: { porteiro: ['packages.create'] }
          })
        )
      ).status
    ).toBe(403);
  });

  it('14. cabo_turma negado', async () => {
    expect(
      (
        await getEvents(
          buildHandler({
            role: 'cabo_turma',
            keys: ['packages.create'],
            roleMap: { cabo_turma: ['packages.create'] }
          })
        )
      ).status
    ).toBe(403);
  });

  it('15. morador negado', async () => {
    expect(
      (
        await getEvents(
          buildHandler({
            role: 'morador',
            keys: ['residents.view'],
            roleMap: { morador: ['residents.view'] }
          })
        )
      ).status
    ).toBe(403);
  });

  // --- Filters ---
  it('16. filter event_type', async () => {
    const res = await getEvents(buildHandler(), 'event_type=operation.failed');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.events).toHaveLength(1);
    expect(body.data.events[0].event_id).toBe('evt_a2');
  });

  it('17. filter operation', async () => {
    const res = await getEvents(buildHandler(), 'operation=create_package');
    const body = await res.json();
    expect(body.data.events.every((e: { operation: string }) => e.operation === 'create_package')).toBe(
      true
    );
  });

  it('18. filter status', async () => {
    const res = await getEvents(buildHandler(), 'status=rejected');
    const body = await res.json();
    expect(body.data.events.length).toBeGreaterThanOrEqual(1);
    expect(body.data.events.every((e: { status: string }) => e.status === 'rejected')).toBe(true);
  });

  it('19. filter request_id (tenant-scoped)', async () => {
    const res = await getEvents(buildHandler(), 'request_id=req_b1');
    const body = await res.json();
    // req_b1 exists only on tenant B — tenant A sees empty
    expect(res.status).toBe(200);
    expect(body.data.events).toHaveLength(0);
  });

  it('20. filter from/to', async () => {
    const res = await getEvents(
      buildHandler(),
      'from=2026-08-16T14:30:00.000Z&to=2026-08-16T15:30:00.000Z'
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.events.map((e: { event_id: string }) => e.event_id)).toEqual(['evt_a1']);
  });

  it('20b. from/to inválidos → 400', async () => {
    const badTz = await getEvents(buildHandler(), 'from=2026-08-16T14:00:00');
    expect(badTz.status).toBe(400);
    const inverted = await getEvents(
      buildHandler(),
      'from=2026-08-16T16:00:00.000Z&to=2026-08-16T14:00:00.000Z'
    );
    expect(inverted.status).toBe(400);
  });

  // --- Pagination ---
  it('21. default limit 50', async () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      seedRow({
        event_id: `evt_p${String(i).padStart(3, '0')}`,
        occurred_at: new Date(Date.parse('2026-08-16T10:00:00.000Z') + i * 1000).toISOString()
      })
    );
    const res = await getEvents(buildHandler({ seed: many }));
    const body = await res.json();
    expect(body.data.pagination.limit).toBe(EVENTS_PAGE_DEFAULT);
    expect(body.data.events).toHaveLength(EVENTS_PAGE_DEFAULT);
    expect(body.data.pagination.next_cursor).toBeTruthy();
  });

  it('22. máximo 100', async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      seedRow({
        event_id: `evt_m${String(i).padStart(3, '0')}`,
        occurred_at: new Date(Date.parse('2026-08-16T10:00:00.000Z') + i * 1000).toISOString()
      })
    );
    const res = await getEvents(buildHandler({ seed: many }), 'limit=100');
    const body = await res.json();
    expect(body.data.pagination.limit).toBe(EVENTS_PAGE_MAX);
    expect(body.data.events).toHaveLength(100);
  });

  it('23. limite inválido → 400', async () => {
    expect((await getEvents(buildHandler(), 'limit=0')).status).toBe(400);
    expect((await getEvents(buildHandler(), 'limit=101')).status).toBe(400);
    expect((await getEvents(buildHandler(), 'limit=abc')).status).toBe(400);
  });

  it('24. cursor válido avança página', async () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      seedRow({
        event_id: `evt_c${i}`,
        occurred_at: new Date(Date.parse('2026-08-16T10:00:00.000Z') + i * 1000).toISOString()
      })
    );
    const first = await getEvents(buildHandler({ seed: many }), 'limit=2');
    const b1 = await first.json();
    expect(b1.data.events).toHaveLength(2);
    const cursor = b1.data.pagination.next_cursor as string;
    const second = await getEvents(buildHandler({ seed: many }), `limit=2&cursor=${encodeURIComponent(cursor)}`);
    const b2 = await second.json();
    expect(second.status).toBe(200);
    expect(b2.data.events).toHaveLength(2);
    const ids1 = b1.data.events.map((e: { event_id: string }) => e.event_id);
    const ids2 = b2.data.events.map((e: { event_id: string }) => e.event_id);
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false);
  });

  it('25. cursor inválido → 400', async () => {
    const res = await getEvents(buildHandler(), 'cursor=not-a-cursor');
    expect(res.status).toBe(400);
  });

  // --- Redaction ---
  it('26–32. redaction_leak_rows = 0', async () => {
    const res = await getEvents(buildHandler());
    const body = await res.json();
    const leaks = assertNoSensitiveLeak(body);
    expect(leaks).toEqual([]);
    const json = JSON.stringify(body);
    expect(json).not.toMatch(/should-never-appear/);
    expect(json).not.toMatch(/tok_x/);
    expect(json).not.toMatch(/deadbeef/);
    expect(json).not.toMatch(/service_role/i);
    expect(json).not.toMatch(/BEGIN\s/);
    expect(json).not.toMatch(/stack/i);
    expect(json).not.toMatch(/"attributes"/);
    expect(json).not.toMatch(/"secret"/);
    expect(json).not.toMatch(/"token"/);
    expect(json).not.toMatch(/"hmac"/);
    expect(json).not.toMatch(/"token_hash"/);
    expect(body.data.events.every((e: Record<string, unknown>) => !('organization_id' in e))).toBe(
      true
    );
  });

  // --- Read-only ---
  it('33–35. consulta não muta store / não executa Core', async () => {
    const seed = [...SEED];
    const store = createMemoryEventStoreQuery(seed);
    const before = await store.listEvents({
      organization_id: FIXTURE_ORG_A,
      condominium_id: FIXTURE_CONDO_A,
      limit: 100
    });
    const handler = createEventsHandler({
      credentials: createMemoryCredentialStore([cred('sindico', ['events.view'])]),
      tenants,
      permissionResolver: createMemoryPermissionResolver({ sindico: ['events.view'] }),
      eventStoreQuery: store,
      skipProductionComposition: true
    });
    const res = await getEvents(handler);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.core_executed).toBe(false);
    const after = await store.listEvents({
      organization_id: FIXTURE_ORG_A,
      condominium_id: FIXTURE_CONDO_A,
      limit: 100
    });
    expect(after.ok && before.ok && after.events.length).toBe(
      before.ok ? before.events.length : -1
    );
  });

  // --- Regression markers ---
  it('36–40. regressões de inventário (G6/G7 markers no contrato AuthZ)', () => {
    expect(OPERATION_PERMISSION_MAP.create_package.permission).toBe('packages.create');
    expect(OPERATION_PERMISSION_MAP.cancel_reservation.permission).toBe('reservations.delete');
    expect(OPERATION_PERMISSION_MAP.list_events.permission).toBe('events.view');
    expect(classifyOperation('create_package')).toBe('WRITE');
    expect(classifyOperation('pickup_package')).toBe('SENSITIVE');
    expect(classifyOperation('list_events')).toBe('READ');
  });
});
