import Dexie, { Table } from 'dexie';

export type CacheRecord = {
  id: string;
  table: string;
  payload: any;
  updated_at: string;
};

export type OutboxStatus = 'pending' | 'synced' | 'error';
export type OutboxOperation = 'INSERT' | 'UPDATE' | 'DELETE';

export type OutboxRecord = {
  id: string;
  table: string;
  operation: OutboxOperation;
  payload: any;
  timestamp: number;
  status: OutboxStatus;
  error?: string | null;
};

class OfflineDatabase extends Dexie {
  cache_data!: Table<CacheRecord, string>;
  outbox!: Table<OutboxRecord, string>;

  constructor() {
    super('qualivida_offline_db');

    this.version(1).stores({
      cache_data: '&id, table, updated_at',
      outbox: '&id, table, status, timestamp'
    });
  }
}

export const offlineDb = new OfflineDatabase();

export async function getCachedTable<T = any>(table: string): Promise<T[]> {
  const rows = await offlineDb.cache_data.where('table').equals(table).toArray();
  return rows.map((r) => r.payload as T);
}

export async function setCachedTable<T = any>(
  table: string,
  records: (T & { id: string; updated_at?: string })[]
): Promise<void> {
  const now = new Date().toISOString();

  const cacheRecords: CacheRecord[] = records.map((r) => ({
    id: r.id,
    table,
    payload: r,
    updated_at: r.updated_at ?? now
  }));

  await offlineDb.transaction('rw', offlineDb.cache_data, async () => {
    await offlineDb.cache_data.where('table').equals(table).delete();
    if (cacheRecords.length) {
      await offlineDb.cache_data.bulkPut(cacheRecords);
    }
  });
}

export async function upsertCachedRecord<T = any>(
  table: string,
  record: T & { id: string; updated_at?: string }
): Promise<void> {
  const now = new Date().toISOString();
  const cacheRecord: CacheRecord = {
    id: record.id,
    table,
    payload: record,
    updated_at: record.updated_at ?? now
  };
  await offlineDb.cache_data.put(cacheRecord);
}

export async function deleteCachedRecord(table: string, id: string): Promise<void> {
  await offlineDb.cache_data.where({ table, id }).delete();
}

export async function addToOutbox(entry: Omit<OutboxRecord, 'timestamp' | 'status'>): Promise<void> {
  const now = Date.now();
  await offlineDb.outbox.put({
    ...entry,
    timestamp: now,
    status: 'pending'
  });
}

export async function listPendingOutbox(): Promise<OutboxRecord[]> {
  return offlineDb.outbox.where('status').equals('pending').sortBy('timestamp');
}

export async function markOutboxAsSynced(id: string): Promise<void> {
  await offlineDb.outbox.update(id, { status: 'synced', error: null });
}

export async function markOutboxAsError(id: string, error: string): Promise<void> {
  await offlineDb.outbox.update(id, { status: 'error', error });
}

