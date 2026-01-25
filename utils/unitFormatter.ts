/**
 * Utilitários para formatação e parseamento de unidades
 * Suporta formato: 03/005 (bloco/apartamento) -> BL 03 / APTO 005
 */

export interface ParsedUnit {
  block: string;
  apartment: string;
  original: string;
  formatted: string; // "BL 03 / APTO 005"
  normalized: string; // "03/005" para armazenamento
}

/**
 * Parseia uma unidade no formato "03/005" ou similar
 * @param unit - String da unidade (ex: "03/005", "3/5", "BL03-APTO005", etc)
 * @returns Objeto com bloco, apartamento e formatos
 */
export const parseUnit = (unit: string): ParsedUnit | null => {
  if (!unit || !unit.trim()) return null;

  const trimmed = unit.trim().toUpperCase();

  // Formato 1: "03/005" ou "3/5" (bloco/apartamento)
  const slashMatch = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (slashMatch) {
    const block = slashMatch[1].padStart(2, '0');
    const apartment = slashMatch[2].padStart(3, '0');
    return {
      block,
      apartment,
      original: unit,
      formatted: `BL ${block} / APTO ${apartment}`,
      normalized: `${block}/${apartment}`
    };
  }

  // Formato 2: "BL03-APTO005" ou "BL 03 - APTO 005"
  const blAptoMatch = trimmed.match(/^BL\s*(\d+)\s*[-/]\s*APTO\s*(\d+)$/i);
  if (blAptoMatch) {
    const block = blAptoMatch[1].padStart(2, '0');
    const apartment = blAptoMatch[2].padStart(3, '0');
    return {
      block,
      apartment,
      original: unit,
      formatted: `BL ${block} / APTO ${apartment}`,
      normalized: `${block}/${apartment}`
    };
  }

  // Formato 3: "03-005" (hífen)
  const hyphenMatch = trimmed.match(/^(\d+)\s*-\s*(\d+)$/);
  if (hyphenMatch) {
    const block = hyphenMatch[1].padStart(2, '0');
    const apartment = hyphenMatch[2].padStart(3, '0');
    return {
      block,
      apartment,
      original: unit,
      formatted: `BL ${block} / APTO ${apartment}`,
      normalized: `${block}/${apartment}`
    };
  }

  // Formato 4: Apenas números (ex: "03005" - assume 2 primeiros dígitos = bloco, resto = apartamento)
  const numbersOnly = trimmed.replace(/\D/g, '');
  if (numbersOnly.length >= 3) {
    const block = numbersOnly.substring(0, 2).padStart(2, '0');
    const apartment = numbersOnly.substring(2).padStart(3, '0');
    return {
      block,
      apartment,
      original: unit,
      formatted: `BL ${block} / APTO ${apartment}`,
      normalized: `${block}/${apartment}`
    };
  }

  // Se não conseguir parsear, retorna null
  return null;
};

/**
 * Valida se uma unidade está no formato correto
 * @param unit - String da unidade
 * @returns true se válida, false caso contrário
 */
export const validateUnit = (unit: string): boolean => {
  if (!unit || !unit.trim()) return false;
  const parsed = parseUnit(unit);
  return parsed !== null;
};

/**
 * Normaliza uma unidade para armazenamento (formato: "03/005")
 * @param unit - String da unidade
 * @returns String normalizada ou a original se não conseguir parsear
 */
export const normalizeUnit = (unit: string): string => {
  const parsed = parseUnit(unit);
  if (parsed) {
    return parsed.normalized;
  }
  // Se não conseguir parsear, retorna a original em uppercase
  return unit.trim().toUpperCase();
};

/**
 * Formata uma unidade para exibição (formato: "BL 03 / APTO 005")
 * @param unit - String da unidade (pode ser normalizada ou original)
 * @returns String formatada para exibição
 */
export const formatUnit = (unit: string): string => {
  const parsed = parseUnit(unit);
  if (parsed) {
    return parsed.formatted;
  }
  // Se não conseguir parsear, retorna a original
  return unit.trim().toUpperCase();
};

/**
 * Compara duas unidades (normalizadas) para verificar se são iguais
 * @param unit1 - Primeira unidade
 * @param unit2 - Segunda unidade
 * @returns true se forem iguais
 */
export const compareUnits = (unit1: string, unit2: string): boolean => {
  const normalized1 = normalizeUnit(unit1);
  const normalized2 = normalizeUnit(unit2);
  return normalized1 === normalized2;
};
