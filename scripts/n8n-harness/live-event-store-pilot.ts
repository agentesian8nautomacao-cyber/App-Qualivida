/**
 * G7-J-W-LIVE — Controlled LIVE Event Store validation.
 *
 * Runs real API handlers (HMAC → AuthZ → Core path) with fake domain stores
 * (avoids polluting LIVE packages), but persists observability events to
 * LIVE public.api_domain_events via postgres (service-role not required for
 * this pilot when PGPASSWORD is set for the DB owner).
 *
 * No WhatsApp. No n8n prod. No manual fake INSERT of fabricated events.
 * Events are produced only by safeEmit from real handler execution.
 *
 * Usage:
 *   $env:PGPASSWORD='…'  # session only, never commit
 *   npx vite-node scripts/n8n-harness/live-event-store-pilot.ts
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryCredentialStore } from '../../api/v1/_lib/auth/credentials';
import { createMemoryTenantDirectory } from '../../api/v1/_lib/auth/tenant';
import { createMemoryPermissionResolver } from '../../api/v1/_lib/authz/permissionResolver';
import {
  FIXTURE_CLIENT,
  FIXTURE_CONDO_A,
  FIXTURE_CONDO_B,
  FIXTURE_ORG_A,
  FIXTURE_ORG_B,
  authHeaders
} from '../../api/v1/_lib/auth/testFixtures';
import { createFakePersistenceDb } from '../../api/v1/_lib/execution/fakePersistenceDb';
import { createSupabaseCorePersistence } from '../../api/v1/_lib/execution/supabasePersistence';
import { createSupabaseIdempotencyStore } from '../../api/v1/_lib/idempotency/supabaseStore';
import { createSupabaseConfirmationStore } from '../../api/v1/_lib/confirmations/supabaseStore';
import {
  createMemoryEventSink,
  setObservabilitySink,
  resetObservabilitySink,
  setPersistentEventPersister,
  resetPersistentEventPersister,
  mapEnvelopeToDomainEventRow,
  type DomainEventRow,
  type PersistResult
} from '../../api/v1/_lib/observability';
import { createIdentifyResidentHandler } from '../../api/v1/residents/identify';
import { createPackagesHandler } from '../../api/v1/operations/packages/index';
import { createPickupHandler } from '../../api/v1/operations/packages/pickup';
import type { Resident } from '../../types';

const PGHOST = process.env.PGHOST || 'db.zaemlxjwhzrfmowbckmk.supabase.co';
const PGPORT = process.env.PGPORT || '5432';
const PGUSER = process.env.PGUSER || 'postgres';
const PGDATABASE = process.env.PGDATABASE || 'postgres';

if (!process.env.PGPASSWORD) {
  console.error('[g7jw-live] BLOCK: PGPASSWORD missing (session env only)');
  process.exit(2);
}

process.env.PGSSLMODE = process.env.PGSSLMODE || 'require';

function sqlLiteral(v: string | null | undefined): string {
  if (v == null) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlJson(v: DomainEventRow['attributes']): string {
  if (v == null) return 'NULL';
  return `${sqlLiteral(JSON.stringify(v))}::jsonb`;
}

function insertRowViaPsql(row: DomainEventRow): PersistResult {
  const sql = `
INSERT INTO public.api_domain_events (
  event_id, occurred_at, request_id, organization_id, condominium_id,
  client_id, correlation_id, operation, event_type, status, source,
  classification, http_status, error_code, retry_class, core_executed,
  duration_ms, external_ref, confirmation_id, attributes
) VALUES (
  ${sqlLiteral(row.event_id)},
  ${sqlLiteral(row.occurred_at)}::timestamptz,
  ${sqlLiteral(row.request_id)},
  ${sqlLiteral(row.organization_id)}::uuid,
  ${sqlLiteral(row.condominium_id)}::uuid,
  ${sqlLiteral(row.client_id)},
  ${sqlLiteral(row.correlation_id)},
  ${sqlLiteral(row.operation)},
  ${sqlLiteral(row.event_type)},
  ${sqlLiteral(row.status)},
  ${sqlLiteral(row.source)},
  ${sqlLiteral(row.classification)},
  ${row.http_status == null ? 'NULL' : String(row.http_status)},
  ${sqlLiteral(row.error_code)},
  ${sqlLiteral(row.retry_class)},
  ${row.core_executed ? 'true' : 'false'},
  ${row.duration_ms == null ? 'NULL' : String(row.duration_ms)},
  ${sqlLiteral(row.external_ref)},
  ${sqlLiteral(row.confirmation_id)},
  ${sqlJson(row.attributes)}
);
`;
  const dir = mkdtempSync(join(tmpdir(), 'g7jw-'));
  const file = join(dir, 'ins.sql');
  try {
    writeFileSync(file, sql, 'utf8');
    const r = spawnSync(
      'psql',
      ['-v', 'ON_ERROR_STOP=1', '-f', file],
      {
        encoding: 'utf8',
        env: { ...process.env, PGHOST, PGPORT, PGUSER, PGDATABASE, PGSSLMODE: 'require' }
      }
    );
    if (r.status !== 0) {
      const err = `${r.stderr || r.stdout || 'psql_failed'}`.slice(0, 120);
      return { ok: false, reason: err };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e instanceof Error ? e.message : String(e)).slice(0, 120) };
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

function psqlQuery(sql: string): string {
  const r = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-A', '-F', '|', '-t', '-c', sql], {
    encoding: 'utf8',
    env: { ...process.env, PGHOST, PGPORT, PGUSER, PGDATABASE, PGSSLMODE: 'require' }
  });
  if (r.status !== 0) throw new Error((r.stderr || 'psql query failed').slice(0, 200));
  return (r.stdout || '').trim();
}

async function flush() {
  await new Promise((r) => setTimeout(r, 80));
}

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

const credentials = createMemoryCredentialStore([
  { ...FIXTURE_CLIENT },
  {
    ...FIXTURE_CLIENT,
    client_id: 'n8n-pilot-readonly',
    permission_keys: ['residents.view']
  }
]);

const resolver = createMemoryPermissionResolver({
  porteiro: FIXTURE_CLIENT.permission_keys || []
});

const residents: Resident[] = [
  {
    id: 'r-g7jw-live',
    name: 'Maria Pilot',
    unit: '101',
    phone: '5511999990001',
    whatsapp: '5511999990001',
    email: 'pilot@example.invalid'
  }
];

const fake = createFakePersistenceDb({ packages: [], reservations: [] });
const persistenceResult = await createSupabaseCorePersistence({
  organizationId: FIXTURE_ORG_A,
  condominiumId: FIXTURE_CONDO_A,
  client: fake,
  tenantDirectory: tenants
});
if (!persistenceResult.ok) {
  console.error('[g7jw-live] persistence bootstrap failed');
  process.exit(1);
}

const deps = {
  credentials,
  tenants,
  permissionResolver: resolver,
  windowSeconds: 300,
  skipProductionComposition: true as const,
  persistence: persistenceResult.persistence,
  idempotencyStore: createSupabaseIdempotencyStore(fake),
  confirmationStore: createSupabaseConfirmationStore(fake),
  residentsProvider: {
    async listResidents() {
      return residents;
    }
  },
  createPersistence: async (org: string, condo: string) => {
    const r = await createSupabaseCorePersistence({
      organizationId: org,
      condominiumId: condo,
      client: fake,
      tenantDirectory: tenants
    });
    return r.ok ? r.persistence : null;
  }
};

const localSink = createMemoryEventSink();
setObservabilitySink(localSink);
setPersistentEventPersister(async (event) => {
  const mapped = mapEnvelopeToDomainEventRow(event);
  if ('skip' in mapped) return { ok: true, skipped: true, reason: mapped.skip };
  return insertRowViaPsql(mapped.row);
});

const identify = createIdentifyResidentHandler(deps);
const packages = createPackagesHandler(deps);
const pickup = createPickupHandler(deps);

const report: Record<string, unknown> = {
  gate: 'G7-J-W-LIVE',
  host: PGHOST,
  organization_id: FIXTURE_ORG_A,
  condominium_id: FIXTURE_CONDO_A,
  client_id: FIXTURE_CLIENT.client_id,
  domain_write_target: 'fake_in_memory',
  event_store_target: 'LIVE api_domain_events',
  scenarios: [] as unknown[]
};

const rowsBefore = Number(psqlQuery('SELECT COUNT(*) FROM public.api_domain_events'));
report.rows_before = rowsBefore;

function pushScenario(s: Record<string, unknown>) {
  (report.scenarios as unknown[]).push(s);
  console.log(JSON.stringify(s));
}

// --- READ ---
{
  const url = 'http://localhost/api/v1/residents/identify?name=Maria%20Pilot&unit=101';
  const reqId = `g7jwl-read-${Date.now()}`;
  const res = await identify.fetch(
    new Request(url, {
      method: 'GET',
      headers: {
        ...authHeaders({ method: 'GET', url }),
        'X-Request-Id': reqId
      }
    })
  );
  const json = await res.json();
  await flush();
  pushScenario({
    scenario: 'READ_identify_resident',
    http: res.status,
    request_id: json.request_id || reqId,
    success: json.success === true,
    core_executed: json.data?.core_executed ?? null,
    operation: json.operation || 'identify_resident'
  });
}

// --- WRITE ---
const idemKey = `g7jwl-pkg-${Date.now()}`;
let writeReqId = '';
{
  const bodyObj = {
    recipient: 'G7-J-W-LIVE-TEST',
    unit: '101',
    type: 'caixa',
    input_type: 'text',
    text: 'G7-J-W-LIVE controlled package',
    metadata: { gate: 'G7-J-W-LIVE', test: true }
  };
  const body = JSON.stringify(bodyObj);
  const url = 'http://localhost/api/v1/operations/packages';
  const res = await packages.fetch(
    new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders({ method: 'POST', url, body, idempotencyKey: idemKey })
      },
      body
    })
  );
  const json = await res.json();
  writeReqId = String(json.request_id || '');
  await flush();
  pushScenario({
    scenario: 'WRITE_create_package',
    http: res.status,
    request_id: writeReqId,
    success: json.success === true,
    core_executed: json.data?.core_executed ?? null,
    idempotency_key: idemKey,
    recipient: 'G7-J-W-LIVE-TEST'
  });
}

// --- REPLAY ---
{
  const bodyObj = {
    recipient: 'G7-J-W-LIVE-TEST',
    unit: '101',
    type: 'caixa',
    input_type: 'text',
    text: 'G7-J-W-LIVE controlled package',
    metadata: { gate: 'G7-J-W-LIVE', test: true }
  };
  const body = JSON.stringify(bodyObj);
  const url = 'http://localhost/api/v1/operations/packages';
  const res = await packages.fetch(
    new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders({ method: 'POST', url, body, idempotencyKey: idemKey })
      },
      body
    })
  );
  const json = await res.json();
  await flush();
  pushScenario({
    scenario: 'IDEMPOTENCY_replay',
    http: res.status,
    request_id: json.request_id || null,
    success: json.success === true,
    core_executed: json.data?.core_executed ?? null,
    idempotency_key: idemKey
  });
}

// --- AuthZ denied ---
{
  const bodyObj = {
    recipient: 'G7-J-W-LIVE-DENY',
    unit: '101',
    type: 'caixa',
    input_type: 'text',
    text: 'should deny'
  };
  const body = JSON.stringify(bodyObj);
  const url = 'http://localhost/api/v1/operations/packages';
  const res = await packages.fetch(
    new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders({
          method: 'POST',
          url,
          body,
          idempotencyKey: `g7jwl-deny-${Date.now()}`,
          clientId: 'n8n-pilot-readonly'
        })
      },
      body
    })
  );
  const json = await res.json();
  await flush();
  pushScenario({
    scenario: 'AUTHZ_denied',
    http: res.status,
    request_id: json.request_id || null,
    error_code: json.error?.code || null,
    core_executed: json.data?.core_executed ?? json.error?.details?.core_executed ?? null
  });
}

// --- Tenant invalid ---
{
  const bodyObj = {
    recipient: 'G7-J-W-LIVE-TENANT',
    unit: '101',
    type: 'caixa',
    input_type: 'text',
    text: 'tenant mismatch'
  };
  const body = JSON.stringify(bodyObj);
  const url = 'http://localhost/api/v1/operations/packages';
  const res = await packages.fetch(
    new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders({
          method: 'POST',
          url,
          body,
          idempotencyKey: `g7jwl-tenant-${Date.now()}`,
          condominiumId: FIXTURE_CONDO_B
        })
      },
      body
    })
  );
  const json = await res.json();
  await flush();
  pushScenario({
    scenario: 'TENANT_invalid',
    http: res.status,
    request_id: json.request_id || null,
    error_code: json.error?.code || null
  });
}

// --- SENSITIVE confirmation required ---
{
  const bodyObj = { resource_id: 'pkg-g7jwl-missing' };
  const body = JSON.stringify(bodyObj);
  const url = 'http://localhost/api/v1/operations/packages/pickup';
  const res = await pickup.fetch(
    new Request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders({ method: 'POST', url, body })
      },
      body
    })
  );
  const json = await res.json();
  await flush();
  pushScenario({
    scenario: 'SENSITIVE_confirmation_required',
    http: res.status,
    request_id: json.request_id || null,
    error_code: json.error?.code || null
  });
}

await flush();
await flush();

const rowsAfter = Number(psqlQuery('SELECT COUNT(*) FROM public.api_domain_events'));
report.rows_after = rowsAfter;
report.rows_delta = rowsAfter - rowsBefore;

const eventsSql = `
SELECT event_type, request_id, organization_id, condominium_id, operation, status, core_executed::text, error_code
FROM public.api_domain_events
WHERE request_id LIKE 'g7jwl-%'
   OR request_id LIKE 'req_%'
ORDER BY occurred_at ASC
LIMIT 50;
`;
// Prefer pilot request ids from scenarios
const reqIds = (report.scenarios as Array<{ request_id?: string }>)
  .map((s) => s.request_id)
  .filter((x): x is string => !!x);

const listed: unknown[] = [];
for (const rid of reqIds) {
  const out = psqlQuery(
    `SELECT event_type || '|' || coalesce(operation,'') || '|' || status || '|' || core_executed::text || '|' || coalesce(error_code,'') || '|' || organization_id::text || '|' || condominium_id::text FROM public.api_domain_events WHERE request_id = ${sqlLiteral(rid)} ORDER BY occurred_at`
  );
  if (out) {
    for (const line of out.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const [event_type, operation, status, core_executed, error_code, organization_id, condominium_id] =
        line.split('|');
      listed.push({
        request_id: rid,
        event_type,
        operation,
        status,
        core_executed,
        error_code: error_code || null,
        organization_id,
        condominium_id
      });
    }
  }
}
report.live_events = listed;

// Redaction spot-check: no forbidden columns populated with secrets
const leakCheck = psqlQuery(`
SELECT COUNT(*)::text FROM public.api_domain_events e
WHERE (e.attributes::text ~* '(secret|hmac|signature|confirmation_token|service_role|BEGIN |password=)')
   OR (e.external_ref IS NOT NULL AND length(e.external_ref) > 200)
`);
report.redaction_leak_rows = Number(leakCheck || '0');

report.fail_safe =
  'Validated in g7jw.event-sink.test.ts (E/F): Core SUCCESS when Event Store INSERT fails; not provoked on LIVE.';

writeFileSync(
  join(process.cwd(), 'docs/evidence/results/_tmp_g7jw_live_raw.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);

console.log('[g7jw-live] rows_before=', rowsBefore, 'rows_after=', rowsAfter, 'delta=', rowsAfter - rowsBefore);
console.log('[g7jw-live] live_events=', listed.length, 'redaction_leak_rows=', report.redaction_leak_rows);

resetObservabilitySink();
resetPersistentEventPersister();
