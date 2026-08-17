import { describe, it, expect, beforeEach } from 'vitest';
import type { Package, Resident } from '../../types';
import {
  identifyResident,
  identifyUnit,
  createPackage,
  pickupPackage,
  setCorePersistenceForTests,
  clearRecentDomainEventsForTests,
  getRecentDomainEvents,
  type OperationContext,
  type CorePersistence
} from './index';

const residents: Resident[] = [
  {
    id: 'r1',
    name: 'Paulo Henrique',
    unit: '03/005',
    email: 'paulo@test.com',
    phone: '11999990000',
    whatsapp: '5511999990000'
  },
  {
    id: 'r2',
    name: 'Maria Silva',
    unit: '01/101',
    email: 'maria@test.com',
    phone: '11988887777',
    whatsapp: ''
  },
  {
    id: 'r3',
    name: 'João',
    unit: '02/201',
    email: '',
    phone: '',
    whatsapp: ''
  },
  {
    id: 'r4',
    name: 'João',
    unit: '02/202',
    email: '',
    phone: '',
    whatsapp: ''
  }
];

const ctx: OperationContext = {
  channel: 'panel',
  actorDisplayName: 'Porteiro Teste',
  organizationId: 'org-1',
  condominiumId: 'condo-1'
};

function mockPersistence(store: { packages: Package[] }): CorePersistence {
  return {
    savePackage: async (pkg) => {
      const id = `pkg-${store.packages.length + 1}`;
      store.packages.push({ ...pkg, id });
      return { success: true, id };
    },
    updatePackage: async (pkg) => {
      const i = store.packages.findIndex((p) => p.id === pkg.id);
      if (i < 0) return { success: false, error: 'not found' };
      store.packages[i] = pkg;
      return { success: true };
    },
    saveOccurrence: async () => ({ success: true, id: 'occ-1' }),
    updateOccurrence: async () => ({ success: true }),
    saveReservation: async () => ({ success: true, id: 'res-1' }),
    deleteReservation: async () => ({ success: true }),
    getBoletos: async () => ({ data: [] }),
    createNotification: async () => ({ success: true, id: 'n1' })
  };
}

describe('Operational Core — identify', () => {
  it('identify_resident by id', () => {
    const res = identifyResident({ residentId: 'r1', residents }, ctx);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.resident?.id).toBe('r1');
      expect(res.data.matchStrategy).toBe('id');
    }
  });

  it('identify_resident fails for missing id', () => {
    const res = identifyResident({ residentId: 'missing', residents }, ctx);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('NOT_FOUND');
  });

  it('identify_resident by phone', () => {
    const res = identifyResident({ phone: '(11) 99999-0000', residents }, ctx);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.resident?.id).toBe('r1');
      expect(res.data.matchStrategy).toBe('phone');
    }
  });

  it('identify_resident phone not found = NOT_FOUND', () => {
    const res = identifyResident({ phone: '11900000000', residents }, ctx);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('NOT_FOUND');
  });

  it('identify_resident phone ambiguous = CLARIFICATION_REQUIRED', () => {
    const sharedPhone: Resident[] = [
      { ...residents[0], id: 'p1', phone: '11977776666', whatsapp: '11977776666' },
      { ...residents[1], id: 'p2', phone: '11977776666', whatsapp: '11977776666' }
    ];
    const res = identifyResident({ phone: '11977776666', residents: sharedPhone }, ctx);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('CLARIFICATION_REQUIRED');
  });

  it('identify_resident ambiguous name', () => {
    const res = identifyResident({ name: 'João', residents }, ctx);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.ambiguous).toBe(true);
      expect(res.data.resident).toBeNull();
    }
  });

  it('identify_unit success', () => {
    const res = identifyUnit({ unit: '3/5' }, ctx);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.normalized).toBe('03/005');
    }
  });

  it('identify_unit missing', () => {
    const res = identifyUnit({ unit: '' }, ctx);
    expect(res.success).toBe(false);
  });

  it('identify_unit not in catalog', () => {
    const res = identifyUnit({ unit: '03/005', knownUnitCodes: ['01/101'] }, ctx);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('NOT_FOUND');
  });
});

describe('Operational Core — packages', () => {
  beforeEach(() => {
    clearRecentDomainEventsForTests();
    setCorePersistenceForTests(null);
  });

  it('create_package success', async () => {
    const store = { packages: [] as Package[] };
    setCorePersistenceForTests(mockPersistence(store));
    const res = await createPackage(
      {
        recipientId: 'r1',
        recipient: 'Paulo Henrique',
        unit: '03/005',
        type: ' interagem',
        residents
      },
      ctx,
      mockPersistence(store)
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.id).toBeTruthy();
      expect(res.events[0]?.type).toBe('package.created');
    }
    expect(getRecentDomainEvents().some((e) => e.type === 'package.created')).toBe(true);
  });

  it('create_package validation missing recipient/unit', async () => {
    const store = { packages: [] as Package[] };
    const res = await createPackage({ type: 'X' }, ctx, mockPersistence(store));
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('VALIDATION_ERROR');
  });

  it('create_package without tenant warns', async () => {
    const store = { packages: [] as Package[] };
    const res = await createPackage(
      { recipient: 'Paulo Henrique', unit: '03/005', recipientId: 'r1' },
      { channel: 'panel' },
      mockPersistence(store)
    );
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.warnings).toContain('TENANT_CONTEXT_ABSENT');
    }
  });

  it('pickup_package success', async () => {
    const pkg: Package = {
      id: 'pkg-1',
      recipient: 'Paulo',
      unit: '03/005',
      type: 'Caixa',
      receivedAt: new Date().toISOString(),
      displayTime: '10:00',
      status: 'pendente',
      deadlineMinutes: 45,
      recipientId: 'r1'
    };
    const store = { packages: [pkg] };
    const res = await pickupPackage(
      { packageId: 'pkg-1', package: pkg, deliveredBy: 'admin-1' },
      ctx,
      mockPersistence(store)
    );
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.package.status).toBe('recebida');
  });

  it('pickup_package duplicate', async () => {
    const pkg: Package = {
      id: 'pkg-1',
      recipient: 'Paulo',
      unit: '03/005',
      type: 'Caixa',
      receivedAt: new Date().toISOString(),
      displayTime: '10:00',
      status: 'recebida',
      deadlineMinutes: 45
    };
    const res = await pickupPackage(
      { packageId: 'pkg-1', package: pkg },
      ctx,
      mockPersistence({ packages: [pkg] })
    );
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('DUPLICATE');
  });

  it('pickup_package missing package', async () => {
    const res = await pickupPackage(
      { packageId: '', package: null as unknown as Package },
      ctx,
      mockPersistence({ packages: [] })
    );
    expect(res.success).toBe(false);
  });

  it('pickup_package authorization for resident', async () => {
    const pkg: Package = {
      id: 'pkg-1',
      recipient: 'Outro',
      unit: '09/999',
      type: 'Caixa',
      receivedAt: new Date().toISOString(),
      displayTime: '10:00',
      status: 'pendente',
      deadlineMinutes: 45,
      recipientId: 'other'
    };
    const res = await pickupPackage(
      {
        packageId: 'pkg-1',
        package: pkg,
        actorIsResident: true,
        currentResident: residents[0]
      },
      ctx,
      mockPersistence({ packages: [pkg] })
    );
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.code).toBe('AUTHORIZATION_ERROR');
  });
});
