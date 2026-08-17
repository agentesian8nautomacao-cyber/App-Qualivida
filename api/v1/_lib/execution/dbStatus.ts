/**
 * Pure DB status mappers for server adapter (no dataService / browser imports).
 */

import type { Occurrence, Package } from '../../../../types';

export type DbPackageStatus = 'pendente' | 'recebida';
export type DbOccurrenceStatus = 'aberta' | 'em_andamento' | 'resolvida';

export function toDbPackageStatus(status: unknown): DbPackageStatus {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === 'recebida' || raw === 'entregue' || raw === 'e') return 'recebida';
  return 'pendente';
}

export function fromDbPackageStatus(status: unknown): Package['status'] {
  return toDbPackageStatus(status);
}

export function toDbOccurrenceStatus(
  status: Occurrence['status'] | string | null | undefined
): DbOccurrenceStatus {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === 'aberto' || raw === 'aberta') return 'aberta';
  if (raw.includes('andamento') || raw.replace(/\s+/g, '_') === 'em_andamento') {
    return 'em_andamento';
  }
  if (raw === 'resolvido' || raw === 'resolvida') return 'resolvida';
  return 'aberta';
}

export function fromDbOccurrenceStatus(status: string | null | undefined): Occurrence['status'] {
  const raw = String(status ?? '').trim().toLowerCase();
  if (raw === 'aberta' || raw === 'aberto') return 'Aberto';
  if (raw === 'em_andamento' || raw.includes('andamento')) return 'Em Andamento';
  if (raw === 'resolvida' || raw === 'resolvido') return 'Resolvido';
  return 'Aberto';
}

export function newEntityId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
