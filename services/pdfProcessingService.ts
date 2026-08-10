// PDF processing service - using lightweight approach
// For now, we'll use a simple text extraction approach
// TODO: Implement proper PDF parsing when dependencies are resolved

export interface BoletoData {
  cpf?: string;
  unidade?: string;
  nome?: string;
  valor?: number;
  vencimento?: string;
  nossoNumero?: string;
  referencia?: string;
  codigoBarras?: string;
}

export interface ValidationResult {
  isValid: boolean;
  resident?: any;
  confidence: number;
  extractedData: BoletoData;
  suggestions: any[];
  errors: string[];
}

/**
 * Extrai texto de um arquivo PDF (versão simplificada)
 * Por enquanto retorna dados mock para demonstração
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
  // Versão simplificada - retorna dados mock para demonstração
  // TODO: Implementar extração real de PDF quando dependências forem resolvidas
  return new Promise((resolve) => {
    setTimeout(() => {
      // Simular extração de dados de um boleto típico
      const mockText = `
        CONDOMÍNIO QUALIVIDA RESIDENCE
        Boleto de Pagamento

        CPF/CNPJ: 123.456.789-00
        Nome: João Silva Santos
        Unidade: 101
        Referência: 12/2024
        Vencimento: 10/12/2024
        Valor: R$ 250,00

        Descrição: Taxa Condominial - Rateio de Água e Energia
        Nosso Número: 001234567890123
        Código de Barras: 00190000090012345678901234567890123456789012
      `;
      resolve(mockText);
    }, 1000); // Simular processamento
  });
};

/**
 * Usa OCR para extrair texto de imagens em PDFs (versão simplificada)
 */
export const extractTextWithOCR = async (file: File): Promise<string> => {
  // Versão simplificada - mesma implementação do PDF por enquanto
  return extractTextFromPDF(file);
};

/**
 * Extrai dados específicos de boleto do texto
 */
