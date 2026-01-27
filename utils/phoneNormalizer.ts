/**
 * Utilitário para normalização de números de telefone brasileiros para WhatsApp
 * 
 * Regras de normalização:
 * - Remove todos os caracteres não numéricos
 * - Garante DDI 55 (Brasil)
 * - Valida comprimento mínimo (12-13 dígitos com DDI)
 * - Retorna null se inválido
 */

export interface PhoneNormalizationResult {
  normalized: string | null;
  original: string;
  isValid: boolean;
  error?: string;
}

/**
 * Normaliza um número de telefone brasileiro para uso no WhatsApp
 * 
 * @param phone - Número de telefone (pode conter formatação)
 * @returns Objeto com número normalizado ou null se inválido
 * 
 * @example
 * normalizePhoneForWhatsApp("(11) 9 9999-9999") // { normalized: "5511999999999", isValid: true }
 * normalizePhoneForWhatsApp("11999999999") // { normalized: "5511999999999", isValid: true }
 * normalizePhoneForWhatsApp("5511999999999") // { normalized: "5511999999999", isValid: true }
 */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): PhoneNormalizationResult {
  // Se não houver número, retornar inválido
  if (!phone || typeof phone !== 'string') {
    return {
      normalized: null,
      original: phone || '',
      isValid: false,
      error: 'Número de telefone não fornecido'
    };
  }

  const original = phone.trim();

  // Se estiver vazio após trim, retornar inválido
  if (original.length === 0) {
    return {
      normalized: null,
      original,
      isValid: false,
      error: 'Número de telefone vazio'
    };
  }

  // Remover todos os caracteres não numéricos
  const digitsOnly = original.replace(/\D/g, '');

  // Se não houver dígitos, retornar inválido
  if (digitsOnly.length === 0) {
    return {
      normalized: null,
      original,
      isValid: false,
      error: 'Número não contém dígitos válidos'
    };
  }

  let normalized: string;

  // Se começar com 55 (DDI do Brasil), usar como está
  if (digitsOnly.startsWith('55')) {
    normalized = digitsOnly;
  }
  // Se começar com 0 (código de discagem), remover o 0 e adicionar 55
  else if (digitsOnly.startsWith('0')) {
    normalized = '55' + digitsOnly.substring(1);
  }
  // Se começar com DDD (2 dígitos), adicionar 55
  else if (digitsOnly.length >= 10 && digitsOnly.length <= 11) {
    normalized = '55' + digitsOnly;
  }
  // Se já tiver 12-13 dígitos sem DDI, assumir que falta o 55
  else if (digitsOnly.length >= 12) {
    // Verificar se já tem DDI de outro país (não 55)
    // Se começar com outro código de país, não adicionar 55
    normalized = digitsOnly;
  }
  // Caso padrão: adicionar 55
  else {
    normalized = '55' + digitsOnly;
  }

  // Validar comprimento final (deve ter 12-13 dígitos: 55 + DDD + número)
  // 55 (2) + DDD (2) + número (8-9) = 12-13 dígitos
  if (normalized.length < 12 || normalized.length > 13) {
    return {
      normalized: null,
      original,
      isValid: false,
      error: `Número inválido: deve ter 12-13 dígitos (tem ${normalized.length})`
    };
  }

  // Validar que começa com 55
  if (!normalized.startsWith('55')) {
    return {
      normalized: null,
      original,
      isValid: false,
      error: 'Número deve começar com DDI 55 (Brasil)'
    };
  }

  // Validar DDD (terceiro e quarto dígitos devem ser válidos para Brasil)
  const ddd = normalized.substring(2, 4);
  const validDDDs = [
    '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
    '21', '22', '24', // RJ/ES
    '27', '28', // ES
    '31', '32', '33', '34', '35', '37', '38', // MG
    '41', '42', '43', '44', '45', '46', // PR
    '47', '48', '49', // SC
    '51', '53', '54', '55', // RS
    '61', // DF
    '62', '64', // GO
    '63', // TO
    '65', '66', // MT
    '67', // MS
    '68', // AC
    '69', // RO
    '71', '73', '74', '75', '77', // BA
    '79', // SE
    '81', '87', // PE
    '82', // AL
    '83', // PB
    '84', // RN
    '85', '88', // CE
    '86', '89', // PI
    '91', '93', '94', // PA
    '92', '97', // AM
    '95', // RR
    '96', // AP
    '98', '99' // MA
  ];

  if (!validDDDs.includes(ddd)) {
    // Avisar mas não bloquear (pode ser número internacional ou novo DDD)
    console.warn(`DDD ${ddd} não reconhecido como DDD brasileiro válido, mas continuando...`);
  }

  return {
    normalized,
    original,
    isValid: true
  };
}

/**
 * Cria URL do WhatsApp com número normalizado e mensagem
 * 
 * @param phone - Número de telefone (será normalizado)
 * @param message - Mensagem a ser enviada (será codificada)
 * @returns URL do WhatsApp ou null se número inválido
 */
export function createWhatsAppUrl(
  phone: string | null | undefined,
  message?: string
): string | null {
  const normalization = normalizePhoneForWhatsApp(phone);

  if (!normalization.isValid || !normalization.normalized) {
    console.error('Erro ao normalizar número para WhatsApp:', normalization.error);
    return null;
  }

  const baseUrl = `https://wa.me/${normalization.normalized}`;
  
  if (message && message.trim()) {
    const encodedMessage = encodeURIComponent(message.trim());
    return `${baseUrl}?text=${encodedMessage}`;
  }

  return baseUrl;
}

/**
 * Valida e abre WhatsApp com número normalizado
 * 
 * @param phone - Número de telefone (será normalizado)
 * @param message - Mensagem opcional
 * @param onError - Callback chamado em caso de erro
 * @returns true se abriu com sucesso, false caso contrário
 */
export function openWhatsApp(
  phone: string | null | undefined,
  message?: string,
  onError?: (error: string) => void
): boolean {
  const url = createWhatsAppUrl(phone, message);

  if (!url) {
    const error = 'Número de WhatsApp inválido. Verifique se o número está correto e tente novamente.';
    console.error('Erro ao abrir WhatsApp:', error);
    if (onError) {
      onError(error);
    }
    return false;
  }

  // Log para depuração (remover em produção se necessário)
  const normalization = normalizePhoneForWhatsApp(phone);
  console.log('Abrindo WhatsApp:', {
    original: normalization.original,
    normalized: normalization.normalized,
    url: url.substring(0, 50) + '...' // Log parcial da URL
  });

  window.open(url, '_blank');
  return true;
}
