/**
 * G7-B — Server composition root.
 * Single place to wire Supabase client + stores + persistence factory.
 * Never imports Dexie / browser adapters.
 */

import { createServerSupabaseClient } from '../supabase/adminClient';
import { createSupabaseCorePersistence } from '../execution/supabasePersistence';
import type { CorePersistence } from '../../../../sentinela/core';
import {
  createUnavailableIdempotencyStore,
  type IdempotencyStore
} from '../idempotency/store';
import { createSupabaseIdempotencyStore } from '../idempotency/supabaseStore';
import { createUnavailableConfirmationStore } from '../confirmations/unavailableStore';
import { createSupabaseConfirmationStore } from '../confirmations/supabaseStore';
import type { ConfirmationStore } from '../confirmations/types';
import { resolveTenantDirectory, type TenantDirectory } from '../auth/tenant';
import type { ResidentsProvider } from '../execution/executeCore';
import { createSupabaseResidentsProvider } from './residentsProvider';
import {
  resetPersistentEventPersister,
  wireSupabasePersistentEventStore
} from '../observability/persistentEventStore';
import {
  createSupabaseEventStoreQuery,
  createUnavailableEventStoreQuery,
  type EventStoreQueryPort
} from '../observability/eventStoreQuery';

export type PersistenceFactory = (
  organizationId: string,
  condominiumId: string
) => Promise<CorePersistence | null>;

export type ProductionApiComposition = {
  readonly kind: 'production' | 'unavailable';
  idempotencyStore: IdempotencyStore;
  confirmationStore: ConfirmationStore;
  createPersistence: PersistenceFactory;
  residentsProvider?: ResidentsProvider;
  tenantDirectory: TenantDirectory;
  eventStoreQuery: EventStoreQueryPort;
};

let cached: ProductionApiComposition | null = null;

export function resetProductionCompositionCacheForTests(): void {
  cached = null;
  resetPersistentEventPersister();
}

/**
 * Build server composition. Fail-closed when service-role client unavailable:
 * stores = unavailable, persistence factory returns null.
 */
export function createProductionApiDeps(
  env: NodeJS.ProcessEnv = process.env,
  options?: { cache?: boolean }
): ProductionApiComposition {
  const useCache = options?.cache !== false;
  if (useCache && cached) return cached;

  const client = createServerSupabaseClient(env);
  const tenantDirectory = resolveTenantDirectory(undefined, env);

  if (!client) {
    resetPersistentEventPersister();
    const unavailable: ProductionApiComposition = {
      kind: 'unavailable',
      idempotencyStore: createUnavailableIdempotencyStore(),
      confirmationStore: createUnavailableConfirmationStore(),
      tenantDirectory,
      eventStoreQuery: createUnavailableEventStoreQuery('event store client unavailable'),
      async createPersistence() {
        return null;
      }
    };
    if (useCache) cached = unavailable;
    return unavailable;
  }

  // G7-J-W — best-effort Event Store (never blocks Core)
  wireSupabasePersistentEventStore(client);

  const composition: ProductionApiComposition = {
    kind: 'production',
    idempotencyStore: createSupabaseIdempotencyStore(client),
    confirmationStore: createSupabaseConfirmationStore(client),
    residentsProvider: createSupabaseResidentsProvider(client),
    tenantDirectory,
    eventStoreQuery: createSupabaseEventStoreQuery(client),
    async createPersistence(organizationId, condominiumId) {
      const created = await createSupabaseCorePersistence({
        organizationId,
        condominiumId,
        client,
        tenantDirectory
      });
      return created.ok ? created.persistence : null;
    }
  };

  if (useCache) cached = composition;
  return composition;
}
