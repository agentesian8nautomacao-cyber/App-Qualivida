import React, { useState, useRef } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertCircle, Download, Copy, FileSpreadsheet, FileJson, File } from 'lucide-react';
import { Boleto, Resident } from '../../types';

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
  const [importMethod, setImportMethod] = useState<'file' | 'paste'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [pastedData, setPastedData] = useState('');
  const [previewData, setPreviewData] = useState<Boleto[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

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
      const fileType = fileToProcess.name.split('.').pop()?.toLowerCase();
      
      if (fileType === 'csv') {
        await processCSV(fileToProcess);
      } else if (fileType === 'json') {
        await processJSON(fileToProcess);
      } else {
        setErrors(['Formato de arquivo não suportado. Use CSV ou JSON.']);
      }
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

      // Associar PDF se disponível (buscar por nome do arquivo)
      let pdfUrl = '';
      if (pdfFiles.length > 0) {
        const matchingPdf = pdfFiles.find(pdf => {
          const pdfName = pdf.name.toLowerCase();
          return pdfName.includes(unit.toLowerCase()) || pdfName.includes(referenceMonth.toLowerCase());
        });
        if (matchingPdf) {
          pdfUrl = URL.createObjectURL(matchingPdf);
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

      let pdfUrl = '';
      if (pdfFiles.length > 0) {
        const matchingPdf = pdfFiles.find(pdf => {
          const pdfName = pdf.name.toLowerCase();
          return pdfName.includes(unit.toLowerCase()) || pdfName.includes(referenceMonth.toLowerCase());
        });
        if (matchingPdf) {
          pdfUrl = URL.createObjectURL(matchingPdf);
        }
      }

      boletos.push({
        id: Date.now().toString() + index,
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

  const handlePasteProcess = () => {
    setIsProcessing(true);
    setErrors([]);
    setPreviewData([]);

    try {
      try {
        const data = JSON.parse(pastedData);
        if (Array.isArray(data)) {
          processJSONData(data);
          return;
        }
      } catch {
        setErrors(['Por favor, forneça dados no formato JSON válido.']);
      }
    } catch (error) {
      setErrors([`Erro ao processar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const processJSONData = (data: any[]) => {
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

      boletos.push({
        id: Date.now().toString() + index,
        residentName: resident.name,
        unit: unit,
        referenceMonth: referenceMonth,
        dueDate: parsedDate.toISOString().split('T')[0],
        amount: amount,
        status: status,
        barcode: item.codigo || item.cod || item.barcode,
        description: item.descricao || item.description,
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
    try {
      await onImport(previewData);
      handleClose();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Erro ao importar.']);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPdfFiles([]);
    setPastedData('');
    setPreviewData([]);
    setErrors([]);
    setImportMethod('file');
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
            <p className="text-xs opacity-40 mt-1">Importe boletos de arquivo CSV ou JSON. Associe PDFs opcionalmente.</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Método de Importação */}
        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setImportMethod('file')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                importMethod === 'file'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)]'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Arquivo
            </button>
            <button
              onClick={() => setImportMethod('paste')}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                importMethod === 'paste'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)]'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <Copy className="w-4 h-4 inline mr-2" />
              Colar Dados
            </button>
          </div>

          {importMethod === 'file' ? (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-8 text-center cursor-pointer hover:border-[var(--text-primary)]/30 transition-all"
              >
                <Upload className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p className="text-sm font-bold mb-2">
                  {file ? file.name : 'Clique para selecionar arquivo CSV ou JSON'}
                </p>
                <p className="text-xs opacity-40">CSV ou JSON</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              
              {/* Upload de PDFs */}
              <div
                onClick={() => pdfInputRef.current?.click()}
                className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-6 text-center cursor-pointer hover:border-[var(--text-primary)]/30 transition-all"
              >
                <File className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-bold mb-2">
                  {pdfFiles.length > 0 ? `${pdfFiles.length} PDF(s) selecionado(s)` : 'Selecionar PDFs dos boletos (opcional)'}
                </p>
                <p className="text-xs opacity-40">Os PDFs serão associados automaticamente pela unidade ou mês</p>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handlePdfSelect}
                  className="hidden"
                />
                {pdfFiles.length > 0 && (
                  <div className="mt-3 text-xs opacity-60">
                    {pdfFiles.map((pdf, idx) => (
                      <div key={idx} className="truncate">{pdf.name}</div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={downloadTemplate}
                className="text-xs opacity-60 hover:opacity-100 flex items-center gap-2 transition-opacity"
              >
                <Download className="w-3 h-3" />
                Baixar template CSV
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={pastedData}
                onChange={(e) => setPastedData(e.target.value)}
                placeholder='Cole aqui os dados em formato JSON...\n\nExemplo:\n[\n  {\n    "unidade": "102A",\n    "mes": "01/2025",\n    "vencimento": "10/01/2025",\n    "valor": 450.00,\n    "status": "Pendente",\n    "descricao": "Taxa de condomínio"\n  }\n]'
                className="w-full h-48 p-4 bg-white/5 border border-[var(--border-color)] rounded-xl text-xs font-mono outline-none focus:border-[var(--text-primary)]/30 transition-all resize-none"
              />
              <button
                onClick={handlePasteProcess}
                disabled={!pastedData.trim() || isProcessing}
                className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-xl text-xs font-black uppercase hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isProcessing ? 'Processando...' : 'Processar Dados'}
              </button>
            </div>
          )}
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
                <li key={index}>• {error}</li>
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
            <div className="max-h-64 overflow-y-auto border border-[var(--border-color)] rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="p-3 text-left font-black uppercase">Unidade</th>
                    <th className="p-3 text-left font-black uppercase">Morador</th>
                    <th className="p-3 text-left font-black uppercase">Mês</th>
                    <th className="p-3 text-left font-black uppercase">Vencimento</th>
                    <th className="p-3 text-left font-black uppercase">Valor</th>
                    <th className="p-3 text-left font-black uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((boleto, index) => (
                    <tr key={index} className="border-t border-[var(--border-color)]">
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