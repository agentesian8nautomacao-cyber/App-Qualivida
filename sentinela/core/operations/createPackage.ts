import type { Package, PackageItem, Resident } from '../../../types';
import type { OperationContext, OperationResult } from '../types';
import { fail, makeEvent, ok } from '../types';
import { tenantWarnings } from '../context';
import { publishDomainEvents } from '../domain/events';
import { identifyResident } from './identifyResident';
import { getDefaultPersistence, type PackagePersistence } from '../adapters/persistence';

export interface CreatePackageInput {
  recipient?: string | null;
  unit?: string | null;
  recipientId?: string | null;
  type?: string | null;
  items?: PackageItem[];
  residentPhone?: string | null;
  imageUrl?: string | null;
  qrCodeData?: string | null;
  receivedByName?: string | null;
  status?: 'pendente' | 'recebida';
  deadlineMinutes?: number;
  /** Catalog for identify_resident enrichment */
  residents?: Resident[];
}

export interface CreatePackageData {
  id: string;
  package: Package;
  resolvedResidentId: string | null;
}

/**
 * create_package — single domain entry for panel / voice / photo / QR / import.
 * Persistence delegated to existing savePackage (notifications inbox preserved there).
 */
export async function createPackage(
  input: CreatePackageInput,
  ctx: OperationContext,
  persistence?: PackagePersistence
): Promise<OperationResult<CreatePackageData>> {
  const warnings = tenantWarnings(ctx);
  const type = (input.type ?? '').trim() || 'Encomenda';
  let recipient = (input.recipient ?? '').trim();
  let unit = (input.unit ?? '').trim();
  let recipientId = input.recipientId ?? null;

  if (input.residents && input.residents.length > 0) {
    const idRes = identifyResident(
      {
        residentId: recipientId,
        name: recipient || null,
        unit: unit || null,
        phone: input.residentPhone,
        residents: input.residents
      },
      ctx
    );
    if (idRes.success && idRes.data.resident) {
      recipientId = idRes.data.resident.id;
      recipient = idRes.data.resident.name;
      unit = idRes.data.resident.unit;
    } else if (idRes.success && idRes.data.ambiguous) {
      return fail('CLARIFICATION_REQUIRED', 'Mais de um morador corresponde aos dados informados.', {
        candidates: idRes.data.candidates.map((c) => ({ id: c.id, name: c.name, unit: c.unit }))
      });
    }
  }

  if (!recipient || !unit) {
    return fail('VALIDATION_ERROR', 'Destinatário e unidade são obrigatórios para registrar encomenda.');
  }

  const pkg: Package = {
    id: `temp-${Date.now()}`,
    recipient,
    unit,
    type,
    receivedAt: new Date().toISOString(),
    displayTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    status: input.status ?? 'pendente',
    deadlineMinutes: input.deadlineMinutes ?? 45,
    residentPhone: input.residentPhone ?? undefined,
    items: (input.items ?? []).filter((it) => it.name?.trim()),
    recipientId: recipientId ?? undefined,
    imageUrl: input.imageUrl ?? null,
    qrCodeData: input.qrCodeData ?? null,
    receivedByName: input.receivedByName ?? ctx.actorDisplayName ?? undefined
  };

  const store = persistence ?? (await getDefaultPersistence());
  const result = await store.savePackage(pkg);
  if (!result.success || !result.id) {
    return fail('OPERATIONAL_ERROR', result.error || 'Erro ao salvar encomenda.');
  }

  const saved: Package = { ...pkg, id: result.id };
  const events = [
    makeEvent('package.created', ctx, {
      packageId: result.id,
      recipientId: recipientId,
      unit,
      channel: ctx.channel,
      hasImage: Boolean(input.imageUrl),
      hasQr: Boolean(input.qrCodeData)
    })
  ];
  publishDomainEvents(events);

  const notifications = recipientId
    ? [
        {
          channel: 'inbox' as const,
          residentId: recipientId,
          title: '📦 Nova encomenda na portaria',
          message: 'Encomenda registrada (notificação inbox via adapter existente).',
          relatedType: 'package',
          relatedId: result.id
        }
      ]
    : [];

  return ok(
    { id: result.id, package: saved, resolvedResidentId: recipientId },
    { events, notifications, warnings }
  );
}
