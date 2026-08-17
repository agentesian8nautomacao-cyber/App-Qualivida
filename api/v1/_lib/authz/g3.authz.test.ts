/**
 * G3 AuthZ tests — profile + authorizeOperation (fail-closed, no role bypass)
 */

import { describe, expect, it } from 'vitest';
import { authorizeOperation } from './authorize';
import { createMemoryPermissionResolver } from './permissionResolver';
import { createMemoryCredentialStore } from '../auth/credentials';
import { createMemoryTenantDirectory } from '../auth/tenant';
import { createAuthzProbeHandler } from '../../authz-probe';
import { createPackagesHandler } from '../../operations/packages/index';
import {
  FIXTURE_CLIENT,
  FIXTURE_CONDO_A,
  FIXTURE_CONDO_B,
  FIXTURE_ORG_A,
  FIXTURE_ORG_B,
  authHeaders
} from '../auth/testFixtures';

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

const resolver = createMemoryPermissionResolver({
  porteiro: [
    'packages.create',
    'packages.update',
    'residents.view',
    'occurrences.create',
    'reservations.create',
    'boletos.view'
  ],
  // sindico role in memory has ONLY residents.view — proves no ALL bypass
  sindico: ['residents.view'],
  // porteiro-empty: role name present but no keys
  'porteiro-empty': []
});

const AUTHZ_URL = 'http://localhost/api/v1/authz-probe?operation=create_package';
const PACKAGES_URL = 'http://localhost/api/v1/operations/packages';

describe('G3 authorizeOperation (unit)', () => {
  it('1. client válido + tenant válido + profile autorizado = PASS', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: { ...FIXTURE_CLIENT }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ctx.permission).toBe('packages.create');
      expect(res.ctx.core_operation_context.organizationId).toBe(FIXTURE_ORG_A);
    }
  });

  it('2. profile sem permission = DENY', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: {
          ...FIXTURE_CLIENT,
          permission_keys: ['residents.view']
        }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('FORBIDDEN');
  });

  it('3. profile condo A acessando condo B = DENY', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_B,
        condominiumId: FIXTURE_CONDO_B,
        clientId: FIXTURE_CLIENT.client_id,
        credential: { ...FIXTURE_CLIENT } // scoped to A
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('TENANT_MISMATCH');
  });

  it('4. org A + condo B (credential forged to mismatched pair) = DENY at G2 layer in HTTP; unit scope mismatch', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_B,
        clientId: FIXTURE_CLIENT.client_id,
        credential: {
          ...FIXTURE_CLIENT,
          organization_id: FIXTURE_ORG_A,
          condominium_id: FIXTURE_CONDO_A
        }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('TENANT_MISMATCH');
  });

  it('4b. authorize denies when tenant headers missing', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: '',
        condominiumId: '',
        clientId: FIXTURE_CLIENT.client_id,
        credential: { ...FIXTURE_CLIENT }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('TENANT_REQUIRED');
  });

  it('5. client sem profile = DENY', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: {
          ...FIXTURE_CLIENT,
          permission_keys: undefined,
          role_name: undefined
        }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('FORBIDDEN');
      expect(res.details?.reason).toBe('profile_missing');
    }
  });

  it('5b. credential null = DENY', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: null
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.details?.reason).toBe('client_without_profile');
  });

  it('6. role sem permission = DENY', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: {
          ...FIXTURE_CLIENT,
          permission_keys: undefined,
          role_name: 'porteiro-empty'
        }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('FORBIDDEN');
  });

  it('7. permission inexistente no map notify = DENY (DECISION REQUIRED)', async () => {
    const res = await authorizeOperation(
      {
        operation: 'notify_resident',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: {
          ...FIXTURE_CLIENT,
          permission_keys: ['notices.create', 'packages.create']
        }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('FORBIDDEN');
      expect(res.details?.reason).toBe('decision_required');
    }
  });

  it('8. ausência de tenant = DENY', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: '',
        clientId: FIXTURE_CLIENT.client_id,
        credential: { ...FIXTURE_CLIENT }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('TENANT_REQUIRED');
  });

  it('9. ausência de client = DENY', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: '',
        credential: { ...FIXTURE_CLIENT }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('UNAUTHENTICATED');
  });

  it('10-12. SINDICO/PORTEIRO sem bypass automático', async () => {
    const sindicoDeny = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: {
          ...FIXTURE_CLIENT,
          permission_keys: undefined,
          role_name: 'sindico' // memory: only residents.view
        }
      },
      { permissionResolver: resolver }
    );
    expect(sindicoDeny.ok).toBe(false);

    const porteiroDeny = await authorizeOperation(
      {
        operation: 'cancel_reservation',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: {
          ...FIXTURE_CLIENT,
          permission_keys: undefined,
          role_name: 'porteiro' // has create but not delete
        }
      },
      { permissionResolver: resolver }
    );
    expect(porteiroDeny.ok).toBe(false);
  });

  it('unknown permission key in profile ignored; missing required = DENY', async () => {
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: {
          ...FIXTURE_CLIENT,
          permission_keys: ['not.a.real.permission', 'invented.op']
        }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
  });
});

describe('G3 HTTP authz-probe + packages', () => {
  const credentials = createMemoryCredentialStore([{ ...FIXTURE_CLIENT }]);
  const deps = { credentials, tenants, permissionResolver: resolver, windowSeconds: 300 };
  const authzProbe = createAuthzProbeHandler(deps);
  const packages = createPackagesHandler(deps);

  it('13-14. authz works on server API path (not UI)', async () => {
    const headers = authHeaders({ method: 'GET', url: AUTHZ_URL });
    const res = await authzProbe.fetch(new Request(AUTHZ_URL, { method: 'GET', headers }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.authorized).toBe(true);
    expect(body.data.permission).toBe('packages.create');
    expect(body.data.gates.g3_authz_ops).toBe(true);
    expect(JSON.stringify(body)).not.toContain(FIXTURE_CLIENT.secret);
  });

  it('authorized create_package without Idempotency-Key = DENY (G5)', async () => {
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
    expect(body.error.details.core_executed).toBe(false);
  });

  it('HTTP: org A + condo B rejected at G2 tenant before authz', async () => {
    const creds = createMemoryCredentialStore([
      {
        ...FIXTURE_CLIENT,
        organization_id: FIXTURE_ORG_A,
        condominium_id: FIXTURE_CONDO_B
      }
    ]);
    const probe = createAuthzProbeHandler({
      credentials: creds,
      tenants,
      permissionResolver: resolver,
      windowSeconds: 300
    });
    const headers = authHeaders({
      method: 'GET',
      url: AUTHZ_URL,
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_B
    });
    const res = await probe.fetch(new Request(AUTHZ_URL, { method: 'GET', headers }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('TENANT_MISMATCH');
  });

  it('HTTP: missing client denied', async () => {
    const headers = authHeaders({ method: 'GET', url: AUTHZ_URL, omit: ['client'] });
    const res = await authzProbe.fetch(new Request(AUTHZ_URL, { method: 'GET', headers }));
    expect(res.status).toBe(401);
  });
});
