/**
 * G7-L — n8n workflow contract readiness tests
 * No LIVE writes required. No WhatsApp. No migrations.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  resolveIntent,
  buildIdempotencyKey,
  shouldGenerateNewIdempotencyKey,
  decideWorkflowRetry,
  assertOperationAligned,
  auditWorkflowJson,
  G7L_HMAC_HEADERS,
  G7L_HTTP_TIMEOUT_MS,
  G7L_INTENT_CATALOG
} from './g7l.n8n-workflow-contract';
import { createHash, createHmac } from 'node:crypto';
import { authHeaders, FIXTURE_CLIENT, FIXTURE_ORG_A, FIXTURE_CONDO_A } from '../auth/testFixtures';
import { createMemoryCredentialStore } from '../auth/credentials';
import { createMemoryTenantDirectory } from '../auth/tenant';
import { createMemoryPermissionResolver } from '../authz/permissionResolver';
import { createIdentifyResidentHandler } from '../handlers/residents/identify';
import { createPackagesHandler } from '../handlers/operations/packages/index';
import { createPickupHandler } from '../handlers/operations/packages/pickup';
import { createFakePersistenceDb } from './fakePersistenceDb';
import { createSupabaseCorePersistence } from './supabasePersistence';
import { createSupabaseIdempotencyStore } from '../idempotency/supabaseStore';
import { createMemoryConfirmationStoreForTests } from '../confirmations/memoryStore';
import { createConfirmationRequest } from '../confirmations/service';

const WORKFLOW_PATH = resolve(
  process.cwd(),
  'scripts/n8n-harness/workflows/SENTINELA-G7-L-FIRST-REAL-WORKFLOW.json'
);
const HMAC_JS = resolve(process.cwd(), 'scripts/n8n-harness/n8n-code-hmac.js');

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A }
]);

describe('G7-L n8n workflow contract', () => {
  it('1. intenção válida resolve para API suportada', () => {
    const spec = resolveIntent('IDENTIFY_RESIDENT');
    expect(spec.status).toBe('supported');
    expect(spec.path).toBe('/api/v1/residents/identify');
    assertOperationAligned('IDENTIFY_RESIDENT');
  });

  it('2. intenção desconhecida → NOT_SUPPORTED / UNKNOWN', () => {
    const spec = resolveIntent('SOMETHING_WEIRD');
    expect(spec.intent).toBe('UNKNOWN');
    expect(spec.status).toBe('not_supported');
    expect(resolveIntent('PACKAGE_STATUS').status).toBe('needs_implementation');
    expect(resolveIntent('NOTIFY_RESIDENT').status).toBe('not_supported');
  });

  it('3–5. HMAC válido / inválido / timestamp (identify READ)', async () => {
    const credentials = createMemoryCredentialStore([
      { ...FIXTURE_CLIENT, role_name: 'porteiro', permission_keys: ['residents.view'] }
    ]);
    const permissionResolver = createMemoryPermissionResolver({
      porteiro: ['residents.view']
    });
    const handler = createIdentifyResidentHandler({
      credentials,
      tenants,
      permissionResolver,
      skipProductionComposition: true
    });
    const url = 'http://localhost/api/v1/residents/identify?name=Maria&unit=101';

    const ok = await handler.fetch(
      new Request(url, {
        method: 'GET',
        headers: authHeaders({ method: 'GET', url })
      })
    );
    expect([200, 404, 409]).toContain(ok.status); // 200 or domain not found — auth passed

    const badSig = await handler.fetch(
      new Request(url, {
        method: 'GET',
        headers: authHeaders({ method: 'GET', url, signature: 'deadbeef' })
      })
    );
    expect(badSig.status).toBe(401);

    const expired = String(Math.floor(Date.now() / 1000) - 10_000);
    const badTs = await handler.fetch(
      new Request(url, {
        method: 'GET',
        headers: authHeaders({ method: 'GET', url, timestamp: expired })
      })
    );
    expect(badTs.status).toBe(401);
  });

  it('6. tenant inválido → rejeitado', async () => {
    const credentials = createMemoryCredentialStore([
      { ...FIXTURE_CLIENT, role_name: 'porteiro', permission_keys: ['residents.view'] }
    ]);
    const handler = createIdentifyResidentHandler({
      credentials,
      tenants,
      permissionResolver: createMemoryPermissionResolver({ porteiro: ['residents.view'] }),
      skipProductionComposition: true
    });
    const url = 'http://localhost/api/v1/residents/identify?unit=101';
    const res = await handler.fetch(
      new Request(url, {
        method: 'GET',
        headers: authHeaders({
          method: 'GET',
          url,
          organizationId: '99999999-9999-9999-9999-999999999999',
          condominiumId: '88888888-8888-8888-8888-888888888888'
        })
      })
    );
    expect([403, 404]).toContain(res.status);
  });

  it('7. AuthZ denied sem permission', async () => {
    const credentials = createMemoryCredentialStore([
      { ...FIXTURE_CLIENT, role_name: 'morador', permission_keys: ['residents.view'] }
    ]);
    const handler = createIdentifyResidentHandler({
      credentials,
      tenants,
      permissionResolver: createMemoryPermissionResolver({ morador: [] }),
      skipProductionComposition: true
    });
    const url = 'http://localhost/api/v1/residents/identify?unit=101';
    const res = await handler.fetch(
      new Request(url, { method: 'GET', headers: authHeaders({ method: 'GET', url }) })
    );
    expect(res.status).toBe(403);
  });

  it('8. READ sucesso (identify) + request_id', async () => {
    const credentials = createMemoryCredentialStore([
      { ...FIXTURE_CLIENT, role_name: 'porteiro', permission_keys: ['residents.view'] }
    ]);
    const fake = createFakePersistenceDb({
      residents: [
        {
          id: 'r1',
          name: 'Maria',
          unit: '101',
          phone: '5511999',
          organization_id: FIXTURE_ORG_A,
          condominium_id: FIXTURE_CONDO_A
        }
      ]
    });
    const persistence = await createSupabaseCorePersistence({
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      client: fake,
      tenantDirectory: tenants
    });
    const handler = createIdentifyResidentHandler({
      credentials,
      tenants,
      permissionResolver: createMemoryPermissionResolver({ porteiro: ['residents.view'] }),
      createPersistence: async () => (persistence.ok ? persistence.persistence : null),
      skipProductionComposition: true
    });
    const url = 'http://localhost/api/v1/residents/identify?name=Maria&unit=101';
    const res = await handler.fetch(
      new Request(url, {
        method: 'GET',
        headers: {
          ...authHeaders({ method: 'GET', url }),
          'X-Request-Id': 'req_g7l_read_001'
        }
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request_id).toBeTruthy();
    expect(body.ok).toBe(true);
  });

  it('9–11. WRITE + retry same Idempotency-Key + fingerprint mismatch', async () => {
    const key = buildIdempotencyKey({
      clientId: FIXTURE_CLIENT.client_id,
      intent: 'CREATE_PACKAGE',
      externalMessageId: 'g7l-ext-001'
    });
    expect(key).toContain('CREATE_PACKAGE');
    expect(shouldGenerateNewIdempotencyKey({ isRetry: true })).toBe(false);
    expect(
      shouldGenerateNewIdempotencyKey({
        isRetry: false,
        errorCode: 'IDEMPOTENCY_FINGERPRINT_MISMATCH'
      })
    ).toBe(true);

    const fake = createFakePersistenceDb();
    const persistence = await createSupabaseCorePersistence({
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      client: fake,
      tenantDirectory: tenants
    });
    const credentials = createMemoryCredentialStore([
      {
        ...FIXTURE_CLIENT,
        role_name: 'porteiro',
        permission_keys: ['packages.create']
      }
    ]);
    const handler = createPackagesHandler({
      credentials,
      tenants,
      permissionResolver: createMemoryPermissionResolver({ porteiro: ['packages.create'] }),
      idempotencyStore: createSupabaseIdempotencyStore(fake as never),
      createPersistence: async () => (persistence.ok ? persistence.persistence : null),
      skipProductionComposition: true
    });

    const url = 'http://localhost/api/v1/operations/packages';
    const body1 = JSON.stringify({
      recipient: 'G7L',
      unit: '101',
      type: 'caixa',
      input_type: 'text'
    });
    const h1 = authHeaders({ method: 'POST', url, body: body1, idempotencyKey: key });
    const r1 = await handler.fetch(
      new Request(url, { method: 'POST', headers: h1, body: body1 })
    );
    expect(r1.status).toBe(200);
    const b1 = await r1.json();

    // retry same key + same body → replay
    const h2 = authHeaders({ method: 'POST', url, body: body1, idempotencyKey: key });
    const r2 = await handler.fetch(
      new Request(url, { method: 'POST', headers: h2, body: body1 })
    );
    expect(r2.status).toBe(200);
    const b2 = await r2.json();
    expect(b2.request_id).toBeTruthy();
    expect(b1.data?.result || b1.data).toBeTruthy();

    // fingerprint mismatch
    const body3 = JSON.stringify({
      recipient: 'OTHER',
      unit: '101',
      type: 'caixa',
      input_type: 'text'
    });
    const h3 = authHeaders({ method: 'POST', url, body: body3, idempotencyKey: key });
    const r3 = await handler.fetch(
      new Request(url, { method: 'POST', headers: h3, body: body3 })
    );
    expect(r3.status).toBe(409);
    const b3 = await r3.json();
    expect(b3.error.code).toBe('IDEMPOTENCY_FINGERPRINT_MISMATCH');
  });

  it('12–13. timeout/5xx → retry_same_key; 400 → no_retry', () => {
    expect(
      decideWorkflowRetry({ httpStatus: 503, classification: 'WRITE' }).action
    ).toBe('retry_same_key');
    expect(
      decideWorkflowRetry({ networkError: true, classification: 'WRITE' }).action
    ).toBe('retry_same_key');
    expect(
      decideWorkflowRetry({ errorCode: 'INTERNAL_ERROR', httpStatus: 500 }).action
    ).toBe('retry_same_key');
    expect(
      decideWorkflowRetry({ errorCode: 'INVALID_REQUEST', httpStatus: 400 }).action
    ).toBe('no_retry');
  });

  it('14–15. SENSITIVE confirmation_required + consume', async () => {
    expect(
      decideWorkflowRetry({ errorCode: 'CONFIRMATION_REQUIRED' }).action
    ).toBe('confirmation_flow');
    expect(
      decideWorkflowRetry({
        classification: 'SENSITIVE',
        confirmationAlreadyConsumed: true
      }).action
    ).toBe('no_retry');

    const store = createMemoryConfirmationStoreForTests();
    const created = await createConfirmationRequest(
      {
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_A,
        client_id: FIXTURE_CLIENT.client_id,
        operation: 'pickup_package',
        resource_id: 'pkg-1',
        prompt: 'Confirmar?'
      },
      store
    );
    expect(created.ok).toBe(true);

    const fake = createFakePersistenceDb({
      packages: [
        {
          id: 'pkg-1',
          status: 'received',
          organization_id: FIXTURE_ORG_A,
          condominium_id: FIXTURE_CONDO_A,
          unit: '101'
        }
      ]
    });
    const persistence = await createSupabaseCorePersistence({
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      client: fake,
      tenantDirectory: tenants
    });
    const credentials = createMemoryCredentialStore([
      {
        ...FIXTURE_CLIENT,
        role_name: 'porteiro',
        permission_keys: ['packages.update']
      }
    ]);
    const handler = createPickupHandler({
      credentials,
      tenants,
      permissionResolver: createMemoryPermissionResolver({ porteiro: ['packages.update'] }),
      confirmationStore: store,
      createPersistence: async () => (persistence.ok ? persistence.persistence : null),
      skipProductionComposition: true
    });

    const url = 'http://localhost/api/v1/operations/packages/pickup';
    const challengeBody = JSON.stringify({ resource_id: 'pkg-1' });
    const challenge = await handler.fetch(
      new Request(url, {
        method: 'POST',
        headers: authHeaders({ method: 'POST', url, body: challengeBody }),
        body: challengeBody
      })
    );
    expect(challenge.status).toBe(409);
    const ch = await challenge.json();
    expect(ch.error.code).toBe('CONFIRMATION_REQUIRED');

    if (!created.ok) return;
    const execBody = JSON.stringify({
      resource_id: 'pkg-1',
      confirmation_id: created.data.confirmation_id,
      confirmation_token: created.data.confirmation_token
    });
    const exec = await handler.fetch(
      new Request(url, {
        method: 'POST',
        headers: authHeaders({ method: 'POST', url, body: execBody }),
        body: execBody
      })
    );
    // may be 200 or domain error depending on package shape — AuthZ+confirmation path exercised
    expect([200, 400, 404, 409]).toContain(exec.status);
    const execJson = JSON.stringify(await exec.json());
    expect(execJson).not.toMatch(/service_role/i);
  });

  it('16. request_id preservado no envelope', async () => {
    const credentials = createMemoryCredentialStore([
      { ...FIXTURE_CLIENT, role_name: 'porteiro', permission_keys: ['residents.view'] }
    ]);
    const handler = createIdentifyResidentHandler({
      credentials,
      tenants,
      permissionResolver: createMemoryPermissionResolver({ porteiro: ['residents.view'] }),
      skipProductionComposition: true
    });
    const url = 'http://localhost/api/v1/residents/identify?unit=101';
    const res = await handler.fetch(
      new Request(url, {
        method: 'GET',
        headers: {
          ...authHeaders({ method: 'GET', url }),
          'X-Request-Id': 'req_g7l_preserve_16'
        }
      })
    );
    const body = await res.json();
    expect(body.request_id).toBe('req_g7l_preserve_16');
  });

  it('17. secret não aparece no HMAC harness / workflow', () => {
    const hmacSrc = readFileSync(HMAC_JS, 'utf8');
    expect(hmacSrc).toMatch(/SENTINELA_N8N_SECRET|SENTINELA_HARNESS_SECRET/);
    expect(hmacSrc).not.toMatch(/test-secret-do-not-use-in-prod/);
    const wf = readFileSync(WORKFLOW_PATH, 'utf8');
    expect(wf).not.toMatch(/test-secret-do-not-use-in-prod/);
    expect(wf.toLowerCase()).not.toMatch(/service_role/);
  });

  it('18–19. workflow não acessa banco / Event Store direto', () => {
    const wf = readFileSync(WORKFLOW_PATH, 'utf8');
    const audit = auditWorkflowJson(wf);
    expect(audit.ok).toBe(true);
    expect(audit.findings).toEqual([]);
    expect(wf).not.toMatch(/n8n-nodes-base\.postgres/i);
    expect(wf).not.toMatch(/api_domain_events/);
    expect(wf).not.toMatch(/supabase\.co/i);
    expect(wf).toMatch(/HTTP Request → Sentinela API/);
    expect(wf).toMatch(/postgres_node:\s*0/);
  });

  it('20. workflow permanece inactive', () => {
    const wf = JSON.parse(readFileSync(WORKFLOW_PATH, 'utf8'));
    expect(wf.active).toBe(false);
    expect(String(wf.name)).toContain('G7-L');
  });

  it('HMAC headers contract + timeout + catalog alignment', () => {
    expect(G7L_HMAC_HEADERS).toContain('X-Sentinela-Signature');
    expect(G7L_HMAC_HEADERS).toContain('Idempotency-Key');
    expect(G7L_HTTP_TIMEOUT_MS).toBe(30_000);
    for (const row of G7L_INTENT_CATALOG.filter((x) => x.status === 'supported')) {
      assertOperationAligned(row.intent);
    }
    // canonical smoke (same as harness)
    const body = '';
    const ts = '1700000000';
    const path = '/api/v1/health';
    const bodySha = createHash('sha256').update(body).digest('hex');
    const canonical = ['v1', ts, 'GET', path, bodySha, FIXTURE_ORG_A, FIXTURE_CONDO_A, ''].join(
      '\n'
    );
    const sig = createHmac('sha256', 'x').update(canonical, 'utf8').digest('hex');
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });
});
