/**
 * Idempotency store port (G5 + G7-B)
 * Production = createSupabaseIdempotencyStore (persistent).
 * Memory = TEST_ONLY. Unavailable = fail-closed default without composition.
 */

export type IdempotencyStatus = 'in_progress' | 'completed' | 'failed';

export type IdempotencyRecord = {
  key: string;
  organization_id: string;
  condominium_id: string;
  client_id: string;
  operation: string;
  request_fingerprint: string;
  response_body: unknown;
  created_at: string;
  status?: IdempotencyStatus;
  expires_at?: string;
  response_status?: number | null;
};

export type IdempotencyClaimInput = {
  key: string;
  organization_id: string;
  condominium_id: string;
  client_id: string;
  operation: string;
  fingerprint: string;
  request_id?: string;
  nowMs?: number;
};

export type IdempotencyClaimResult =
  | { outcome: 'proceed' }
  | { outcome: 'replay'; record: IdempotencyRecord }
  | { outcome: 'duplicate' }
  | { outcome: 'in_progress'; record?: IdempotencyRecord };

export type IdempotencyCompleteInput = {
  key: string;
  organization_id: string;
  condominium_id: string;
  client_id: string;
  operation: string;
  fingerprint: string;
  response_body: unknown;
  response_status: number;
  request_id?: string;
};

export type IdempotencyFailInput = {
  key: string;
  organization_id: string;
  condominium_id: string;
  client_id: string;
  operation: string;
  fingerprint: string;
  response_status: number;
  response_body?: unknown;
  request_id?: string;
};

export type IdempotencyStore = {
  readonly kind: 'persistent' | 'memory_test_only' | 'unavailable';
  get(
    key: string,
    organizationId: string,
    condominiumId: string
  ): Promise<IdempotencyRecord | null>;
  put(record: IdempotencyRecord): Promise<void>;
  claim?(input: IdempotencyClaimInput): Promise<IdempotencyClaimResult>;
  complete?(input: IdempotencyCompleteInput): Promise<void>;
  fail?(input: IdempotencyFailInput): Promise<void>;
};

const MEMORY_TTL_MS = 48 * 60 * 60 * 1000;

export function createUnavailableIdempotencyStore(): IdempotencyStore {
  return {
    kind: 'unavailable',
    async get() {
      return null;
    },
    async put() {
      throw new Error('IDEMPOTENCY_STORE_UNAVAILABLE');
    },
    async claim() {
      throw new Error('IDEMPOTENCY_STORE_UNAVAILABLE');
    }
  };
}

export function createMemoryIdempotencyStoreForTests(): IdempotencyStore {
  type Row = IdempotencyRecord & { status: IdempotencyStatus; expires_at: string };
  const map = new Map<string, Row>();
  const k = (key: string, org: string, condo: string) => `${org}|${condo}|${key}`;

  const store: IdempotencyStore = {
    kind: 'memory_test_only',
    async get(key, organizationId, condominiumId) {
      return map.get(k(key, organizationId, condominiumId)) ?? null;
    },
    async put(record) {
      const key = k(record.key, record.organization_id, record.condominium_id);
      const prev = map.get(key);
      map.set(key, {
        ...record,
        status: 'completed',
        expires_at: record.expires_at || prev?.expires_at || new Date(Date.now() + MEMORY_TTL_MS).toISOString(),
        response_status: record.response_status ?? 200
      });
    },
    async claim(input) {
      const nowMs = input.nowMs ?? Date.now();
      const key = k(input.key, input.organization_id, input.condominium_id);
      const existing = map.get(key);
      if (existing) {
        const exp = new Date(existing.expires_at).getTime();
        if (exp > nowMs) {
          if (
            existing.request_fingerprint !== input.fingerprint ||
            existing.operation !== input.operation
          ) {
            return { outcome: 'duplicate' };
          }
          if (existing.status === 'completed' || existing.status === 'failed') {
            return { outcome: 'replay', record: { ...existing } };
          }
          return { outcome: 'in_progress', record: { ...existing } };
        }
        // R1 reclaim
        map.delete(key);
      }
      const created_at = new Date(nowMs).toISOString();
      map.set(key, {
        key: input.key,
        organization_id: input.organization_id,
        condominium_id: input.condominium_id,
        client_id: input.client_id,
        operation: input.operation,
        request_fingerprint: input.fingerprint,
        response_body: null,
        created_at,
        status: 'in_progress',
        expires_at: new Date(nowMs + MEMORY_TTL_MS).toISOString(),
        response_status: null
      });
      return { outcome: 'proceed' };
    },
    async complete(input) {
      const key = k(input.key, input.organization_id, input.condominium_id);
      const prev = map.get(key);
      map.set(key, {
        key: input.key,
        organization_id: input.organization_id,
        condominium_id: input.condominium_id,
        client_id: input.client_id,
        operation: input.operation,
        request_fingerprint: input.fingerprint,
        response_body: input.response_body,
        created_at: prev?.created_at || new Date().toISOString(),
        status: 'completed',
        expires_at: prev?.expires_at || new Date(Date.now() + MEMORY_TTL_MS).toISOString(),
        response_status: input.response_status
      });
    },
    async fail(input) {
      const key = k(input.key, input.organization_id, input.condominium_id);
      const prev = map.get(key);
      if (!prev) return;
      map.set(key, {
        ...prev,
        status: 'failed',
        response_status: input.response_status,
        response_body: input.response_body ?? null
      });
    }
  };
  return store;
}

export function resolveIdempotencyStore(override?: IdempotencyStore | null): IdempotencyStore {
  if (override) return override;
  return createUnavailableIdempotencyStore();
}
