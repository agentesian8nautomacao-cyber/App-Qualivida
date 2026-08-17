/**
 * G7-C — Residents catalog for identify_* / create_package (server).
 * Bound to service-role client. Row-level condo filter = M5 residual (no org/condo on residents yet).
 */

import type { Resident } from '../../../../types';
import type { PersistenceDbClient } from '../execution/supabasePersistence';
import type { ResidentsProvider } from '../execution/executeCore';

function mapResidentRow(row: Record<string, unknown>): Resident {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    unit: String(row.unit ?? ''),
    email: String(row.email ?? ''),
    phone: String(row.phone ?? ''),
    whatsapp: String(row.whatsapp ?? row.phone ?? '')
  };
}

export function createSupabaseResidentsProvider(client: PersistenceDbClient): ResidentsProvider {
  return {
    async listResidents(): Promise<Resident[]> {
      const { data, error } = await client
        .from('residents')
        .select('id, name, unit, email, phone, whatsapp')
        .limit(5000);
      if (error || !data) return [];
      return (data as Record<string, unknown>[]).map(mapResidentRow);
    }
  };
}
