/**
 * G7-A — Supabase CorePersistence (server adapter).
 *
 * API → Core → this adapter → Postgres/Supabase
 *
 * - No browser storage / React / offline stack
 * - No silent in-memory store fallback
 * - Tenant (organization_id + condominium_id) required and immutable per instance
 * - Does NOT implement business rules (Core owns rules)
 *
 * Note (M5 residual): operational tables (packages/…) may lack org/condo columns.
 * Isolation today = fail-closed tenant binding at adapter construction + API boundary.
 * Row-level tenant filters land in a later migration gate.
 */

import type { Boleto, Occurrence, Package } from '../../../../types';
import type { CorePersistence } from '../../../../sentinela/core';
import {
  validateTenantBinding,
  type TenantDirectory
} from '../auth/tenant';
import {
  fromDbOccurrenceStatus,
  fromDbPackageStatus,
  newEntityId,
  toDbOccurrenceStatus,
  toDbPackageStatus
} from './dbStatus';

/** Minimal surface used by the adapter (real SupabaseClient satisfies this). */
export type PersistenceDbClient = {
  from: (table: string) => any;
};

export type SupabaseCorePersistenceOptions = {
  organizationId: string;
  condominiumId: string;
  client: PersistenceDbClient;
  /** When set, validates condo ∈ org (fail-closed). */
  tenantDirectory?: TenantDirectory;
};

export type SupabaseCorePersistenceOk = {
  ok: true;
  persistence: CorePersistence;
  organization_id: string;
  condominium_id: string;
};

export type SupabaseCorePersistenceFail = {
  ok: false;
  code: 'TENANT_REQUIRED' | 'TENANT_NOT_FOUND' | 'TENANT_MISMATCH' | 'CLIENT_REQUIRED';
  message: string;
};

export type CreateSupabaseCorePersistenceResult =
  | SupabaseCorePersistenceOk
  | SupabaseCorePersistenceFail;

function requireBoundTenant(
  organizationId: string,
  condominiumId: string
): { ok: true } | { ok: false; error: string } {
  if (!organizationId.trim() || !condominiumId.trim()) {
    return { ok: false, error: 'TENANT_REQUIRED: organization_id and condominium_id are required' };
  }
  return { ok: true };
}

function mapPackageRow(row: Record<string, unknown>, items: Package['items'] = []): Package {
  const receivedAt = String(row.received_at ?? new Date().toISOString());
  return {
    id: String(row.id),
    recipient: String(row.recipient_name ?? ''),
    unit: String(row.unit ?? ''),
    type: String(row.type ?? ''),
    receivedAt,
    displayTime: String(
      row.display_time ??
        new Date(receivedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    ),
    status: fromDbPackageStatus(row.status),
    deadlineMinutes: Number(row.deadline_minutes ?? 45),
    residentPhone: row.resident_phone ? String(row.resident_phone) : undefined,
    recipientId: row.recipient_id ? String(row.recipient_id) : undefined,
    imageUrl: (row.image_url as string | null | undefined) ?? null,
    qrCodeData: (row.qr_code_data as string | null | undefined) ?? null,
    receivedByName: (row.received_by_name as string | null | undefined) ?? null,
    receiptAt: (row.data_recebimento as string | null | undefined) ??
      (row.delivered_at as string | null | undefined) ??
      null,
    hiddenForResident: Boolean(row.oculta_para_morador),
    items
  };
}

function mapBoletoRow(b: Record<string, unknown>): Boleto {
  const toDateStr = (v: unknown) => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    return new Date(String(v)).toISOString().slice(0, 10);
  };
  const boletoType =
    b.boleto_type === 'agua' || b.boleto_type === 'luz' ? b.boleto_type : 'condominio';
  return {
    id: String(b.id),
    residentName: String(b.resident_name ?? ''),
    unit: String(b.unit ?? ''),
    referenceMonth: String(b.reference_month ?? ''),
    dueDate: toDateStr(b.due_date),
    amount: Number(b.amount ?? 0),
    status: b.status as Boleto['status'],
    boletoType: boletoType as Boleto['boletoType'],
    barcode: b.barcode ? String(b.barcode) : undefined,
    pdfUrl: b.pdf_url ? String(b.pdf_url) : undefined,
    paidDate: b.paid_date ? toDateStr(b.paid_date) : undefined,
    description: b.description ? String(b.description) : undefined,
    resident_id: b.resident_id ? String(b.resident_id) : undefined,
    pdf_original_path: b.pdf_original_path ? String(b.pdf_original_path) : undefined,
    checksum_pdf: b.checksum_pdf ? String(b.checksum_pdf) : undefined
  };
}

