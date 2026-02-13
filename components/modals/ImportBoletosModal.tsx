import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Download, File as FileIcon } from 'lucide-react';
import { Boleto, BoletoType, Resident } from '../../types';
import { getResidents, uploadBoletoPdf } from '../../services/dataService';
import { useToast } from '../../contexts/ToastContext';
import { normalizeUnit, compareUnits } from '../../utils/unitFormatter';
import { extractFieldsFromBoletoText, extractTextFromPdf } from '../../services/pdfBoletoExtractor';

interface ImportBoletosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (boletos: Boleto[]) => void;
  existingBoletos: Boleto[];
  allResidents: Resident[];
}

const ImportBoletosModal: React.FC<ImportBoletosModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingBoletos,
  allResidents
}) => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [previewData, setPreviewData] = useState<Boleto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [remoteResidents, setRemoteResidents] = useState<Resident[] | null>(null);
  /** Designação manual: boleto.id -> File (PDF escolhido para aquele morador). */
  const [assignedPdfByBoletoId, setAssignedPdfByBoletoId] = useState<Record<string, File | null>>({});
  /** Tipo padrão para importação em lote (Taxa/Condomínio, Água ou Luz). */
  const [defaultBoletoType, setDefaultBoletoType] = useState<BoletoType>('condominio');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const pdfAssignmentsRef = useRef<Map<string, File>>(new Map());

  // Quando abrir o modal, tenta buscar moradores atualizados (Supabase) para evitar lista desatualizada
  useEffect(() => {
    if (!isOpen) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    (async () => {
      try {
        const { data } = await getResidents();
        if (data && data.length > 0) setRemoteResidents(data);
      } catch {
        // silencioso: usa allResidents do App
      }
    })();
  }, [isOpen]);

  const residentsPool = (remoteResidents && remoteResidents.length > 0) ? remoteResidents : allResidents;

  const normalizeBoletoType = (v: string): BoletoType => {
    const t = (v || '').toLowerCase().trim();
    if (t === 'agua' || t === 'água' || t === 'water') return 'agua';
    if (t === 'luz' || t === 'energia' || t === 'light') return 'luz';
    return 'condominio';
  };

  // Sincronizar designações do ref para estado quando o preview é preenchido (ex.: auto-assign por nome)
  useEffect(() => {
    if (previewData.length === 0) return;
    setAssignedPdfByBoletoId(prev => {
      const next = { ...prev };
      pdfAssignmentsRef.current.forEach((f, id) => { next[id] = f; });
      return next;
    });
  }, [previewData.length]);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    // Se múltiplos arquivos foram selecionados
    if (selectedFiles.length > 1) {
      const pdfFiles = Array.from(selectedFiles).filter(f =>
        f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
      );

      if (pdfFiles.length > 0) {
        // Mostrar informação sobre múltiplos PDFs selecionados
        setFile(null); // Limpar arquivo único
        processMultiplePDFFiles(pdfFiles);
        return;
      }
    }

    // Arquivo único
    const selectedFile = selectedFiles[0];
    setFile(selectedFile);
    processFile(selectedFile);
  };

  const processMultiplePDFFiles = async (pdfFiles: File[]) => {
    setPdfFiles(pdfFiles);
    setErrors([]);
    setPreviewData([]);
    setIsProcessing(true);

    try {
      const boletoData: any[] = [];

      for (const pdfFile of pdfFiles) {
        // Mesmo código de extração usado no processPDFFile
        const fileName = pdfFile.name.toLowerCase().replace('.pdf', '');

        const patterns = {
          unit: /(?:^|_|-)((?:\d{1,3})(?:[a-zA-Z]{0,2}))(?:_|-|$)/,
          monthYear: [
            /(?:^|_|-)(\d{1,2})[_\/-](\d{4})(?:_|-|$)/,
            /(?:^|_|-)(\d{1,2})(\d{4})(?:_|-|$)/,
            /(?:^|_|-)(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[_-]?(\d{4})(?:_|-|$)/i,
            /(?:^|_|-)(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[_-]?(\d{4})(?:_|-|$)/i
          ],
          type: /(?:^|_|-)(condominio|condomínio|agua|água|luz|condo|water|light|electricity)(?:_|-|$)/,
          amount: /(?:^|_|-)R\$?[_]?([\d.,]+)(?:_|-|$)/,
          dueDate: /(?:^|_|-)(\d{1,2})[_\/-](\d{1,2})[_\/-](\d{4})(?:_|-|$)/
        };

        let extractedUnit = '';

        // Tentar padrões mais específicos primeiro
        const unitPatterns = [
          /(?:^|_|-)((?:\d{1,3})(?:[a-zA-Z]{0,2}))(?:_|-|$)/,  // 101A, 205, 45B
          /(?:^|_|-)([a-zA-Z]{1,2}(\d{1,3}))(?:_|-|$)/,        // A101, B205
          /(?:^|_|-)(apt|apto|unidade)[_-]?(\d{1,3}[a-zA-Z]{0,2})(?:_|-|$)/i, // apt101, unidade205A
          /(?:^|_|-)(\d{1,3})(?:_|-|$)/,                       // 101, 205 (número simples)
        ];

        for (const pattern of unitPatterns) {
          const match = fileName.match(pattern);
          if (match) {
            // Pegar o grupo de captura correto
            extractedUnit = (match[1] || match[2] || '').toUpperCase();
            if (extractedUnit) break;
          }
        }

        let extractedMonth = '';
        for (const pattern of patterns.monthYear) {
          const match = fileName.match(pattern);
          if (match) {
            if (match[1] && match[2]) {
              if (isNaN(Number(match[1]))) {
                const months = {
                  'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
                  'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
                  'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'abril': '04', 'maio': '05',
                  'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10',
                  'novembro': '11', 'dezembro': '12'
                };
                const monthNum = months[match[1].toLowerCase() as keyof typeof months];
                if (monthNum) {
                  extractedMonth = `${monthNum}/${match[2]}`;
                }
              } else {
                extractedMonth = `${match[1].padStart(2, '0')}/${match[2]}`;
              }
            }
            break;
          }
        }

        let extractedType: BoletoType = 'condominio';
        const typeMatch = fileName.match(patterns.type);
        if (typeMatch) {
          const typeStr = typeMatch[1].toLowerCase();
          if (typeStr.includes('agua') || typeStr.includes('água') || typeStr === 'water') {
            extractedType = 'agua';
          } else if (typeStr.includes('luz') || typeStr === 'light' || typeStr === 'electricity') {
            extractedType = 'luz';
          }
        }

        let extractedAmount = 0;
        const amountMatch = fileName.match(patterns.amount);
        if (amountMatch) {
          const amountStr = amountMatch[1].replace(/[.,]$/, '').replace(',', '.');
          extractedAmount = parseFloat(amountStr) || 0;
        }

        let extractedDueDate = '';
        let extractedBarcode = '';
        let extractedNossoNumero = '';
        const dueDateMatch = fileName.match(patterns.dueDate);
        if (dueDateMatch) {
          const [, day, month, year] = dueDateMatch;
          extractedDueDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
        }

        // Log para debug
        console.log(`[PDF Processing] ${pdfFile.name}:`, {
          extractedUnit,
          extractedMonth,
          extractedType,
          extractedAmount,
          extractedDueDate,
          fileNameAnalysis: fileName
        });

        // Se faltou algum dado importante, tentar extrair do CONTEÚDO do PDF (texto)
        try {
          if (!extractedUnit || !extractedMonth || !extractedDueDate || extractedAmount <= 0) {
            const pdfText = await extractTextFromPdf(pdfFile);
            const fields = extractFieldsFromBoletoText(pdfText);

            if (!extractedUnit && fields.unidade) extractedUnit = fields.unidade;
            if (!extractedMonth && fields.referencia) extractedMonth = fields.referencia;
            if (!extractedDueDate && fields.vencimento) extractedDueDate = fields.vencimento;
            if ((extractedAmount <= 0 || Number.isNaN(extractedAmount)) && typeof fields.valor === 'number') extractedAmount = fields.valor;
            if (!extractedBarcode && fields.codigoBarras) extractedBarcode = fields.codigoBarras;
            if (!extractedNossoNumero && fields.nossoNumero) extractedNossoNumero = fields.nossoNumero;
          }
        } catch (e) {
          console.warn('[PDF Processing] Falha ao extrair texto do PDF (conteúdo). Usando apenas nome do arquivo.', e);
        }

        // Se não conseguiu extrair unidade, tentar padrões mais simples
        if (!extractedUnit) {
          // Tentar encontrar qualquer número que possa ser unidade
          // Mas só usar se for claramente uma unidade (não apenas um número isolado)
          const simpleNumberMatch = fileName.match(/(\d{1,3})/);
          if (simpleNumberMatch) {
            const possibleUnit = simpleNumberMatch[1];
            // Só aceitar se o número for maior que 3 dígitos (ex: 03005 -> 03/005) ou se for precedido por palavras chave
            if (possibleUnit.length > 3 || fileName.toLowerCase().includes('unidade') || fileName.toLowerCase().includes('apt') || fileName.toLowerCase().includes('apto')) {
              extractedUnit = possibleUnit;
              console.log(`[PDF Processing] Usando padrão simples para unidade: ${extractedUnit}`);
            } else {
              console.warn(`[PDF Processing] Número encontrado mas não usado como unidade (muito curto ou sem contexto): ${possibleUnit} em "${fileName}"`);
            }
          }
        }

        boletoData.push({
          unidade: extractedUnit,
          mes: extractedMonth,
          vencimento: extractedDueDate,
          valor: extractedAmount,
          tipo: extractedType,
          status: 'Pendente',
          descricao: `Boleto importado de PDF: ${pdfFile.name}`,
          codigo_barras: extractedBarcode,
          nosso_numero: extractedNossoNumero,
          pdf_associado: pdfFile.name
        });
      }

      // Verificar se pelo menos uma unidade foi extraída
      const validBoletos = boletoData.filter(b => b.unidade);
      const invalidBoletos = boletoData.filter(b => !b.unidade);

      if (invalidBoletos.length > 0) {
        console.warn(`[ImportBoletos] ${invalidBoletos.length} PDFs não tiveram unidade extraída:`, invalidBoletos.map(b => b.pdf_associado));
        setErrors(prev => [...prev, `Atenção: ${invalidBoletos.length} PDF(s) não puderam ter a unidade extraída automaticamente. Verifique os nomes dos arquivos e tente renomeá-los seguindo o padrão: unidade_mes_ano.pdf (ex: 101A_01_2025.pdf)`]);
      }

      // Log detalhado das unidades extraídas
      console.log(`[ImportBoletos] Resumo da extração:`, {
        totalPDFs: pdfFiles.length,
        validBoletos: validBoletos.length,
        invalidBoletos: invalidBoletos.length,
        unidadesExtraidas: validBoletos.map(b => ({ arquivo: b.pdf_associado, unidade: b.unidade }))
      });

      // Processar apenas boletos válidos
      if (validBoletos.length > 0) {
        processJSONData(validBoletos);
        console.log(`[ImportBoletos] ${validBoletos.length} PDFs processados com sucesso`);
      } else {
        setErrors(prev => [...prev, 'Nenhum PDF teve seus dados extraídos com sucesso. Renomeie os arquivos seguindo o padrão: unidade_mes_ano.pdf']);
      }

    } catch (error) {
      setErrors([`Erro ao processar PDFs: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPdfFiles(files);
  };

  const processFile = async (fileToProcess: File) => {
    setIsProcessing(true);
    setErrors([]);
    setPreviewData([]);

    try {
      // Verificar se é um arquivo PDF
      if (fileToProcess.type === 'application/pdf' || fileToProcess.name.toLowerCase().endsWith('.pdf')) {
        await processPDFFile(fileToProcess);
        return;
      }

      const text = await fileToProcess.text();

      // Verificar se o conteúdo parece ser de um PDF
      const trimmed = text.trim();
      if (trimmed.startsWith('%PDF-')) {
        setErrors(['Este parece ser um arquivo PDF. PDFs devem ser processados como arquivos PDF.']);
        return;
      }

      // Tenta interpretar como JSON (array de boletos)
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            processJSONData(data);
            return;
          }
          setErrors(['JSON deve ser um array de objetos.']);
          return;
        } catch {
          // Não é JSON válido; tenta CSV abaixo
        }
      }

      // Tenta interpretar como CSV (qualquer extensão)
      const csvFile = new File([text], fileToProcess.name || 'data.csv', { type: 'text/csv' });
      await processCSV(csvFile);
    } catch (error) {
      setErrors([`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const processPDFFile = async (pdfFile: File) => {
    // Para PDFs únicos, criar entrada básica do boleto
    const pdfFiles = [pdfFile];
    setPdfFiles(pdfFiles);

    // Tentar extrair informações básicas do nome do arquivo
    const fileName = pdfFile.name.toLowerCase().replace('.pdf', '');

    // Inicializar todas as variáveis primeiro
    let extractedUnit = '';
    let extractedMonth = '';
    let extractedType: BoletoType = 'condominio';
    let extractedAmount = 0;
    let extractedDueDate = '';
    let extractedBarcode = '';
    let extractedNossoNumero = '';

    // Padrões comuns para identificação de dados
    const patterns = {
      // Unidade: 101A, 205, 45B, etc.
      unit: /(?:^|_|-)((?:\d{1,3})(?:[a-zA-Z]{0,2}))(?:_|-|$)/,

      // Mês/Ano: 01_2025, 01-2025, 01/2025, 012025, jan2025, etc.
      monthYear: [
        /(?:^|_|-)(\d{1,2})[_\/-](\d{4})(?:_|-|$)/,  // 01_2025, 01/2025
        /(?:^|_|-)(\d{1,2})(\d{4})(?:_|-|$)/,        // 012025
        /(?:^|_|-)(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[_-]?(\d{4})(?:_|-|$)/i, // jan2025
        /(?:^|_|-)(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)[_-]?(\d{4})(?:_|-|$)/i
      ],

      // Tipo: condominio, agua, luz, condo, etc.
      type: /(?:^|_|-)(condominio|condomínio|agua|água|luz|condo|water|light|electricity)(?:_|-|$)/,

      // Valor: pode ter pontos ou vírgulas
      amount: /(?:^|_|-)R\$?[_]?([\d.,]+)(?:_|-|$)/,

      // Vencimento: dd_mm_yyyy ou similar
      dueDate: /(?:^|_|-)(\d{1,2})[_\/-](\d{1,2})[_\/-](\d{4})(?:_|-|$)/
    };

    // Extrair unidade
    const unitPatterns = [
      /(?:^|_|-)((?:\d{1,3})(?:[a-zA-Z]{0,2}))(?:_|-|$)/,  // 101A, 205, 45B
      /(?:^|_|-)([a-zA-Z]{1,2}(\d{1,3}))(?:_|-|$)/,        // A101, B205
      /(?:^|_|-)(apt|apto|unidade)[_-]?(\d{1,3}[a-zA-Z]{0,2})(?:_|-|$)/i, // apt101, unidade205A
      /(?:^|_|-)(\d{1,3})(?:_|-|$)/,                       // 101, 205 (número simples)
    ];

    for (const pattern of unitPatterns) {
      const match = fileName.match(pattern);
      if (match) {
        // Pegar o grupo de captura correto
        extractedUnit = (match[1] || match[2] || '').toUpperCase();
        if (extractedUnit) break;
      }
    }

    // Se não conseguiu extrair unidade, tentar padrões mais simples
    if (!extractedUnit) {
      // Tentar encontrar qualquer número que possa ser unidade
      const simpleNumberMatch = fileName.match(/(\d{1,3})/);
      if (simpleNumberMatch) {
        extractedUnit = simpleNumberMatch[1];
        console.log(`[PDF Processing] Usando padrão simples para unidade: ${extractedUnit}`);
      }
    }

    // Extrair mês/ano
    for (const pattern of patterns.monthYear) {
      const match = fileName.match(pattern);
      if (match) {
        if (match[1] && match[2]) {
          // Se for mês por extenso, converter para número
          if (isNaN(Number(match[1]))) {
            const months = {
              'jan': '01', 'fev': '02', 'mar': '03', 'abr': '04', 'mai': '05', 'jun': '06',
              'jul': '07', 'ago': '08', 'set': '09', 'out': '10', 'nov': '11', 'dez': '12',
              'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'abril': '04', 'maio': '05',
              'junho': '06', 'julho': '07', 'agosto': '08', 'setembro': '09', 'outubro': '10',
              'novembro': '11', 'dezembro': '12'
            };
            const monthNum = months[match[1].toLowerCase() as keyof typeof months];
            if (monthNum) {
              extractedMonth = `${monthNum}/${match[2]}`;
            }
          } else {
            extractedMonth = `${match[1].padStart(2, '0')}/${match[2]}`;
          }
        }
        break;
      }
    }

    // Extrair tipo (já inicializada acima)
    const typeMatch = fileName.match(patterns.type);
    if (typeMatch) {
      const typeStr = typeMatch[1].toLowerCase();
      if (typeStr.includes('agua') || typeStr.includes('água') || typeStr === 'water') {
        extractedType = 'agua';
      } else if (typeStr.includes('luz') || typeStr === 'light' || typeStr === 'electricity') {
        extractedType = 'luz';
      }
    }

    // Extrair valor (já inicializada acima)
    const amountMatch = fileName.match(patterns.amount);
    if (amountMatch) {
      const amountStr = amountMatch[1].replace(/[.,]$/, '').replace(',', '.');
      extractedAmount = parseFloat(amountStr) || 0;
    }

    // Extrair data de vencimento (já inicializada acima)
    const dueDateMatch = fileName.match(patterns.dueDate);
    if (dueDateMatch) {
      const [, day, month, year] = dueDateMatch;
      extractedDueDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }

    // Log para debug
    console.log(`[PDF Processing] ${pdfFile.name}:`, {
      extractedUnit,
      extractedMonth,
      extractedType,
      extractedAmount,
      extractedDueDate
    });

    // Se faltou algum dado importante, tentar extrair do CONTEÚDO do PDF (texto)
    try {
      if (!extractedUnit || !extractedMonth || !extractedDueDate || extractedAmount <= 0) {
        const pdfText = await extractTextFromPdf(pdfFile);
        const fields = extractFieldsFromBoletoText(pdfText);

        if (!extractedUnit && fields.unidade) extractedUnit = fields.unidade;
        if (!extractedMonth && fields.referencia) extractedMonth = fields.referencia;
        if (!extractedDueDate && fields.vencimento) extractedDueDate = fields.vencimento;
        if ((extractedAmount <= 0 || Number.isNaN(extractedAmount)) && typeof fields.valor === 'number') extractedAmount = fields.valor;
        if (!extractedBarcode && fields.codigoBarras) extractedBarcode = fields.codigoBarras;
        if (!extractedNossoNumero && fields.nossoNumero) extractedNossoNumero = fields.nossoNumero;
      }
    } catch (e) {
      console.warn('[PDF Processing] Falha ao extrair texto do PDF (conteúdo). Usando apenas nome do arquivo.', e);
    }

    // Criar entrada básica para o boleto
    const boletoData = [{
      unidade: extractedUnit,
      mes: extractedMonth,
      vencimento: extractedDueDate,
      valor: extractedAmount,
      tipo: extractedType,
      status: 'Pendente',
      descricao: `Boleto importado de PDF: ${pdfFile.name}`,
      codigo_barras: extractedBarcode,
      nosso_numero: extractedNossoNumero,
      pdf_associado: pdfFile.name
    }];

    // Processar como dados JSON
    processJSONData(boletoData);
  };

  const getResidentByUnit = (unit: string): Resident | undefined => {
    return allResidents.find(r => r.unit.toLowerCase() === unit.toLowerCase());
  };

  /** Busca morador por unidade com flexibilidade: aceita "03", "03/005", "03 / 005", "03-005", etc. */
  const getResidentByUnitFlexible = (unit: string): Resident | undefined => {
    if (!unit || !unit.trim()) return undefined;

    const trimmed = unit.trim();
    console.log(`[Resident Lookup] Procurando morador para unidade: "${trimmed}"`);

    // 1. Match exato
    let found = getResidentByUnit(trimmed);
    if (found) {
      console.log(`[Resident Lookup] Encontrado por match exato: ${found.name} (${found.unit})`);
      return found;
    }

    // 2. Match normalizado (03/005, 03 / 005, 03-005)
    found = residentsPool.find(r => compareUnits(r.unit, trimmed));
    if (found) {
      console.log(`[Resident Lookup] Encontrado por match normalizado: ${found.name} (${found.unit})`);
      return found;
    }

    // 3. Match por bloco/apartamento: "03" → "03/005"; "03/005" ou "03-005"
    const blockMatch = trimmed.match(/^(\d{1,3})(?:\s*[\/\-]\s*(\d{1,3}))?$/);
    if (blockMatch) {
      const block = blockMatch[1].padStart(2, '0');
      const apt = blockMatch[2] ? blockMatch[2].padStart(3, '0') : null;

      if (apt) {
        // Tem bloco e apt: "03/005" ou "03-005"
        const target = `${block}/${apt}`;
        found = residentsPool.find(r => compareUnits(r.unit, target) || normalizeUnit(r.unit) === target);
        if (found) {
          console.log(`[Resident Lookup] Encontrado por bloco/apartamento completo: ${found.name} (${found.unit}) para target: ${target}`);
          return found;
        }
      }

      // Só bloco: "03" → busca residentes com bloco 03 (ex: 03/005)
      const blockCandidates = residentsPool.filter(r => {
        const n = normalizeUnit(r.unit);
        return n.startsWith(`${block}/`) || n === block;
      });
      if (blockCandidates.length === 1) {
        console.log(`[Resident Lookup] Encontrado único morador do bloco: ${blockCandidates[0].name} (${blockCandidates[0].unit})`);
        return blockCandidates[0];
      } else if (blockCandidates.length > 1) {
        console.warn(`[Resident Lookup] Múltiplos moradores encontrados para bloco "${block}": ${blockCandidates.map(r => `${r.name} (${r.unit})`).join(', ')}`);
        // Não retorna automaticamente para evitar associação incorreta
      }
    }

    // 4. Match apenas por apartamento (quando só tem número como "005") - MAIS RESTRITIVO
    // Só usar se o número for claramente um apartamento (mínimo 3 dígitos) e não houver ambiguidade
    if (/^\d{3,}$/.test(trimmed)) {
      const aptNumber = trimmed; // Não padronizar aqui

      // Procura exato: */005
      const exactMatches = residentsPool.filter(r => {
        const n = normalizeUnit(r.unit);
        return n.endsWith(`/${aptNumber}`);
      });

      if (exactMatches.length === 1) {
        console.log(`[Resident Lookup] Encontrado único morador por apartamento exato: ${exactMatches[0].name} (${exactMatches[0].unit})`);
        return exactMatches[0];
      } else if (exactMatches.length > 1) {
        console.warn(`[Resident Lookup] Múltiplos moradores encontrados para apartamento "${aptNumber}": ${exactMatches.map(r => `${r.name} (${r.unit})`).join(', ')}`);
        return undefined; // Não associar automaticamente para evitar erro
      }

      // Tentar sem padding se não encontrou
      if (aptNumber.startsWith('0')) {
        const shortApt = aptNumber.replace(/^0+/, ''); // "5" de "005"
        const shortMatches = residentsPool.filter(r => {
          const n = normalizeUnit(r.unit);
          return n.endsWith(`/${shortApt}`);
        });

        if (shortMatches.length === 1) {
          console.log(`[Resident Lookup] Encontrado único morador por apartamento curto: ${shortMatches[0].name} (${shortMatches[0].unit})`);
          return shortMatches[0];
        }
      }
    }

    // 5. Última tentativa: busca fuzzy por similaridade - APENAS SE FOR MUITO SIMILAR
    const trimmedUpper = trimmed.toUpperCase();
    const fuzzyMatches = residentsPool.filter(r => {
      const unitUpper = r.unit.toUpperCase();
      // Só considerar fuzzy se for substring significativo (não apenas números isolados)
      return (unitUpper.includes(trimmedUpper) && trimmedUpper.length > 2) ||
             (trimmedUpper.includes(unitUpper) && unitUpper.length > 2);
    });

    if (fuzzyMatches.length === 1) {
      console.log(`[Resident Lookup] Encontrado por busca fuzzy: ${fuzzyMatches[0].name} (${fuzzyMatches[0].unit})`);
      return fuzzyMatches[0];
    } else if (fuzzyMatches.length > 1) {
      console.warn(`[Resident Lookup] Múltiplos matches fuzzy encontrados para "${trimmed}": ${fuzzyMatches.map(r => `${r.name} (${r.unit})`).join(', ')}`);
    }

    console.warn(`[Resident Lookup] Nenhum morador encontrado para unidade "${trimmed}"`);
    return undefined;
  };

  const processCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      setErrors(['Arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados.']);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    console.log('Headers encontrados no CSV:', headers);
    console.log('Campos disponíveis para mapeamento:', headers.join(', '));

    // Função para verificar se um campo obrigatório existe nos headers
    const hasField = (fieldName: string, variations: string[]): boolean => {
      return headers.some(h =>
        variations.some(v => h.includes(v))
      );
    };

    // Campos obrigatórios com suas variações aceitas
    const requiredFieldsMap = {
      unidade: ['unidade', 'unit', 'apto', 'apartamento', 'apt'],
      mes: ['mes', 'referencia', 'referência', 'reference', 'mesref'],
      vencimento: ['vencimento', 'venc', 'data', 'duedate', 'due_date', 'datavenc'],
      valor: ['valor', 'amount', 'preco', 'price', 'total']
    };

    const missingFields: string[] = [];
    for (const [fieldKey, variations] of Object.entries(requiredFieldsMap)) {
      if (!hasField(fieldKey, variations)) {
        missingFields.push(fieldKey);
      }
    }

    if (missingFields.length > 0) {
      console.log('[ImportBoletos] Headers encontrados:', headers);
      const errorMsg = `Campos obrigatórios não encontrados: ${missingFields.join(', ')}.

Headers aceitos:
• Unidade: unidade, unit, apto, apartamento, apt
• Mês: mes, referencia, referência, reference, mesref
• Vencimento: vencimento, venc, data, duedate, due_date, datavenc
• Valor: valor, amount, preco, price, total

Headers encontrados: ${headers.join(', ')}

Baixe o template CSV para ver o formato correto.`;
      setErrors([errorMsg]);
      return;
    }

    pdfAssignmentsRef.current.clear();
    const boletos: Boleto[] = [];
    const csvErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const boleto: Partial<Boleto> = { id: Date.now().toString() + i };
      
      let unit = '';
      let referenceMonth = '';
      let dueDate = '';
      let amount = 0;

      headers.forEach((header, index) => {
        const value = values[index] || '';
        const headerLower = header.toLowerCase().trim();

        // Campos obrigatórios - DETECÇÃO MAIS FLEXÍVEL
        if (headerLower.includes('unidade') || headerLower.includes('unit') ||
            headerLower.includes('apto') || headerLower.includes('apartamento') ||
            headerLower.includes('apt') || headerLower === 'apart' ||
            headerLower.includes('numero') || headerLower === 'nº' ||
            headerLower === 'n' || headerLower.includes('endereco')) {
          unit = value;
        } else if (headerLower.includes('mes') || headerLower.includes('referencia') ||
                   headerLower.includes('referência') || headerLower.includes('reference') ||
                   headerLower.includes('mesref') || headerLower.includes('competencia')) {
          referenceMonth = value;
        } else if (headerLower.includes('vencimento') || headerLower.includes('venc') ||
                   headerLower.includes('data') || headerLower.includes('duedate') ||
                   headerLower.includes('due_date') || headerLower.includes('datavenc') ||
                   headerLower.includes('validade')) {
          if (!headerLower.includes('pagamento') && !headerLower.includes('paid') &&
              !headerLower.includes('quitacao')) {
            dueDate = value;
          }
        } else if (headerLower.includes('valor') || headerLower.includes('amount') ||
                   headerLower.includes('preco') || headerLower.includes('price') ||
                   headerLower.includes('total') || headerLower.includes('vlr') ||
                   headerLower === 'preço') {
          amount = parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'));
        }
        // Campos opcionais
        else if (headerLower.includes('nome') || headerLower.includes('name') || headerLower.includes('morador') || headerLower.includes('resident')) {
          // Nome será buscado pela unidade, mas pode ser usado para validação adicional
        } else if (headerLower.includes('status')) {
          boleto.status = value as 'Pendente' | 'Pago' | 'Vencido';
        } else if (headerLower.includes('codigo') || headerLower.includes('cod') || headerLower.includes('barcode') || headerLower.includes('linha_digitavel')) {
          boleto.barcode = value;
        } else if (headerLower.includes('descricao') || headerLower.includes('description') || headerLower.includes('observacao') || headerLower.includes('obs')) {
          boleto.description = value;
        } else if (headerLower.includes('pagamento') || headerLower.includes('paid') || headerLower.includes('data_pagamento') || headerLower.includes('paid_date')) {
          boleto.paidDate = value;
        } else if (headerLower.includes('tipo') || headerLower === 'type' || headerLower.includes('boleto_type')) {
          boleto.boletoType = normalizeBoletoType(value) || defaultBoletoType;
        }
      });
      if (!boleto.boletoType) boleto.boletoType = defaultBoletoType;

      // Validação mais flexível da unidade
      if (!unit || unit.trim() === '') {
        // Tentar encontrar unidade em outros campos (como nome que pode conter a unidade)
        const possibleUnitFields = ['nome', 'name', 'morador', 'resident'];
        let foundUnit = false;

        headers.forEach((header, idx) => {
          const hdrLower = header.toLowerCase().trim();
          if (possibleUnitFields.some(field => hdrLower.includes(field))) {
            const nameValue = values[idx] || '';
            // Tentar extrair unidade do nome (ex: "João Silva - Apt 101" -> "101")
            const unitMatch = nameValue.match(/\b(\d{1,3}[a-zA-Z]?\d*\/?\d*)\b/);
            if (unitMatch && unitMatch[1]) {
              unit = unitMatch[1];
              foundUnit = true;
            }
          }
        });

        if (!foundUnit) {
          csvErrors.push(`Linha ${i + 1}: Unidade não encontrada. Campos aceitos: unidade, unit, apto, apartamento, apt, numero, n, endereco. Ou inclua a unidade no campo nome (ex: 'João Silva - Apt 101')`);
          continue;
        }
      }

      const resident = getResidentByUnitFlexible(unit);
      console.log(`🔍 Procurando morador para unidade "${unit}":`, resident ? `✅ Encontrado: ${resident.name} (${resident.unit})` : `❌ Não encontrado. Moradores disponíveis: ${allResidents.slice(0, 5).map(r => `${r.name} (${r.unit})`).join(', ')}${allResidents.length > 5 ? '...' : ''}`);
      if (!resident) {
        // Busca moradores com unidades similares para sugerir
        const similarUnits = allResidents.filter(r => {
          const rUnit = r.unit.toLowerCase();
          const searchUnit = unit.toLowerCase();
          return rUnit.includes(searchUnit) || searchUnit.includes(rUnit) ||
                 rUnit.replace(/[^\d]/g, '') === searchUnit.replace(/[^\d]/g, '');
        }).slice(0, 3);

        let errorMsg = `Linha ${i + 1}: Morador não encontrado para unidade "${unit}"`;
        if (similarUnits.length > 0) {
          errorMsg += `. Moradores similares encontrados: ${similarUnits.map(r => `"${r.name}" (${r.unit})`).join(', ')}`;
        }
        errorMsg += '. Verifique se a unidade está correta ou cadastre o morador.';

        csvErrors.push(errorMsg);
        continue;
      }

      if (!referenceMonth) {
        csvErrors.push(`Linha ${i + 1}: Mês de referência é obrigatório`);
        continue;
      }

      if (!dueDate) {
        csvErrors.push(`Linha ${i + 1}: Data de vencimento é obrigatória`);
        continue;
      }

      // Validar formato de data
      let parsedDate: Date;
      try {
        // Tentar diferentes formatos de data
        if (dueDate.includes('/')) {
          const [day, month, year] = dueDate.split('/');
          parsedDate = new Date(`${year}-${month}-${day}`);
        } else {
          parsedDate = new Date(dueDate);
        }
        if (isNaN(parsedDate.getTime())) {
          throw new Error('Data inválida');
        }
      } catch {
        csvErrors.push(`Linha ${i + 1}: Formato de data inválido: ${dueDate}`);
        continue;
      }

      if (isNaN(amount) || amount <= 0) {
        csvErrors.push(`Linha ${i + 1}: Valor inválido`);
        continue;
      }

      const boletoType: BoletoType = (boleto.boletoType as BoletoType) || defaultBoletoType;
      const exists = existingBoletos.some(b => 
        compareUnits(b.unit, resident.unit) && b.referenceMonth === referenceMonth && (b.boletoType || 'condominio') === boletoType
      );
      if (exists) {
        csvErrors.push(`Linha ${i + 1}: Boleto já existe para unidade ${resident.unit}, referência ${referenceMonth} e tipo ${boletoType}`);
        continue;
      }

      // Determinar status se não foi informado
      let status: 'Pendente' | 'Pago' | 'Vencido' = boleto.status || 'Pendente';
      if (!boleto.status) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (parsedDate < today) {
          status = 'Vencido';
        }
      }

      // Associar PDF se disponível (buscar por nome do arquivo); guardar File para upload depois
      let pdfUrl = '';
      if (pdfFiles.length > 0) {
        const matchingPdf = pdfFiles.find(pdf => {
          const pdfName = pdf.name.toLowerCase();
          return pdfName.includes(unit.toLowerCase()) || pdfName.includes(referenceMonth.toLowerCase());
        });
        if (matchingPdf) {
          pdfUrl = URL.createObjectURL(matchingPdf);
          pdfAssignmentsRef.current.set(boleto.id!, matchingPdf);
        }
      }

      boletos.push({
        id: boleto.id!,
        residentName: resident.name,
        unit: resident.unit,
        referenceMonth: referenceMonth,
        dueDate: parsedDate.toISOString().split('T')[0],
        amount: amount,
        status: status,
        boletoType: boletoType,
        barcode: boleto.barcode,
        description: boleto.description,
        pdfUrl: pdfUrl || undefined,
        // Campos de identificação para boletos importados
        resident_id: resident.id, // ID do morador no sistema
        unidade_id: resident.unit, // Usar unidade como ID (pode ser mapeado depois)
        nosso_numero: boleto.nosso_numero || boleto.id, // Usar nosso_numero se disponível, senão o ID
        paidDate: boleto.paidDate
      });
    }

    if (csvErrors.length > 0) {
      setErrors(csvErrors);
    }
    setPreviewData(boletos);
  };

  const processJSON = async (file: File) => {
    const text = await file.text();
    let data: any[];
    
    try {
      data = JSON.parse(text);
    } catch (error) {
      setErrors(['Arquivo JSON inválido.']);
      return;
    }

    if (!Array.isArray(data)) {
      setErrors(['JSON deve ser um array de objetos.']);
      return;
    }

    pdfAssignmentsRef.current.clear();
    const boletos: Boleto[] = [];
    const jsonErrors: string[] = [];

    data.forEach((item, index) => {
      let unit = item.unidade || item.unit || item.apto || item.apartamento || item.apt ||
                 item.numero || item.n || item.endereco;

      // Se ainda não encontrou unidade, tentar extrair do nome
      if (!unit && (item.nome || item.name || item.morador)) {
        const nameField = item.nome || item.name || item.morador;
        const unitMatch = nameField.match(/\b(\d{1,3}[a-zA-Z]?\d*\/?\d*)\b/);
        if (unitMatch && unitMatch[1]) {
          unit = unitMatch[1];
        }
      }

      if (!unit || unit.toString().trim() === '') {
        jsonErrors.push(`Item ${index + 1}: Unidade não encontrada. Campos aceitos: unidade, unit, apto, apartamento, apt, numero, n, endereco, ou unidade no campo nome (ex: "João Silva - Apt 101")`);
        return;
      }

      const resident = getResidentByUnitFlexible(unit.toString());
      if (!resident) {
                // Busca moradores com unidades similares para sugerir
        const similarUnits = allResidents.filter(r => {
          const rUnit = r.unit.toLowerCase();
          const searchUnit = unit.toString().toLowerCase();
          return rUnit.includes(searchUnit) || searchUnit.includes(rUnit) ||
                 rUnit.replace(/[^\d]/g, '') === searchUnit.replace(/[^\d]/g, '');
        }).slice(0, 3);

        let errorMsg = `Item ${index + 1}: Morador não encontrado para unidade "${unit}"`;
        if (similarUnits.length > 0) {
          errorMsg += `. Moradores similares encontrados: ${similarUnits.map(r => `"${r.name}" (${r.unit})`).join(', ')}`;
        }
        errorMsg += '. Verifique se a unidade está correta ou cadastre o morador.';

        jsonErrors.push(errorMsg);
        return;
      }

      const referenceMonth = item.mes || item.referencia || item.referência || item.reference || item.referenceMonth || item.mesref;
      if (!referenceMonth) {
        jsonErrors.push(`Item ${index + 1}: Mês de referência é obrigatório`);
        return;
      }

      const dueDate = item.vencimento || item.venc || item.dataVencimento || item.dueDate || item.data || item.datavenc || item.due_date;
      if (!dueDate) {
        jsonErrors.push(`Item ${index + 1}: Data de vencimento é obrigatória`);
        return;
      }

      let parsedDate: Date;
      try {
        if (typeof dueDate === 'string' && dueDate.includes('/')) {
          const [day, month, year] = dueDate.split('/');
          parsedDate = new Date(`${year}-${month}-${day}`);
        } else {
          parsedDate = new Date(dueDate);
        }
        if (isNaN(parsedDate.getTime())) {
          throw new Error('Data inválida');
        }
      } catch {
        jsonErrors.push(`Item ${index + 1}: Formato de data inválido: ${dueDate}`);
        return;
      }

      const amount = parseFloat(item.valor || item.amount || item.preco || item.price || item.total || 0);
      if (isNaN(amount) || amount <= 0) {
        jsonErrors.push(`Item ${index + 1}: Valor inválido`);
        return;
      }

      const boletoType: BoletoType = normalizeBoletoType(item.tipo || item.type || item.boleto_type || '') || defaultBoletoType;
      const exists = existingBoletos.some(b => 
        compareUnits(b.unit, resident.unit) && b.referenceMonth === referenceMonth && (b.boletoType || 'condominio') === boletoType
      );
      if (exists) {
        jsonErrors.push(`Item ${index + 1}: Boleto já existe para unidade ${resident.unit}, referência ${referenceMonth} e tipo ${boletoType}`);
        return;
      }

      let status: 'Pendente' | 'Pago' | 'Vencido' = item.status || 'Pendente';
      if (!item.status) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (parsedDate < today) {
          status = 'Vencido';
        }
      }

      const boletoId = Date.now().toString() + index;
      let pdfUrl = '';
      if (pdfFiles.length > 0) {
        const matchingPdf = pdfFiles.find(pdf => {
          const pdfName = pdf.name.toLowerCase();
          return pdfName.includes(unit.toLowerCase()) || pdfName.includes(referenceMonth.toLowerCase());
        });
        if (matchingPdf) {
          pdfUrl = URL.createObjectURL(matchingPdf);
          pdfAssignmentsRef.current.set(boletoId, matchingPdf);
        }
      }

      boletos.push({
        id: boletoId,
        residentName: resident.name,
        unit: resident.unit,
        referenceMonth: referenceMonth,
        dueDate: parsedDate.toISOString().split('T')[0],
        amount: amount,
        status: status,
        boletoType: boletoType,
        barcode: item.codigo || item.cod || item.barcode || item.linha_digitavel || item.codigo_barras || item.codigoBarras,
        description: item.descricao || item.description || item.observacao || item.obs,
        pdfUrl: pdfUrl || undefined,
        // Campos de identificação para boletos importados
        resident_id: resident.id,
        unidade_id: resident.unit,
        nosso_numero: item.nosso_numero || item.nossoNumero || item.nosso_numero_boleto || undefined,
        paidDate: item.pagamento || item.paidDate || item.data_pagamento || item.paid_date
      });
    });

    if (jsonErrors.length > 0) {
      setErrors(jsonErrors);
    }
    setPreviewData(boletos);
  };

  const processJSONData = (data: any[]) => {
    pdfAssignmentsRef.current.clear();
    const boletos: Boleto[] = [];
    const jsonErrors: string[] = [];

    data.forEach((item, index) => {
      let unit = item.unidade || item.unit || item.apto || item.apartamento || item.apt ||
                 item.numero || item.n || item.endereco;

      // Se ainda não encontrou unidade, tentar extrair do nome
      if (!unit && (item.nome || item.name || item.morador)) {
        const nameField = item.nome || item.name || item.morador;
        const unitMatch = nameField.match(/\b(\d{1,3}[a-zA-Z]?\d*\/?\d*)\b/);
        if (unitMatch && unitMatch[1]) {
          unit = unitMatch[1];
        }
      }

      if (!unit || unit.toString().trim() === '') {
        jsonErrors.push(`Item ${index + 1}: Unidade não encontrada. Campos aceitos: unidade, unit, apto, apartamento, apt, numero, n, endereco, ou unidade no campo nome (ex: "João Silva - Apt 101")`);
        return;
      }

      const resident = getResidentByUnitFlexible(unit.toString());
      if (!resident) {
                // Busca moradores com unidades similares para sugerir
        const similarUnits = allResidents.filter(r => {
          const rUnit = r.unit.toLowerCase();
          const searchUnit = unit.toString().toLowerCase();
          return rUnit.includes(searchUnit) || searchUnit.includes(rUnit) ||
                 rUnit.replace(/[^\d]/g, '') === searchUnit.replace(/[^\d]/g, '');
        }).slice(0, 3);

        let errorMsg = `Item ${index + 1}: Morador não encontrado para unidade "${unit}"`;
        if (similarUnits.length > 0) {
          errorMsg += `. Moradores similares encontrados: ${similarUnits.map(r => `"${r.name}" (${r.unit})`).join(', ')}`;
        }
        errorMsg += '. Verifique se a unidade está correta ou cadastre o morador.';

        jsonErrors.push(errorMsg);
        return;
      }

      const referenceMonth = item.mes || item.referencia || item.referência || item.reference || item.referenceMonth || item.mesref;
      if (!referenceMonth) {
        jsonErrors.push(`Item ${index + 1}: Mês de referência é obrigatório`);
        return;
      }

      const dueDate = item.vencimento || item.venc || item.dataVencimento || item.dueDate || item.data || item.datavenc || item.due_date;
      if (!dueDate) {
        jsonErrors.push(`Item ${index + 1}: Data de vencimento é obrigatória`);
        return;
      }

      let parsedDate: Date;
      try {
        if (typeof dueDate === 'string' && dueDate.includes('/')) {
          const [day, month, year] = dueDate.split('/');
          parsedDate = new Date(`${year}-${month}-${day}`);
        } else {
          parsedDate = new Date(dueDate);
        }
        if (isNaN(parsedDate.getTime())) {
          throw new Error('Data inválida');
        }
      } catch {
        jsonErrors.push(`Item ${index + 1}: Formato de data inválido: ${dueDate}`);
        return;
      }

      const amount = parseFloat(item.valor || item.amount || item.preco || item.price || item.total || 0);
      if (isNaN(amount) || amount <= 0) {
        jsonErrors.push(`Item ${index + 1}: Valor inválido`);
        return;
      }

      const boletoType: BoletoType = normalizeBoletoType(item.tipo || item.type || item.boleto_type || '') || defaultBoletoType;
      const exists = existingBoletos.some(b => 
        compareUnits(b.unit, resident.unit) && b.referenceMonth === referenceMonth && (b.boletoType || 'condominio') === boletoType
      );
      if (exists) {
        jsonErrors.push(`Item ${index + 1}: Boleto já existe para unidade ${resident.unit}, referência ${referenceMonth} e tipo ${boletoType}`);
        return;
      }

      let status: 'Pendente' | 'Pago' | 'Vencido' = item.status || 'Pendente';
      if (!item.status) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (parsedDate < today) {
          status = 'Vencido';
        }
      }

      const boletoId = Date.now().toString() + index;
      let pdfUrl = '';
      if (pdfFiles.length > 0) {
        const matchingPdf = pdfFiles.find(pdf => {
          const pdfName = pdf.name.toLowerCase();
          return pdfName.includes(unit.toLowerCase()) || pdfName.includes(referenceMonth.toLowerCase());
        });
        if (matchingPdf) {
          pdfUrl = URL.createObjectURL(matchingPdf);
          pdfAssignmentsRef.current.set(boletoId, matchingPdf);
        }
      }

      boletos.push({
        id: boletoId,
        residentName: resident.name,
        unit: resident.unit,
        referenceMonth: referenceMonth,
        dueDate: parsedDate.toISOString().split('T')[0],
        amount: amount,
        status: status,
        boletoType: boletoType,
        barcode: item.codigo || item.cod || item.barcode || item.linha_digitavel || item.codigo_barras || item.codigoBarras,
        description: item.descricao || item.description || item.observacao || item.obs,
        pdfUrl: pdfUrl || undefined,
        paidDate: item.pagamento || item.paidDate || item.data_pagamento || item.paid_date
      });
    });

    if (jsonErrors.length > 0) {
      setErrors(jsonErrors);
    }
    setPreviewData(boletos);
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      setErrors(['Nenhum boleto válido para importar.']);
      return;
    }
    setIsImporting(true);
    setErrors([]);
    try {
      // Aplicar designações da UI ao ref antes do upload
      pdfAssignmentsRef.current.clear();
      Object.entries(assignedPdfByBoletoId).forEach(([id, f]) => {
        if (f) pdfAssignmentsRef.current.set(id, f);
      });
      // Revogar blob URLs do preview (não mutar estado)
      previewData.forEach(b => {
        if (b.pdfUrl?.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(b.pdfUrl);
          } catch {
            /* ignore */
          }
        }
      });
      // Upload PDFs e montar mapa id -> url final
      const fileToUrl = new Map<File, string>();
      const boletoIdToPdfUrl = new Map<string, string>();
      const uploadWarnings: string[] = [];
      for (const b of previewData) {
        const pdfFile = pdfAssignmentsRef.current.get(b.id);
        if (!pdfFile) continue;
        let url = fileToUrl.get(pdfFile);
        if (url === undefined) {
          const result = await uploadBoletoPdf(pdfFile, b.id);
          if (result.error || !result.url) {
            uploadWarnings.push(`${b.unit} ${b.referenceMonth}: ${result.error || 'Falha no envio do PDF'}`);
          } else {
            url = result.url;
            fileToUrl.set(pdfFile, url);
            boletoIdToPdfUrl.set(b.id, url);
          }
        } else {
          boletoIdToPdfUrl.set(b.id, url);
        }
      }
      // Construir lista para importação sem mutar previewData (sem blob URLs)
      const boletosToImport: Boleto[] = previewData.map(b => ({
        ...b,
        pdfUrl: boletoIdToPdfUrl.get(b.id) ?? undefined,
      }));
      await onImport(boletosToImport);
      if (uploadWarnings.length > 0) {
        toast.error(`Boletos importados, mas alguns PDFs não foram enviados (verifique o bucket "boletos" no Supabase).`);
      }
      handleClose();
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e ?? '')).trim() || 'Erro ao importar.';
      setErrors([message]);
      try {
        toast.error(message);
      } catch {
        /* ignore toast */
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    previewData.forEach(b => {
      if (b.pdfUrl?.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(b.pdfUrl);
        } catch {
          /* ignore */
        }
      }
    });
    setFile(null);
    setPdfFiles([]);
    setPreviewData([]);
    setErrors([]);
    setAssignedPdfByBoletoId({});
    pdfAssignmentsRef.current.clear();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
    onClose();
  };

  const downloadTemplate = () => {
    const template = `unidade,mes,vencimento,valor,tipo,status,codigo_barras,descricao
102A,01/2025,10/01/2025,450.00,condominio,Pendente,34191090000012345678901234567890123456789012,Taxa de condomínio
405B,01/2025,10/01/2025,120.50,agua,Pendente,,Conta de água
301,02/2025,15/02/2025,85.00,luz,Pendente,,Conta de luz

Headers aceitos:
- Unidade: unidade, unit, apto, apartamento, apt
- Mês: mes, referencia, referência, reference, mesref
- Vencimento: vencimento, venc, data, duedate, due_date, datavenc
- Valor: valor, amount, preco, price, total
- Tipo: tipo, type, boleto_type (condominio/agua/luz)
- Status: status (Pendente/Pago/Vencido)
- Código: codigo, cod, barcode, linha_digitavel
- Descrição: descricao, description, observacao, obs
- Pagamento: pagamento, paid, data_pagamento, paid_date

Exemplos de nomes de arquivos PDF que o sistema reconhece:
- boleto_102A_01_2025_condominio.pdf (unidade: 102A, mês: 01/2025, tipo: condominio)
- agua_405B_jan2025_R$120,50.pdf (tipo: agua, unidade: 405B, mês: 01/2025, valor: 120.50)
- luz_301_15_02_2025.pdf (tipo: luz, unidade: 301, vencimento: 15/02/2025)
- 101_janeiro_2025_condominio_R$450.pdf (unidade: 101, mês: 01/2025, valor: 450)`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_boletos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">Importar Boletos</h3>
            <p className="text-xs opacity-40 mt-1">Importe dados via CSV/JSON ou faça upload direto de PDFs dos boletos. O sistema tentará extrair informações automaticamente dos nomes dos arquivos.</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tipo padrão: Taxa/Condomínio, Água ou Luz (usado quando o arquivo não informa a coluna tipo) */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-black uppercase tracking-wider opacity-60">Tipo padrão dos boletos:</span>
          <select
            value={defaultBoletoType}
            onChange={(e) => setDefaultBoletoType(e.target.value as BoletoType)}
            className="px-4 py-2 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl text-sm font-bold outline-none focus:border-[var(--text-primary)]/50"
            style={{ color: 'var(--text-primary)' }}
          >
            <option value="condominio">Taxa/Condomínio</option>
            <option value="agua">Água</option>
            <option value="luz">Luz</option>
          </select>
          <span className="text-[10px] opacity-50">(CSV/JSON pode ter coluna &quot;tipo&quot;: condominio, agua ou luz)</span>
        </div>

        {/* Informações sobre campos aceitos */}
        <div className="mb-6 p-4 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl">
          <h4 className="text-sm font-bold mb-2">📋 Campos Aceitos para Importação</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-medium text-red-400">* Obrigatórios:</span>
              <ul className="mt-1 space-y-1 opacity-80">
                <li><strong>Unidade:</strong> unidade, unit, apto, apartamento, apt, numero, n, endereco</li>
                <li><strong>Mês/Ref:</strong> mes, referencia, referência, mesref, competencia</li>
                <li><strong>Vencimento:</strong> vencimento, venc, data, duedate, datavenc</li>
                <li><strong>Valor:</strong> valor, amount, preco, price, vlr, total</li>
              </ul>
            </div>
            <div>
              <span className="font-medium text-blue-400">* Opcionais:</span>
              <ul className="mt-1 space-y-1 opacity-80">
                <li><strong>Tipo:</strong> tipo, type, boleto_type (condominio/agua/luz)</li>
                <li><strong>Status:</strong> status (Pendente/Pago/Vencido)</li>
                <li><strong>Código:</strong> codigo, cod, barcode, linha_digitavel</li>
                <li><strong>Nome:</strong> nome, name, morador</li>
              </ul>
            </div>
          </div>
          <p className="text-xs opacity-60 mt-2">
            💡 <strong>Dica:</strong> Se não encontrar a unidade nos campos específicos, o sistema tenta extraí-la automaticamente do campo nome (ex: "João Silva - Apt 101").
          </p>
        </div>

        {/* Importar: selecionar arquivo CSV ou JSON */}
        <div className="mb-6 space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-8 text-center cursor-pointer hover:border-[var(--text-primary)]/30 transition-all"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="text-sm font-bold mb-2">
              {file ? file.name : 'Clique para selecionar arquivos'}
            </p>
            <p className="text-xs opacity-40">Aceita CSV, JSON, TXT ou múltiplos PDFs. Para PDFs, o sistema tentará extrair dados automaticamente do nome do arquivo (unidade, mês, valor, etc.).</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,.txt,.pdf,text/csv,application/json,text/plain,application/pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {previewData.length > 0 && (
            <div
              onClick={() => pdfInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-6 text-center cursor-pointer hover:border-[var(--text-primary)]/30 transition-all"
            >
              <FileIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-bold mb-2">
                {pdfFiles.length > 0 ? `${pdfFiles.length} PDF(s) disponível(eis) para designar` : 'Selecionar PDFs dos boletos (opcional)'}
              </p>
              <p className="text-xs opacity-40">Selecione os PDFs dos boletos para vincular aos respectivos moradores após importar os dados.</p>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={handlePdfSelect}
                className="hidden"
              />
              {pdfFiles.length > 0 && (
                <div className="mt-3 text-xs opacity-60 text-left max-h-24 overflow-y-auto">
                  {pdfFiles.map((pdf, idx) => (
                    <div key={idx} className="truncate">{pdf.name}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={downloadTemplate}
            className="text-xs opacity-60 hover:opacity-100 flex items-center gap-2 transition-opacity"
          >
            <Download className="w-3 h-3" />
            Baixar template CSV
          </button>
        </div>

        {/* Erros */}
        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <p className="text-xs font-black text-red-400">Erros encontrados:</p>
            </div>
            <ul className="text-xs opacity-80 space-y-1 max-h-32 overflow-y-auto">
              {errors.map((error, index) => (
                <li key={index}>• {typeof error === 'string' ? error : String(error ?? '')}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview */}
        {previewData.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <p className="text-sm font-black">
                  {previewData.length} boleto(s) pronto(s) para importar
                </p>
              </div>
              {previewData.some(boleto => {
                const resident = allResidents.find(r => r.name === boleto.residentName);
                return resident && !compareUnits(boleto.unit, resident.unit);
              }) && (
                <div className="flex items-center gap-2 text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-xs font-bold">Atenção: Verifique associações de unidade</p>
                </div>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto border border-[var(--border-color)] rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="p-3 text-left font-black uppercase">Unidade</th>
                    <th className="p-3 text-left font-black uppercase">Morador</th>
                    <th className="p-3 text-left font-black uppercase">Tipo</th>
                    <th className="p-3 text-left font-black uppercase">Mês</th>
                    <th className="p-3 text-left font-black uppercase">Vencimento</th>
                    <th className="p-3 text-left font-black uppercase">Valor</th>
                    <th className="p-3 text-left font-black uppercase">Status</th>
                    <th className="p-3 text-left font-black uppercase">Designar PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((boleto, index) => {
                    // Verificar se a unidade do boleto corresponde exatamente à unidade do morador
                    const resident = allResidents.find(r => r.name === boleto.residentName);
                    const unitMismatch = resident && !compareUnits(boleto.unit, resident.unit);

                    return (
                      <tr key={boleto.id} className={`border-t border-[var(--border-color)] ${unitMismatch ? 'bg-red-500/10' : ''}`}>
                        <td className="p-3">
                          {boleto.unit}
                          {unitMismatch && (
                            <div className="text-xs text-red-400 mt-1">
                              ⚠️ Unidade do boleto ≠ unidade do morador ({resident?.unit})
                            </div>
                          )}
                        </td>
                        <td className="p-3">{boleto.residentName}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/10">
                          {boleto.boletoType === 'agua' ? 'Água' : boleto.boletoType === 'luz' ? 'Luz' : 'Taxa/Condomínio'}
                        </span>
                      </td>
                      <td className="p-3">{boleto.referenceMonth}</td>
                      <td className="p-3">{new Date(boleto.dueDate).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">{formatCurrency(boleto.amount)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                          boleto.status === 'Pago' ? 'bg-green-500/20 text-green-400' :
                          boleto.status === 'Vencido' ? 'bg-red-500/20 text-red-400' :
                          'bg-amber-500/20 text-amber-400'
                        }`}>
                          {boleto.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <select
                          value={assignedPdfByBoletoId[boleto.id]?.name ?? ''}
                          onChange={(e) => {
                            const name = e.target.value;
                            const chosen = name ? pdfFiles.find(f => f.name === name) ?? null : null;
                            setAssignedPdfByBoletoId(prev => ({ ...prev, [boleto.id]: chosen }));
                            if (chosen) pdfAssignmentsRef.current.set(boleto.id, chosen);
                            else pdfAssignmentsRef.current.delete(boleto.id);
                          }}
                          className="w-full max-w-[180px] px-2 py-1.5 bg-white/5 border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]/50 text-[10px]"
                        >
                          <option value="">Nenhum</option>
                          {pdfFiles.map((pdf, idx) => (
                            <option key={idx} value={pdf.name}>{pdf.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-white/5 border border-[var(--border-color)] rounded-xl text-xs font-black uppercase hover:bg-white/10 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={previewData.length === 0 || isProcessing || isImporting}
            className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-xl text-xs font-black uppercase hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isImporting ? 'Importando...' : `Importar ${previewData.length > 0 ? `(${previewData.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportBoletosModal;