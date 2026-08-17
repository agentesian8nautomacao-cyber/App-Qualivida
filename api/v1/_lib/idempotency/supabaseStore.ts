/**
 * G7-B — Persistent IdempotencyStore for api_idempotency_keys (R1 lazy reclaim).
 * No cron/trigger. No memory fallback.
 */

import type { PersistenceDbClient } from '../execution/supabasePersistence';
import type {
  IdempotencyClaimInput,
  IdempotencyClaimResult,
  IdempotencyCompleteInput,
  IdempotencyFailInput,
  IdempotencyRecord,
  IdempotencyStore
} from './store';

const TTL_MS = 48 * 60 * 60 * 1000;

function isUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  const msg = String(error.message || '').toLowerCase();
  return msg.includes('duplicate') || msg.includes('unique');
}

function mapRow(row: Record<string, unknown>): IdempotencyRecord {
  return {
    key: String(row.idempotency_key),
    organization_id: String(row.organization_id),
    condominium_id: String(row.condominium_id),
    client_id: String(row.request_id || ''),
    operation: String(row.operation),
    request_fingerprint: String(row.fingerprint),
    response_body: row.response_body ?? null,
    created_at: String(row.created_at),
    status: row.status as IdempotencyRecord['status'],
    expires_at: String(row.expires_at),
    response_status:
      row.response_status === null || row.response_status === undefined
        ? null
        : Number(row.response_status)
  };
}

async function selectKey(
  client: PersistenceDbClient,
  organizationId: string,
  condominiumId: string,
  key: string
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client
    .from('api_idempotency_keys')
    .select(
      'id, organization_id, condominium_id, idempotency_key, fingerprint, operation, request_id, status, response_status, response_body, created_at, expires_at, completed_at'
    )
    .eq('organization_id', organizationId)
    .eq('condominium_id', condominiumId)
    .eq('idempotency_key', key)
    .maybeSingle();
  if (error) throw new Error(error.message || 'idempotency select failed');
  return (data as Record<string, unknown>) || null;
}

export function createSupabaseIdempotencyStore(client: PersistenceDbClient): IdempotencyStore {
  if (!client) {
    throw new Error('createSupabaseIdempotencyStore requires client');
  }

  const store: IdempotencyStore = {
    kind: 'persistent',

    async get(key, organizationId, condominiumId) {
      const row = await selectKey(client, organizationId, condominiumId, key);
      return row ? mapRow(row) : null;
    },

    async put(record) {
      // Prefer complete/fail/claim. put maps to completed upsert for legacy callers.
      await store.complete!({
        key: record.key,
        organization_id: record.organization_id,
        condominium_id: record.condominium_id,
        client_id: record.client_id,
        operation: record.operation,
        fingerprint: record.request_fingerprint,
        response_body: record.response_body,
        response_status: 200,
        request_id: record.client_id
      });
    },

    async claim(input: IdempotencyClaimInput): Promise<IdempotencyClaimResult> {
      const nowMs = input.nowMs ?? Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const expiresAt = new Date(nowMs + TTL_MS).toISOString();
      const org = input.organization_id.trim();
      const condo = input.condominium_id.trim();
      const key = input.key.trim();

      const existing = await selectKey(client, org, condo, key);

      if (existing) {
        const exp = new Date(String(existing.expires_at)).getTime();
        if (exp > nowMs) {
          // ACTIVE
          if (
            String(existing.fingerprint) !== input.fingerprint ||
            String(existing.operation) !== input.operation
          ) {
            return { outcome: 'duplicate' };
          }
          const status = String(existing.status);
          if (status === 'completed' || status === 'failed') {
            return { outcome: 'replay', record: mapRow(existing) };
          }
          // in_progress — same fingerprint
          return { outcome: 'in_progress', record: mapRow(existing) };
        }

        // EXPIRED — R1 reclaim (tenant-scoped + expires_at <= now)
        const { error: delErr } = await client
          .from('api_idempotency_keys')
          .delete()
          .eq('organization_id', org)
          .eq('condominium_id', condo)
          .eq('idempotency_key', key)
          .lte('expires_at', nowIso);
        if (delErr) throw new Error(delErr.message || 'idempotency reclaim delete failed');
      }

      const insertRow = {
        organization_id: org,
        condominium_id: condo,
        idempotency_key: key,
        fingerprint: input.fingerprint,
        operation: input.operation,
        request_id: input.request_id || input.client_id,
        status: 'in_progress',
        response_status: null,
        response_body: null,
        created_at: nowIso,
        expires_at: expiresAt,
        completed_at: null
      };

      const { error: insErr } = await client.from('api_idempotency_keys').insert(insertRow);
      if (!insErr) return { outcome: 'proceed' };

      if (isUniqueViolation(insErr)) {
        // Concurrent claim — re-SELECT
        const again = await selectKey(client, org, condo, key);
        if (!again) return { outcome: 'in_progress' };
        if (
          String(again.fingerprint) !== input.fingerprint ||
          String(again.operation) !== input.operation
        ) {
          return { outcome: 'duplicate' };
        }
        const status = String(again.status);
        if (status === 'completed' || status === 'failed') {
          return { outcome: 'replay', record: mapRow(again) };
        }
        return { outcome: 'in_progress', record: mapRow(again) };
      }

      throw new Error(insErr.message || 'idempotency insert failed');
    },

    async complete(input: IdempotencyCompleteInput): Promise<void> {
      const completedAt = new Date().toISOString();
      const { data, error } = await client
        .from('api_idempotency_keys')
        .update({
          status: 'completed',
          response_status: input.response_status,
          response_body: input.response_body,
          completed_at: completedAt,
          fingerprint: input.fingerprint,
          operation: input.operation,
          request_id: input.request_id || input.client_id
        })
        .eq('organization_id', input.organization_id)
        .eq('condominium_id', input.condominium_id)
        .eq('idempotency_key', input.key)
        .select('id')
        .maybeSingle();
      if (error) throw new Error(error.message || 'idempotency complete failed');
      if (!data) {
        // Row missing (rare) — insert completed directly
        const nowMs = Date.now();
        const { error: insErr } = await client.from('api_idempotency_keys').insert({
          organization_id: input.organization_id,
          condominium_id: input.condominium_id,
          idempotency_key: input.key,
          fingerprint: input.fingerprint,
          operation: input.operation,
          request_id: input.request_id || input.client_id,
          status: 'completed',
          response_status: input.response_status,
          response_body: input.response_body,
          created_at: new Date(nowMs).toISOString(),
          expires_at: new Date(nowMs + TTL_MS).toISOString(),
          completed_at: completedAt
        });
        if (insErr && !isUniqueViolation(insErr)) {
          throw new Error(insErr.message || 'idempotency complete insert failed');
        }
      }
    },

    async fail(input: IdempotencyFailInput): Promise<void> {
      const completedAt = new Date().toISOString();
      const { error } = await client
        .from('api_idempotency_keys')
        .update({
          status: 'failed',
          response_status: input.response_status,
          response_body: input.response_body ?? null,
          completed_at: completedAt
        })
        .eq('organization_id', input.organization_id)
        .eq('condominium_id', input.condominium_id)
        .eq('idempotency_key', input.key);
      if (error) throw new Error(error.message || 'idempotency fail update failed');
    }
  };

  return store;
}
