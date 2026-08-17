import type { Resident } from '../../../types';
import { normalizePhoneForWhatsApp } from '../../../utils/phoneNormalizer';
import { compareUnits, normalizeUnit } from '../../../utils/unitFormatter';
import type { OperationContext, OperationResult } from '../types';
import { fail, ok } from '../types';
import { tenantWarnings } from '../context';

export interface IdentifyResidentInput {
  residentId?: string | null;
  name?: string | null;
  unit?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  /** Required catalog for pure resolution (UI/Core caller supplies list). */
  residents: Resident[];
}

export interface IdentifyResidentData {
  resident: Resident | null;
  matchStrategy: 'id' | 'phone' | 'name_unit' | 'unit_only' | 'name_only' | 'none';
  ambiguous: boolean;
  candidates: Resident[];
}

function phonesMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = normalizePhoneForWhatsApp(a);
  const nb = normalizePhoneForWhatsApp(b);
  if (!na.isValid || !nb.isValid || !na.normalized || !nb.normalized) return false;
  return na.normalized === nb.normalized;
}

/**
 * identify_resident — pure over provided resident catalog.
 * Prefer id → phone/whatsapp → name+unit → unit → name (last = clarification).
 */
export function identifyResident(
  input: IdentifyResidentInput,
  ctx: OperationContext = { channel: 'system' }
): OperationResult<IdentifyResidentData> {
  const warnings = tenantWarnings(ctx);
  const list = input.residents ?? [];

  if (input.residentId) {
    const found = list.find((r) => r.id === input.residentId);
    if (found) {
      return ok(
        { resident: found, matchStrategy: 'id', ambiguous: false, candidates: [found] },
        { warnings }
      );
    }
    return fail('NOT_FOUND', 'Morador não encontrado pelo id informado.', {
      residentId: input.residentId
    });
  }

  const phone = input.phone || input.whatsapp;
  if (phone) {
    const byPhone = list.filter(
      (r) => phonesMatch(r.phone, phone) || phonesMatch(r.whatsapp, phone)
    );
    if (byPhone.length === 1) {
      return ok(
        { resident: byPhone[0], matchStrategy: 'phone', ambiguous: false, candidates: byPhone },
        { warnings }
      );
    }
    if (byPhone.length > 1) {
      // Never pick arbitrarily — WhatsApp/API must confirm (NEEDS_CONFIRMATION)
      return fail('CLARIFICATION_REQUIRED', 'Múltiplos moradores para o telefone informado.', {
        matchStrategy: 'phone',
        candidateIds: byPhone.map((r) => r.id),
        candidateCount: byPhone.length
      });
    }
    // Phone provided but no match — do not fall through to name/unit (no silent cross-match)
    return fail('NOT_FOUND', 'Morador não encontrado pelo telefone informado.', {
      matchStrategy: 'phone'
    });
  }

  const name = input.name?.trim();
  const unit = input.unit?.trim();

  if (name && unit) {
    const byBoth = list.filter(
      (r) =>
        r.name.trim().toLowerCase() === name.toLowerCase() && compareUnits(r.unit, unit)
    );
    if (byBoth.length === 1) {
      return ok(
        { resident: byBoth[0], matchStrategy: 'name_unit', ambiguous: false, candidates: byBoth },
        { warnings }
      );
    }
    if (byBoth.length > 1) {
      return ok(
        { resident: null, matchStrategy: 'name_unit', ambiguous: true, candidates: byBoth },
        { warnings: [...warnings, 'CLARIFICATION_REQUIRED'] }
      );
    }
  }

  if (unit) {
    const byUnit = list.filter((r) => compareUnits(r.unit, unit));
    if (byUnit.length === 1) {
      return ok(
        { resident: byUnit[0], matchStrategy: 'unit_only', ambiguous: false, candidates: byUnit },
        { warnings }
      );
    }
    if (byUnit.length > 1) {
      return ok(
        { resident: null, matchStrategy: 'unit_only', ambiguous: true, candidates: byUnit },
        { warnings: [...warnings, 'CLARIFICATION_REQUIRED'] }
      );
    }
  }

  if (name) {
    const byName = list.filter((r) => r.name.trim().toLowerCase() === name.toLowerCase());
    if (byName.length === 1) {
      return ok(
        { resident: byName[0], matchStrategy: 'name_only', ambiguous: false, candidates: byName },
        { warnings: [...warnings, 'WEAK_MATCH_NAME_ONLY'] }
      );
    }
    if (byName.length > 1) {
      return ok(
        { resident: null, matchStrategy: 'name_only', ambiguous: true, candidates: byName },
        { warnings: [...warnings, 'CLARIFICATION_REQUIRED'] }
      );
    }
  }

  return ok(
    { resident: null, matchStrategy: 'none', ambiguous: false, candidates: [] },
    { warnings: [...warnings, 'RESIDENT_NOT_RESOLVED'] }
  );
}

export { normalizeUnit, compareUnits };
