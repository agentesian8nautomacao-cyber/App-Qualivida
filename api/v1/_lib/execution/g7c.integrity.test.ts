/**
 * G7-C — Operational integrity (server-side) tests A–P
 * Fake/memory stores = TEST_ONLY. Production uses persistent Supabase stores.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { createFakePersistenceDb } from '../execution/fakePersistenceDb';
import { createSupabaseCorePersistence } from '../execution/supabasePersistence';
import { createMemoryCorePersistence } from '../execution/memoryPersistence';
import { createSupabaseIdempotencyStore } from '../idempotency/supabaseStore';
import { createSupabaseConfirmationStore } from '../confirmations/supabaseStore';
import { createUnavailableIdempotencyStore } from '../idempotency/store';
import { createIdentifyResidentHandler } from '../../residents/identify';
import { createPackagesHandler } from '../../operations/packages/index';
import { createPickupHandler } from '../../operations/packages/pickup';
import { createCancelReservationHandler } from '../../operations/reservations/cancel';
import { createReservationsHandler } from '../../operations/reservations/index';
import { createBoletosHandler } from '../../boletos';
import { executeCoreOperation } from '../execution/executeCore';
import { createReservation, timesOverlap, hasReservationConflict } from '../../../../sentinela/core';
import type { AuthorizedContext } from '../authz/authorize';
import type { Resident, Boleto } from '../../../../types';

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

const resolver = createMemoryPermissionResolver({
  porteiro: FIXTURE_CLIENT.permission_keys || []
});

const credentials = createMemoryCredentialStore([{ ...FIXTURE_CLIENT }]);

const residentA: Resident = {
  id: 'r-a-001',
  name: 'Maria Silva',
  unit: '101',
  email: 'maria@example.com',
  phone: '11999990001',
  whatsapp: '11999990001'
};

const residentAmbiguous: Resident[] = [
  { ...residentA, id: 'r-amb-1', name: 'Ana A', unit: '201', phone: '11955554444', whatsapp: '11955554444' },
  { ...residentA, id: 'r-amb-2', name: 'Ana B', unit: '202', phone: '11955554444', whatsapp: '11955554444' }
];

function authz(org = FIXTURE_ORG_A, condo = FIXTURE_CONDO_A): AuthorizedContext {
  return {
    operation: 'create_package',
    permission: 'packages.create',
    client_id: FIXTURE_CLIENT.client_id,
    organization_id: org,
    condominium_id: condo,
    role_name: 'porteiro',
    permission_keys: FIXTURE_CLIENT.permission_keys || [],
    core_operation_context: {
      channel: 'system',
      organizationId: org,
      condominiumId: condo,
      actorRole: 'integration',
      actorDisplayName: 'n8n-pilot'
    }
  };
}

async function buildDeps(client = createFakePersistenceDb(), residents: Resident[] = [residentA]) {
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
    persistence: persistenceResult.persistence,
    deps: {
      credentials,
      tenants,
      permissionResolver: resolver,
      windowSeconds: 300,
      skipProductionComposition: true,
      persistence: persistenceResult.persistence,
      residentsProvider: {
        async listResidents() {
          return residents;
        }
      },
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

function getSigned(url: string, extra?: { organizationId?: string; condominiumId?: string }) {
  const headers = authHeaders({
    method: 'GET',
    url,
    organizationId: extra?.organizationId,
    condominiumId: extra?.condominiumId
  });
  return new Request(url, { method: 'GET', headers });
}

function postSigned(
  url: string,
  bodyObj: Record<string, unknown>,
  opts?: { idempotencyKey?: string; organizationId?: string; condominiumId?: string }
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
      idempotencyKey: opts?.idempotencyKey
    })
  };
  return new Request(url, { method: 'POST', headers, body });
}

describe('G7-C domain overlap rule preserved', () => {
  it('half-open: 10-12 vs 12-14 does NOT overlap; 10-12 vs 11-13 does', () => {
    expect(timesOverlap('10:00', '12:00', '12:00', '14:00')).toBe(false);
    expect(timesOverlap('10:00', '12:00', '11:00', '13:00')).toBe(true);
    expect(
      hasReservationConflict(
        { areaIdOrName: 'X', date: '2026-09-01', startTime: '10:00', endTime: '12:00' },
        [{ areaIdOrName: 'X', date: '2026-09-01', startTime: '12:00', endTime: '14:00' }]
      )
    ).toBe(false);
  });
});

describe('G7-C integrity A–P', () => {
  it('A — duas reservas sequenciais mesmo slot: só uma criada', async () => {
    const { deps, client } = await buildDeps();
    const h = createReservationsHandler(deps);
    const body = {
      area_id: 'area-x',
      resident_id: residentA.id,
      resident_name: residentA.name,
      unit: '101',
      date: '2026-09-01',
      start_time: '10:00',
      end_time: '12:00'
    };
    const r1 = await h.fetch(
      postSigned('http://localhost/api/v1/operations/reservations', body, {
        idempotencyKey: 'res-a-1'
      })
    );
    expect(r1.status).toBe(200);
    const r2 = await h.fetch(
      postSigned('http://localhost/api/v1/operations/reservations', body, {
        idempotencyKey: 'res-a-2'
      })
    );
    expect(r2.status).toBe(409);
    const b2 = await r2.json();
    expect(b2.error.code).toBe('CONFLICT');
    expect(client.__db.reservations).toHaveLength(1);
  });

  it('A2 — concorrência Promise.all (documenta race app-level)', async () => {
    const { persistence } = createMemoryCorePersistence();
    const input = {
      areaId: 'area-x',
      residentId: residentA.id,
      residentName: residentA.name,
      unit: '101',
      date: '2026-09-02',
      startTime: '10:00',
      endTime: '12:00'
    };
    const ctx = {
      channel: 'system' as const,
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A
    };
    // Without DB exclusion constraint, parallel check-then-insert can both pass.
    const results = await Promise.all([
      createReservation(input, ctx, persistence),
      createReservation(input, ctx, persistence)
    ]);
    const oks = results.filter((r) => r.success).length;
    // May be 1 or 2 depending on timing — assert at least one succeeded and document residual
    expect(oks).toBeGreaterThanOrEqual(1);
    // DECISION REQUIRED: Postgres exclusion constraint for hard uniqueness under concurrency
  });

  it('B — sobreposição parcial 10-12 vs 11-13 = CONFLICT; 10-12 vs 12-14 = OK', async () => {
    const { deps, client } = await buildDeps();
    const h = createReservationsHandler(deps);
    const base = {
      area_id: 'area-x',
      resident_id: residentA.id,
      resident_name: residentA.name,
      unit: '101',
      date: '2026-09-03'
    };
    const r1 = await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/reservations',
        { ...base, start_time: '10:00', end_time: '12:00' },
        { idempotencyKey: 'res-b-1' }
      )
    );
    expect(r1.status).toBe(200);

    const overlap = await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/reservations',
        { ...base, start_time: '11:00', end_time: '13:00' },
        { idempotencyKey: 'res-b-2' }
      )
    );
    expect(overlap.status).toBe(409);

    const adjacent = await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/reservations',
        { ...base, start_time: '12:00', end_time: '14:00' },
        { idempotencyKey: 'res-b-3' }
      )
    );
    expect(adjacent.status).toBe(200);
    expect(client.__db.reservations).toHaveLength(2);
  });

  it('B2 — existingSlots do client NÃO sobrescreve servidor', async () => {
    const { persistence } = createMemoryCorePersistence({
      reservations: [
        {
          id: 'res-exist',
          areaId: 'area-x',
          residentId: residentA.id,
          unit: '101',
          date: '2026-09-04',
          startTime: '10:00',
          endTime: '12:00',
          status: 'scheduled'
        }
      ]
    });
    const res = await createReservation(
      {
        areaId: 'area-x',
        residentId: residentA.id,
        residentName: residentA.name,
        unit: '101',
        date: '2026-09-04',
        startTime: '10:00',
        endTime: '12:00',
        // Client lies: empty slots
        existingSlots: []
      },
      {
        channel: 'system',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A
      },
      persistence
    );
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('CONFLICT');
  });

  it('C — retry create_package mesma key+fingerprint = mesmo resultado', async () => {
    const { deps, client } = await buildDeps();
    const h = createPackagesHandler(deps);
    const payload = { recipient: 'Maria Silva', unit: '101', type: 'caixa' };
    const r1 = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'pkg-c'
      })
    );
    const b1 = await r1.json();
    expect(r1.status).toBe(200);
    const r2 = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'pkg-c'
      })
    );
    const b2 = await r2.json();
    expect(r2.status).toBe(200);
    expect(b2.data.result.id).toBe(b1.data.result.id);
    expect(client.__db.packages).toHaveLength(1);
  });

  it('D — retry pickup_package após sucesso (confirmação nova) = DUPLICATE / já retirada', async () => {
    const built = await buildDeps(
      createFakePersistenceDb({
        packages: [
          {
            id: 'pkg_d',
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
    const ch1 = await (
      await h.fetch(
        postSigned('http://localhost/api/v1/operations/packages/pickup', { resource_id: 'pkg_d' })
      )
    ).json();
    const ok1 = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_d',
        confirmation_id: ch1.error.details.confirmation_id,
        confirmation_token: ch1.error.details.confirmation_token
      })
    );
    expect(ok1.status).toBe(200);

    const ch2 = await (
      await h.fetch(
        postSigned('http://localhost/api/v1/operations/packages/pickup', { resource_id: 'pkg_d' })
      )
    ).json();
    const ok2 = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_d',
        confirmation_id: ch2.error.details.confirmation_id,
        confirmation_token: ch2.error.details.confirmation_token
      })
    );
    const b2 = await ok2.json();
    expect(ok2.status).toBe(409);
    expect(['CONFLICT', 'DUPLICATE_REQUEST']).toContain(b2.error.code);
    // status already recebida in DB
    expect(String(built.client.__db.packages[0].status)).toMatch(/recebida|entregue/i);
  });

  it('E — retry cancel_reservation: segunda mutação não inventa sucesso inconsistente', async () => {
    const built = await buildDeps(
      createFakePersistenceDb({
        reservations: [
          {
            id: 'res_e',
            area_id: 'area-x',
            resident_id: residentA.id,
            resident_name: residentA.name,
            unit: '101',
            date: '2026-09-05',
            start_time: '10:00',
            end_time: '12:00',
            status: 'scheduled'
          }
        ]
      })
    );
    const h = createCancelReservationHandler(built.deps);
    const ch1 = await (
      await h.fetch(
        postSigned('http://localhost/api/v1/operations/reservations/cancel', {
          resource_id: 'res_e',
          reservation_id: 'res_e'
        })
      )
    ).json();
    const ok1 = await h.fetch(
      postSigned('http://localhost/api/v1/operations/reservations/cancel', {
        resource_id: 'res_e',
        reservation_id: 'res_e',
        confirmation_id: ch1.error.details.confirmation_id,
        confirmation_token: ch1.error.details.confirmation_token
      })
    );
    expect(ok1.status).toBe(200);
    expect(built.client.__db.reservations.find((r) => r.id === 'res_e')).toBeUndefined();

    const ch2 = await (
      await h.fetch(
        postSigned('http://localhost/api/v1/operations/reservations/cancel', {
          resource_id: 'res_e',
          reservation_id: 'res_e'
        })
      )
    ).json();
    const ok2 = await h.fetch(
      postSigned('http://localhost/api/v1/operations/reservations/cancel', {
        resource_id: 'res_e',
        reservation_id: 'res_e',
        confirmation_id: ch2.error.details.confirmation_id,
        confirmation_token: ch2.error.details.confirmation_token
      })
    );
    expect([404, 409, 400]).toContain(ok2.status);
    const b2 = await ok2.json();
    expect(b2.ok).toBe(false);
  });

  it('F — confirmation consumida + retry = ALREADY_USED (Core não reexecuta)', async () => {
    const built = await buildDeps(
      createFakePersistenceDb({
        packages: [
          {
            id: 'pkg_f',
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
        postSigned('http://localhost/api/v1/operations/packages/pickup', { resource_id: 'pkg_f' })
      )
    ).json();
    const body = {
      resource_id: 'pkg_f',
      confirmation_id: ch.error.details.confirmation_id,
      confirmation_token: ch.error.details.confirmation_token
    };
    expect((await h.fetch(postSigned('http://localhost/api/v1/operations/packages/pickup', body))).status).toBe(
      200
    );
    const retry = await (
      await h.fetch(postSigned('http://localhost/api/v1/operations/packages/pickup', body))
    ).json();
    expect(retry.error.code).toBe('CONFIRMATION_ALREADY_CONSUMED');
  });

  it('G — tenant A não acessa recurso com tenant B headers', async () => {
    const { deps } = await buildDeps();
    const h = createPackagesHandler(deps);
    const res = await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'X', unit: '101' },
        {
          idempotencyKey: 'pkg-g',
          organizationId: FIXTURE_ORG_A,
          condominiumId: FIXTURE_CONDO_B
        }
      )
    );
    expect([401, 403]).toContain(res.status);
  });

  it('H — telefone inexistente = NOT_FOUND', async () => {
    const { deps } = await buildDeps();
    const h = createIdentifyResidentHandler(deps);
    const res = await h.fetch(
      getSigned('http://localhost/api/v1/residents/identify?phone=11900001111')
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('RESOURCE_NOT_FOUND');
  });

  it('I — telefone ambíguo = NEEDS_CONFIRMATION', async () => {
    const { deps } = await buildDeps(createFakePersistenceDb(), residentAmbiguous);
    const h = createIdentifyResidentHandler(deps);
    const res = await h.fetch(
      getSigned('http://localhost/api/v1/residents/identify?phone=11955554444')
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('NEEDS_CONFIRMATION');
  });

  it('J — boleto cross-tenant: unit filter + tenant binding; sem dump global', async () => {
    const boletoA: Boleto = {
      id: 'bol-a',
      residentName: 'Maria',
      unit: '101',
      referenceMonth: '08/2026',
      dueDate: '2026-08-20',
      amount: 100,
      status: 'Pendente',
      resident_id: residentA.id,
      pdf_original_path: 'internal/secret.pdf'
    };
    const { persistence } = createMemoryCorePersistence({ boletos: [boletoA] });
    const unscoped = await executeCoreOperation({
      operation: 'get_boleto',
      authz: authz(),
      body: {},
      idempotencyKey: null,
      rawBodyForFingerprint: '',
      deps: { persistence }
    });
    expect(unscoped.ok).toBe(false);

    const scoped = await executeCoreOperation({
      operation: 'get_boleto',
      authz: authz(),
      body: { unit: '101' },
      idempotencyKey: null,
      rawBodyForFingerprint: '',
      deps: { persistence }
    });
    expect(scoped.ok).toBe(true);
    if (scoped.ok) {
      const bols = (scoped.data as { boletos: Boleto[] }).boletos;
      expect(bols[0].id).toBe('bol-a');
      expect((bols[0] as Boleto).pdf_original_path).toBeUndefined();
    }

    const h = createBoletosHandler({
      credentials,
      tenants,
      permissionResolver: resolver,
      windowSeconds: 300,
      skipProductionComposition: true,
      persistence
    });
    const cross = await h.fetch(
      getSigned('http://localhost/api/v1/boletos?unit=101', {
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_B
      })
    );
    expect([401, 403]).toContain(cross.status);
  });

  it('K — Core não executado quando validação falha', async () => {
    let coreHits = 0;
    const { persistence } = createMemoryCorePersistence();
    const wrapped = {
      ...persistence,
      async savePackage(pkg: Parameters<NonNullable<typeof persistence.savePackage>>[0]) {
        coreHits++;
        return persistence.savePackage(pkg);
      }
    };
    const result = await executeCoreOperation({
      operation: 'create_package',
      authz: authz(),
      body: { recipient: 'X' }, // missing unit
      idempotencyKey: 'k-fail',
      rawBodyForFingerprint: '{"recipient":"X"}',
      deps: {
        persistence: wrapped,
        idempotencyStore: createSupabaseIdempotencyStore(createFakePersistenceDb())
      }
    });
    expect(result.ok).toBe(false);
    expect(result.core_executed).toBe(false);
    expect(coreHits).toBe(0);
  });

  it('L — Core executado uma única vez quando permitido (idempotent replay)', async () => {
    let saves = 0;
    const base = createMemoryCorePersistence();
    const wrapped = {
      ...base.persistence,
      async listReservationSlots() {
        return [];
      },
      async savePackage(pkg: Parameters<NonNullable<typeof base.persistence.savePackage>>[0]) {
        saves++;
        return base.persistence.savePackage(pkg);
      }
    };
    const store = createSupabaseIdempotencyStore(createFakePersistenceDb());
    const opts = {
      operation: 'create_package' as const,
      authz: authz(),
      body: { recipient: 'Maria', unit: '101', type: 'caixa' },
      idempotencyKey: 'pkg-l-once',
      rawBodyForFingerprint: JSON.stringify({ recipient: 'Maria', unit: '101', type: 'caixa' }),
      deps: { persistence: wrapped, idempotencyStore: store }
    };
    const r1 = await executeCoreOperation(opts);
    const r2 = await executeCoreOperation(opts);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(saves).toBe(1);
  });

  it('M — Idempotency replay', async () => {
    const { deps } = await buildDeps();
    const h = createPackagesHandler(deps);
    const payload = { recipient: 'Maria', unit: '101', type: 'caixa' };
    const a = await (
      await h.fetch(
        postSigned('http://localhost/api/v1/operations/packages', payload, {
          idempotencyKey: 'pkg-m'
        })
      )
    ).json();
    const b = await (
      await h.fetch(
        postSigned('http://localhost/api/v1/operations/packages', payload, {
          idempotencyKey: 'pkg-m'
        })
      )
    ).json();
    expect(a.data.result.id).toBe(b.data.result.id);
  });

  it('N — fingerprint mismatch', async () => {
    const { deps } = await buildDeps();
    const h = createPackagesHandler(deps);
    await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101', type: 'caixa' },
        { idempotencyKey: 'pkg-n' }
      )
    );
    const res = await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Outra', unit: '101', type: 'caixa' },
        { idempotencyKey: 'pkg-n' }
      )
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('IDEMPOTENCY_FINGERPRINT_MISMATCH');
  });

  it('O — API sem Dexie (composition + adapters)', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
    const files = [
      'api/v1/_lib/composition/productionDeps.ts',
      'api/v1/_lib/execution/supabasePersistence.ts',
      'api/v1/_lib/execution/executeCore.ts',
      'api/v1/_lib/withCoreExecution.ts'
    ];
    for (const f of files) {
      const src = readFileSync(join(root, f), 'utf8');
      // Ban runtime imports / identifiers — comments mentioning "no Dexie" are OK
      expect(src).not.toMatch(/from\s+['"]dexie['"]/i);
      expect(src).not.toMatch(/require\(\s*['"]dexie['"]\s*\)/i);
      expect(src).not.toMatch(/\bindexedDB\b/);
    }
  });

  it('P — server sem memória como persistência de produção', async () => {
    const result = await executeCoreOperation({
      operation: 'create_package',
      authz: authz(),
      body: { recipient: 'Maria', unit: '101' },
      idempotencyKey: 'pkg-p',
      rawBodyForFingerprint: '{}',
      deps: {
        idempotencyStore: createUnavailableIdempotencyStore()
        // no persistence
      }
    });
    expect(result.ok).toBe(false);
    expect(result.core_executed).toBe(false);
  });
});
