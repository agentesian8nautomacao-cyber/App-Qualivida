/**
 * G7-B — Server wiring tests (persistent stores via fake DB; kind=persistent).
 * Memory is NOT used as production substitute.
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
  authHeaders,
  signRequest
} from '../auth/testFixtures';
import { createFakePersistenceDb } from '../execution/fakePersistenceDb';
import { createSupabaseCorePersistence } from '../execution/supabasePersistence';
import { createSupabaseIdempotencyStore } from '../idempotency/supabaseStore';
import { createSupabaseConfirmationStore } from '../confirmations/supabaseStore';
import { createUnavailableIdempotencyStore } from '../idempotency/store';
import { createUnavailableConfirmationStore } from '../confirmations/unavailableStore';
import { createIdentifyResidentHandler } from '../../residents/identify';
import { createPackagesHandler } from '../../operations/packages/index';
import { createPickupHandler } from '../../operations/packages/pickup';
import { createCancelReservationHandler } from '../../operations/reservations/cancel';
import { sha256Hex } from '../auth/hmac';

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

describe('G7-B server wiring', () => {
  it('A — READ autenticado (identify_resident)', async () => {
    const { deps } = await buildDeps();
    const handler = createIdentifyResidentHandler(deps);
    const url = 'http://localhost/api/v1/residents/identify?name=Maria&unit=101';
    const res = await handler.fetch(getSigned(url));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.core_executed).toBe(true);
  });

  it('B — WRITE sem Idempotency-Key → rejeitado', async () => {
    const { deps } = await buildDeps();
    const handler = createPackagesHandler(deps);
    const res = await handler.fetch(
      postSigned('http://localhost/api/v1/operations/packages', {
        recipient: 'Maria',
        unit: '101'
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('C — primeira utilização da key', async () => {
    const { deps, client } = await buildDeps();
    const handler = createPackagesHandler(deps);
    const res = await handler.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101', type: 'caixa' },
        { idempotencyKey: 'key-c-1' }
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.core_executed).toBe(true);
    expect(client.__db.api_idempotency_keys).toHaveLength(1);
    expect(client.__db.api_idempotency_keys[0].status).toBe('completed');
  });

  it('D — replay mesma key/fingerprint', async () => {
    const { deps } = await buildDeps();
    const handler = createPackagesHandler(deps);
    const payload = { recipient: 'Maria', unit: '101', type: 'caixa' };
    const first = await handler.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'key-d-1'
      })
    );
    const firstBody = await first.json();
    const second = await handler.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'key-d-1'
      })
    );
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(secondBody.data.result).toEqual(firstBody.data.result);
  });

  it('E — fingerprint diferente → IDEMPOTENCY_FINGERPRINT_MISMATCH', async () => {
    const { deps } = await buildDeps();
    const handler = createPackagesHandler(deps);
    await handler.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'key-e-1' }
      )
    );
    const res = await handler.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Outra', unit: '102' },
        { idempotencyKey: 'key-e-1' }
      )
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('IDEMPOTENCY_FINGERPRINT_MISMATCH');
  });

  it('F — key expirada + reclaim R1', async () => {
    const client = createFakePersistenceDb({
      api_idempotency_keys: [
        {
          id: 'old',
          organization_id: FIXTURE_ORG_A,
          condominium_id: FIXTURE_CONDO_A,
          idempotency_key: 'key-f-1',
          fingerprint: 'deadbeef',
          operation: 'create_package',
          request_id: 'n8n-pilot',
          status: 'completed',
          response_status: 200,
          response_body: { ok: true, stale: true },
          created_at: '2020-01-01T00:00:00.000Z',
          expires_at: '2020-01-02T00:00:00.000Z',
          completed_at: '2020-01-01T01:00:00.000Z'
        }
      ]
    });
    const { deps } = await buildDeps(client);
    const handler = createPackagesHandler(deps);
    const res = await handler.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'key-f-1' }
      )
    );
    expect(res.status).toBe(200);
    const rows = client.__db.api_idempotency_keys.filter((r) => r.idempotency_key === 'key-f-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('completed');
    expect(rows[0].response_body).not.toEqual({ ok: true, stale: true });
  });

  it('G — concorrência (segunda claim in_progress)', async () => {
    const client = createFakePersistenceDb();
    const store = createSupabaseIdempotencyStore(client);
    const fp = sha256Hex('{"a":1}');
    const claim1 = await store.claim!({
      key: 'key-g',
      organization_id: FIXTURE_ORG_A,
      condominium_id: FIXTURE_CONDO_A,
      client_id: 'n8n-pilot',
      operation: 'create_package',
      fingerprint: fp
    });
    expect(claim1.outcome).toBe('proceed');
    const claim2 = await store.claim!({
      key: 'key-g',
      organization_id: FIXTURE_ORG_A,
      condominium_id: FIXTURE_CONDO_A,
      client_id: 'n8n-pilot',
      operation: 'create_package',
      fingerprint: fp
    });
    expect(claim2.outcome).toBe('in_progress');
  });

  it('H — tenant A ≠ B (mismatch)', async () => {
    const { deps } = await buildDeps();
    const handler = createPackagesHandler(deps);
    const res = await handler.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        {
          idempotencyKey: 'key-h',
          organizationId: FIXTURE_ORG_A,
          condominiumId: FIXTURE_CONDO_B
        }
      )
    );
    expect([401, 403]).toContain(res.status);
  });

  it('I — confirmation válida (challenge create)', async () => {
    const { deps, client } = await buildDeps();
    const handler = createPickupHandler(deps);
    const res = await handler.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_i'
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFIRMATION_REQUIRED');
    expect(body.error.details.confirmation_token).toBeTruthy();
    expect(client.__db.api_confirmations).toHaveLength(1);
    expect(client.__db.api_confirmations[0].token_hash).toBeTruthy();
    expect(JSON.stringify(client.__db.api_confirmations[0])).not.toContain(
      body.error.details.confirmation_token
    );
  });

  it('J — confirmation expirada', async () => {
    const { deps, client } = await buildDeps();
    const store = createSupabaseConfirmationStore(client);
    const past = new Date(Date.now() - 60_000).toISOString();
    await store.create({
      confirmation_id: 'cnf_expired',
      token_hash: 'a'.repeat(64),
      organization_id: FIXTURE_ORG_A,
      condominium_id: FIXTURE_CONDO_A,
      client_id: FIXTURE_CLIENT.client_id,
      requester_identity: null,
      operation: 'pickup_package',
      resource_id: 'pkg_j',
      operation_fingerprint: 'fp',
      prompt: 'x',
      expires_at: past,
      used_at: null,
      created_at: past,
      status: 'pending'
    });
    const { validateConfirmation } = await import('../confirmations/service');
    const result = await validateConfirmation(
      {
        confirmation_id: 'cnf_expired',
        confirmation_token: 'dead',
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg_j'
      },
      store,
      Date.now()
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('CONFIRMATION_EXPIRED');
  });

  it('K — confirmation consumida (single-use)', async () => {
    const built = await buildDeps(
      createFakePersistenceDb({
        packages: [
          {
            id: 'pkg_k',
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
      postSigned('http://localhost/api/v1/operations/packages/pickup', { resource_id: 'pkg_k' })
    );
    const ch = await chRes.json();
    const ok1 = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_k',
        confirmation_id: ch.error.details.confirmation_id,
        confirmation_token: ch.error.details.confirmation_token
      })
    );
    expect(ok1.status).toBe(200);
    const ok2 = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_k',
        confirmation_id: ch.error.details.confirmation_id,
        confirmation_token: ch.error.details.confirmation_token
      })
    );
    const body2 = await ok2.json();
    expect(body2.error.code).toBe('CONFIRMATION_ALREADY_CONSUMED');
  });

  it('L — token inválido', async () => {
    const built = await buildDeps();
    const h = createPickupHandler(built.deps);
    const chRes = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', { resource_id: 'pkg_l' })
    );
    const ch = await chRes.json();
    const res = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_l',
        confirmation_id: ch.error.details.confirmation_id,
        confirmation_token: '0'.repeat(64)
      })
    );
    const body = await res.json();
    expect(body.error.code).toBe('CONFIRMATION_INVALID');
  });

  it('M — confirmação tenant incorreto', async () => {
    const built = await buildDeps();
    const h = createPickupHandler(built.deps);
    const chRes = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', { resource_id: 'pkg_m' })
    );
    const ch = await chRes.json();
    // credential is scoped to org A / condo A — requesting with org B headers fails auth earlier
    const res = await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages/pickup',
        {
          resource_id: 'pkg_m',
          confirmation_id: ch.error.details.confirmation_id,
          confirmation_token: ch.error.details.confirmation_token
        },
        { organizationId: FIXTURE_ORG_B, condominiumId: FIXTURE_CONDO_B }
      )
    );
    expect([401, 403]).toContain(res.status);
  });

  it('N — SENSITIVE sem confirmação', async () => {
    const { deps } = await buildDeps();
    const h = createCancelReservationHandler(deps);
    const res = await h.fetch(
      postSigned('http://localhost/api/v1/operations/reservations/cancel', {
        resource_id: 'res_n'
      })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('O — SENSITIVE com confirmação válida + Core', async () => {
    const client = createFakePersistenceDb({
      packages: [
        {
          id: 'pkg_o',
          recipient_name: 'Maria',
          unit: '101',
          type: 'caixa',
          received_at: '2026-08-14T12:00:00.000Z',
          display_time: '09:00',
          status: 'pendente',
          deadline_minutes: 45
        }
      ]
    });
    const { deps } = await buildDeps(client);
    const h = createPickupHandler(deps);
    const chRes = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', { resource_id: 'pkg_o' })
    );
    const ch = await chRes.json();
    const res = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_o',
        confirmation_id: ch.error.details.confirmation_id,
        confirmation_token: ch.error.details.confirmation_token
      })
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.core_executed).toBe(true);
  });

  it('P — Core não executado se store indisponível', async () => {
    const h = createPackagesHandler({
      credentials,
      tenants,
      permissionResolver: resolver,
      windowSeconds: 300,
      skipProductionComposition: true,
      idempotencyStore: createUnavailableIdempotencyStore(),
      confirmationStore: createUnavailableConfirmationStore()
    });
    const res = await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'key-p' }
      )
    );
    const body = await res.json();
    expect(body.error.code).toBe('IDEMPOTENCY_STORE_UNAVAILABLE');
    expect(body.error.details.core_executed).toBe(false);
  });

  it('Q — Core executado exatamente uma vez (replay não reexecuta mutação)', async () => {
    const { deps, client } = await buildDeps();
    const h = createPackagesHandler(deps);
    const payload = { recipient: 'Maria', unit: '101', type: 'caixa' };
    await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'key-q'
      })
    );
    const count1 = client.__db.packages.length;
    await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'key-q'
      })
    );
    expect(client.__db.packages.length).toBe(count1);
  });

  it('R — API composition/stores não importam Dexie/browser', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const files = [
      join(here, 'supabaseStore.ts'),
      join(here, '../confirmations/supabaseStore.ts'),
      join(here, '../composition/productionDeps.ts'),
      join(here, '../withCoreExecution.ts')
    ];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const imports = src.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n');
      expect(imports).not.toMatch(/dexie/i);
      expect(imports).not.toMatch(/offlineDb|offlineDataService|dataService/);
      expect(src).not.toMatch(/\bwindow\./);
      expect(src).not.toMatch(/localStorage/);
    }
  });
});