/**
 * Build a tenant-bound CorePersistence backed by Supabase/Postgres.
 * Fail-closed on missing tenant or missing client. Never returns an in-memory store.
 */
export async function createSupabaseCorePersistence(
  options: SupabaseCorePersistenceOptions
): Promise<CreateSupabaseCorePersistenceResult> {
  if (!options?.client) {
    return { ok: false, code: 'CLIENT_REQUIRED', message: 'Supabase client is required' };
  }

  const organizationId = String(options.organizationId || '').trim();
  const condominiumId = String(options.condominiumId || '').trim();
  if (!organizationId || !condominiumId) {
    return {
      ok: false,
      code: 'TENANT_REQUIRED',
      message: 'organization_id and condominium_id are required'
    };
  }

  if (options.tenantDirectory) {
    const binding = await validateTenantBinding(
      options.tenantDirectory,
      organizationId,
      condominiumId
    );
    if (!binding.ok) {
      return { ok: false, code: binding.code, message: binding.message };
    }
  }

  const client = options.client;
  const boundOrg = organizationId;
  const boundCondo = condominiumId;

  const guardTenant = (): string | null => {
    const check = requireBoundTenant(boundOrg, boundCondo);
    return check.ok ? null : check.error;
  };

  const persistence: CorePersistence = {
    async savePackage(pkg) {
      const tenantErr = guardTenant();
      if (tenantErr) return { success: false, error: tenantErr };

      const insertData: Record<string, unknown> = {
        recipient_id: pkg.recipientId ?? null,
        recipient_name: pkg.recipient,
        unit: pkg.unit,
        type: pkg.type,
        received_at: pkg.receivedAt,
        display_time: pkg.displayTime,
        status: toDbPackageStatus(pkg.status),
        deadline_minutes: pkg.deadlineMinutes || 45,
        resident_phone: pkg.residentPhone || null,
        received_by_name: pkg.receivedByName || null,
        oculta_para_morador: false,
        data_recebimento: null
      };
      if (pkg.qrCodeData) insertData.qr_code_data = pkg.qrCodeData;
      if (pkg.imageUrl) insertData.image_url = pkg.imageUrl;

      const { data, error } = await client
        .from('packages')
        .insert(insertData)
        .select('id')
        .single();

      if (error) return { success: false, error: error.message || 'DB error saving package' };
      const packageId = String(data.id);

      if (pkg.items?.length) {
        const rows = pkg.items.map((item) => ({
          package_id: packageId,
          name: item.name,
          description: item.description || null
        }));
        const itemsResult = await client.from('package_items').insert(rows);
        if (itemsResult.error) {
          return {
            success: false,
            error: itemsResult.error.message || 'DB error saving package_items'
          };
        }
      }

      return { success: true, id: packageId };
    },

    async updatePackage(pkg, deliveredBy) {
      const tenantErr = guardTenant();
      if (tenantErr) return { success: false, error: tenantErr };
      if (!pkg?.id) return { success: false, error: 'package id required' };

      const dbStatus = toDbPackageStatus(pkg.status);
      const receiptAt = dbStatus === 'recebida' ? pkg.receiptAt || new Date().toISOString() : null;
      const updateData: Record<string, unknown> = {
        status: dbStatus,
        data_recebimento: receiptAt,
        delivered_at: receiptAt,
        delivered_by: dbStatus === 'recebida' ? deliveredBy ?? null : null
      };

      const { data, error } = await client
        .from('packages')
        .update(updateData)
        .eq('id', pkg.id)
        .select('id')
        .maybeSingle();

      if (error) return { success: false, error: error.message || 'DB error updating package' };
      if (!data) return { success: false, error: 'package not found' };
      return { success: true };
    },

    async getPackageById(id) {
      const tenantErr = guardTenant();
      if (tenantErr) return null;
      if (!id) return null;

      const { data, error } = await client
        .from('packages')
        .select(
          'id, recipient_id, recipient_name, unit, type, received_at, display_time, status, deadline_minutes, resident_phone, delivered_at, delivered_by, qr_code_data, image_url, oculta_para_morador, data_recebimento, received_by_name'
        )
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return null;

      const itemsRes = await client
        .from('package_items')
        .select('id, package_id, name, description')
        .eq('package_id', id);
      const items =
        !itemsRes.error && Array.isArray(itemsRes.data)
          ? itemsRes.data.map((item: Record<string, unknown>) => ({
              id: String(item.id),
              name: String(item.name ?? ''),
              description: String(item.description ?? '')
            }))
          : [];

      return mapPackageRow(data as Record<string, unknown>, items);
    },

    async saveOccurrence(occurrence) {
      const tenantErr = guardTenant();
      if (tenantErr) return { success: false, error: tenantErr };

      const id =
        occurrence.id && !String(occurrence.id).startsWith('temp-')
          ? occurrence.id
          : newEntityId();

      const payload: Record<string, unknown> = {
        id,
        resident_id: occurrence.residentId ? String(occurrence.residentId) : null,
        resident_name: occurrence.residentName,
        unit: occurrence.unit,
        description: occurrence.description,
        status: toDbOccurrenceStatus(occurrence.status),
        date: occurrence.date,
        reported_by: occurrence.reportedBy,
        deleted_by_admin: false,
        image_url: occurrence.imageUrl || null,
        messages: occurrence.messages || []
      };

      const { data, error } = await client
        .from('occurrences')
        .insert(payload)
        .select('id')
        .single();

      if (error) return { success: false, error: error.message || 'DB error saving occurrence' };
      return { success: true, id: String(data.id) };
    },

    async updateOccurrence(occurrence) {
      const tenantErr = guardTenant();
      if (tenantErr) return { success: false, error: tenantErr };
      if (!occurrence?.id) return { success: false, error: 'occurrence id required' };

      const { data, error } = await client
        .from('occurrences')
        .update({
          description: occurrence.description,
          status: toDbOccurrenceStatus(occurrence.status),
          messages: occurrence.messages || []
        })
        .eq('id', occurrence.id)
        .select('id')
        .maybeSingle();

      if (error) return { success: false, error: error.message || 'DB error updating occurrence' };
      if (!data) return { success: false, error: 'occurrence not found' };
      return { success: true };
    },

    async saveReservation(r) {
      const tenantErr = guardTenant();
      if (tenantErr) return { success: false, error: tenantErr };

      const { data, error } = await client
        .from('reservations')
        .insert({
          area_id: r.areaId,
          resident_id: r.residentId,
          resident_name: r.residentName,
          unit: r.unit,
          date: r.date,
          start_time: r.startTime,
          end_time: r.endTime,
          status: r.status ?? 'scheduled'
        })
        .select('id')
        .single();

      if (error) {
        const code = String((error as { code?: string }).code || '');
        const msg = error.message || 'DB error saving reservation';
        if (
          code === '23P01' ||
          /exclusion|23P01|reservations_area_date_slot_excl/i.test(msg)
        ) {
          return {
            success: false,
            error: 'schedule_conflict',
            errorCode: '23P01'
          };
        }
        return { success: false, error: msg };
      }
      return { success: true, id: String(data.id) };
    },

    /**
     * Server-authoritative slots for conflict check (G7-C).
     * Excludes canceled (official) and legacy cancel spellings. No condo column yet (M5).
     */
    async listReservationSlots(query) {
      const tenantErr = guardTenant();
      if (tenantErr) return [];

      const { data, error } = await client
        .from('reservations')
        .select('id, area_id, date, start_time, end_time, status')
        .eq('area_id', query.areaId)
        .eq('date', query.date);

      if (error || !data) return [];

      return (data as Record<string, unknown>[])
        .filter((row) => {
          const st = String(row.status || '').toLowerCase();
          return (
            st !== 'canceled' &&
            st !== 'cancelled' &&
            st !== 'cancelada' &&
            st !== 'cancelado'
          );
        })
        .map((row) => ({
          id: String(row.id),
          areaIdOrName: String(row.area_id ?? query.areaId),
          date: String(row.date).slice(0, 10),
          startTime: String(row.start_time ?? '').slice(0, 5),
          endTime: String(row.end_time ?? '').slice(0, 5),
          status: row.status ? String(row.status) : undefined
        }));
    },

    async deleteReservation(id) {
      const tenantErr = guardTenant();
      if (tenantErr) return { success: false, error: tenantErr };
      if (!id) return { success: false, error: 'reservation id required' };

      const { data, error } = await client
        .from('reservations')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (error) return { success: false, error: error.message || 'DB error deleting reservation' };
      if (!data) return { success: false, error: 'reservation not found' };
      return { success: true };
    },

    async getBoletos() {
      const tenantErr = guardTenant();
      if (tenantErr) return { data: [], error: tenantErr };

      // Intentionally omit pdf_original_path / checksum_pdf from select (internal storage paths)
      const { data, error } = await client
        .from('boletos')
        .select(
          'id, resident_id, resident_name, unit, reference_month, due_date, amount, status, boleto_type, barcode, pdf_url, paid_date, description'
        )
        .order('due_date', { ascending: false })
        .limit(1000);

      if (error) return { data: [], error: error.message || 'DB error loading boletos' };
      return {
        data: (data || []).map((row: Record<string, unknown>) => mapBoletoRow(row))
      };
    },

    async createNotification(moradorId, title, message, type = 'other', relatedId, imageUrl) {
      const tenantErr = guardTenant();
      if (tenantErr) return { success: false, error: tenantErr };
      if (!moradorId || !title || !message) {
        return { success: false, error: 'moradorId, title and message are required' };
      }

      const insertData: Record<string, unknown> = {
        morador_id: moradorId,
        title,
        message,
        type,
        read: false
      };
      if (relatedId) insertData.related_id = relatedId;
      if (imageUrl) insertData.image_url = imageUrl;

      const { data, error } = await client
        .from('notifications')
        .insert(insertData)
        .select('id')
        .single();

      if (error) return { success: false, error: error.message || 'DB error creating notification' };
      return { success: true, id: String(data.id) };
    }
  };

  // Expose bound tenant for tests / composition (non-enumerable to avoid accidental spread into DB)
  Object.defineProperty(persistence, '__tenant', {
    value: Object.freeze({ organization_id: boundOrg, condominium_id: boundCondo }),
    enumerable: false,
    writable: false
  });

  return {
    ok: true,
    persistence,
    organization_id: boundOrg,
    condominium_id: boundCondo
  };
}

/** Read bound tenant from a persistence created by createSupabaseCorePersistence (tests/diagnostics). */
export function getPersistenceTenantBinding(
  persistence: CorePersistence
): { organization_id: string; condominium_id: string } | null {
  const t = (persistence as { __tenant?: { organization_id: string; condominium_id: string } })
    .__tenant;
  return t ?? null;
}
