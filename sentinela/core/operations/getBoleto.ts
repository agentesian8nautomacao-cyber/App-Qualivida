import type { Boleto } from '../../../types';
import type { OperationContext, OperationResult } from '../types';
import { fail, ok } from '../types';
import { tenantWarnings } from '../context';
import { getDefaultPersistence, type BoletoPersistence, type NotificationPersistence } from '../adapters/persistence';

export interface GetBoletoInput {
  boletoId?: string;
  residentId?: string;
  unit?: string;
  /** When omitted, loads via adapter getBoletos */
  boletos?: Boleto[];
}

export interface GetBoletoData {
  boletos: Boleto[];
}

/**
 * get_boleto — query facade over existing getBoletos / filters.
 */
export async function getBoleto(
  input: GetBoletoInput,
  ctx: OperationContext,
  persistence?: BoletoPersistence
): Promise<OperationResult<GetBoletoData>> {
  const warnings = tenantWarnings(ctx);
  let list = input.boletos;

  if (!list) {
    const store = persistence ?? (await getDefaultPersistence());
    const res = await store.getBoletos();
    if (res.error && (!res.data || res.data.length === 0)) {
      return fail('OPERATIONAL_ERROR', res.error);
    }
    list = res.data ?? [];
  }

  let filtered = list;
  if (input.boletoId) {
    filtered = filtered.filter((b) => b.id === input.boletoId);
    if (filtered.length === 0) {
      return fail('NOT_FOUND', 'Boleto não encontrado.', { boletoId: input.boletoId });
    }
  }
  if (input.residentId) {
    filtered = filtered.filter((b) => b.resident_id === input.residentId);
  }
  if (input.unit) {
    filtered = filtered.filter((b) => b.unit === input.unit);
  }

  // Server/API channel: never return an unscoped global dump
  if (
    ctx.channel === 'system' &&
    !input.boletoId &&
    !input.residentId &&
    !input.unit
  ) {
    return fail(
      'VALIDATION_ERROR',
      'get_boleto requer boletoId, residentId ou unit no canal system.'
    );
  }

  // Strip internal storage metadata from API/system responses
  const sanitized =
    ctx.channel === 'system'
      ? filtered.map((b) => {
          const { pdf_original_path: _p, checksum_pdf: _c, ...rest } = b;
          return rest as Boleto;
        })
      : filtered;

  return ok({ boletos: sanitized }, { warnings });
}

export interface NotifyResidentInput {
  residentId: string;
  title: string;
  message: string;
  type?: 'package' | 'visitor' | 'occurrence' | 'other';
  relatedId?: string;
  imageUrl?: string | null;
}

/**
 * notify_resident — inbox via existing createNotification.
 * WhatsApp channel NOT implemented (intent only in result.notifications).
 */
export async function notifyResident(
  input: NotifyResidentInput,
  ctx: OperationContext,
  persistence?: NotificationPersistence
): Promise<OperationResult<{ notificationId?: string }>> {
  const warnings = [...tenantWarnings(ctx), 'WHATSAPP_CHANNEL_NOT_IMPLEMENTED'];

  if (!input.residentId || !input.title || !input.message) {
    return fail('VALIDATION_ERROR', 'residentId, title e message são obrigatórios.');
  }

  const store = persistence ?? (await getDefaultPersistence());
  const result = await store.createNotification(
    input.residentId,
    input.title,
    input.message,
    input.type ?? 'other',
    input.relatedId,
    input.imageUrl
  );

  if (!result.success) {
    return fail('OPERATIONAL_ERROR', result.error || 'Erro ao criar notificação.');
  }

  return ok(
    { notificationId: result.id },
    {
      warnings,
      notifications: [
        {
          channel: 'inbox',
          residentId: input.residentId,
          title: input.title,
          message: input.message,
          relatedType: input.type,
          relatedId: input.relatedId
        },
        {
          channel: 'whatsapp_future',
          residentId: input.residentId,
          title: input.title,
          message: input.message,
          relatedType: input.type,
          relatedId: input.relatedId
        }
      ]
    }
  );
}
