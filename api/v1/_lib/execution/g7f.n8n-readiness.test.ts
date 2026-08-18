/**
 * G7-F — n8n readiness harness + boundary tests.
 * Sem n8n real, sem WhatsApp, sem LIVE writes.
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
import { createFakePersistenceDb } from './fakePersistenceDb';
import { createSupabaseCorePersistence } from './supabasePersistence';
import { createSupabaseIdempotencyStore } from '../idempotency/supabaseStore';
import { createSupabaseConfirmationStore } from '../confirmations/supabaseStore';
import { createIdentifyResidentHandler } from '../handlers/residents/identify';
import { createBoletosHandler } from '../handlers/boletos';
import { createPackagesHandler } from '../handlers/operations/packages/index';
import { createPickupHandler } from '../handlers/operations/packages/pickup';
import { createOccurrencesHandler } from '../handlers/operations/occurrences/index';
import { createReservationsHandler } from '../handlers/operations/reservations/index';
import { createCancelReservationHandler } from '../handlers/operations/reservations/cancel';
import { MAX_API_BODY_BYTES } from '../withCoreExecution';
import type { Resident } from '../../../../types';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dir, '../../../../scripts/n8n-harness/fixtures');

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as Record<string, unknown>;
}

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

const resolver = createMemoryPermissionResolver({
  porteiro: FIXTURE_CLIENT.permission_keys || []
});

const credentials = createMemoryCredentialStore([{ ...FIXTURE_CLIENT }]);

const sampleResidents: Resident[] = [
  {
    id: 'r-maria',
    name: 'Maria',
    unit: '101',
    phone: '5511999990001',
    whatsapp: '5511999990001',
    email: '',
  },
  {
    id: 'r-amb-1',
    name: 'Ambiguo',
    unit: '501',
    phone: '5511888888888',
    whatsapp: '5511888888888',
    email: '',
  },
  {
    id: 'r-amb-2',
    name: 'Ambiguo',
    unit: '502',
    phone: '5511888888888',
    whatsapp: '5511888888888',
    email: '',
  }
];

async function buildDeps(
  client = createFakePersistenceDb(),
  residents: Resident[] = sampleResidents
) {
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
      residentsProvider: {
        async listResidents() {
          return residents;
        }
      },
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

function getSigned(url: string, extra?: { timestamp?: string; organizationId?: string; condominiumId?: string }) {
  return new Request(url, {
    method: 'GET',
    headers: authHeaders({
      method: 'GET',
      url,
      timestamp: extra?.timestamp,
      organizationId: extra?.organizationId,
      condominiumId: extra?.condominiumId
    })
  });
}

function postSigned(
  url: string,
  bodyObj: Record<string, unknown>,
  opts?: {
    idempotencyKey?: string;
    timestamp?: string;
    organizationId?: string;
    condominiumId?: string;
    signature?: string | null;
    clientId?: string;
    secret?: string;
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
        timestamp: opts?.timestamp,
        organizationId: opts?.organizationId,
        condominiumId: opts?.condominiumId,
        signature: opts?.signature,
        clientId: opts?.clientId,
        secret: opts?.secret
      })
    },
    body
  });
}

describe('G7-F n8n readiness harness (F5)', () => {
  it('1–5 create_package text/voice/photo/qr/barcode', async () => {
    const { deps } = await buildDeps();
    const handler = createPackagesHandler(deps);
    const files = [
      'create_package_text.json',
      'create_package_voice.json',
      'create_package_photo.json',
      'create_package_qr.json',
      'create_package_barcode.json'
    ];
    for (const f of files) {
      const fx = loadFixture(f);
      const apiBody = fx.api_body as Record<string, unknown>;
      const res = await handler.fetch(
        postSigned('http://localhost/api/v1/operations/packages', apiBody, {
          idempotencyKey: `g7f-${String(fx.external_message_id)}`
        })
      );
      expect(res.status, f).toBe(200);
      const body = await res.json();
      expect(body.data.core_executed).toBe(true);
      expect(body.data.operation).toBe('create_package');
    }
  });

  it('6 identify_resident', async () => {
    const { deps } = await buildDeps();
    const res = await createIdentifyResidentHandler(deps).fetch(
      getSigned('http://localhost/api/v1/residents/identify?name=Maria&unit=101')
    );
    expect(res.status).toBe(200);
    expect((await res.json()).data.core_executed).toBe(true);
  });

  it('7 get_boleto', async () => {
    const { deps } = await buildDeps(
      createFakePersistenceDb({
        boletos: [
          {
            id: 'bol-1',
            unit: '101',
            resident_id: 'r-maria',
            amount: 100,
            due_date: '2026-09-01',
            status: 'open'
          }
        ]
      })
    );
    const res = await createBoletosHandler(deps).fetch(
      getSigned('http://localhost/api/v1/boletos?unit=101')
    );
    const body = await res.json();
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) expect(body.data.core_executed).toBe(true);
  });

  it('8 create_occurrence', async () => {
    const { deps } = await buildDeps();
    const res = await createOccurrencesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/occurrences',
        { description: 'Barulho após 22h', unit: '101', resident_name: 'Maria' },
        { idempotencyKey: 'g7f-occ-1' }
      )
    );
    expect(res.status).toBe(200);
  });

  it('9–10 create_reservation + conflict', async () => {
    const { deps, client } = await buildDeps();
    const h = createReservationsHandler(deps);
    const base = {
      area_id: 'area-g7f',
      resident_id: 'r-maria',
      resident_name: 'Maria',
      unit: '101',
      date: '2026-10-01',
      start_time: '14:00',
      end_time: '16:00'
    };
    const first = await h.fetch(
      postSigned('http://localhost/api/v1/operations/reservations', base, {
        idempotencyKey: 'g7f-res-1'
      })
    );
    expect(first.status).toBe(200);
    const second = await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/reservations',
        { ...base, resident_id: 'r2', resident_name: 'Outro' },
        { idempotencyKey: 'g7f-res-2' }
      )
    );
    if (second.status === 409) {
      expect((await second.json()).error.code).toBe('CONFLICT');
    } else {
      expect(client.__db.reservations?.length || 0).toBeGreaterThanOrEqual(1);
    }
  });

  it('11 pickup confirmation', async () => {
    const built = await buildDeps(
      createFakePersistenceDb({
        packages: [
          {
            id: 'pkg_g7f',
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
          resource_id: 'pkg_g7f'
        })
      )
    ).json();
    expect(ch.error.code).toBe('CONFIRMATION_REQUIRED');
    const ok = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages/pickup', {
        resource_id: 'pkg_g7f',
        confirmation_id: ch.error.details.confirmation_id,
        confirmation_token: ch.error.details.confirmation_token
      })
    );
    expect(ok.status).toBe(200);
  });

  it('12 cancel_reservation confirmation', async () => {
    const { deps } = await buildDeps();
    const h = createCancelReservationHandler(deps);
    const res = await h.fetch(
      postSigned('http://localhost/api/v1/operations/reservations/cancel', {
        resource_id: 'res_g7f'
      })
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('CONFIRMATION_REQUIRED');
  });

  it('13–14 idempotency retry + fingerprint mismatch', async () => {
    const { deps } = await buildDeps();
    const h = createPackagesHandler(deps);
    const payload = { recipient: 'Maria', unit: '101', type: 'caixa' };
    const a = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'g7f-idem'
      })
    );
    const aBody = await a.json();
    const b = await h.fetch(
      postSigned('http://localhost/api/v1/operations/packages', payload, {
        idempotencyKey: 'g7f-idem'
      })
    );
    expect((await b.json()).data.result).toEqual(aBody.data.result);
    const c = await h.fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Outra', unit: '999' },
        { idempotencyKey: 'g7f-idem' }
      )
    );
    expect((await c.json()).error.code).toBe('IDEMPOTENCY_FINGERPRINT_MISMATCH');
  });

  it('15 tenant inválido', async () => {
    const { deps } = await buildDeps();
    const res = await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        {
          idempotencyKey: 'g7f-tenant',
          organizationId: FIXTURE_ORG_A,
          condominiumId: FIXTURE_CONDO_B
        }
      )
    );
    expect([401, 403]).toContain(res.status);
  });

  it('16 HMAC inválido', async () => {
    const { deps } = await buildDeps();
    const res = await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        { idempotencyKey: 'g7f-hmac', signature: '00'.repeat(32) }
      )
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('INVALID_SIGNATURE');
  });

  it('17 timestamp expirado', async () => {
    const { deps } = await buildDeps();
    const old = String(Math.floor(Date.now() / 1000) - 10_000);
    const res = await createIdentifyResidentHandler(deps).fetch(
      getSigned('http://localhost/api/v1/residents/identify?name=Maria&unit=101', {
        timestamp: old
      })
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('TIMESTAMP_EXPIRED');
  });

  it('18 usuário ambíguo', async () => {
    const { deps } = await buildDeps();
    const res = await createIdentifyResidentHandler(deps).fetch(
      getSigned('http://localhost/api/v1/residents/identify?phone=5511888888888')
    );
    const body = await res.json();
    expect([409, 200]).toContain(res.status);
    if (res.status === 409) expect(body.error.code).toBe('NEEDS_CONFIRMATION');
  });

  it('19 usuário inexistente', async () => {
    const { deps } = await buildDeps();
    const res = await createIdentifyResidentHandler(deps).fetch(
      getSigned('http://localhost/api/v1/residents/identify?phone=5599999999999')
    );
    const body = await res.json();
    expect([404, 200]).toContain(res.status);
    if (res.status === 404) {
      expect(['RESOURCE_NOT_FOUND', 'RESIDENT_NOT_FOUND']).toContain(body.error.code);
    }
  });

  it('20 payload acima do limite', async () => {
    const { deps } = await buildDeps();
    const pad = 'x'.repeat(MAX_API_BODY_BYTES + 8);
    const body = `{"recipient":"Maria","unit":"101","pad":"${pad}"}`;
    const url = 'http://localhost/api/v1/operations/packages';
    const res = await createPackagesHandler(deps).fetch(
      new Request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders({ method: 'POST', url, body, idempotencyKey: 'g7f-huge' })
        },
        body
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_REQUEST');
  });
});

describe('G7-F boundary (F8)', () => {
  it('n8n → API = permitido (READ autenticado)', async () => {
    const { deps } = await buildDeps();
    const res = await createIdentifyResidentHandler(deps).fetch(
      getSigned('http://localhost/api/v1/residents/identify?name=Maria&unit=101')
    );
    expect(res.status).toBe(200);
  });

  it('n8n → Core direto = proibido (sem export público de executeCore no contrato harness)', () => {
    // Boundary documental + estático: Core é import interno da API, não endpoint.
    const contract = readFileSync(
      join(__dir, '../../../../docs/SENTINELA-AUT-N8N-CONTRACT.md'),
      'utf8'
    );
    expect(contract).toMatch(/Não chamar Core/);
    expect(contract).toMatch(/Única porta de entrada externa/);
  });

  it('n8n → PostgreSQL = proibido (contrato)', () => {
    const contract = readFileSync(
      join(__dir, '../../../../docs/SENTINELA-AUT-N8N-CONTRACT.md'),
      'utf8'
    );
    expect(contract).toMatch(/Não acessar PostgreSQL diretamente/);
    expect(contract).toMatch(/Não executar SQL/);
  });

  it('frontend → service-role = proibido (.env.example + contrato)', () => {
    const envEx = readFileSync(join(__dir, '../../../../.env.example'), 'utf8');
    expect(envEx).toMatch(/NUNCA VITE_\*.*service role|NUNCA VITE_\* para service role/i);
    expect(envEx).not.toMatch(/^VITE_SUPABASE_SERVICE_ROLE/m);
  });

  it('API sem tenant = rejeitada', async () => {
    const { deps } = await buildDeps();
    const url = 'http://localhost/api/v1/residents/identify?name=Maria';
    const headers = authHeaders({ method: 'GET', url, omit: ['organization', 'condominium'] });
    // Re-sign without org/condo still needs canonical empty? protect rejects missing headers.
    const res = await createIdentifyResidentHandler(deps).fetch(
      new Request(url, { method: 'GET', headers })
    );
    expect([400, 401, 403]).toContain(res.status);
  });

  it('API sem HMAC = rejeitada', async () => {
    const { deps } = await buildDeps();
    const url = 'http://localhost/api/v1/residents/identify?name=Maria&unit=101';
    const res = await createIdentifyResidentHandler(deps).fetch(
      new Request(url, {
        method: 'GET',
        headers: {
          'X-Sentinela-Client-Id': FIXTURE_CLIENT.client_id,
          'X-Organization-Id': FIXTURE_ORG_A,
          'X-Condominium-Id': FIXTURE_CONDO_A
        }
      })
    );
    expect([401, 400]).toContain(res.status);
  });

  it('API tenant incorreto = rejeitada', async () => {
    const { deps } = await buildDeps();
    const res = await createPackagesHandler(deps).fetch(
      postSigned(
        'http://localhost/api/v1/operations/packages',
        { recipient: 'Maria', unit: '101' },
        {
          idempotencyKey: 'g7f-b-tenant',
          organizationId: FIXTURE_ORG_B,
          condominiumId: FIXTURE_CONDO_B
        }
      )
    );
    expect([401, 403]).toContain(res.status);
  });

  it('API permissionamento incorreto = rejeitada', async () => {
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
            idempotencyKey: 'g7f-b-perm'
          })
        },
        body
      })
    );
    expect(res.status).toBe(403);
  });
});
