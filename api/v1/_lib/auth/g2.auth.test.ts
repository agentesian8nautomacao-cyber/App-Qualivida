/**
 * SENTINELA API v1 — G2 authn + tenant fail-closed tests
 * No INSERT/UPDATE/DELETE. In-memory tenant catalog only.
 */

import { describe, expect, it } from 'vitest';
import { createMemoryCredentialStore } from './credentials';
import { createMemoryTenantDirectory } from './tenant';
import { createProtectedProbeHandler } from '../../protected-probe';
import { createPackagesHandler } from '../../operations/packages/index';
import health from '../../health';
import {
  FIXTURE_CLIENT,
  FIXTURE_CONDO_A,
  FIXTURE_CONDO_B,
  FIXTURE_ORG_A,
  FIXTURE_ORG_B,
  authHeaders
} from './testFixtures';

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

const credentials = createMemoryCredentialStore([FIXTURE_CLIENT]);

const deps = { credentials, tenants, windowSeconds: 300 };

const probe = createProtectedProbeHandler(deps);
const packages = createPackagesHandler(deps);

const PROBE_URL = 'http://localhost/api/v1/protected-probe';
const PACKAGES_URL = 'http://localhost/api/v1/operations/packages';

async function probeGet(headers: Record<string, string>) {
  return probe.fetch(new Request(PROBE_URL, { method: 'GET', headers }));
}