export const extractBoletoData = (text: string): BoletoData => {
  const data: BoletoData = {};

  // Padrões de regex para diferentes campos
  const patterns = {
    cpf: [
      /CPF[:\s]*([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2})/gi,
      /CPF[:\s]*([\d]{11})/gi,
      /CPF\/CNPJ[:\s]*([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2})/gi
    ],
    unidade: [
      /Unidade[:\s]*([A-Za-z0-9\s\/\-]+)/gi,
      /Apto[:\s]*([A-Za-z0-9\s\/\-]+)/gi,
      /Apartamento[:\s]*([A-Za-z0-9\s\/\-]+)/gi,
      /Apt[:\s]*([A-Za-z0-9\s\/\-]+)/gi,
      /Unid[:\s]*([A-Za-z0-9\s\/\-]+)/gi
    ],
    nome: [
      /Nome[:\s]*([A-Za-zÀ-ÿ\s]+)/gi,
      /Morador[:\s]*([A-Za-zÀ-ÿ\s]+)/gi,
      /Cliente[:\s]*([A-Za-zÀ-ÿ\s]+)/gi
    ],
    valor: [
      /Valor[:\s]*R\$[\s]*([\d,]+\.?\d*)/gi,
      /Total[:\s]*R\$[\s]*([\d,]+\.?\d*)/gi,
      /Valor[\s]+a[\s]+pagar[:\s]*R\$[\s]*([\d,]+\.?\d*)/gi
    ],
    vencimento: [
      /Vencimento[:\s]*([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/gi,
      /Data[\s]+de[\s]+vencimento[:\s]*([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/gi,
      /Venc[:\s]*([\d]{1,2}[\/\-][\d]{1,2}[\/\-][\d]{4})/gi
    ],
    nossoNumero: [
      /Nosso[\s]+número[:\s]*([\d\s]+)/gi,
      /Nosso[\s]+numero[:\s]*([\d\s]+)/gi,
      /Nº[:\s]*([\d\s]+)/gi,
      /N\s*º[:\s]*([\d\s]+)/gi
    ],
    referencia: [
      /Referência[:\s]*([\d]{1,2}[\/\-][\d]{4})/gi,
      /Mês[\s]+de[\s]+referência[:\s]*([\d]{1,2}[\/\-][\d]{4})/gi,
      /Ref[:\s]*([\d]{1,2}[\/\-][\d]{4})/gi
    ],
    codigoBarras: [
      /([\d]{5}\.[\d]{5}\s[\d]{5}\.[\d]{6}\s[\d]{5}\.[\d]{6}\s[\d]\s[\d]{14})/gi,
      /([\d]{44,48})/gi
    ]
  };

  // Extrair dados usando os padrões
  for (const [field, fieldPatterns] of Object.entries(patterns)) {
    for (const pattern of fieldPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const value = match[1].trim();

          switch (field) {
            case 'cpf':
              if (!data.cpf) data.cpf = value.replace(/[^\d]/g, '');
              break;
            case 'unidade':
              if (!data.unidade) data.unidade = value.toUpperCase().trim();
              break;
            case 'nome':
              if (!data.nome) data.nome = value.trim();
              break;
            case 'valor':
              if (!data.valor) {
                const cleanValue = value.replace(/[^\d,]/g, '').replace(',', '.');
                data.valor = parseFloat(cleanValue);
              }
              break;
            case 'vencimento':
              if (!data.vencimento) data.vencimento = value;
              break;
            case 'nossoNumero':
              if (!data.nossoNumero) data.nossoNumero = value.replace(/\s/g, '');
              break;
            case 'referencia':
              if (!data.referencia) data.referencia = value;
              break;
            case 'codigoBarras':
              if (!data.codigoBarras) data.codigoBarras = value.replace(/\s/g, '');
              break;
          }
        }
      }
    }
  }

  return data;
};

/**
 * Valida e encontra correspondência com moradores cadastrados
 */
export const validateAndFindResident = (
  extractedData: BoletoData,
  allResidents: any[]
): ValidationResult => {
  const result: ValidationResult = {
    isValid: false,
    confidence: 0,
    extractedData,
    suggestions: [],
    errors: []
  };

  // Procurar por CPF
  if (extractedData.cpf) {
    const residentByCPF = allResidents.find(r => r.cpf === extractedData.cpf);
    if (residentByCPF) {
      result.isValid = true;
      result.resident = residentByCPF;
      result.confidence = 100;
      return result;
    }
  }

  // Procurar por unidade
  if (extractedData.unidade) {
    const residentByUnit = allResidents.find(r => {
      // Comparar unidades de forma flexível
      const unit1 = r.unit.toLowerCase().replace(/[^\w]/g, '');
      const unit2 = extractedData.unidade!.toLowerCase().replace(/[^\w]/g, '');
      return unit1 === unit2;
    });

    if (residentByUnit) {
      result.isValid = true;
      result.resident = residentByUnit;
      result.confidence = 90;
      return result;
    }

    // Se não encontrou exatamente, procurar sugestões similares
    const suggestions = allResidents.filter(r => {
      const unit = r.unit.toLowerCase();
      const extractedUnit = extractedData.unidade!.toLowerCase();
      return unit.includes(extractedUnit) || extractedUnit.includes(unit);
    });

    if (suggestions.length > 0) {
      result.suggestions = suggestions.slice(0, 3);
      result.confidence = 50;
    }
  }

  // Procurar por nome (menos confiável)
  if (extractedData.nome && !result.isValid) {
    const residentByName = allResidents.find(r => {
      const name1 = r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const name2 = extractedData.nome!.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return name1.includes(name2) || name2.includes(name1);
    });

    if (residentByName) {
      result.suggestions = [residentByName, ...result.suggestions].slice(0, 3);
      result.confidence = Math.max(result.confidence, 30);
    }
  }

  // Adicionar erros se nada foi encontrado
  if (!result.isValid && result.suggestions.length === 0) {
    result.errors.push('Não foi possível encontrar um morador correspondente no sistema');
  }

  return result;
};

/**
 * Processa um PDF de boleto completo
 */
export const processBoletoPDF = async (
  file: File,
  allResidents: any[]
): Promise<ValidationResult> => {
  try {
    // Tentar extrair texto diretamente do PDF
    let text = await extractTextFromPDF(file);

    // Se o texto extraído for muito curto, tentar OCR
    if (text.length < 100) {
      console.log('Texto extraído muito curto, tentando OCR...');
      text = await extractTextWithOCR(file);
    }

    console.log('Texto extraído do PDF:', text);

    // Extrair dados do boleto
    const extractedData = extractBoletoData(text);
    console.log('Dados extraídos:', extractedData);

    // Validar e encontrar residente
    const validationResult = validateAndFindResident(extractedData, allResidents);

    return validationResult;

  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    return {
      isValid: false,
      confidence: 0,
      extractedData: {},
      suggestions: [],
      errors: ['Erro ao processar o arquivo PDF']
    };
  }
};