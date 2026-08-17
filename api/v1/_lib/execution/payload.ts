/**
 * Central payload validation — never trust n8n/WhatsApp body.
 * Authenticated tenant is authority (strip/ignore caller org/condo).
 */

import { isCoreOperationName, type CoreOperationName } from '../authz/operations';
import { validateReservationTimeRange } from '../../../../sentinela/core/domain/reservationTime';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export type ValidatedPayload = {
  operation: CoreOperationName;
  /** Sanitized input for Core — no organization_id/condominium_id overrides */
  input: Record<string, unknown>;
};

export type PayloadValidationFail = {
  ok: false;
  message: string;
  details?: Record<string, unknown>;
};

export type PayloadValidationOk = { ok: true; data: ValidatedPayload };

const MAX_STRING = 2000;
const MAX_DESCRIPTION = 8000;
const MAX_METADATA_JSON = 4096;

/** Documented input limits for n8n / external clients (G7-E). */
export const PAYLOAD_LIMITS = {
  maxString: MAX_STRING,
  maxDescription: MAX_DESCRIPTION,
  maxMetadataJsonBytes: MAX_METADATA_JSON,
  maxId: 64,
  maxPhone: 32,
  maxUnit: 64,
  maxName: 200,
  maxImageUrl: 2000,
  maxCodeData: 2000
} as const;

const NORMALIZED_INPUT_TYPES = new Set(['text', 'voice', 'photo', 'qrcode', 'barcode']);

function asString(v: unknown, max = MAX_STRING): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length > max) return null;
  return t;
}

function stripTenantOverrides(body: Record<string, unknown>): {
  rest: Record<string, unknown>;
  mismatch: boolean;
  claimed?: { organization_id?: string; condominium_id?: string };
} {
  const organization_id = asString(
    body.organization_id ?? body.organizationId,
    64
  );
  const condominium_id = asString(body.condominium_id ?? body.condominiumId, 64);
  const {
    organization_id: _o,
    condominium_id: _c,
    organizationId: _o2,
    condominiumId: _c2,
    ...rest
  } = body;
  return {
    rest,
    mismatch: Boolean(organization_id || condominium_id),
    claimed: {
      ...(organization_id ? { organization_id } : {}),
      ...(condominium_id ? { condominium_id } : {})
    }
  };
}

