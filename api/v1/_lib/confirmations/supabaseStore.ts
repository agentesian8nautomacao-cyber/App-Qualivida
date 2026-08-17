/**
 * G7-B — Persistent ConfirmationStore for api_confirmations.
 * token plaintext NEVER stored. Consume = atomic UPDATE pending→consumed.
 */

import type { PersistenceDbClient } from '../execution/supabasePersistence';
import type { ConfirmationRecord, ConfirmationStore } from './types';

function mapRow(row: Record<string, unknown>): ConfirmationRecord {
  const status = String(row.status || 'pending') as 'pending' | 'consumed';
  const consumedAt = row.consumed_at ? String(row.consumed_at) : null;
  return {
    confirmation_id: String(row.confirmation_id),
    token_hash: String(row.token_hash),
    organization_id: String(row.organization_id),
    condominium_id: String(row.condominium_id),
    client_id: String(row.client_id),
    requester_identity: row.requester_identity ? String(row.requester_identity) : null,
    operation: String(row.operation),
    resource_id: String(row.resource_id),
    operation_fingerprint: String(row.operation_fingerprint || ''),
    prompt: String(row.prompt),
    expires_at: String(row.expires_at),
    used_at: consumedAt,
    created_at: String(row.created_at),
    status
  };
}

export function createSupabaseConfirmationStore(client: PersistenceDbClient): ConfirmationStore {
  if (!client) throw new Error('createSupabaseConfirmationStore requires client');

  return {
    kind: 'persistent',

    async create(record) {
      if (!record.token_hash || !record.operation_fingerprint) {
        throw new Error('confirmation create requires token_hash and operation_fingerprint');
      }
      // Never accept accidental plaintext fields
      const row = {
        confirmation_id: record.confirmation_id,
        token_hash: record.token_hash,
        organization_id: record.organization_id,
        condominium_id: record.condominium_id,
        client_id: record.client_id,
        operation: record.operation,
        resource_id: record.resource_id,
        operation_fingerprint: record.operation_fingerprint,
        status: 'pending',
        prompt: record.prompt,
        requester_identity: record.requester_identity,
        created_request_id: null,
        created_at: record.created_at,
        expires_at: record.expires_at,
        consumed_at: null
      };
      const { error } = await client.from('api_confirmations').insert(row);
      if (error) throw new Error(error.message || 'confirmation create failed');
    },

    async get(confirmationId, scope) {
      let q = client
        .from('api_confirmations')
        .select(
          'confirmation_id, token_hash, organization_id, condominium_id, client_id, operation, resource_id, operation_fingerprint, status, prompt, requester_identity, created_at, expires_at, consumed_at'
        )
        .eq('confirmation_id', confirmationId);
      if (scope?.organization_id) q = q.eq('organization_id', scope.organization_id);
      if (scope?.condominium_id) q = q.eq('condominium_id', scope.condominium_id);
      const { data, error } = await q.maybeSingle();
      if (error) throw new Error(error.message || 'confirmation get failed');
      if (!data) return null;
      return mapRow(data as Record<string, unknown>);
    },

    async markUsed(confirmationId, usedAtIso, scope) {
      if (!scope?.organization_id || !scope?.condominium_id) {
        // Fail-closed: consume must be tenant-scoped
        return false;
      }
      const { data, error } = await client
        .from('api_confirmations')
        .update({
          status: 'consumed',
          consumed_at: usedAtIso
        })
        .eq('confirmation_id', confirmationId)
        .eq('organization_id', scope.organization_id)
        .eq('condominium_id', scope.condominium_id)
        .eq('status', 'pending')
        .is('consumed_at', null)
        .gt('expires_at', usedAtIso)
        .select('confirmation_id')
        .maybeSingle();
      if (error) throw new Error(error.message || 'confirmation consume failed');
      return Boolean(data);
    }
  };
}
