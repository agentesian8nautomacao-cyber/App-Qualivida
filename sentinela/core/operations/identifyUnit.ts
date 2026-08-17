import { parseUnit, normalizeUnit, validateUnit, type ParsedUnit } from '../../../utils/unitFormatter';
import type { OperationContext, OperationResult } from '../types';
import { fail, ok } from '../types';
import { tenantWarnings } from '../context';

export interface IdentifyUnitInput {
  unit?: string | null;
  /** Optional known unit codes from public.units (M2) when available. */
  knownUnitCodes?: string[];
}

export interface IdentifyUnitData {
  raw: string;
  normalized: string;
  parsed: ParsedUnit | null;
  validFormat: boolean;
  /** True when knownUnitCodes provided and normalized code is in catalog. */
  inCatalog: boolean | null;
}

/**
 * identify_unit — uses existing unitFormatter; optional M2 catalog check.
 * Does not invent units table rows.
 */
export function identifyUnit(
  input: IdentifyUnitInput,
  ctx: OperationContext = { channel: 'system' }
): OperationResult<IdentifyUnitData> {
  const warnings = tenantWarnings(ctx);
  const raw = (input.unit ?? '').trim();
  if (!raw) {
    return fail('VALIDATION_ERROR', 'Unidade obrigatória.');
  }

  const parsed = parseUnit(raw);
  const normalized = normalizeUnit(raw);
  const validFormat = validateUnit(raw) || Boolean(normalized);

  let inCatalog: boolean | null = null;
  if (input.knownUnitCodes && input.knownUnitCodes.length > 0) {
    inCatalog = input.knownUnitCodes.some(
      (c) => normalizeUnit(c) === normalized || c.trim() === raw
    );
    if (!inCatalog) {
      return fail('NOT_FOUND', 'Unidade não encontrada no catálogo informado.', {
        unit: raw,
        normalized
      });
    }
  }

  return ok(
    {
      raw,
      normalized,
      parsed,
      validFormat,
      inCatalog
    },
    { warnings }
  );
}
