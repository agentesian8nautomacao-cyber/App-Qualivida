/**
 * G7-H-A — Production observability runtime (in-process sink).
 * G7-J-W — Optional persistent Event Store (fail-safe, best-effort).
 * Fail-safe: emit / persist failures never throw to callers.
 */

import { buildOperationalEvent, type BuildEventInput, type EmitSink } from './emit';
import type { OperationalEventEnvelope, OperationalEventName } from './types';
import { assertNoSensitiveLeak } from './redact';
import { queuePersistentPersist, resetPersistentEventPersister } from './persistentEventStore';

function createConsoleEventSink(): EmitSink {
  const ring: OperationalEventEnvelope[] = [];
  const MAX = 200;
  return {
    emit(event) {
      ring.push(event);
      if (ring.length > MAX) ring.shift();
      console.info('[sentinela-obs]', JSON.stringify(event));
    },
    list() {
      return [...ring];
    },
    clear() {
      ring.length = 0;
    }
  };
}

let activeSink: EmitSink = createConsoleEventSink();

/** Dedup per request_id (re-entrant protect/authz on sensitive path). */
const onceByRequest = new Map<string, Set<string>>();

export function clearObservabilityOnce(requestId?: string): void {
  if (requestId) onceByRequest.delete(requestId);
  else onceByRequest.clear();
}

/** Tests may replace sink; production uses console ring buffer. */
export function setObservabilitySink(sink: EmitSink | null): void {
  activeSink = sink ?? createConsoleEventSink();
  if (!sink) clearObservabilityOnce();
}

export function getObservabilitySink(): EmitSink {
  return activeSink;
}

export function resetObservabilitySink(): void {
  activeSink = createConsoleEventSink();
  clearObservabilityOnce();
  resetPersistentEventPersister();
}

/**
 * Emit one event. Never throws.
 * Local sink always; persistent Event Store is best-effort (G7-J-W) and never
 * affects business outcome.
 */
export function safeEmit(input: BuildEventInput): OperationalEventEnvelope | null {
  try {
    const event = buildOperationalEvent(input);
    const leaks = assertNoSensitiveLeak(event);
    if (leaks.length) {
      console.error('[sentinela-obs] blocked leak paths', input.request_id, leaks.join(','));
      return null;
    }
    activeSink.emit(event);
    queuePersistentPersist(event);
    return event;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sentinela-obs] sink failure (non-fatal)', input.request_id, msg);
    return null;
  }
}

/** Emit at most once per (request_id, event_name) — safe for re-entrant handlers. */
export function safeEmitOnce(
  input: BuildEventInput & { event_name: OperationalEventName }
): OperationalEventEnvelope | null {
  try {
    let set = onceByRequest.get(input.request_id);
    if (!set) {
      set = new Set();
      onceByRequest.set(input.request_id, set);
    }
    if (set.has(input.event_name)) return null;
    set.add(input.event_name);
    return safeEmit(input);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sentinela-obs] sink failure (non-fatal)', input.request_id, msg);
    return null;
  }
}
