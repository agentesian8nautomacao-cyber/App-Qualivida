/**
 * Reservation time helpers (G7-D) — half-open [start,end) domain.
 * Official canceled status spelling = LIVE CHECK: "canceled".
 */

/** Official DB/Core status for soft-cancel (LIVE CHECK). */
export const RESERVATION_STATUS_CANCELED = 'canceled' as const;

/** Statuses that participate in conflict / exclusion. */
export const RESERVATION_ACTIVE_STATUSES = ['scheduled', 'active'] as const;

/**
 * True when status must be ignored for conflict (does not occupy the slot).
 * Official: canceled. Legacy aliases accepted for read filters only (no DB rewrite).
 */
export function isReservationCanceledStatus(status?: string | null): boolean {
  const st = String(status || '').toLowerCase().trim();
  return (
    st === RESERVATION_STATUS_CANCELED ||
    st === 'cancelled' || // legacy spelling — treat as canceled for filters
    st === 'cancelada' ||
    st === 'cancelado'
  );
}

export function parseTimeToMinutes(t: string): number | null {
  const m = String(t || '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

export type ReservationTimeRangeFail = {
  ok: false;
  code: 'INVALID_TIME_RANGE';
  message: string;
  details: { startTime: string; endTime: string; reason: 'empty' | 'inverted' | 'malformed' };
};

export type ReservationTimeRangeOk = { ok: true };

/**
 * Reject empty (start==end) and inverted (end<start) ranges before Core persistence.
 */
export function validateReservationTimeRange(
  startTime: string,
  endTime: string
): ReservationTimeRangeOk | ReservationTimeRangeFail {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start == null || end == null) {
    return {
      ok: false,
      code: 'INVALID_TIME_RANGE',
      message: 'Horário de início/fim inválido.',
      details: { startTime, endTime, reason: 'malformed' }
    };
  }
  if (start === end) {
    return {
      ok: false,
      code: 'INVALID_TIME_RANGE',
      message: 'Intervalo de reserva vazio: horário inicial e final são iguais.',
      details: { startTime, endTime, reason: 'empty' }
    };
  }
  if (end < start) {
    return {
      ok: false,
      code: 'INVALID_TIME_RANGE',
      message: 'Intervalo de reserva inválido: horário final anterior ao inicial.',
      details: { startTime, endTime, reason: 'inverted' }
    };
  }
  return { ok: true };
}

/** Detect Postgres exclusion_violation (23P01) from adapter/driver messages. */
export function isExclusionViolationError(
  error?: string | null,
  code?: string | null
): boolean {
  const c = String(code || '').toUpperCase();
  if (c === '23P01' || c === 'EXCLUSION_VIOLATION') return true;
  const msg = String(error || '').toLowerCase();
  return (
    msg.includes('23p01') ||
    msg.includes('exclusion_violation') ||
    msg.includes('exclusion constraint') ||
    msg.includes('reservations_area_date_slot_excl')
  );
}
