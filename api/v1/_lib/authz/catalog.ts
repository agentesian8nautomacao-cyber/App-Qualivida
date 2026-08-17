/**
 * Known RBAC permission keys (mirror of granular catalog).
 * Do NOT invent keys here — must exist in public.permissions.
 */

export const KNOWN_RBAC_PERMISSION_KEYS = [
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
  'events.view',
  'settings.view',
  'settings.update'
] as const;

export type KnownRbacPermissionKey = (typeof KNOWN_RBAC_PERMISSION_KEYS)[number];

const KNOWN_SET = new Set<string>(KNOWN_RBAC_PERMISSION_KEYS);

export function isKnownPermissionKey(key: string): boolean {
  return KNOWN_SET.has(key);
}

export function filterKnownPermissionKeys(keys: string[]): string[] {
  return keys.filter((k) => isKnownPermissionKey(k));
}
