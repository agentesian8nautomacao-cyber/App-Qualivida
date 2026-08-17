/**
 * G7-H-B — Local Sentinela API pilot server (HTTP) for n8n.
 * Uses in-memory/fake stores — NOT LIVE PostgreSQL.
 * No WhatsApp. No service-role required.
 *
 * Start: npx vite-node scripts/n8n-harness/local-api-pilot.ts
 * Default: http://127.0.0.1:3099
 */

import { createServer } from 'node:http';
import { createMemoryCredentialStore } from '../../api/v1/_lib/auth/credentials';
import { createMemoryTenantDirectory } from '../../api/v1/_lib/auth/tenant';
import { createMemoryPermissionResolver } from '../../api/v1/_lib/authz/permissionResolver';
import {
  FIXTURE_CLIENT,
  FIXTURE_CONDO_A,
  FIXTURE_CONDO_B,
  FIXTURE_ORG_A,
  FIXTURE_ORG_B
} from '../../api/v1/_lib/auth/testFixtures';
import { createFakePersistenceDb } from '../../api/v1/_lib/execution/fakePersistenceDb';
import { createSupabaseCorePersistence } from '../../api/v1/_lib/execution/supabasePersistence';
import { createSupabaseIdempotencyStore } from '../../api/v1/_lib/idempotency/supabaseStore';
import { createSupabaseConfirmationStore } from '../../api/v1/_lib/confirmations/supabaseStore';
import health from '../../api/v1/health';
import { createProtectedProbeHandler } from '../../api/v1/protected-probe';
import { createIdentifyResidentHandler } from '../../api/v1/residents/identify';
import { createIdentifyUnitHandler } from '../../api/v1/units/identify';
import { createPackagesHandler } from '../../api/v1/operations/packages/index';
import { createPickupHandler } from '../../api/v1/operations/packages/pickup';
import { createReservationsHandler } from '../../api/v1/operations/reservations/index';
import { createCancelReservationHandler } from '../../api/v1/operations/reservations/cancel';
import type { Resident } from '../../types';

const PORT = Number(process.env.SENTINELA_PILOT_PORT || 3099);

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

const credentials = createMemoryCredentialStore([
  {
    ...FIXTURE_CLIENT,
    client_id: process.env.SENTINELA_HARNESS_CLIENT_ID || FIXTURE_CLIENT.client_id,
    secret: process.env.SENTINELA_HARNESS_SECRET || FIXTURE_CLIENT.secret
  },
  {
    ...FIXTURE_CLIENT,
    client_id: 'n8n-pilot-readonly',
    secret: process.env.SENTINELA_HARNESS_SECRET || FIXTURE_CLIENT.secret,
    permission_keys: ['residents.view']
  }
]);

const resolver = createMemoryPermissionResolver({
  porteiro: FIXTURE_CLIENT.permission_keys || []
});

const residents: Resident[] = [
  {
    id: 'r-pilot-maria',
    name: 'Maria Pilot',
    unit: '101',
    phone: '5511999990001',
    whatsapp: '5511999990001',
    email: 'pilot@example.invalid'
  }
];

const client = createFakePersistenceDb({
  packages: [],
  reservations: [],
  areas: [{ id: 'area-pilot', name: 'Salão Pilot' }]
});

const persistenceResult = await createSupabaseCorePersistence({
  organizationId: FIXTURE_ORG_A,
  condominiumId: FIXTURE_CONDO_A,
  client,
  tenantDirectory: tenants
});

if (!persistenceResult.ok) {
  console.error('[pilot-api] persistence failed');
  process.exit(1);
}

const deps = {
  credentials,
  tenants,
  permissionResolver: resolver,
  windowSeconds: 300,
  skipProductionComposition: true as const,
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
};

type Handler = { fetch: (req: Request) => Promise<Response> };

const routes: Array<{ method: string; match: (p: string) => boolean; handler: Handler }> = [
  { method: 'GET', match: (p) => p === '/api/v1/health', handler: health },
  { method: 'GET', match: (p) => p === '/api/v1/protected-probe', handler: createProtectedProbeHandler(deps) },
  { method: 'GET', match: (p) => p === '/api/v1/residents/identify', handler: createIdentifyResidentHandler(deps) },
  { method: 'GET', match: (p) => p === '/api/v1/units/identify', handler: createIdentifyUnitHandler(deps) },
  { method: 'POST', match: (p) => p === '/api/v1/operations/packages', handler: createPackagesHandler(deps) },
  { method: 'POST', match: (p) => p === '/api/v1/operations/packages/pickup', handler: createPickupHandler(deps) },
  { method: 'POST', match: (p) => p === '/api/v1/operations/reservations', handler: createReservationsHandler(deps) },
  {
    method: 'POST',
    match: (p) => p === '/api/v1/operations/reservations/cancel',
    handler: createCancelReservationHandler(deps)
  }
];

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, X-Sentinela-Client-Id, X-Sentinela-Timestamp, X-Sentinela-Signature, X-Organization-Id, X-Condominium-Id, Idempotency-Key, X-Request-Id, X-Correlation-Id, X-Confirmation-Id, X-Confirmation-Token'
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors);
    res.end();
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(','));
  }

  const request = new Request(url.toString(), {
    method: req.method || 'GET',
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
  });

  const route = routes.find((r) => r.method === req.method && r.match(url.pathname));
  if (!route) {
    res.writeHead(404, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'route not in pilot server' } }));
    return;
  }

  try {
    const response = await route.handler.fetch(request);
    const buf = Buffer.from(await response.arrayBuffer());
    const outHeaders: Record<string, string> = { ...cors };
    response.headers.forEach((v, k) => {
      outHeaders[k] = v;
    });
    res.writeHead(response.status, outHeaders);
    res.end(buf);
  } catch (err) {
    console.error('[pilot-api]', err);
    res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'pilot server error' } }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[pilot-api] G7-H-B listening http://127.0.0.1:${PORT}`);
  console.log('[pilot-api] LIVE WRITE=0 (fake stores). No WhatsApp. No PostgreSQL for n8n.');
});
