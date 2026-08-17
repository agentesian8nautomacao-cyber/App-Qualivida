/**
 * G7-J-W — Persistent Event Store sink (api_domain_events).
 * Auditoria only. Fail-safe. Never controls Core / business outcome.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { OperationalEventEnvelope, OperationalEventName } from './types';
import { assertNoSensitiveLeak } from './redact';

/** Subset G7-I — must match CHECK on public.api_domain_events */
export const PERSISTABLE_EVENT_TYPES = [
  'request.rejected',
  'request.denied',
  'confirmation.required',
  'confirmation.consumed',
  'idempotency.replay',
  'core.failed',
  'operation.completed',
  'operation.failed'
] as const satisfies readonly OperationalEventName[];

export type PersistableEventType = (typeof PERSISTABLE_EVENT_TYPES)[number];

const PERSISTABLE = new Set<string>(PERSISTABLE_EVENT_TYPES);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DomainEventRow = {
  event_id: string;
  occurred_at: string;
  request_id: string;
  organization_id: string;
  condominium_id: string;
  client_id: string | null;
  correlation_id: string | null;
  operation: string | null;
  event_type: PersistableEventType;
  status: string;
  source: string;
  classification: string | null;
  http_status: number | null;
  error_code: string | null;
  retry_class: string | null;
  core_executed: boolean;
  duration_ms: number | null;
  external_ref: string | null;
  confirmation_id: string | null;
  attributes: Record<string, string | number | boolean | null> | null;
};

export type PersistResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; reason: string };

export function isPersistableEventName(name: string): name is PersistableEventType {
  return PERSISTABLE.has(name);
}

export function hasValidTenantIds(
  organizationId: string | null | undefined,
  condominiumId: string | null | undefined
): boolean {
  if (!organizationId || !condominiumId) return false;
  return UUID_RE.test(organizationId) && UUID_RE.test(condominiumId);
}

/**
 * Map envelope → row. Returns null if should not persist (runtime-only / invalid tenant / bad shape).
 */
export function mapEnvelopeToDomainEventRow(
  event: OperationalEventEnvelope
): { row: DomainEventRow } | { skip: string } {
  if (!isPersistableEventName(event.event_name)) {
    return { skip: 'runtime_only_event' };
  }

  if (!event.event_id || !String(event.event_id).startsWith('evt_')) {
    return { skip: 'invalid_event_id' };
  }
  if (!event.request_id || !String(event.request_id).trim()) {
    return { skip: 'invalid_request_id' };
  }
  if (!event.occurred_at || !event.status) {
    return { skip: 'invalid_envelope' };
  }

  if (!hasValidTenantIds(event.organization_id, event.condominium_id)) {
    return { skip: 'tenant_required' };
  }

  const leaks = assertNoSensitiveLeak(event);
  if (leaks.length) {
    return { skip: `redaction_blocked:${leaks.join(',')}` };
  }

  const attrs = event.attributes ? { ...event.attributes } : null;
  let confirmationId: string | null = null;
  if (attrs && typeof attrs.confirmation_id === 'string') {
    confirmationId = attrs.confirmation_id;
    delete attrs.confirmation_id;
  }
  if (confirmationId && !confirmationId.startsWith('cnf_')) {
    return { skip: 'invalid_confirmation_id' };
  }

  const row: DomainEventRow = {
    event_id: event.event_id,
    occurred_at: event.occurred_at,
    request_id: event.request_id,
    organization_id: event.organization_id as string,
    condominium_id: event.condominium_id as string,
    client_id: event.client_id ?? null,
    correlation_id: event.correlation_id ?? null,
    operation: event.operation ?? null,
    event_type: event.event_name,
    status: event.status,
    source: 'api.v1',
    classification: event.classification ?? null,
    http_status: event.http_status ?? null,
    error_code: event.error_code ?? null,
    retry_class: event.retry_class ?? null,
    core_executed: event.core_executed === true,
    duration_ms: event.duration_ms ?? null,
    external_ref: event.external_ref ?? null,
    confirmation_id: confirmationId,
    attributes: attrs && Object.keys(attrs).length ? attrs : null
  };

  return { row };
}

export type EventStoreInsertClient = {
  from: (table: string) => {
    insert: (row: DomainEventRow) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
  };
};

/** Best-effort INSERT. Never throws to caller. */
export async function persistOperationalEvent(
  client: EventStoreInsertClient | SupabaseClient,
  event: OperationalEventEnvelope
): Promise<PersistResult> {
  try {
    const mapped = mapEnvelopeToDomainEventRow(event);
    if ('skip' in mapped) {
      return { ok: true, skipped: true, reason: mapped.skip };
    }

    const { error } = await client.from('api_domain_events').insert(mapped.row);
    if (error) {
      return {
        ok: false,
        reason: String(error.code || error.message || 'insert_failed').slice(0, 120)
      };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: msg.slice(0, 120) };
  }
}

export type PersistentEventPersister = (
  event: OperationalEventEnvelope
) => Promise<PersistResult>;

let activePersister: PersistentEventPersister | null = null;

/** Production / tests: register async persister. Null = logs only. */
export function setPersistentEventPersister(fn: PersistentEventPersister | null): void {
  activePersister = fn;
}

export function getPersistentEventPersister(): PersistentEventPersister | null {
  return activePersister;
}

export function resetPersistentEventPersister(): void {
  activePersister = null;
}

/**
 * Fire-and-forget persist after local sink. Fail-safe: never throws.
 */
export function queuePersistentPersist(event: OperationalEventEnvelope): void {
  const fn = activePersister;
  if (!fn) return;
  if (!isPersistableEventName(event.event_name)) return;

  void Promise.resolve()
    .then(() => fn(event))
    .then((result) => {
      if (!result.ok) {
        console.error(
          '[sentinela-obs] persistent sink failure (non-fatal)',
          event.request_id,
          event.event_name,
          result.reason
        );
      } else if (result.skipped && result.reason === 'tenant_required') {
        console.error(
          '[sentinela-obs] persistent sink skipped (tenant fail-closed)',
          event.request_id,
          event.event_name
        );
      }
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        '[sentinela-obs] persistent sink failure (non-fatal)',
        event.request_id,
        msg.slice(0, 120)
      );
    });
}

/** Wire Supabase service-role client as persister (composition root). */
export function wireSupabasePersistentEventStore(client: SupabaseClient): void {
  setPersistentEventPersister((event) => persistOperationalEvent(client, event));
}

/** In-memory persister for unit tests. */
export function createMemoryPersistentEventStore() {
  const rows: DomainEventRow[] = [];
  let failNext: string | null = null;

  const persister: PersistentEventPersister = async (event) => {
    if (failNext) {
      const reason = failNext;
      failNext = null;
      return { ok: false, reason };
    }
    const mapped = mapEnvelopeToDomainEventRow(event);
    if ('skip' in mapped) return { ok: true, skipped: true, reason: mapped.skip };
    rows.push(mapped.row);
    return { ok: true };
  };

  return {
    rows,
    persister,
    failNext(message: string) {
      failNext = message;
    },
    clear() {
      rows.length = 0;
      failNext = null;
    }
  };
}
