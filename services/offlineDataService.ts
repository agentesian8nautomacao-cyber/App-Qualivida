import { supabase } from './supabase';
import {
  addToOutbox,
  deleteCachedRecord,
  getCachedTable,
  listPendingOutbox,
  markOutboxAsError,
  markOutboxAsSynced,
  OutboxRecord,
  OutboxOperation,
  setCachedTable,
  upsertCachedRecord
} from './offlineDb';

export type GetDataOptions<T> = {
  /**
   * Função opcional para buscar dados atualizados do Supabase.
   * Se fornecida e o app estiver online, é executada em paralelo
   * e atualiza o cache/local quando finalizar.
   */
  fetchRemote?: () => Promise<T[]>;
  /**
   * Callback opcional chamado quando os dados remotos forem carregados.
   * Ideal para atualizar o estado da UI sem bloquear a primeira renderização.
   */
  onRemoteUpdate?: (rows: T[]) => void;
};

export type DataResult<T> = {
  data: T[];
  fromCache: boolean;
  error?: string;
};

const isOnline = () => typeof navigator !== 'undefined' ? navigator.onLine : true;

// =============================
// LEITURA OFFLINE-FIRST
// =============================

export async function getData<T extends { id: string; updated_at?: string }>(
  table: string,
  options?: GetDataOptions<T>
): Promise<DataResult<T>> {
  // 1) Sempre tentar ler do cache primeiro
  const cached = await getCachedTable<T>(table);

  // 2) Se tiver callback de fetch remoto e estiver online, dispara em paralelo
  if (options?.fetchRemote && isOnline()) {
    (async () => {
      try {
        const remote = await options.fetchRemote!();
        await setCachedTable<T>(table, remote as any);
        options.onRemoteUpdate?.(remote);
      } catch (err) {
        console.warn('[offlineDataService] Erro ao atualizar cache remoto de', table, err);
      }
    })();
  }

  return {
    data: cached,
    fromCache: true,
    error: undefined
  };
}

// =============================
// ESCRITA (CREATE / UPDATE / DELETE)
// =============================

export type WriteResult = { success: boolean; id?: string; error?: string; queued?: boolean };

function ensureId(payload: any): string {
  if (payload?.id && typeof payload.id === 'string') {
    return payload.id;
  }
  const id = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  payload.id = id;
  return id;
}

function stampUpdatedAt(payload: any) {
  const now = new Date().toISOString();
  if (!payload.updated_at) {
    payload.updated_at = now;
  }
}

async function queueOutbox(
  table: string,
  operation: OutboxOperation,
  payload: any
) {
  const id = ensureId(payload);
  stampUpdatedAt(payload);
  await addToOutbox({
    id,
    table,
    operation,
    payload
  });
}

export async function createData(
  table: string,
  payload: any
): Promise<WriteResult> {
  const localPayload = { ...payload };
  const localId = ensureId(localPayload);
  stampUpdatedAt(localPayload);

  // Atualizar cache imediatamente para manter a UI responsiva
  await upsertCachedRecord(table, localPayload);

  if (!isOnline()) {
    await queueOutbox(table, 'INSERT', localPayload);
    return { success: true, id: localId, queued: true };
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .insert(localPayload as any)
      .select()
      .single();

    if (error) {
      console.error('[offlineDataService] Erro ao criar dado online, enfileirando:', error);
      await queueOutbox(table, 'INSERT', localPayload);
      return { success: true, id: localId, queued: true };
    }

    const finalRow = data || localPayload;
    await upsertCachedRecord(table, finalRow);

    return { success: true, id: finalRow.id || localId };
  } catch (err: any) {
    console.error('[offlineDataService] Exceção ao criar dado online, enfileirando:', err);
    await queueOutbox(table, 'INSERT', localPayload);
    return { success: true, id: localId, queued: true };
  }
}

export async function updateData(
  table: string,
  payload: any
): Promise<WriteResult> {
  if (!payload) return { success: false, error: 'Payload vazio' };

  const localPayload = { ...payload };
  const localId = ensureId(localPayload);
  stampUpdatedAt(localPayload);

  await upsertCachedRecord(table, localPayload);

  if (!isOnline()) {
    await queueOutbox(table, 'UPDATE', localPayload);
    return { success: true, id: localId, queued: true };
  }

  try {
    const { data, error } = await supabase
      .from(table)
      .update(localPayload as any)
      .eq('id', localId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('[offlineDataService] Erro ao atualizar dado online, enfileirando:', error);
      await queueOutbox(table, 'UPDATE', localPayload);
      return { success: true, id: localId, queued: true };
    }

    if (data) {
      await upsertCachedRecord(table, data);
    }

    return { success: true, id: localId };
  } catch (err: any) {
    console.error('[offlineDataService] Exceção ao atualizar dado online, enfileirando:', err);
    await queueOutbox(table, 'UPDATE', localPayload);
    return { success: true, id: localId, queued: true };
  }
}

export async function deleteData(
  table: string,
  id: string
): Promise<WriteResult> {
  if (!id) return { success: false, error: 'ID inválido' };

  await deleteCachedRecord(table, id);

  const payload = { id };

  if (!isOnline()) {
    await queueOutbox(table, 'DELETE', payload);
    return { success: true, id, queued: true };
  }

  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[offlineDataService] Erro ao deletar dado online, enfileirando:', error);
      await queueOutbox(table, 'DELETE', payload);
      return { success: true, id, queued: true };
    }

    return { success: true, id };
  } catch (err: any) {
    console.error('[offlineDataService] Exceção ao deletar dado online, enfileirando:', err);
    await queueOutbox(table, 'DELETE', payload);
    return { success: true, id, queued: true };
  }
}

// =============================
// ENGINE DE SYNC (BÁSICO)
// =============================

export async function syncOutbox(): Promise<void> {
  if (!isOnline()) return;

  const pending = await listPendingOutbox();
  if (!pending.length) return;

  for (const entry of pending) {
    await processOutboxEntry(entry);
  }
}

async function processOutboxEntry(entry: OutboxRecord): Promise<void> {
  try {
    const table = entry.table;
    const payload = entry.payload || {};
    const id = payload.id || entry.id;

    // Política simples: last write wins baseada em updated_at do payload.
    // O Supabase/Postgres mantém updated_at como fonte de verdade.

    if (entry.operation === 'INSERT') {
      const { data, error } = await supabase
        .from(table)
        .insert(payload as any)
        .select()
        .single();

      if (error) throw error;

      if (data?.id) {
        await upsertCachedRecord(table, data);
      }
    } else if (entry.operation === 'UPDATE') {
      const { data, error } = await supabase
        .from(table)
        .update(payload as any)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (data) {
        await upsertCachedRecord(table, data);
      }
    } else if (entry.operation === 'DELETE') {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      await deleteCachedRecord(table, id);
    }

    await markOutboxAsSynced(entry.id);
  } catch (err: any) {
    console.error('[offlineDataService] Erro ao processar outbox', entry, err);
    await markOutboxAsError(entry.id, err?.message || 'Erro ao sincronizar');
  }
}

