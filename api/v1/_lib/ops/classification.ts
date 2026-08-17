/**
 * Central operation classification — READ / WRITE / SENSITIVE (G4)
 * Do not duplicate per endpoint.
 */

import type { CoreOperationName } from '../authz/operations';
import { isCoreOperationName } from '../authz/operations';

export type OperationClass = 'READ' | 'WRITE' | 'SENSITIVE';

const CLASSIFICATION: Record<CoreOperationName, OperationClass> = {
  identify_resident: 'READ',
  identify_unit: 'READ',
  get_boleto: 'READ',
  /** Admin Event Store query — READ only; never Core / never domain mutation */
  list_events: 'READ',
  create_package: 'WRITE',
  create_occurrence: 'WRITE',
  update_occurrence: 'WRITE',
  create_reservation: 'WRITE',
  pickup_package: 'SENSITIVE',
  cancel_reservation: 'SENSITIVE',
  /** Blocked at AuthZ (DECISION REQUIRED) — classified WRITE if ever mapped */
  notify_resident: 'WRITE'
};

export function classifyOperation(operation: string): OperationClass | null {
  if (!isCoreOperationName(operation)) return null;
  return CLASSIFICATION[operation];
}

export function requiresConfirmation(operation: string): boolean {
  return classifyOperation(operation) === 'SENSITIVE';
}

export function listOperationsByClass(opClass: OperationClass): CoreOperationName[] {
  return (Object.keys(CLASSIFICATION) as CoreOperationName[]).filter(
    (op) => CLASSIFICATION[op] === opClass
  );
}
