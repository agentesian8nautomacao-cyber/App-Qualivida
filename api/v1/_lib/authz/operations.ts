/**
 * Core operation → existing RBAC permission key.
 * notify_resident = unmapped (DECISION REQUIRED) → always deny.
 */

import type { KnownRbacPermissionKey } from './catalog';

export type CoreOperationName =
  | 'identify_resident'
  | 'identify_unit'
  | 'create_package'
  | 'pickup_package'
  | 'create_occurrence'
  | 'update_occurrence'
  | 'create_reservation'
  | 'cancel_reservation'
  | 'get_boleto'
  | 'list_events'
  | 'notify_resident';

export type OperationPermissionBinding =
  | { operation: CoreOperationName; permission: KnownRbacPermissionKey; status: 'mapped' }
  | {
      operation: 'notify_resident';
      permission: null;
      status: 'decision_required';
      reason: string;
    };

export const OPERATION_PERMISSION_MAP: Record<CoreOperationName, OperationPermissionBinding> = {
  identify_resident: {
    operation: 'identify_resident',
    permission: 'residents.view',
    status: 'mapped'
  },
  identify_unit: {
    operation: 'identify_unit',
    permission: 'residents.view',
    status: 'mapped'
  },
  create_package: {
    operation: 'create_package',
    permission: 'packages.create',
    status: 'mapped'
  },
  pickup_package: {
    operation: 'pickup_package',
    permission: 'packages.update',
    status: 'mapped'
  },
  create_occurrence: {
    operation: 'create_occurrence',
    permission: 'occurrences.create',
    status: 'mapped'
  },
  update_occurrence: {
    operation: 'update_occurrence',
    permission: 'occurrences.update',
    status: 'mapped'
  },
  create_reservation: {
    operation: 'create_reservation',
    permission: 'reservations.create',
    status: 'mapped'
  },
  cancel_reservation: {
    operation: 'cancel_reservation',
    permission: 'reservations.delete',
    status: 'mapped'
  },
  get_boleto: {
    operation: 'get_boleto',
    permission: 'boletos.view',
    status: 'mapped'
  },
  list_events: {
    operation: 'list_events',
    permission: 'events.view',
    status: 'mapped'
  },
  notify_resident: {
    operation: 'notify_resident',
    permission: null,
    status: 'decision_required',
    reason:
      'No notifications.* permission in RBAC catalog; notices.create is mural domain, not inbox. Do not invent key without migration approval.'
  }
};

export function isCoreOperationName(value: string): value is CoreOperationName {
  return Object.prototype.hasOwnProperty.call(OPERATION_PERMISSION_MAP, value);
}
