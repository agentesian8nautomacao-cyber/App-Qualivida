/**
 * G7-K-RBAC — events.view catalog recognition + AuthZ profile semantics
 * No endpoint. No Core operation. No role-name bypass.
 */

import { describe, expect, it } from 'vitest';
import {
  KNOWN_RBAC_PERMISSION_KEYS,
  filterKnownPermissionKeys,
  isKnownPermissionKey
} from './catalog';
import { authorizeOperation, resolveProfilePermissionKeys } from './authorize';
import { createMemoryPermissionResolver } from './permissionResolver';
import {
  FIXTURE_CLIENT,
  FIXTURE_CONDO_A,
  FIXTURE_ORG_A
} from '../auth/testFixtures';

const BASELINE_WITHOUT_EVENTS = [
  'dashboard.view',
  'residents.view',
  'residents.create',
  'residents.update',
  'residents.delete',
  'staff.view',
  'staff.create',
  'staff.update',
  'staff.delete',
  'visitors.view',
  'visitors.create',
  'visitors.update',
  'visitors.delete',
  'occurrences.view',
  'occurrences.create',
  'occurrences.update',
  'occurrences.delete',
  'occurrences.resolve',
  'reservations.view',
  'reservations.create',
  'reservations.update',
  'reservations.delete',
  'packages.view',
  'packages.create',
  'packages.update',
  'packages.delete',
  'notices.view',
  'notices.create',
  'notices.update',
  'notices.delete',
  'boletos.view',
  'boletos.create',
  'boletos.update',
  'boletos.delete',
  'boletos.download',
  'sentinela.view',
  'settings.view',
  'settings.update'
] as const;

describe('G7-K-RBAC events.view', () => {
  it('1. events.view é reconhecida no mirror TS', () => {
    expect(isKnownPermissionKey('events.view')).toBe(true);
    expect(KNOWN_RBAC_PERMISSION_KEYS).toContain('events.view');
    expect(filterKnownPermissionKeys(['events.view', 'invented.op'])).toEqual([
      'events.view'
    ]);
  });

  it('2. permission ausente no perfil → deny em operação mapeada', async () => {
    const resolver = createMemoryPermissionResolver({
      sindico: ['events.view', 'sentinela.view']
    });
    const res = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: {
          ...FIXTURE_CLIENT,
          role_name: 'sindico',
          permission_keys: undefined
        }
      },
      { permissionResolver: resolver }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('FORBIDDEN');
  });

  it('3. permission presente (events.view) → perfil autoriza a key', async () => {
    const resolver = createMemoryPermissionResolver({
      administradora: ['events.view', 'packages.create']
    });
    const profile = await resolveProfilePermissionKeys(
      {
        ...FIXTURE_CLIENT,
        role_name: 'administradora',
        permission_keys: undefined
      },
      resolver
    );
    expect(profile.keys).toContain('events.view');
    expect(profile.keys).toContain('packages.create');
  });

  it('4. sentinela.view NÃO concede events.view', async () => {
    const resolver = createMemoryPermissionResolver({
      sindico: ['sentinela.view', 'packages.create']
    });
    const profile = await resolveProfilePermissionKeys(
      {
        ...FIXTURE_CLIENT,
        role_name: 'sindico',
        permission_keys: undefined
      },
      resolver
    );
    expect(profile.keys).toContain('sentinela.view');
    expect(profile.keys).not.toContain('events.view');
    expect(isKnownPermissionKey('sentinela.view')).toBe(true);
  });

  it('5. role não autorizada (porteiro sem grant) → deny events.view', async () => {
    const resolver = createMemoryPermissionResolver({
      porteiro: ['packages.create', 'sentinela.view'],
      sindico: ['events.view']
    });
    const profile = await resolveProfilePermissionKeys(
      {
        ...FIXTURE_CLIENT,
        role_name: 'porteiro',
        permission_keys: undefined
      },
      resolver
    );
    expect(profile.keys).not.toContain('events.view');
  });

  it('6. role autorizada (sindico com grant) → allow events.view', async () => {
    const resolver = createMemoryPermissionResolver({
      sindico: ['events.view'],
      administradora: ['events.view']
    });
    const sindico = await resolveProfilePermissionKeys(
      {
        ...FIXTURE_CLIENT,
        role_name: 'sindico',
        permission_keys: undefined
      },
      resolver
    );
    const adm = await resolveProfilePermissionKeys(
      {
        ...FIXTURE_CLIENT,
        role_name: 'administradora',
        permission_keys: undefined
      },
      resolver
    );
    expect(sindico.keys).toContain('events.view');
    expect(adm.keys).toContain('events.view');
  });

  it('7. permissions existentes do mirror permanecem intactas', () => {
    for (const key of BASELINE_WITHOUT_EVENTS) {
      expect(isKnownPermissionKey(key)).toBe(true);
      expect(KNOWN_RBAC_PERMISSION_KEYS).toContain(key);
    }
    expect(KNOWN_RBAC_PERMISSION_KEYS.length).toBe(BASELINE_WITHOUT_EVENTS.length + 1);
  });

  it('8. nenhum bypass por role name (sindico sem grant ≠ events.view)', async () => {
    const resolver = createMemoryPermissionResolver({
      // sindico role present but WITHOUT events.view — proves no ALL/role bypass
      sindico: ['residents.view', 'sentinela.view']
    });
    const profile = await resolveProfilePermissionKeys(
      {
        ...FIXTURE_CLIENT,
        role_name: 'sindico',
        permission_keys: undefined
      },
      resolver
    );
    expect(profile.role_name).toBe('sindico');
    expect(profile.keys).not.toContain('events.view');

    const denied = await authorizeOperation(
      {
        operation: 'create_package',
        organizationId: FIXTURE_ORG_A,
        condominiumId: FIXTURE_CONDO_A,
        clientId: FIXTURE_CLIENT.client_id,
        credential: {
          ...FIXTURE_CLIENT,
          role_name: 'sindico',
          permission_keys: undefined
        }
      },
      { permissionResolver: resolver }
    );
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('FORBIDDEN');
  });

  it('intersection: permission_keys events.view exige grant na role', async () => {
    const resolver = createMemoryPermissionResolver({
      porteiro: ['packages.create']
    });
    const profile = await resolveProfilePermissionKeys(
      {
        ...FIXTURE_CLIENT,
        role_name: 'porteiro',
        permission_keys: ['events.view', 'packages.create']
      },
      resolver
    );
    expect(profile.keys).toEqual(['packages.create']);
    expect(profile.keys).not.toContain('events.view');
  });
});
