import type { Occurrence, Resident } from '../../../types';
import type { OperationContext, OperationResult } from '../types';
import { fail, makeEvent, ok } from '../types';
import { tenantWarnings } from '../context';
import { publishDomainEvents } from '../domain/events';
import { identifyResident } from './identifyResident';
import { getDefaultPersistence, type OccurrencePersistence } from '../adapters/persistence';

export interface CreateOccurrenceInput {
  description: string;
  residentName?: string | null;
  unit?: string | null;
  residentId?: string | null;
  status?: Occurrence['status'];
  reportedBy?: string | null;
  imageUrl?: string | null;
  residents?: Resident[];
}

export interface CreateOccurrenceData {
  id: string;
  occurrence: Occurrence;
}

export async function createOccurrence(
  input: CreateOccurrenceInput,
  ctx: OperationContext,
  persistence?: OccurrencePersistence
): Promise<OperationResult<CreateOccurrenceData>> {
  const warnings = tenantWarnings(ctx);
  const description = (input.description ?? '').trim();
  if (!description) {
    return fail('VALIDATION_ERROR', 'Descrição da ocorrência é obrigatória.');
  }

  let residentName = (input.residentName ?? '').trim() || 'Condomínio';
  let unit = (input.unit ?? '').trim() || '—';
  let residentId = input.residentId ?? undefined;

  if (input.residents?.length) {
    const idRes = identifyResident(
      {
        residentId,
        name: input.residentName,
        unit: input.unit,
        residents: input.residents
      },
      ctx
    );
    if (idRes.success && idRes.data.resident) {
      residentId = idRes.data.resident.id;
      residentName = idRes.data.resident.name;
      unit = idRes.data.resident.unit;
    } else if (idRes.success && idRes.data.ambiguous) {
      return fail('CLARIFICATION_REQUIRED', 'Mais de um morador corresponde aos dados informados.');
    }
  }

  const occurrence: Occurrence = {
    id: `temp-${Date.now()}`,
    residentName,
    unit,
    description,
    status: input.status ?? 'Aberto',
    date: new Date().toISOString(),
    reportedBy: input.reportedBy ?? ctx.actorDisplayName ?? 'Sistema',
    residentId,
    imageUrl: input.imageUrl ?? undefined
  };

  const store = persistence ?? (await getDefaultPersistence());
  const result = await store.saveOccurrence(occurrence);
  if (!result.success || !result.id) {
    return fail('OPERATIONAL_ERROR', result.error || 'Erro ao salvar ocorrência.');
  }

  const saved = { ...occurrence, id: result.id };
  const events = [
    makeEvent('occurrence.created', ctx, {
      occurrenceId: result.id,
      residentId: residentId ?? null,
      channel: ctx.channel
    })
  ];
  publishDomainEvents(events);

  return ok({ id: result.id, occurrence: saved }, { events, warnings });
}

export interface UpdateOccurrenceInput {
  occurrence: Occurrence;
}

export async function updateOccurrence(
  input: UpdateOccurrenceInput,
  ctx: OperationContext,
  persistence?: OccurrencePersistence
): Promise<OperationResult<{ occurrence: Occurrence }>> {
  const warnings = tenantWarnings(ctx);
  if (!input.occurrence?.id) {
    return fail('VALIDATION_ERROR', 'Ocorrência inválida.');
  }

  const store = persistence ?? (await getDefaultPersistence());
  const result = await store.updateOccurrence(input.occurrence);
  if (!result.success) {
    return fail('OPERATIONAL_ERROR', result.error || 'Erro ao atualizar ocorrência.');
  }

  const events = [
    makeEvent('occurrence.updated', ctx, {
      occurrenceId: input.occurrence.id,
      status: input.occurrence.status,
      channel: ctx.channel
    })
  ];
  publishDomainEvents(events);

  return ok({ occurrence: input.occurrence }, { events, warnings });
}
