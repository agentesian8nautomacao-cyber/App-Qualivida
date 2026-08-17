import type { Package, Resident } from '../../../types';
import type { OperationContext, OperationResult } from '../types';
import { fail, makeEvent, ok } from '../types';
import { tenantWarnings } from '../context';
import { publishDomainEvents } from '../domain/events';
import { getDefaultPersistence, type PackagePersistence } from '../adapters/persistence';

export interface PickupPackageInput {
  packageId: string;
  /** Current package snapshot from UI/cache (required — Core does not scan DB in this stage). */
  package: Package;
  deliveredBy?: string | null;
  /** When actor is MORADOR, enforce ownership */
  actorIsResident?: boolean;
  currentResident?: Resident | null;
}

export interface PickupPackageData {
  package: Package;
}

/**
 * pickup_package — preserves App.tsx handleDeliverPackage rules + updatePackage persistence.
 */
export async function pickupPackage(
  input: PickupPackageInput,
  ctx: OperationContext,
  persistence?: PackagePersistence
): Promise<OperationResult<PickupPackageData>> {
  const warnings = tenantWarnings(ctx);
  const pkg = input.package;

  if (!input.packageId || !pkg) {
    return fail('VALIDATION_ERROR', 'Encomenda obrigatória para retirada.');
  }
  if (pkg.id !== input.packageId) {
    return fail('VALIDATION_ERROR', 'packageId não corresponde ao objeto informado.');
  }

  if (String(pkg.status).toLowerCase() === 'recebida' || String(pkg.status).toLowerCase() === 'entregue') {
    return fail('DUPLICATE', 'Encomenda já foi marcada como recebida.', { packageId: pkg.id });
  }

  if (input.actorIsResident && input.currentResident) {
    const sameRecipient = pkg.recipientId ? pkg.recipientId === input.currentResident.id : false;
    const sameUnitLegacy = pkg.unit === input.currentResident.unit;
    if (!sameRecipient && !sameUnitLegacy) {
      return fail('AUTHORIZATION_ERROR', 'Você só pode dar baixa em encomendas da sua unidade/conta.');
    }
  }

  const updatedPkg: Package = {
    ...pkg,
    status: 'recebida',
    receiptAt: new Date().toISOString()
  };

  const store = persistence ?? (await getDefaultPersistence());
  const result = await store.updatePackage(updatedPkg, input.deliveredBy ?? null);
  if (!result.success) {
    return fail('OPERATIONAL_ERROR', result.error || 'Erro ao marcar encomenda como recebida.');
  }

  const events = [
    makeEvent('package.picked_up', ctx, {
      packageId: pkg.id,
      deliveredBy: input.deliveredBy ?? null,
      channel: ctx.channel
    })
  ];
  publishDomainEvents(events);

  return ok({ package: updatedPkg }, { events, warnings });
}