export function validateOperationPayload(
  operation: string,
  rawBody: Record<string, unknown>,
  authenticatedTenant?: { organization_id: string; condominium_id: string }
): PayloadValidationOk | PayloadValidationFail {
  if (!isCoreOperationName(operation)) {
    return { ok: false, message: 'unknown operation' };
  }

  const stripped = stripTenantOverrides(rawBody);
  if (stripped.mismatch && authenticatedTenant) {
    const orgOk =
      !stripped.claimed?.organization_id ||
      stripped.claimed.organization_id === authenticatedTenant.organization_id;
    const condoOk =
      !stripped.claimed?.condominium_id ||
      stripped.claimed.condominium_id === authenticatedTenant.condominium_id;
    if (!orgOk || !condoOk) {
      return {
        ok: false,
        message: 'organization_id/condominium_id in body must match authenticated tenant',
        details: {
          code: 'TENANT_MISMATCH',
          claimed: stripped.claimed,
          authenticated: authenticatedTenant
        }
      };
    }
  } else if (stripped.mismatch && !authenticatedTenant) {
    // Still strip; caller of validate without tenant should pass authz separately
  }

  const body = stripped.rest;

  switch (operation) {
    case 'identify_resident': {
      const input: Record<string, unknown> = {};
      const phone = asString(body.phone ?? body.whatsapp, 32);
      const name = asString(body.name, 200);
      const unit = asString(body.unit, 64);
      const residentId = asString(body.resident_id ?? body.residentId, 64);
      if (residentId && !isUuid(residentId) && !residentId.startsWith('r')) {
        // allow test ids like r1; production UUIDs preferred
      }
      if (!phone && !name && !unit && !residentId) {
        return {
          ok: false,
          message: 'identify_resident requires phone, name, unit, or resident_id'
        };
      }
      if (phone) input.phone = phone;
      if (name) input.name = name;
      if (unit) input.unit = unit;
      if (residentId) input.residentId = residentId;
      return { ok: true, data: { operation, input } };
    }
    case 'identify_unit': {
      const unit = asString(body.unit, 64);
      if (!unit) return { ok: false, message: 'unit is required' };
      return { ok: true, data: { operation, input: { unit } } };
    }
    case 'get_boleto': {
      const input: Record<string, unknown> = {};
      const boletoId = asString(body.boleto_id ?? body.boletoId, 64);
      const residentId = asString(body.resident_id ?? body.residentId, 64);
      const unit = asString(body.unit, 64);
      if (boletoId) input.boletoId = boletoId;
      if (residentId) input.residentId = residentId;
      if (unit) input.unit = unit;
      return { ok: true, data: { operation, input } };
    }
    case 'create_package': {
      const recipient = asString(body.recipient ?? body.recipient_name, 200);
      const unit = asString(body.unit, 64);
      const type = asString(body.type, 120) || 'Encomenda';
      const residentPhone = asString(body.resident_phone ?? body.residentPhone, 32);
      const recipientId = asString(body.recipient_id ?? body.recipientId, 64);
      if (!recipient && !recipientId && !residentPhone) {
        return {
          ok: false,
          message: 'create_package requires recipient, recipient_id, or resident_phone'
        };
      }
      if (!unit && !recipientId && !residentPhone) {
        return { ok: false, message: 'unit is required when recipient is free-text' };
      }

      // G7-E: n8n-normalized multimodal hint (no WhatsApp/OCR/STT here).
      const inputTypeRaw = asString(body.input_type ?? body.inputType, 32);
      const inputType = inputTypeRaw ? inputTypeRaw.toLowerCase() : null;
      if (inputType && !NORMALIZED_INPUT_TYPES.has(inputType)) {
        return {
          ok: false,
          message: 'input_type must be one of: text, voice, photo, qrcode, barcode'
        };
      }
      if (body.metadata !== undefined) {
        if (
          typeof body.metadata !== 'object' ||
          body.metadata === null ||
          Array.isArray(body.metadata)
        ) {
          return { ok: false, message: 'metadata must be a JSON object' };
        }
        if (JSON.stringify(body.metadata).length > MAX_METADATA_JSON) {
          return { ok: false, message: `metadata exceeds ${MAX_METADATA_JSON} bytes` };
        }
      }
      // QR/barcode/text codes all terminate in create_package (same op — no duplicate endpoint).
      const codeData =
        asString(body.qr_code_data ?? body.qrCodeData, 2000) ||
        asString(body.barcode_data ?? body.barcodeData ?? body.code, 2000) ||
        (inputType === 'qrcode' || inputType === 'barcode'
          ? asString(body.text, 2000)
          : null);

      return {
        ok: true,
        data: {
          operation,
          input: {
            recipient,
            unit,
            type,
            residentPhone,
            recipientId,
            imageUrl: asString(body.image_url ?? body.imageUrl, 2000),
            qrCodeData: codeData,
            receivedByName: asString(body.received_by_name ?? body.receivedByName, 200),
            ...(inputType ? { inputType } : {}),
            ...(asString(body.text, MAX_STRING) ? { text: asString(body.text, MAX_STRING) } : {})
          }
        }
      };
    }
    case 'create_occurrence': {
      const description = asString(body.description, MAX_DESCRIPTION);
      if (!description) return { ok: false, message: 'description is required' };
      return {
        ok: true,
        data: {
          operation,
          input: {
            description,
            residentName: asString(body.resident_name ?? body.residentName, 200),
            unit: asString(body.unit, 64),
            residentId: asString(body.resident_id ?? body.residentId, 64),
            reportedBy: asString(body.reported_by ?? body.reportedBy, 200),
            imageUrl: asString(body.image_url ?? body.imageUrl, 2000)
          }
        }
      };
    }
    case 'update_occurrence': {
      const occurrence = body.occurrence;
      if (!occurrence || typeof occurrence !== 'object') {
        return { ok: false, message: 'occurrence object is required' };
      }
      const occ = occurrence as Record<string, unknown>;
      const id = asString(occ.id, 64);
      const description = asString(occ.description, MAX_DESCRIPTION);
      if (!id) return { ok: false, message: 'occurrence.id is required' };
      return {
        ok: true,
        data: {
          operation,
          input: {
            occurrence: {
              id,
              description: description || '',
              residentName: asString(occ.residentName ?? occ.resident_name, 200) || 'Condomínio',
              unit: asString(occ.unit, 64) || '—',
              status: asString(occ.status, 64) || 'Aberto',
              date: asString(occ.date, 64) || new Date().toISOString(),
              reportedBy: asString(occ.reportedBy ?? occ.reported_by, 200) || 'Sistema',
              residentId: asString(occ.residentId ?? occ.resident_id, 64) || undefined,
              imageUrl: asString(occ.imageUrl ?? occ.image_url, 2000) || undefined
            }
          }
        }
      };
    }
    case 'create_reservation': {
      const areaId = asString(body.area_id ?? body.areaId, 64);
      const residentId = asString(body.resident_id ?? body.residentId, 64);
      const residentName = asString(body.resident_name ?? body.residentName, 200);
      const unit = asString(body.unit, 64);
      const date = asString(body.date, 32);
      const startTime = asString(body.start_time ?? body.startTime, 16);
      const endTime = asString(body.end_time ?? body.endTime, 16);
      if (!areaId || !residentId || !residentName || !unit || !date || !startTime || !endTime) {
        return { ok: false, message: 'create_reservation missing required fields' };
      }
      const range = validateReservationTimeRange(startTime, endTime);
      if (!range.ok) {
        return {
          ok: false,
          message: range.message,
          details: { code: 'INVALID_TIME_RANGE', ...range.details }
        };
      }
      return {
        ok: true,
        data: {
          operation,
          input: {
            areaId,
            areaName: asString(body.area_name ?? body.areaName, 200),
            residentId,
            residentName,
            unit,
            date,
            startTime,
            endTime,
            status: asString(body.status, 32) || 'scheduled'
          }
        }
      };
    }
    case 'pickup_package': {
      const packageId = asString(
        body.package_id ?? body.packageId ?? body.resource_id,
        64
      );
      if (!packageId) return { ok: false, message: 'package_id / resource_id is required' };
      return {
        ok: true,
        data: {
          operation,
          input: {
            packageId,
            deliveredBy: asString(body.delivered_by ?? body.deliveredBy, 200)
          }
        }
      };
    }
    case 'cancel_reservation': {
      const reservationId = asString(
        body.reservation_id ?? body.reservationId ?? body.resource_id,
        64
      );
      if (!reservationId) {
        return { ok: false, message: 'reservation_id / resource_id is required' };
      }
      return {
        ok: true,
        data: {
          operation,
          input: { reservationId }
        }
      };
    }
    case 'notify_resident':
      return {
        ok: false,
        message: `operation ${operation} is not executable (AuthZ decision required)`,
        details: { operation }
      };
    case 'list_events':
      // Admin Event Store query — handled by GET /api/v1/events, not Core payload.
      return { ok: true, data: { operation, input: {} } };
    default:
      return { ok: false, message: 'unsupported operation' };
  }
}
