/**
 * In-memory domain event bus (no persistence / no new tables).
 * Prepared for future Event Store / n8n consumers.
 */

import type { DomainEvent } from '../types';

type Listener = (event: DomainEvent) => void;

const listeners: Listener[] = [];
const recent: DomainEvent[] = [];
const MAX_RECENT = 200;

export function publishDomainEvents(events: DomainEvent[]): void {
  for (const e of events) {
    recent.push(e);
    if (recent.length > MAX_RECENT) recent.shift();
    for (const l of listeners) {
      try {
        l(e);
      } catch {
        /* never break operations on listener failure */
      }
    }
  }
}

export function subscribeDomainEvents(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const i = listeners.indexOf(listener);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function getRecentDomainEvents(): readonly DomainEvent[] {
  return recent;
}

export function clearRecentDomainEventsForTests(): void {
  recent.length = 0;
}
