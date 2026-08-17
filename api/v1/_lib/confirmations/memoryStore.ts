/**
 * TEST_ONLY in-memory confirmation store.
 * NOT for production. NOT a security control in multi-instance serverless.
 */

import type { ConfirmationRecord, ConfirmationStore } from './types';

export function createMemoryConfirmationStoreForTests(): ConfirmationStore {
  const map = new Map<string, ConfirmationRecord>();
  return {
    kind: 'memory_test_only',
    async create(record) {
      map.set(record.confirmation_id, {
        ...record,
        status: 'pending',
        operation_fingerprint: record.operation_fingerprint
      });
    },
    async get(confirmationId, scope) {
      const row = map.get(confirmationId);
      if (!row) return null;
      if (scope?.organization_id && row.organization_id !== scope.organization_id) return null;
      if (scope?.condominium_id && row.condominium_id !== scope.condominium_id) return null;
      return { ...row };
    },
    async markUsed(confirmationId, usedAtIso, scope) {
      const row = map.get(confirmationId);
      if (!row) return false;
      if (scope?.organization_id && row.organization_id !== scope.organization_id) return false;
      if (scope?.condominium_id && row.condominium_id !== scope.condominium_id) return false;
      if (row.used_at || row.status === 'consumed') return false;
      if (new Date(row.expires_at).getTime() <= new Date(usedAtIso).getTime()) return false;
      row.used_at = usedAtIso;
      row.status = 'consumed';
      map.set(confirmationId, row);
      return true;
    }
  };
}
