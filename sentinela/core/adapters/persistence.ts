/**
 * Persistence ports for Operational Core.
 * Default adapter wraps existing dataService / notificationService.
 */

import type { Boleto, Occurrence, Package, Resident } from '../../../types';
import { isReservationCanceledStatus } from '../domain/reservationTime';

export interface PackagePersistence {
  savePackage(pkg: Package): Promise<{ success: boolean; error?: string; id?: string }>;
  updatePackage(pkg: Package, deliveredBy?: string | null): Promise<{ success: boolean; error?: string }>;
  getPackageById?(id: string): Promise<Package | null>;
}

export interface OccurrencePersistence {
  saveOccurrence(occurrence: Occurrence): Promise<{ success: boolean; error?: string; id?: string }>;
  updateOccurrence(occurrence: Occurrence): Promise<{ success: boolean; error?: string }>;
}

export interface ReservationPersistence {
  saveReservation(r: {
    areaId: string;
    residentId: string;
    residentName: string;
    unit: string;
    date: string;
    startTime: string;
    endTime: string;
    status?: string;
  }): Promise<{
    success: boolean;
    error?: string;
    /** Adapter-level code (e.g. EXCLUSION_VIOLATION / 23P01) — never raw SQL to clients */
    errorCode?: string;
    id?: string;
  }>;
  deleteReservation(id: string): Promise<{ success: boolean; error?: string }>;
  /**
   * Server-authoritative slots for conflict check (G7-C).
   * When present, Core MUST use this instead of client-supplied existingSlots.
   */
  listReservationSlots?(query: {
    areaId: string;
    date: string;
  }): Promise<
    Array<{
      id?: string;
      areaIdOrName: string;
      date: string;
      startTime: string;
      endTime: string;
      status?: string;
    }>
  >;
}

export interface BoletoPersistence {
  getBoletos(options?: { onRemoteUpdate?: (rows: Boleto[]) => void }): Promise<{ data: Boleto[]; error?: string }>;
}

export interface NotificationPersistence {
  createNotification(
    moradorId: string,
    title: string,
    message: string,
    type?: 'package' | 'visitor' | 'occurrence' | 'other',
    relatedId?: string,
    imageUrl?: string | null
  ): Promise<{ success: boolean; error?: string; id?: string }>;
}

export interface CorePersistence
  extends PackagePersistence,
    OccurrencePersistence,
    ReservationPersistence,
    BoletoPersistence,
    NotificationPersistence {}

let defaultPersistence: CorePersistence | null = null;

export function setCorePersistenceForTests(p: CorePersistence | null): void {
  defaultPersistence = p;
}

export async function getDefaultPersistence(): Promise<CorePersistence> {
  if (defaultPersistence) return defaultPersistence;
  const dataService = await import('../../../services/dataService');
  const notificationService = await import('../../../services/notificationService');
  return {
    savePackage: dataService.savePackage,
    updatePackage: dataService.updatePackage,
    saveOccurrence: dataService.saveOccurrence,
    updateOccurrence: dataService.updateOccurrence,
    saveReservation: dataService.saveReservation,
    deleteReservation: dataService.deleteReservation,
    async listReservationSlots(query) {
      const res = await dataService.getReservations();
      const rows = res.data || [];
      return rows
        .filter((r) => {
          if (r.areaId !== query.areaId) return false;
          if (String(r.date).slice(0, 10) !== String(query.date).slice(0, 10)) return false;
          if (isReservationCanceledStatus(r.status)) return false;
          return true;
        })
        .map((r) => ({
          id: r.id,
          areaIdOrName: r.areaId,
          date: String(r.date).slice(0, 10),
          startTime: String(r.startTime).slice(0, 5),
          endTime: String(r.endTime).slice(0, 5),
          status: r.status
        }));
    },
    getBoletos: dataService.getBoletos,
    createNotification: notificationService.createNotification
  };
}
