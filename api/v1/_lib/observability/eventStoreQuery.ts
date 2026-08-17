/**
 * G7-K — Event Store READ query (tenant-scoped).
 * No schema changes. No Dexie. Server adapter only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { assertNoSensitiveLeak, redactObservabilityValue } from './redact';
import { PERSISTABLE_EVENT_TYPES, type PersistableEventType } from './persistentEventStore';

export const EVENTS_PAGE_DEFAULT = 50;
export const EVENTS_PAGE_MAX = 100;
/** Inclusive range cap for from/to filters */
export const EVENTS_MAX_RANGE_MS = 93 * 24 * 60 * 60 * 1000;

export type EventStoreRow = {
  event_id: string;
  occurred_at: string;
  created_at?: string | null;
  request_id: string;
  organization_id: string;
  condominium_id: string;
  client_id: string | null;
  correlation_id: string | null;
  operation: string | null;
  event_type: string;
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
  attributes?: unknown;
};

/** Public admin projection — never includes secrets / raw attributes / tenant override */
export type SanitizedDomainEvent = {
  event_id: string;
  event_type: string;
  request_id: string;
  operation: string | null;
  status: string;
  occurred_at: string;
  created_at: string | null;
  core_executed: boolean;
  retry_class: string | null;
  classification: string | null;
  http_status: number | null;
  error_code: string | null;
  duration_ms: number | null;
  external_ref: string | null;
  confirmation_id: string | null;
  correlation_id: string | null;
  client_id: string | null;
  source: string;
};

export type EventListQuery = {
  organization_id: string;
  condominium_id: string;
  event_type?: string;
  operation?: string;
  status?: string;
  request_id?: string;
  from?: string;
  to?: string;
  limit: number;
  cursor?: string;
};

export type EventListResult =
  | {
      ok: true;
      events: SanitizedDomainEvent[];
      next_cursor: string | null;
      limit: number;
    }
  | { ok: false; code: 'INVALID_REQUEST' | 'INTERNAL_ERROR'; message: string; details?: Record<string, unknown> };

export type EventStoreQueryPort = {
  listEvents(query: EventListQuery): Promise<EventListResult>;
};

type CursorPayload = { occurred_at: string; event_id: string };

function encodeCursor(row: { occurred_at: string; event_id: string }): string {
  const payload: CursorPayload = { occurred_at: row.occurred_at, event_id: row.event_id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): CursorPayload | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as CursorPayload;
    if (
      !parsed ||
      typeof parsed.occurred_at !== 'string' ||
      typeof parsed.event_id !== 'string' ||
      !parsed.occurred_at.trim() ||
      !parsed.event_id.trim()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function parseIsoInstant(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Require explicit timezone (Z or ±hh:mm) to avoid implicit local TZ
  if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed)) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function parseEventsLimit(raw: string | null): { ok: true; limit: number } | { ok: false; message: string } {
  if (raw == null || raw === '') return { ok: true, limit: EVENTS_PAGE_DEFAULT };
  if (!/^\d+$/.test(raw)) return { ok: false, message: 'limit must be a positive integer' };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return { ok: false, message: 'limit must be >= 1' };
  if (n > EVENTS_PAGE_MAX) return { ok: false, message: `limit must be <= ${EVENTS_PAGE_MAX}` };
  return { ok: true, limit: n };
}

export type ParseEventsParamsResult =
  | { ok: true; query: EventListQuery }
  | { ok: false; code: 'INVALID_REQUEST'; message: string; details?: Record<string, unknown> };

export function parseEventsListParams(
  searchParams: URLSearchParams,
  tenant: { organization_id: string; condominium_id: string }
): ParseEventsParamsResult {
  // Tenant query overrides are ignored (never used)
  void searchParams.get('organization_id');
  void searchParams.get('condominium_id');

  const limitParsed = parseEventsLimit(searchParams.get('limit'));
  if (limitParsed.ok === false) {
    return { ok: false, code: 'INVALID_REQUEST', message: limitParsed.message };
  }

  const eventType = (searchParams.get('event_type') || '').trim() || undefined;
  if (eventType && !(PERSISTABLE_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: 'event_type is not a known persistable event type',
      details: { allowed: [...PERSISTABLE_EVENT_TYPES] }
    };
  }

  const operation = (searchParams.get('operation') || '').trim() || undefined;
  const status = (searchParams.get('status') || '').trim() || undefined;
  const requestId = (searchParams.get('request_id') || '').trim() || undefined;
  const fromRaw = (searchParams.get('from') || '').trim() || undefined;
  const toRaw = (searchParams.get('to') || '').trim() || undefined;
  const cursorRaw = (searchParams.get('cursor') || '').trim() || undefined;

  let fromIso: string | undefined;
  let toIso: string | undefined;
  if (fromRaw) {
    const d = parseIsoInstant(fromRaw);
    if (!d) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'from must be ISO-8601 with explicit timezone (Z or offset)'
      };
    }
    fromIso = d.toISOString();
  }
  if (toRaw) {
    const d = parseIsoInstant(toRaw);
    if (!d) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'to must be ISO-8601 with explicit timezone (Z or offset)'
      };
    }
    toIso = d.toISOString();
  }
  if (fromIso && toIso) {
    const fromMs = Date.parse(fromIso);
    const toMs = Date.parse(toIso);
    if (fromMs > toMs) {
      return { ok: false, code: 'INVALID_REQUEST', message: 'from must be <= to' };
    }
    if (toMs - fromMs > EVENTS_MAX_RANGE_MS) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: 'from/to range exceeds maximum of 93 days'
      };
    }
  }

  if (cursorRaw && !decodeCursor(cursorRaw)) {
    return { ok: false, code: 'INVALID_REQUEST', message: 'cursor is invalid' };
  }

  return {
    ok: true,
    query: {
      organization_id: tenant.organization_id,
      condominium_id: tenant.condominium_id,
      event_type: eventType,
      operation,
      status,
      request_id: requestId,
      from: fromIso,
      to: toIso,
      limit: limitParsed.limit,
      cursor: cursorRaw
    }
  };
}

