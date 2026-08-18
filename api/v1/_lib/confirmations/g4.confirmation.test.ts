/**
 * G4 confirmation + sensitive operations tests
 * Memory store = TEST_ONLY. Production default = unavailable.
 */

import { describe, expect, it } from 'vitest';
import {
  classifyOperation,
  requiresConfirmation,
  listOperationsByClass
} from '../ops/classification';
import {
  createConfirmationRequest,
  validateConfirmation,
  resolveConfirmationStore
} from './service';
import { createMemoryConfirmationStoreForTests } from './memoryStore';
import { createUnavailableConfirmationStore } from './unavailableStore';
import { createMemoryCredentialStore } from '../auth/credentials';
import { createMemoryTenantDirectory } from '../auth/tenant';
import { createMemoryPermissionResolver } from '../authz/permissionResolver';
import { createPickupHandler } from '../handlers/operations/packages/pickup';
import { createCancelReservationHandler } from '../handlers/operations/reservations/cancel';
import { createPackagesHandler } from '../handlers/operations/packages/index';
import { createConfirmationProbeHandler } from '../handlers/confirmation-probe';
import {
  FIXTURE_CLIENT,
  FIXTURE_CONDO_A,
  FIXTURE_CONDO_B,
  FIXTURE_ORG_A,
  FIXTURE_ORG_B,
  authHeaders,
  signRequest
} from '../auth/testFixtures';

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

const resolver = createMemoryPermissionResolver({
  porteiro: FIXTURE_CLIENT.permission_keys || [],
  sindico: ['residents.view']
});

const memoryStore = createMemoryConfirmationStoreForTests();
const credentials = createMemoryCredentialStore([{ ...FIXTURE_CLIENT }]);
const deps = {
  credentials,
  tenants,
  permissionResolver: resolver,
  confirmationStore: memoryStore,
  windowSeconds: 300
};

const pickup = createPickupHandler(deps);
const cancel = createCancelReservationHandler(deps);
const packages = createPackagesHandler(deps);
const probe = createConfirmationProbeHandler(deps);

const PICKUP_URL = 'http://localhost/api/v1/operations/packages/pickup';
const CANCEL_URL = 'http://localhost/api/v1/operations/reservations/cancel';
const PACKAGES_URL = 'http://localhost/api/v1/operations/packages';

function postSigned(url: string, bodyObj: Record<string, unknown>) {
  const body = JSON.stringify(bodyObj);
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders({ method: 'POST', url, body })
  };
  return new Request(url, { method: 'POST', headers, body });
}

describe('G4 classification', () => {
  it('classifies READ / WRITE / SENSITIVE', () => {
    expect(classifyOperation('identify_resident')).toBe('READ');
    expect(classifyOperation('get_boleto')).toBe('READ');
    expect(classifyOperation('create_package')).toBe('WRITE');
    expect(classifyOperation('pickup_package')).toBe('SENSITIVE');
    expect(classifyOperation('cancel_reservation')).toBe('SENSITIVE');
    expect(requiresConfirmation('pickup_package')).toBe(true);
    expect(requiresConfirmation('create_package')).toBe(false);
    expect(listOperationsByClass('SENSITIVE').sort()).toEqual(
      ['cancel_reservation', 'pickup_package'].sort()
    );
  });
});

