/**
 * In-memory CorePersistence for G5/G7-C tests — NOT production.
 */

import type { Boleto, Occurrence, Package, Resident } from '../../../../types';
import type { CorePersistence } from '../../../../sentinela/core';

export type MemoryReservation = {
  id: string;
  areaId: string;
  residentId: string;
  residentName?: string;
  unit: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
};

export type MemoryCatalog = {
  residents: Resident[];
  boletos: Boleto[];
  packages: Package[];
  occurrences: Occurrence[];
  reservations: MemoryReservation[];
};

export function createMemoryCorePersistence(seed?: Partial<MemoryCatalog>): {
  persistence: CorePersistence;
  catalog: MemoryCatalog;
} {
  const catalog: MemoryCatalog = {
    residents: seed?.residents ? [...seed.residents] : [],
    boletos: seed?.boletos ? [...seed.boletos] : [],
    packages: seed?.packages ? [...seed.packages] : [],
    occurrences: seed?.occurrences ? [...seed.occurrences] : [],
    reservations: seed?.reservations ? [...seed.reservations] : []
  };

  let seq = 0;

  const persistence: CorePersistence = {
    async savePackage(pkg) {
      const id = pkg.id?.startsWith('temp-') ? `pkg_${Date.now()}_${++seq}` : pkg.id;
      const saved = { ...pkg, id };
      catalog.packages.push(saved);
      return { success: true, id };
    },
    async updatePackage(pkg) {
      const idx = catalog.packages.findIndex((p) => p.id === pkg.id);
      if (idx < 0) return { success: false, error: 'not found' };
      catalog.packages[idx] = { ...pkg };
      return { success: true };
    },
    async getPackageById(id) {
      return catalog.packages.find((p) => p.id === id) ?? null;
    },
    async saveOccurrence(occurrence) {
      const id = occurrence.id?.startsWith('temp-') ? `occ_${Date.now()}_${++seq}` : occurrence.id;
      const saved = { ...occurrence, id };
      catalog.occurrences.push(saved);
      return { success: true, id };
    },
    async updateOccurrence(occurrence) {
      const idx = catalog.occurrences.findIndex((o) => o.id === occurrence.id);
      if (idx < 0) return { success: false, error: 'not found' };
      catalog.occurrences[idx] = { ...occurrence };
      return { success: true };
    },
    async saveReservation(r) {
      const id = `res_${Date.now()}_${++seq}`;
      catalog.reservations.push({
        id,
        areaId: r.areaId,
        residentId: r.residentId,
        residentName: r.residentName,
        unit: r.unit,
        date: r.date,
        startTime: r.startTime,
        endTime: r.endTime,
        status: r.status ?? 'scheduled'
      });
      return { success: true, id };
    },
    async listReservationSlots(query) {
      return catalog.reservations
        .filter((r) => {
          if (r.areaId !== query.areaId) return false;
          if (String(r.date).slice(0, 10) !== String(query.date).slice(0, 10)) return false;
          const st = String(r.status || '').toLowerCase();
          if (st === 'canceled' || st === 'cancelled' || st === 'cancelada' || st === 'cancelado') {
            return false;
          }
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
    async deleteReservation(id) {
      const before = catalog.reservations.length;
      catalog.reservations = catalog.reservations.filter((r) => r.id !== id);
      if (catalog.reservations.length === before) {
        return { success: false, error: 'reservation not found' };
      }
      return { success: true };
    },
    async getBoletos() {
      return { data: [...catalog.boletos] };
    },
    async createNotification() {
      return { success: true, id: `ntf_${Date.now()}` };
    }
  };

  return { persistence, catalog };
}