export function sanitizeDomainEvent(row: EventStoreRow): SanitizedDomainEvent {
  const projected: SanitizedDomainEvent = {
    event_id: String(row.event_id),
    event_type: String(row.event_type),
    request_id: String(row.request_id),
    operation: row.operation == null ? null : String(row.operation),
    status: String(row.status),
    occurred_at: String(row.occurred_at),
    created_at: row.created_at == null ? null : String(row.created_at),
    core_executed: Boolean(row.core_executed),
    retry_class: row.retry_class == null ? null : String(row.retry_class),
    classification: row.classification == null ? null : String(row.classification),
    http_status: row.http_status == null ? null : Number(row.http_status),
    error_code: row.error_code == null ? null : String(row.error_code),
    duration_ms: row.duration_ms == null ? null : Number(row.duration_ms),
    external_ref: row.external_ref == null ? null : String(row.external_ref),
    confirmation_id: row.confirmation_id == null ? null : String(row.confirmation_id),
    correlation_id: row.correlation_id == null ? null : String(row.correlation_id),
    client_id: row.client_id == null ? null : String(row.client_id),
    source: String(row.source || 'api.v1')
  };

  const redacted = redactObservabilityValue(projected) as SanitizedDomainEvent;
  return redacted;
}

function compareDesc(a: EventStoreRow, b: EventStoreRow): number {
  const oa = String(a.occurred_at);
  const ob = String(b.occurred_at);
  if (oa !== ob) return oa < ob ? 1 : -1;
  const ea = String(a.event_id);
  const eb = String(b.event_id);
  if (ea === eb) return 0;
  return ea < eb ? 1 : -1;
}

function afterCursor(row: EventStoreRow, cursor: CursorPayload): boolean {
  const oa = String(row.occurred_at);
  if (oa < cursor.occurred_at) return true;
  if (oa > cursor.occurred_at) return false;
  return String(row.event_id) < cursor.event_id;
}

