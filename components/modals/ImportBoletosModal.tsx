import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, Download, File as FileIcon } from 'lucide-react';
import { Boleto, Resident } from '../../types';
import { uploadBoletoPdf } from '../../services/dataService';
import { useToast } from '../../contexts/ToastContext';

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
  /** Designação manual: boleto.id -> File (PDF escolhido para aquele morador). */
  const [assignedPdfByBoletoId, setAssignedPdfByBoletoId] = useState<Record<string, File | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const pdfAssignmentsRef = useRef<Map<string, File>>(new Map());

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
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processFile(selectedFile);
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
      const text = await fileToProcess.text();

      // Tenta interpretar como JSON (array de boletos)
      const trimmed = text.trim();
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

  const getResidentByUnit = (unit: string): Resident | undefined => {
    return allResidents.find(r => r.unit.toLowerCase() === unit.toLowerCase());
  };

  const processCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      setErrors(['Arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados.']);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredFields = ['unidade', 'mes', 'vencimento', 'valor'];
    const missingFields = requiredFields.filter(field => 
      !headers.some(h => 
        h.includes('unidade') || h.includes('unit') || h.includes('apto') ||
        (field === 'mes' && (h.includes('mes') || h.includes('referencia') || h.includes('referência'))) ||
        (field === 'vencimento' && (h.includes('vencimento') || h.includes('venc') || h.includes('data'))) ||
        (field === 'valor' && (h.includes('valor') || h.includes('amount')))
      )
    );
    
    if (missingFields.length > 0) {
      setErrors([`Campos obrigatórios não encontrados: ${missingFields.join(', ')}`]);
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
        
        if (headerLower.includes('unidade') || headerLower.includes('unit') || headerLower.includes('apto')) {
          unit = value;
        } else if (headerLower.includes('mes') || headerLower.includes('referencia') || headerLower.includes('referência')) {
          referenceMonth = value;
        } else if (headerLower.includes('vencimento') || headerLower.includes('venc') || (headerLower.includes('data') && !headerLower.includes('pagamento'))) {
          dueDate = value;
        } else if (headerLower.includes('valor') || headerLower.includes('amount')) {
          amount = parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'));
        } else if (headerLower.includes('nome') || headerLower.includes('name')) {
          // Nome será buscado pela unidade
        } else if (headerLower.includes('status')) {
          boleto.status = value as 'Pendente' | 'Pago' | 'Vencido';
        } else if (headerLower.includes('codigo') || headerLower.includes('cod') || headerLower.includes('barcode')) {
          boleto.barcode = value;
        } else if (headerLower.includes('descricao') || headerLower.includes('description')) {
          boleto.description = value;
        } else if (headerLower.includes('pagamento') || headerLower.includes('paid')) {
          boleto.paidDate = value;
        }
      });

      if (!unit) {
        csvErrors.push(`Linha ${i + 1}: Unidade é obrigatória`);
        continue;
      }

      const resident = getResidentByUnit(unit);
      if (!resident) {
        csvErrors.push(`Linha ${i + 1}: Morador não encontrado para unidade ${unit}`);
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

      // Verificar se já existe boleto para esta unidade e mês
      const exists = existingBoletos.some(b => 
        b.unit === unit && b.referenceMonth === referenceMonth
      );
      if (exists) {
        csvErrors.push(`Linha ${i + 1}: Boleto já existe para unidade ${unit} e referência ${referenceMonth}`);
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
        unit: unit,
        referenceMonth: referenceMonth,
        dueDate: parsedDate.toISOString().split('T')[0],
        amount: amount,
        status: status,
        barcode: boleto.barcode,
        description: boleto.description,
        pdfUrl: pdfUrl || undefined,
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
      const unit = item.unidade || item.unit || item.apto;
      if (!unit) {
        jsonErrors.push(`Item ${index + 1}: Unidade é obrigatória`);
        return;
      }

      const resident = getResidentByUnit(unit);
      if (!resident) {
        jsonErrors.push(`Item ${index + 1}: Morador não encontrado para unidade ${unit}`);
        return;
      }

      const referenceMonth = item.mes || item.referencia || item.referência || item.referenceMonth;
      if (!referenceMonth) {
        jsonErrors.push(`Item ${index + 1}: Mês de referência é obrigatório`);
        return;
      }

      const dueDate = item.vencimento || item.venc || item.dataVencimento || item.dueDate;
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

      const amount = parseFloat(item.valor || item.amount || 0);
      if (isNaN(amount) || amount <= 0) {
        jsonErrors.push(`Item ${index + 1}: Valor inválido`);
        return;
      }

      const exists = existingBoletos.some(b => 
        b.unit === unit && b.referenceMonth === referenceMonth
      );
      if (exists) {
        jsonErrors.push(`Item ${index + 1}: Boleto já existe para unidade ${unit} e referência ${referenceMonth}`);
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
        unit: unit,
        referenceMonth: referenceMonth,
        dueDate: parsedDate.toISOString().split('T')[0],
        amount: amount,
        status: status,
        barcode: item.codigo || item.cod || item.barcode,
        description: item.descricao || item.description,
        pdfUrl: pdfUrl || undefined,
        paidDate: item.pagamento || item.paidDate
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
      const unit = item.unidade || item.unit || item.apto;
      if (!unit) {
        jsonErrors.push(`Item ${index + 1}: Unidade é obrigatória`);
        return;
      }

      const resident = getResidentByUnit(unit);
      if (!resident) {
        jsonErrors.push(`Item ${index + 1}: Morador não encontrado para unidade ${unit}`);
        return;
      }

      const referenceMonth = item.mes || item.referencia || item.referência || item.referenceMonth;
      if (!referenceMonth) {
        jsonErrors.push(`Item ${index + 1}: Mês de referência é obrigatório`);
        return;
      }

      const dueDate = item.vencimento || item.venc || item.dataVencimento || item.dueDate;
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

      const amount = parseFloat(item.valor || item.amount || 0);
      if (isNaN(amount) || amount <= 0) {
        jsonErrors.push(`Item ${index + 1}: Valor inválido`);
        return;
      }

      const exists = existingBoletos.some(b => 
        b.unit === unit && b.referenceMonth === referenceMonth
      );
      if (exists) {
        jsonErrors.push(`Item ${index + 1}: Boleto já existe para unidade ${unit} e referência ${referenceMonth}`);
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
        unit: unit,
        referenceMonth: referenceMonth,
        dueDate: parsedDate.toISOString().split('T')[0],
        amount: amount,
        status: status,
        barcode: item.codigo || item.cod || item.barcode,
        description: item.descricao || item.description,
        pdfUrl: pdfUrl || undefined,
        paidDate: item.pagamento || item.paidDate
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
    const template = `unidade,mes,vencimento,valor,status,codigo_barras,descricao
102A,01/2025,10/01/2025,450.00,Pendente,34191090000012345678901234567890123456789012,Taxa de condomínio
405B,01/2025,10/01/2025,450.00,Pendente,,Taxa de condomínio`;
    
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
            <p className="text-xs opacity-40 mt-1">Selecione qualquer arquivo. O sistema detecta automaticamente CSV ou JSON. O arquivo ficará disponível para designar cada PDF ao morador correspondente.</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Importar: selecionar arquivo CSV ou JSON */}
        <div className="mb-6 space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-8 text-center cursor-pointer hover:border-[var(--text-primary)]/30 transition-all"
          >
            <Upload className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="text-sm font-bold mb-2">
              {file ? file.name : 'Clique para selecionar arquivo (qualquer tipo)'}
            </p>
            <p className="text-xs opacity-40">CSV e JSON são detectados automaticamente. O arquivo ficará disponível para designar PDFs a cada morador.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="*/*"
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
              <p className="text-xs opacity-40">Designe cada PDF ao morador na tabela abaixo.</p>
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
            </div>
            <div className="max-h-72 overflow-y-auto border border-[var(--border-color)] rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="p-3 text-left font-black uppercase">Unidade</th>
                    <th className="p-3 text-left font-black uppercase">Morador</th>
                    <th className="p-3 text-left font-black uppercase">Mês</th>
                    <th className="p-3 text-left font-black uppercase">Vencimento</th>
                    <th className="p-3 text-left font-black uppercase">Valor</th>
                    <th className="p-3 text-left font-black uppercase">Status</th>
                    <th className="p-3 text-left font-black uppercase">Designar PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((boleto, index) => (
                    <tr key={boleto.id} className="border-t border-[var(--border-color)]">
                      <td className="p-3">{boleto.unit}</td>
                      <td className="p-3">{boleto.residentName}</td>
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
                  ))}
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