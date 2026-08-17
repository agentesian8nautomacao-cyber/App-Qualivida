import type { OperationContext, OperationResult } from '../types';
import { fail, makeEvent, ok } from '../types';
import { tenantWarnings } from '../context';
import { publishDomainEvents } from '../domain/events';
import { hasReservationConflict, type ReservationSlot } from '../domain/reservationConflict';
import {
  isExclusionViolationError,
  isReservationCanceledStatus,
  validateReservationTimeRange
} from '../domain/reservationTime';
import { getDefaultPersistence, type ReservationPersistence } from '../adapters/persistence';

export interface CreateReservationInput {
  areaId: string;
  areaName?: string;
  residentId: string;
  residentName: string;
  unit: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
  /**
   * @deprecated Client-supplied slots are IGNORED when persistence.listReservationSlots exists (G7-C).
   * Kept for backward compatibility with older panel callers that lack server list.
   */
  existingSlots?: ReservationSlot[];
  /** When true (default), reject on conflict. */
  enforceConflictCheck?: boolean;
}

export interface CreateReservationData {
  id: string;
}

/**
 * create_reservation — conflict rule = App/Core timesOverlap (half-open [start,end)).
 * G7-C/G7-D: server listReservationSlots is source of truth; PG exclusion is final authority.
 * Empty/inverted ranges rejected as INVALID_TIME_RANGE before persistence.
 */
export async function createReservation(
  input: CreateReservationInput,
  ctx: OperationContext,
  persistence?: ReservationPersistence
): Promise<OperationResult<CreateReservationData>> {
  const warnings = [...tenantWarnings(ctx)];

  if (!input.areaId || !input.residentId || !input.residentName || !input.unit || !input.date) {
    return fail('VALIDATION_ERROR', 'Dados obrigatórios da reserva ausentes.');
  }
  if (!input.startTime || !input.endTime) {
    return fail('VALIDATION_ERROR', 'Horário de início e fim são obrigatórios.');
  }

  const range = validateReservationTimeRange(input.startTime, input.endTime);
  if (!range.ok) {
    return fail('INVALID_TIME_RANGE', range.message, range.details);
  }

  const store = persistence ?? (await getDefaultPersistence());
  const enforce = input.enforceConflictCheck !== false;

  let slots: ReservationSlot[] = [];
  let conflictSource: 'server' | 'client_legacy' | 'none' = 'none';

  if (typeof store.listReservationSlots === 'function') {
    const rows = await store.listReservationSlots({
      areaId: input.areaId,
      date: input.date
    });
    slots = (rows || [])
      .filter((r) => !isReservationCanceledStatus(r.status))
      .map((r) => ({
        areaIdOrName: r.areaIdOrName || input.areaId,
        date: String(r.date).slice(0, 10),
        startTime: String(r.startTime).slice(0, 5),
        endTime: String(r.endTime).slice(0, 5)
      }));
    conflictSource = 'server';
  } else if (input.existingSlots && input.existingSlots.length >= 0) {
    slots = input.existingSlots;
    conflictSource = 'client_legacy';
    warnings.push('RESERVATION_CONFLICT_CLIENT_ONLY');
  }

  if (enforce && conflictSource !== 'none') {
    const candidateByAreaId: ReservationSlot = {
      areaIdOrName: input.areaId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime
    };
    const candidateByName: ReservationSlot = {
      areaIdOrName: input.areaName || input.areaId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime
    };
    const conflict =
      hasReservationConflict(candidateByAreaId, slots) ||
      hasReservationConflict(candidateByName, slots);
    if (conflict) {
      return fail('CONFLICT', 'Já existe reserva neste horário para a área selecionada.', {
        areaId: input.areaId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        reason: 'schedule_conflict',
        retry_hint: 'try_another_time_slot'
      });
    }
  }

  const result = await store.saveReservation({
    areaId: input.areaId,
    residentId: input.residentId,
    residentName: input.residentName,
    unit: input.unit,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    status: input.status ?? 'scheduled'
  });

  if (!result.success || !result.id) {
    if (isExclusionViolationError(result.error, result.errorCode)) {
      return fail('CONFLICT', 'Já existe reserva neste horário para a área selecionada.', {
        areaId: input.areaId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        reason: 'schedule_conflict',
        source: 'database_exclusion',
        retry_hint: 'try_another_time_slot'
      });
    }
    return fail('OPERATIONAL_ERROR', result.error || 'Erro ao salvar reserva.');
  }

  const events = [
    makeEvent('reservation.created', ctx, {
      reservationId: result.id,
      areaId: input.areaId,
      residentId: input.residentId,
      channel: ctx.channel,
      conflictSource
    })
  ];
  publishDomainEvents(events);

  return ok({ id: result.id }, { events, warnings });
}

export interface CancelReservationInput {
  reservationId: string;
}

/**
 * cancel_reservation — current behavior = deleteReservation (no soft-cancel status).
 * Domain event type kept as reservation.cancelled (event name); DB status spelling = canceled.
 */
export async function cancelReservation(
  input: CancelReservationInput,
  ctx: OperationContext,
  persistence?: ReservationPersistence
): Promise<OperationResult<{ id: string }>> {
  const warnings = tenantWarnings(ctx);
  if (!input.reservationId) {
    return fail('VALIDATION_ERROR', 'ID da reserva obrigatório.');
  }

  const store = persistence ?? (await getDefaultPersistence());
  const result = await store.deleteReservation(input.reservationId);
  if (!result.success) {
    const msg = result.error || 'Erro ao cancelar reserva.';
    if (/not found/i.test(msg)) {
      return fail('NOT_FOUND', 'Reserva não encontrada.', { reservationId: input.reservationId });
    }
    return fail('OPERATIONAL_ERROR', msg);
  }

  const events = [
    makeEvent('reservation.cancelled', ctx, {
      reservationId: input.reservationId,
      channel: ctx.channel
    })
  ];
  publishDomainEvents(events);

  return ok({ id: input.reservationId }, { events, warnings });
}
