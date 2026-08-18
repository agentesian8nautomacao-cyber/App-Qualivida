/**
 * G5 — Operational Core execution tests
 * Persistence/idempotency memory stores = TEST_ONLY (not production).
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
  authHeaders,
  signRequest
} from '../auth/testFixtures';
import { createMemoryCorePersistence } from '../execution/memoryPersistence';
import { createMemoryIdempotencyStoreForTests } from '../idempotency/store';
import { createUnavailableConfirmationStore } from '../confirmations/unavailableStore';
import { createMemoryConfirmationStoreForTests } from '../confirmations/memoryStore';
import { createIdentifyResidentHandler } from '../handlers/residents/identify';
import { createIdentifyUnitHandler } from '../handlers/units/identify';
import { createBoletosHandler } from '../handlers/boletos';
import { createPackagesHandler } from '../handlers/operations/packages/index';
import { createOccurrencesHandler } from '../handlers/operations/occurrences/index';
import { createUpdateOccurrenceHandler } from '../handlers/operations/occurrences/update';
import { createReservationsHandler } from '../handlers/operations/reservations/index';
import { createPickupHandler } from '../handlers/operations/packages/pickup';
import { createCancelReservationHandler } from '../handlers/operations/reservations/cancel';
import { classifyOperation } from '../ops/classification';
import { executeCoreOperation } from '../execution/executeCore';
import type { Resident, Boleto, Occurrence } from '../../../../types';
import type { AuthorizedContext } from '../authz/authorize';

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

const resolver = createMemoryPermissionResolver({
  porteiro: FIXTURE_CLIENT.permission_keys || [],
  sindico: ['residents.view']
});

const residentA: Resident = {
  id: 'r-a-001',
  name: 'Maria Silva',
  unit: '101',
  email: 'maria@example.com',
  phone: '11999990001',
  whatsapp: '11999990001'
};

const boletoA: Boleto = {
  id: 'bol-001',
  residentName: 'Maria Silva',
  unit: '101',
  referenceMonth: '08/2026',
  dueDate: '2026-08-20',
  amount: 450,
  status: 'Pendente',
  resident_id: residentA.id
};

const { persistence, catalog } = createMemoryCorePersistence({
  residents: [residentA],
  boletos: [boletoA],
  packages: [
    {
      id: 'pkg-block',
      recipient: 'Maria Silva',
      unit: '101',
      type: 'caixa',
      receivedAt: '2026-08-14T12:00:00.000Z',
      displayTime: '09:00',
      status: 'pendente',
      deadlineMinutes: 45,
      recipientId: residentA.id
    }
  ]
});

const idempotencyStore = createMemoryIdempotencyStoreForTests();
const credentials = createMemoryCredentialStore([{ ...FIXTURE_CLIENT }]);

const baseDeps = {
  credentials,
  tenants,
  permissionResolver: resolver,
  windowSeconds: 300,
  persistence,
  residentsProvider: {
    async listResidents() {
      return catalog.residents;
    }
  },
  idempotencyStore
};

const identifyResident = createIdentifyResidentHandler(baseDeps);
const identifyUnit = createIdentifyUnitHandler(baseDeps);
const boletos = createBoletosHandler(baseDeps);
const packages = createPackagesHandler(baseDeps);
const occurrences = createOccurrencesHandler(baseDeps);
const updateOccurrence = createUpdateOccurrenceHandler(baseDeps);
const reservations = createReservationsHandler(baseDeps);
const pickup = createPickupHandler({
  ...baseDeps,
  confirmationStore: createMemoryConfirmationStoreForTests()
});
const cancel = createCancelReservationHandler({
  ...baseDeps,
  confirmationStore: createMemoryConfirmationStoreForTests()
});
const pickupProd = createPickupHandler({
  credentials,
  tenants,
  permissionResolver: resolver,
  confirmationStore: createUnavailableConfirmationStore(),
  windowSeconds: 300
});

const ID_RES_URL = 'http://localhost/api/v1/residents/identify';
const ID_UNIT_URL = 'http://localhost/api/v1/units/identify';
const BOLETOS_URL = 'http://localhost/api/v1/boletos';
const PACKAGES_URL = 'http://localhost/api/v1/operations/packages';
const OCC_URL = 'http://localhost/api/v1/operations/occurrences';
const OCC_UPD_URL = 'http://localhost/api/v1/operations/occurrences/update';
const RES_URL = 'http://localhost/api/v1/operations/reservations';
const PICKUP_URL = 'http://localhost/api/v1/operations/packages/pickup';
const CANCEL_URL = 'http://localhost/api/v1/operations/reservations/cancel';

function getSigned(url: string, extra?: { organizationId?: string; condominiumId?: string; secret?: string; clientId?: string }) {
  const headers = authHeaders({
    method: 'GET',
    url,
    organizationId: extra?.organizationId,
    condominiumId: extra?.condominiumId,
    secret: extra?.secret,
    clientId: extra?.clientId
  });
  return new Request(url, { method: 'GET', headers });
}

function postSigned(
  url: string,
  bodyObj: Record<string, unknown>,
  opts?: { idempotencyKey?: string; organizationId?: string; condominiumId?: string; clientId?: string; secret?: string }
) {
  const body = JSON.stringify(bodyObj);
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders({
      method: 'POST',
      url,
      body,
      idempotencyKey: opts?.idempotencyKey,
      organizationId: opts?.organizationId,
      condominiumId: opts?.condominiumId,
      clientId: opts?.clientId,
      secret: opts?.secret
    })
  };
  return new Request(url, { method: 'POST', headers, body });
}

function patchSigned(
  url: string,
  bodyObj: Record<string, unknown>,
  opts?: { idempotencyKey?: string }
) {
  const body = JSON.stringify(bodyObj);
  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders({
      method: 'PATCH',
      url,
      body,
      idempotencyKey: opts?.idempotencyKey
    })
  };
  return new Request(url, { method: 'PATCH', headers, body });
}

describe('G5 READ operations', () => {
  it('1. identify_resident válido = PASS', async () => {
    const url = `${ID_RES_URL}?phone=11999990001`;
    const res = await identifyResident.fetch(getSigned(url));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.request_id).toBeTruthy();
    expect(body.operation).toBe('identify_resident');
    expect(body.data.core_executed).toBe(true);
    expect(body.data.result.resident.name).toBe('Maria Silva');
  });

  it('1b. identify_unit válido = PASS', async () => {
    const url = `${ID_UNIT_URL}?unit=101`;
    const res = await identifyUnit.fetch(getSigned(url));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.core_executed).toBe(true);
    expect(body.data.result.normalized).toBeTruthy();
  });

  it('2. get_boleto válido = PASS', async () => {
    const url = `${BOLETOS_URL}?unit=101`;
    const res = await boletos.fetch(getSigned(url));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.core_executed).toBe(true);
    expect(body.data.result.boletos[0].id).toBe('bol-001');
  });

  it('3. tenant errado = DENY', async () => {
    const url = `${ID_RES_URL}?phone=11999990001`;
    const res = await identifyResident.fetch(
      getSigned(url, { organizationId: FIXTURE_ORG_A, condominiumId: FIXTURE_CONDO_B })
    );
    expect([400, 401, 403]).toContain(res.status);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(['TENANT_MISMATCH', 'TENANT_INVALID', 'UNAUTHENTICATED', 'FORBIDDEN']).toContain(
      body.error.code
    );
  });

  it('4. AuthZ inválido = DENY', async () => {
    const noPerm = createMemoryCredentialStore([
      {
        ...FIXTURE_CLIENT,
        client_id: 'no-perm',
        permission_keys: []
      }
    ]);
    const handler = createIdentifyResidentHandler({ ...baseDeps, credentials: noPerm });
    const url = `${ID_RES_URL}?phone=11999990001`;
    const headers = authHeaders({
      method: 'GET',
      url,
      clientId: 'no-perm'
    });
    const res = await handler.fetch(new Request(url, { method: 'GET', headers }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(['OPERATION_NOT_ALLOWED', 'FORBIDDEN']).toContain(body.error.code);
  });

  it('5. HMAC inválido = DENY', async () => {
    const url = `${ID_RES_URL}?phone=11999990001`;
    const headers = authHeaders({ method: 'GET', url, signature: '00' });
    const res = await identifyResident.fetch(new Request(url, { method: 'GET', headers }));
    expect(res.status).toBe(401);
  });
});

describe('G5 WRITE operations (memory idempotency TEST_ONLY)', () => {
  it('6. create_package válido = PASS', async () => {
    const res = await packages.fetch(
      postSigned(
        PACKAGES_URL,
        { recipient: 'Maria Silva', unit: '101', type: 'Caixa' },
        { idempotencyKey: `pkg-${Date.now()}` }
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.core_executed).toBe(true);
    expect(body.data.result.id).toBeTruthy();
    expect(catalog.packages.length).toBeGreaterThan(0);
  });

  it('7. create_occurrence válido = PASS', async () => {
    const res = await occurrences.fetch(
      postSigned(
        OCC_URL,
        { description: 'Barulho no hall', unit: '101', resident_name: 'Maria Silva' },
        { idempotencyKey: `occ-${Date.now()}` }
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.core_executed).toBe(true);
    expect(body.data.result.id).toBeTruthy();
  });

  it('8. update_occurrence válido = PASS', async () => {
    const created = await occurrences.fetch(
      postSigned(
        OCC_URL,
        { description: 'Vazamento', unit: '101' },
        { idempotencyKey: `occ-u-${Date.now()}` }
      )
    );
    const createdBody = await created.json();
    const occ = createdBody.data.result.occurrence as Occurrence;
    const res = await updateOccurrence.fetch(
      patchSigned(
        OCC_UPD_URL,
        { occurrence: { ...occ, status: 'Em Andamento', description: 'Vazamento - em andamento' } },
        { idempotencyKey: `occ-upd-${Date.now()}` }
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.core_executed).toBe(true);
  });

  it('9. create_reservation válido = PASS', async () => {
    const res = await reservations.fetch(
      postSigned(
        RES_URL,
        {
          area_id: 'area-churrasqueira',
          resident_id: residentA.id,
          resident_name: residentA.name,
          unit: '101',
          date: '2026-09-01',
          start_time: '10:00',
          end_time: '12:00'
        },
        { idempotencyKey: `res-${Date.now()}` }
      )
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.core_executed).toBe(true);
    expect(body.data.result.id).toBeTruthy();
    // G7-C: server listReservationSlots — no RESERVATION_CONFLICT_CLIENT_ONLY
    expect(body.data.warnings || []).not.toEqual(
      expect.arrayContaining([expect.stringContaining('RESERVATION_CONFLICT_CLIENT')])
    );
  });
});

describe('G5 TENANT isolation', () => {
  it('10. tenant A não acessa B (credential bound to A)', async () => {
    const res = await identifyResident.fetch(
      getSigned(`${ID_RES_URL}?phone=11999990001`, {
        organizationId: FIXTURE_ORG_B,
        condominiumId: FIXTURE_CONDO_B
      })
    );
    expect([401, 403]).toContain(res.status);
  });

  it('11-12. body org/condo inconsistente = DENY', async () => {
    const res = await packages.fetch(
      postSigned(
        PACKAGES_URL,
        {
          recipient: 'X',
          unit: '101',
          organization_id: FIXTURE_ORG_B,
          condominium_id: FIXTURE_CONDO_B
        },
        { idempotencyKey: `tenant-bad-${Date.now()}` }
      )
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TENANT_MISMATCH');
    expect(body.error.details.core_executed).toBe(false);
  });
});

describe('G5 SENSITIVE blocked', () => {
  it('13. pickup sem confirmation = DENY', async () => {
    const res = await pickup.fetch(postSigned(PICKUP_URL, { resource_id: 'pkg-1' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('14. cancel sem confirmation = DENY', async () => {
    const res = await cancel.fetch(postSigned(CANCEL_URL, { resource_id: 'res-1' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('15. confirmation store unavailable = DENY', async () => {
    const res = await pickupProd.fetch(postSigned(PICKUP_URL, { resource_id: 'pkg-1' }));
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe('CONFIRMATION_STORE_UNAVAILABLE');
  });

  it('16. confirmation válida → Core executa pickup (G7-B)', async () => {
    const challenge = await pickup.fetch(postSigned(PICKUP_URL, { resource_id: 'pkg-block' }));
    const ch = await challenge.json();
    const res = await pickup.fetch(
      postSigned(PICKUP_URL, {
        resource_id: 'pkg-block',
        confirmation_id: ch.error.details.confirmation_id,
        confirmation_token: ch.error.details.confirmation_token
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.core_executed).toBe(true);
    expect(classifyOperation('pickup_package')).toBe('SENSITIVE');
  });
});

describe('G5 IDEMPOTENCY', () => {
  it('17. ausência de Idempotency-Key = IDEMPOTENCY_KEY_REQUIRED', async () => {
    const res = await packages.fetch(
      postSigned(PACKAGES_URL, { recipient: 'Maria', unit: '101' })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(body.error.details.core_executed).toBe(false);
  });

  it('18. store indisponível = não fingir sucesso', async () => {
    const prodPackages = createPackagesHandler({
      credentials,
      tenants,
      permissionResolver: resolver,
      persistence,
      windowSeconds: 300
      // no idempotencyStore → unavailable
    });
    const body = JSON.stringify({ recipient: 'Maria', unit: '101' });
    const key = `no-store-${Date.now()}`;
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders({ method: 'POST', url: PACKAGES_URL, body, idempotencyKey: key })
    };
    const res = await prodPackages.fetch(
      new Request(PACKAGES_URL, { method: 'POST', headers, body })
    );
    expect(res.status).toBe(501);
    const json = await res.json();
    expect(json.error.code).toBe('IDEMPOTENCY_STORE_UNAVAILABLE');
    expect(json.error.details.core_executed).toBe(false);
  });
});

describe('G5 CORE wiring / security', () => {
  it('19-20. API chama Core (executeCoreOperation) sem duplicar regra', async () => {
    const authz: AuthorizedContext = {
      operation: 'identify_unit',
      client_id: FIXTURE_CLIENT.client_id,
      organization_id: FIXTURE_ORG_A,
      condominium_id: FIXTURE_CONDO_A,
      permission: 'residents.view',
      role_name: null,
      permission_keys: FIXTURE_CLIENT.permission_keys || [],
      core_operation_context: {
        channel: 'system',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        actorRole: 'integration',
        actorDisplayName: 'test'
      }
    };
    const result = await executeCoreOperation({
      operation: 'identify_unit',
      authz,
      body: { unit: '202' },
      idempotencyKey: null,
      rawBodyForFingerprint: '',
      deps: { persistence, residentsProvider: baseDeps.residentsProvider }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.core_executed).toBe(true);
      expect(result.operation).toBe('identify_unit');
    }
  });

  it('22-23. nenhum bypass SINDICO/PORTEIRO', async () => {
    const sindico = createMemoryCredentialStore([
      {
        ...FIXTURE_CLIENT,
        client_id: 'sindico-x',
        permission_keys: undefined,
        role_name: 'sindico'
      }
    ]);
    const handler = createPackagesHandler({ ...baseDeps, credentials: sindico });
    const body = JSON.stringify({ recipient: 'X', unit: '1' });
    const ts = String(Math.floor(Date.now() / 1000));
    const key = 'bypass-1';
    const sig = signRequest({
      method: 'POST',
      url: PACKAGES_URL,
      body,
      timestamp: ts,
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      idempotencyKey: key
    });
    const res = await handler.fetch(
      new Request(PACKAGES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sentinela-Client-Id': 'sindico-x',
          'X-Sentinela-Timestamp': ts,
          'X-Sentinela-Signature': sig,
          'X-Organization-Id': FIXTURE_ORG_A,
          'X-Condominium-Id': FIXTURE_CONDO_A,
          'Idempotency-Key': key
        },
        body
      })
    );
    expect(res.status).toBe(403);
  });

  it('24-26. gates sem fallback global / sem secret no envelope', async () => {
    const res = await identifyUnit.fetch(getSigned(`${ID_UNIT_URL}?unit=1`));
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(FIXTURE_CLIENT.secret);
    expect(body.data?.secret).toBeUndefined();
  });
});