export function createMemoryEventStoreQuery(seed: EventStoreRow[]): EventStoreQueryPort {
  const rows = [...seed];
  return {
    async listEvents(query) {
      let filtered = rows.filter(
        (r) =>
          r.organization_id === query.organization_id &&
          r.condominium_id === query.condominium_id
      );
      if (query.event_type) filtered = filtered.filter((r) => r.event_type === query.event_type);
      if (query.operation) filtered = filtered.filter((r) => r.operation === query.operation);
      if (query.status) filtered = filtered.filter((r) => r.status === query.status);
      if (query.request_id) filtered = filtered.filter((r) => r.request_id === query.request_id);
      if (query.from) filtered = filtered.filter((r) => String(r.occurred_at) >= query.from!);
      if (query.to) filtered = filtered.filter((r) => String(r.occurred_at) <= query.to!);

      if (query.cursor) {
        const cursor = decodeCursor(query.cursor);
        if (!cursor) {
          return { ok: false, code: 'INVALID_REQUEST', message: 'cursor is invalid' };
        }
        filtered = filtered.filter((r) => afterCursor(r, cursor));
      }

      filtered.sort(compareDesc);
      const page = filtered.slice(0, query.limit);
      const hasMore = filtered.length > query.limit;
      const events = page.map(sanitizeDomainEvent);
      for (const ev of events) {
        const leaks = assertNoSensitiveLeak(ev);
        if (leaks.length) {
          return {
            ok: false,
            code: 'INTERNAL_ERROR',
            message: 'response redaction failed',
            details: { paths: leaks }
          };
        }
      }
      const next =
        hasMore && page.length
          ? encodeCursor({ occurred_at: page[page.length - 1].occurred_at, event_id: page[page.length - 1].event_id })
          : null;
      return { ok: true, events, next_cursor: next, limit: query.limit };
    }
  };
}

export function createUnavailableEventStoreQuery(reason = 'event store query unavailable'): EventStoreQueryPort {
  return {
    async listEvents() {
      return { ok: false, code: 'INTERNAL_ERROR', message: reason };
    }
  };
}

export function createSupabaseEventStoreQuery(client: SupabaseClient): EventStoreQueryPort {
  return {
    async listEvents(query) {
      try {
        let q = client
          .from('api_domain_events')
          .select(
            [
              'event_id',
              'occurred_at',
              'created_at',
              'request_id',
              'organization_id',
              'condominium_id',
              'client_id',
              'correlation_id',
              'operation',
              'event_type',
              'status',
              'source',
              'classification',
              'http_status',
              'error_code',
              'retry_class',
              'core_executed',
              'duration_ms',
              'external_ref',
              'confirmation_id'
            ].join(',')
          )
          .eq('organization_id', query.organization_id)
          .eq('condominium_id', query.condominium_id);

        if (query.event_type) q = q.eq('event_type', query.event_type);
        if (query.operation) q = q.eq('operation', query.operation);
        if (query.status) q = q.eq('status', query.status);
        if (query.request_id) q = q.eq('request_id', query.request_id);
        // from inclusive, to inclusive on occurred_at
        if (query.from) q = q.gte('occurred_at', query.from);
        if (query.to) q = q.lte('occurred_at', query.to);

        if (query.cursor) {
          const cursor = decodeCursor(query.cursor);
          if (!cursor) {
            return { ok: false, code: 'INVALID_REQUEST', message: 'cursor is invalid' };
          }
          // keyset: (occurred_at, event_id) DESC — quote ISO timestamps for PostgREST
          const oa = cursor.occurred_at.replace(/"/g, '');
          const eid = cursor.event_id.replace(/"/g, '');
          q = q.or(
            `occurred_at.lt."${oa}",and(occurred_at.eq."${oa}",event_id.lt."${eid}")`
          );
        }

        q = q
          .order('occurred_at', { ascending: false })
          .order('event_id', { ascending: false })
          .limit(query.limit + 1);

        const { data, error } = await q;
        if (error) {
          return {
            ok: false,
            code: 'INTERNAL_ERROR',
            message: 'failed to query event store'
          };
        }

        const rows = (data || []) as unknown as EventStoreRow[];
        const hasMore = rows.length > query.limit;
        const page = hasMore ? rows.slice(0, query.limit) : rows;
        const events = page.map(sanitizeDomainEvent);
        for (const ev of events) {
          const leaks = assertNoSensitiveLeak(ev);
          if (leaks.length) {
            return {
              ok: false,
              code: 'INTERNAL_ERROR',
              message: 'response redaction failed'
            };
          }
        }
        const next =
          hasMore && page.length
            ? encodeCursor({
                occurred_at: page[page.length - 1].occurred_at,
                event_id: page[page.length - 1].event_id
              })
            : null;
        return { ok: true, events, next_cursor: next, limit: query.limit };
      } catch {
        return { ok: false, code: 'INTERNAL_ERROR', message: 'failed to query event store' };
      }
    }
  };
}

export type { PersistableEventType };
