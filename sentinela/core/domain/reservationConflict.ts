/**
 * Reservation time-conflict rule extracted from App.tsx hasTimeConflict.
 * Half-open intervals [start, end). Same area + date.
 * G7-C: server loads slots via persistence.listReservationSlots (not client existingSlots).
 * LIMITATION: without Postgres exclusion constraint, concurrent check-then-insert can race.
 */

export interface ReservationSlot {
  areaIdOrName: string;
  date: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

function toMins(t: string): number {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** True when [aStart,aEnd) overlaps [bStart,bEnd). */
export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = toMins(aStart);
  const ae = toMins(aEnd);
  const bs = toMins(bStart);
  const be = toMins(bEnd);
  return as < be && ae > bs;
}

/**
 * Same semantics as App.tsx hasTimeConflict for a candidate vs existing list.
 * `matchArea` / `matchDate` allow callers to normalize display formats.
 */
export function hasReservationConflict(
  candidate: ReservationSlot,
  existing: ReservationSlot[],
  opts?: { excludeId?: string; idOf?: (r: ReservationSlot & { id?: string }) => string | undefined }
): boolean {
  return existing.some((r) => {
    if (opts?.excludeId && opts.idOf) {
      const id = opts.idOf(r as ReservationSlot & { id?: string });
      if (id && id === opts.excludeId) return false;
    }
    if (r.areaIdOrName !== candidate.areaIdOrName) return false;
    if (r.date !== candidate.date) return false;
    return timesOverlap(candidate.startTime, candidate.endTime, r.startTime, r.endTime);
  });
}