describe('G2 protected-probe authn/tenant', () => {
  it('1. missing client_id → BLOCK UNAUTHENTICATED', async () => {
    const headers = authHeaders({ method: 'GET', url: PROBE_URL, omit: ['client'] });
    const res = await probeGet(headers);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('2. invalid client_id → BLOCK UNAUTHENTICATED', async () => {
    const headers = authHeaders({
      method: 'GET',
      url: PROBE_URL,
      clientId: 'unknown-client'
    });
    // signature still computed with fixture secret but client unknown
    const res = await probeGet(headers);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('3. missing signature → BLOCK INVALID_SIGNATURE', async () => {
    const headers = authHeaders({ method: 'GET', url: PROBE_URL, omit: ['signature'] });
    const res = await probeGet(headers);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('4. invalid signature → BLOCK INVALID_SIGNATURE', async () => {
    const headers = authHeaders({
      method: 'GET',
      url: PROBE_URL,
      signature: 'deadbeef'
    });
    const res = await probeGet(headers);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_SIGNATURE');
  });

  it('5. missing timestamp → BLOCK', async () => {
    const headers = authHeaders({ method: 'GET', url: PROBE_URL, omit: ['timestamp'] });
    const res = await probeGet(headers);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_REQUEST');
  });

  it('6. expired timestamp → BLOCK TIMESTAMP_EXPIRED', async () => {
    const expired = String(Math.floor(Date.now() / 1000) - 10_000);
    const headers = authHeaders({ method: 'GET', url: PROBE_URL, timestamp: expired });
    const res = await probeGet(headers);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TIMESTAMP_EXPIRED');
  });

  it('7. future timestamp outside window → BLOCK TIMESTAMP_EXPIRED', async () => {
    const future = String(Math.floor(Date.now() / 1000) + 10_000);
    const headers = authHeaders({ method: 'GET', url: PROBE_URL, timestamp: future });
    const res = await probeGet(headers);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('TIMESTAMP_EXPIRED');
  });

  it('8. tenant absent → BLOCK TENANT_REQUIRED', async () => {
    const headers = authHeaders({
      method: 'GET',
      url: PROBE_URL,
      omit: ['organization', 'condominium']
    });
    const res = await probeGet(headers);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('TENANT_REQUIRED');
  });

  it('9. organization inexistente → BLOCK TENANT_NOT_FOUND', async () => {
    const fakeOrg = '99999999-9999-9999-9999-999999999999';
    // Need credential scoped to fake org for signature path to reach directory check —
    // credential scope mismatch happens first if we keep FIXTURE_CLIENT.
    // Use a temp cred bound to fake org + real condo A (condo won't match org in directory).
    const creds = createMemoryCredentialStore([
      {
        ...FIXTURE_CLIENT,
        organization_id: fakeOrg,
        condominium_id: FIXTURE_CONDO_A
      }
    ]);
    const localProbe = createProtectedProbeHandler({
      credentials: creds,
      tenants,
      windowSeconds: 300
    });
    const url = PROBE_URL;
    const headers = authHeaders({
      method: 'GET',
      url,
      organizationId: fakeOrg,
      condominiumId: FIXTURE_CONDO_A,
      secret: FIXTURE_CLIENT.secret
    });
    const res = await localProbe.fetch(new Request(url, { method: 'GET', headers }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('TENANT_NOT_FOUND');
  });

  it('10. condominium inexistente → BLOCK TENANT_NOT_FOUND', async () => {
    const fakeCondo = '88888888-8888-8888-8888-888888888888';
    const creds = createMemoryCredentialStore([
      {
        ...FIXTURE_CLIENT,
        organization_id: FIXTURE_ORG_A,
        condominium_id: fakeCondo
      }
    ]);
    const localProbe = createProtectedProbeHandler({
      credentials: creds,
      tenants,
      windowSeconds: 300
    });
    const headers = authHeaders({
      method: 'GET',
      url: PROBE_URL,
      organizationId: FIXTURE_ORG_A,
      condominiumId: fakeCondo
    });
    const res = await localProbe.fetch(new Request(PROBE_URL, { method: 'GET', headers }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('TENANT_NOT_FOUND');
  });

  it('11. condominium de outra organization → BLOCK TENANT_MISMATCH', async () => {
    // Org A + Condo B (B belongs to Org B)
    const creds = createMemoryCredentialStore([
      {
        ...FIXTURE_CLIENT,
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_B
      }
    ]);
    const localProbe = createProtectedProbeHandler({
      credentials: creds,
      tenants,
      windowSeconds: 300
    });
    const headers = authHeaders({
      method: 'GET',
      url: PROBE_URL,
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_B
    });
    const res = await localProbe.fetch(new Request(PROBE_URL, { method: 'GET', headers }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TENANT_MISMATCH');
  });

  it('12. tenant válido + HMAC válido → PASS', async () => {
    const headers = authHeaders({ method: 'GET', url: PROBE_URL });
    const res = await probeGet(headers);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.authenticated).toBe(true);
    expect(body.data.client_id).toBe(FIXTURE_CLIENT.client_id);
    expect(body.data.organization_id).toBe(FIXTURE_ORG_A);
    expect(body.data.condominium_id).toBe(FIXTURE_CONDO_A);
    expect(body.data.secret).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(FIXTURE_CLIENT.secret);
  });

  it('13. health continua sem autenticação', async () => {
    const res = await health.fetch(new Request('http://localhost/api/v1/health', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.gates.g2_authn_hmac).toBe(true);
  });

  it('14. endpoint de negócio autenticado exige Idempotency-Key (G5 WRITE)', async () => {
    const bodyStr = JSON.stringify({ recipient: 'Paulo', unit: '101' });
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders({ method: 'POST', url: PACKAGES_URL, body: bodyStr })
    };
    const res = await packages.fetch(
      new Request(PACKAGES_URL, { method: 'POST', headers, body: bodyStr })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(body.operation).toBe('create_package');
    expect(body.error.details.core_executed).toBe(false);
  });

  it('14b. endpoint de negócio sem auth → BLOCK (não libera)', async () => {
    const res = await packages.fetch(
      new Request(PACKAGES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHENTICATED');
  });

  it('16. credential de tenant A não opera tenant B (TENANT_MISMATCH)', async () => {
    const headers = authHeaders({
      method: 'GET',
      url: PROBE_URL,
      organizationId: FIXTURE_ORG_B,
      condominiumId: FIXTURE_CONDO_B
    });
    // signature uses org B but credential is scoped to A → mismatch before/at scope check
    const res = await probeGet(headers);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TENANT_MISMATCH');
  });
});

describe('G2 security invariants', () => {
  it('does not set Access-Control-Allow-Origin * on protected success', async () => {
    const headers = authHeaders({ method: 'GET', url: PROBE_URL });
    const res = await probeGet(headers);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('TENANT A + CONDOMINIUM B → REJECT', async () => {
    const creds = createMemoryCredentialStore([
      {
        client_id: FIXTURE_CLIENT.client_id,
        secret: FIXTURE_CLIENT.secret,
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_B
      }
    ]);
    const local = createProtectedProbeHandler({ credentials: creds, tenants, windowSeconds: 300 });
    const headers = authHeaders({
      method: 'GET',
      url: PROBE_URL,
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_B
    });
    const res = await local.fetch(new Request(PROBE_URL, { method: 'GET', headers }));
    expect([403, 404]).toContain(res.status);
    const body = await res.json();
    expect(['TENANT_MISMATCH', 'TENANT_NOT_FOUND']).toContain(body.error.code);
  });
});