describe('G4 confirmation service (test store)', () => {
  it('5. valid confirmation allows proceed (validate ok)', async () => {
    const store = createMemoryConfirmationStoreForTests();
    const created = await createConfirmationRequest(
      {
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1',
        prompt: 'Confirmar retirada?'
      },
      store
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const validated = await validateConfirmation(
      {
        confirmation_id: created.data.confirmation_id,
        confirmation_token: created.data.confirmation_token,
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1'
      },
      store
    );
    expect(validated.ok).toBe(true);
  });

  it('6. invalid token = DENY', async () => {
    const store = createMemoryConfirmationStoreForTests();
    const created = await createConfirmationRequest(
      {
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1',
        prompt: 'x'
      },
      store
    );
    if (!created.ok) throw new Error('create failed');
    const validated = await validateConfirmation(
      {
        confirmation_id: created.data.confirmation_id,
        confirmation_token: 'deadbeef',
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1'
      },
      store
    );
    expect(validated.ok).toBe(false);
    if (!validated.ok) expect(validated.code).toBe('CONFIRMATION_INVALID');
  });

  it('7. expired = DENY', async () => {
    const store = createMemoryConfirmationStoreForTests();
    const now = Date.now();
    const created = await createConfirmationRequest(
      {
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1',
        prompt: 'x',
        ttl_seconds: 30
      },
      store,
      now
    );
    if (!created.ok) throw new Error('create failed');
    const validated = await validateConfirmation(
      {
        confirmation_id: created.data.confirmation_id,
        confirmation_token: created.data.confirmation_token,
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1'
      },
      store,
      now + 60_000
    );
    expect(validated.ok).toBe(false);
    if (!validated.ok) expect(validated.code).toBe('CONFIRMATION_EXPIRED');
  });

  it('8. already used = DENY', async () => {
    const store = createMemoryConfirmationStoreForTests();
    const created = await createConfirmationRequest(
      {
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'cancel_reservation',
        resource_id: 'res-1',
        prompt: 'x'
      },
      store
    );
    if (!created.ok) throw new Error('create failed');
    const input = {
      confirmation_id: created.data.confirmation_id,
      confirmation_token: created.data.confirmation_token,
      organization_id: FIXTURE_ORG_A,
      condominium_id: FIXTURE_CONDO_A,
      client_id: FIXTURE_CLIENT.client_id,
      operation: 'cancel_reservation',
      resource_id: 'res-1'
    };
    expect((await validateConfirmation(input, store)).ok).toBe(true);
    const second = await validateConfirmation(input, store);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe('CONFIRMATION_ALREADY_CONSUMED');
  });

  it('9. other tenant = DENY', async () => {
    const store = createMemoryConfirmationStoreForTests();
    const created = await createConfirmationRequest(
      {
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1',
        prompt: 'x'
      },
      store
    );
    if (!created.ok) throw new Error('create failed');
    const validated = await validateConfirmation(
      {
        confirmation_id: created.data.confirmation_id,
        confirmation_token: created.data.confirmation_token,
        organization_id: FIXTURE_ORG_B,
        condominium_id: FIXTURE_CONDO_B,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1'
      },
      store
    );
    expect(validated.ok).toBe(false);
    if (!validated.ok) expect(validated.code).toBe('CONFIRMATION_INVALID');
  });

  it('10. other operation = DENY', async () => {
    const store = createMemoryConfirmationStoreForTests();
    const created = await createConfirmationRequest(
      {
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1',
        prompt: 'x'
      },
      store
    );
    if (!created.ok) throw new Error('create failed');
    const validated = await validateConfirmation(
      {
        confirmation_id: created.data.confirmation_id,
        confirmation_token: created.data.confirmation_token,
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'cancel_reservation',
        resource_id: 'pkg-1'
      },
      store
    );
    expect(validated.ok).toBe(false);
  });

  it('11. other resource = DENY', async () => {
    const store = createMemoryConfirmationStoreForTests();
    const created = await createConfirmationRequest(
      {
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1',
        prompt: 'x'
      },
      store
    );
    if (!created.ok) throw new Error('create failed');
    const validated = await validateConfirmation(
      {
        confirmation_id: created.data.confirmation_id,
        confirmation_token: created.data.confirmation_token,
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-OTHER'
      },
      store
    );
    expect(validated.ok).toBe(false);
  });

  it('production default store is unavailable (not memory)', () => {
    const store = resolveConfirmationStore(null);
    expect(store.kind).toBe('unavailable');
    expect(createUnavailableConfirmationStore().kind).toBe('unavailable');
  });
});

describe('G4 HTTP sensitive gates', () => {
  it('1. READ classify without confirmation = PASS', async () => {
    const url = 'http://localhost/api/v1/confirmation-probe?operation=identify_resident';
    const headers = authHeaders({ method: 'GET', url });
    const res = await probe.fetch(new Request(url, { method: 'GET', headers }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.classification).toBe('READ');
    expect(body.data.requires_confirmation).toBe(false);
  });

  it('2. WRITE create_package AuthZ = IDEMPOTENCY_KEY_REQUIRED (no confirmation)', async () => {
    const res = await packages.fetch(postSigned(PACKAGES_URL, { recipient: 'A', unit: '1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(body.error.details.core_executed).toBe(false);
  });

  it('3. pickup without confirmation = CONFIRMATION_REQUIRED', async () => {
    const res = await pickup.fetch(postSigned(PICKUP_URL, { resource_id: 'pkg-99' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFIRMATION_REQUIRED');
    expect(body.error.details.confirmation_id).toBeTruthy();
    expect(body.error.details.confirmation_token).toBeTruthy();
  });

  it('4. cancel without confirmation = CONFIRMATION_REQUIRED', async () => {
    const res = await cancel.fetch(
      postSigned(CANCEL_URL, { resource_id: 'res-99', reservation_id: 'res-99' })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('5b. pickup with valid confirmation reaches Core path (G7-B; needs persistence for success)', async () => {
    const challenge = await pickup.fetch(postSigned(PICKUP_URL, { resource_id: 'pkg-ok' }));
    const ch = await challenge.json();
    const confirmation_id = ch.error.details.confirmation_id as string;
    const confirmation_token = ch.error.details.confirmation_token as string;

    const res = await pickup.fetch(
      postSigned(PICKUP_URL, {
        resource_id: 'pkg-ok',
        confirmation_id,
        confirmation_token
      })
    );
    const body = await res.json();
    // Confirmation consumed; Core attempted. Without persistence adapter → fail closed (not 501 store unavailable).
    expect(body.error?.code || body.data?.core_executed).toBeTruthy();
    if (body.error) {
      expect(body.error.code).not.toBe('CONFIRMATION_STORE_UNAVAILABLE');
      expect(body.error.details.core_executed).toBe(false);
    } else {
      expect(body.data.core_executed).toBe(true);
    }
  });

  it('12. confirmation without AuthZ = DENY', async () => {
    const res = await pickup.fetch(
      new Request(PICKUP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: 'pkg-1' })
      })
    );
    expect(res.status).toBe(401);
  });

  it('13. absence of tenant = DENY', async () => {
    const body = JSON.stringify({ resource_id: 'pkg-1' });
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders({ method: 'POST', url: PICKUP_URL, body, omit: ['organization'] })
    };
    const res = await pickup.fetch(new Request(PICKUP_URL, { method: 'POST', headers, body }));
    expect([400, 401]).toContain(res.status);
  });

  it('14. invalid HMAC = DENY', async () => {
    const body = JSON.stringify({ resource_id: 'pkg-1' });
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders({ method: 'POST', url: PICKUP_URL, body, signature: '00' })
    };
    const res = await pickup.fetch(new Request(PICKUP_URL, { method: 'POST', headers, body }));
    expect(res.status).toBe(401);
  });

  it('15-17. SINDICO/PORTEIRO no bypass; sensitive never reaches Core without confirmation', async () => {
    const sindicoCreds = createMemoryCredentialStore([
      {
        ...FIXTURE_CLIENT,
        client_id: 'sindico-client',
        secret: FIXTURE_CLIENT.secret,
        permission_keys: undefined,
        role_name: 'sindico'
      }
    ]);
    const sindicoPickup = createPickupHandler({
      ...deps,
      credentials: sindicoCreds
    });
    const body = JSON.stringify({ resource_id: 'pkg-1' });
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = signRequest({
      method: 'POST',
      url: PICKUP_URL,
      body,
      timestamp: ts,
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      secret: FIXTURE_CLIENT.secret
    });
    const res = await sindicoPickup.fetch(
      new Request(PICKUP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentinela-Client-Id': 'sindico-client',
          'X-Sentinela-Timestamp': ts,
          'X-Sentinela-Signature': sig,
          'X-Organization-Id': FIXTURE_ORG_A,
          'X-Condominium-Id': FIXTURE_CONDO_A
        },
        body
      })
    );
    expect(res.status).toBe(403);

    // Without confirmation, even authorized pickup does not return GATE_PENDING with core
    const noConf = await pickup.fetch(postSigned(PICKUP_URL, { resource_id: 'pkg-no' }));
    const noConfBody = await noConf.json();
    expect(noConfBody.error.code).toBe('CONFIRMATION_REQUIRED');
    expect(noConfBody.error.details?.core_executed).toBeUndefined();
  });

  it('prod path without store returns CONFIRMATION_STORE_UNAVAILABLE', async () => {
    const prodPickup = createPickupHandler({
      credentials,
      tenants,
      permissionResolver: resolver,
      confirmationStore: createUnavailableConfirmationStore(),
      windowSeconds: 300
    });
    const res = await prodPickup.fetch(postSigned(PICKUP_URL, { resource_id: 'pkg-1' }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('CONFIRMATION_STORE_UNAVAILABLE');
  });
});
