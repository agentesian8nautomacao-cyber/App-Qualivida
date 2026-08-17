/**
 * G7-A — Server Adapter tests (CorePersistence via Supabase-shaped client).
 * No LIVE writes. Fake DB only.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createMemoryTenantDirectory } from '../auth/tenant';
import { FIXTURE_CONDO_A, FIXTURE_CONDO_B, FIXTURE_ORG_A, FIXTURE_ORG_B } from '../auth/testFixtures';
import { createFakePersistenceDb } from './fakePersistenceDb';
import {
  createSupabaseCorePersistence,
  getPersistenceTenantBinding
} from './supabasePersistence';
import { createServerSupabaseClient } from '../supabase/adminClient';
import type { Package } from '../../../../types';

const ORG = FIXTURE_ORG_A;
const CONDO = FIXTURE_CONDO_A;

const tenants = createMemoryTenantDirectory([
  { organization_id: FIXTURE_ORG_A, condominium_id: FIXTURE_CONDO_A },
  { organization_id: FIXTURE_ORG_B, condominium_id: FIXTURE_CONDO_B }
]);

describe('G7-A server adapter', () => {
  it('A — leitura válida (getBoletos / getPackageById)', async () => {
    const client = createFakePersistenceDb({
      boletos: [
        {
          id: 'bol_1',
          resident_name: 'Ana',
          unit: '101',
          reference_month: '2026-08',
          due_date: '2026-08-10',
          amount: 100,
          status: 'Pendente',
          boleto_type: 'condominio'
        }
      ],
      packages: [
        {
          id: 'pkg_1',
          recipient_name: 'Ana',
          unit: '101',
          type: 'caixa',
          received_at: '2026-08-14T12:00:00.000Z',
          display_time: '09:00',
          status: 'pendente',
          deadline_minutes: 45
        }
      ]
    });

    const created = await createSupabaseCorePersistence({
      organizationId: ORG,
      condominiumId: CONDO,
      client,
      tenantDirectory: tenants
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const boletos = await created.persistence.getBoletos();
    expect(boletos.error).toBeUndefined();
    expect(boletos.data).toHaveLength(1);
    expect(boletos.data[0].id).toBe('bol_1');

    const pkg = await created.persistence.getPackageById!('pkg_1');
    expect(pkg?.id).toBe('pkg_1');
    expect(pkg?.status).toBe('pendente');
  });

  it('B — escrita válida (savePackage / updatePackage / reservation / occurrence)', async () => {
    const client = createFakePersistenceDb();
    const created = await createSupabaseCorePersistence({
      organizationId: ORG,
      condominiumId: CONDO,
      client,
      tenantDirectory: tenants
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const p = created.persistence;

    const saved = await p.savePackage({
      id: 'temp-1',
      recipient: 'Ana',
      unit: '101',
      type: 'caixa',
      receivedAt: '2026-08-14T12:00:00.000Z',
      displayTime: '09:00',
      status: 'pendente',
      deadlineMinutes: 45,
      items: [{ id: 'i1', name: 'Livro', description: '' }]
    });
    expect(saved.success).toBe(true);
    expect(saved.id).toBeTruthy();

    const updated = await p.updatePackage(
      {
        id: saved.id!,
        recipient: 'Ana',
        unit: '101',
        type: 'caixa',
        receivedAt: '2026-08-14T12:00:00.000Z',
        displayTime: '09:00',
        status: 'recebida',
        deadlineMinutes: 45,
        receiptAt: '2026-08-14T13:00:00.000Z'
      },
      'porteiro'
    );
    expect(updated.success).toBe(true);

    const occ = await p.saveOccurrence({
      id: 'temp-occ',
      residentName: 'Ana',
      unit: '101',
      description: 'barulho',
      status: 'Aberto',
      date: '2026-08-14',
      reportedBy: 'portaria'
    });
    expect(occ.success).toBe(true);

    const res = await p.saveReservation({
      areaId: 'area_1',
      residentId: 'res_1',
      residentName: 'Ana',
      unit: '101',
      date: '2026-08-20',
      startTime: '10:00',
      endTime: '11:00'
    });
    expect(res.success).toBe(true);
    expect(res.id).toBeTruthy();

    const del = await p.deleteReservation(res.id!);
    expect(del.success).toBe(true);
  });

  it('C — tenant ausente → FAIL CLOSED', async () => {
    const client = createFakePersistenceDb();
    const missingOrg = await createSupabaseCorePersistence({
      organizationId: '',
      condominiumId: CONDO,
      client,
      tenantDirectory: tenants
    });
    expect(missingOrg.ok).toBe(false);
    if (!missingOrg.ok) expect(missingOrg.code).toBe('TENANT_REQUIRED');

    const missingCondo = await createSupabaseCorePersistence({
      organizationId: ORG,
      condominiumId: '   ',
      client
    });
    expect(missingCondo.ok).toBe(false);
    if (!missingCondo.ok) expect(missingCondo.code).toBe('TENANT_REQUIRED');
  });

  it('D — tenant diferente / mismatch → FAIL CLOSED', async () => {
    const client = createFakePersistenceDb();
    const mismatch = await createSupabaseCorePersistence({
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_B,
      client,
      tenantDirectory: tenants
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.code).toBe('TENANT_MISMATCH');

    const a = await createSupabaseCorePersistence({
      organizationId: FIXTURE_ORG_A,
      condominiumId: FIXTURE_CONDO_A,
      client,
      tenantDirectory: tenants
    });
    const b = await createSupabaseCorePersistence({
      organizationId: FIXTURE_ORG_B,
      condominiumId: FIXTURE_CONDO_B,
      client,
      tenantDirectory: tenants
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(getPersistenceTenantBinding(a.persistence)?.organization_id).toBe(FIXTURE_ORG_A);
    expect(getPersistenceTenantBinding(b.persistence)?.condominium_id).toBe(FIXTURE_CONDO_B);
    expect(getPersistenceTenantBinding(a.persistence)).not.toEqual(
      getPersistenceTenantBinding(b.persistence)
    );
  });

  it('E — resource inexistente', async () => {
    const client = createFakePersistenceDb();
    const created = await createSupabaseCorePersistence({
      organizationId: ORG,
      condominiumId: CONDO,
      client,
      tenantDirectory: tenants
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const pkg = await created.persistence.getPackageById!('missing');
    expect(pkg).toBeNull();

    const upd = await created.persistence.updatePackage(
      {
        id: 'missing',
        recipient: 'x',
        unit: '1',
        type: 'caixa',
        receivedAt: '2026-08-14T12:00:00.000Z',
        displayTime: '09:00',
        status: 'recebida',
        deadlineMinutes: 45
      } satisfies Package,
      null
    );
    expect(upd.success).toBe(false);
    expect(upd.error).toMatch(/not found/i);

    const del = await created.persistence.deleteReservation('missing');
    expect(del.success).toBe(false);
  });

  it('F — erro do banco propagado (sem fallback)', async () => {
    const client = createFakePersistenceDb({}, { failTables: { packages: 'simulated db down' } });
    const created = await createSupabaseCorePersistence({
      organizationId: ORG,
      condominiumId: CONDO,
      client,
      tenantDirectory: tenants
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const saved = await created.persistence.savePackage({
      id: 'temp',
      recipient: 'Ana',
      unit: '101',
      type: 'caixa',
      receivedAt: '2026-08-14T12:00:00.000Z',
      displayTime: '09:00',
      status: 'pendente',
      deadlineMinutes: 45
    });
    expect(saved.success).toBe(false);
    expect(saved.error).toMatch(/simulated db down/);
    expect(client.__db.packages).toHaveLength(0);
  });

  it('G — adapter sem browser APIs (source contract)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, 'supabasePersistence.ts'), 'utf8');
    const admin = readFileSync(join(here, '../supabase/adminClient.ts'), 'utf8');
    const importLines = [...src.split('\n'), ...admin.split('\n')].filter((l) =>
      /^\s*import\b/.test(l)
    );
    const joinedImports = importLines.join('\n');
    expect(joinedImports).not.toMatch(/dexie/i);
    expect(joinedImports).not.toMatch(/offlineDb|offlineDataService|dataService/);
    expect(joinedImports).not.toMatch(/from ['"]react['"]/);
    expect(src).not.toMatch(/\bnavigator\./);
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/indexedDB|localStorage|sessionStorage/);
    expect(src).not.toMatch(/import\.meta\.env\.VITE_/);
    expect(admin).not.toMatch(/import\.meta\.env\.VITE_/);
  });

  it('H — ausência de fallback silencioso (sem client / sem env)', async () => {
    const noClient = await createSupabaseCorePersistence({
      organizationId: ORG,
      condominiumId: CONDO,
      client: null as any
    });
    expect(noClient.ok).toBe(false);
    if (!noClient.ok) expect(noClient.code).toBe('CLIENT_REQUIRED');

    const envClient = createServerSupabaseClient({
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: ''
    });
    expect(envClient).toBeNull();
  });

  it('I — isolamento organization_id + condominium_id (binding imutável)', async () => {
    const client = createFakePersistenceDb();
    const created = await createSupabaseCorePersistence({
      organizationId: ORG,
      condominiumId: CONDO,
      client,
      tenantDirectory: tenants
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const binding = getPersistenceTenantBinding(created.persistence);
    expect(binding).toEqual({ organization_id: ORG, condominium_id: CONDO });

    // binding is non-enumerable and frozen — cannot be swapped via assignment on public API
    expect(Object.keys(created.persistence)).not.toContain('__tenant');
    expect(() => {
      (binding as { organization_id: string }).organization_id = FIXTURE_ORG_B;
    }).toThrow();
  });
});
