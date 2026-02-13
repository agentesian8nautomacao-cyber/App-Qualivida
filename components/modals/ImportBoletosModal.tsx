import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { Boleto, BoletoType, Resident } from '../../types';
import { addBoletoOriginalPdf } from '../../services/dataService';

interface ImportBoletosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (boletos: Boleto[]) => void;
  existingBoletos: Boleto[];
  allResidents: Resident[];
}

interface BoletoWithPDF extends Boleto {
  pdfFile?: File;
}

const ImportBoletosModal: React.FC<ImportBoletosModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingBoletos,
  allResidents
}) => {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [previewData, setPreviewData] = useState<BoletoWithPDF[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    const csvFiles = Array.from(selectedFiles).filter(f => f.type === 'text/csv' || f.name.endsWith('.csv'));
    const pdfFilesSelected = Array.from(selectedFiles).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));

    // Processar CSV
    if (csvFiles.length > 0) {
      if (csvFiles.length > 1) {
        setErrors(['Selecione apenas um arquivo CSV.']);
        return;
      }
      setCsvFile(csvFiles[0]);
      processCsvFile(csvFiles[0]);
    }

    // Processar PDFs
    if (pdfFilesSelected.length > 0) {
      setPdfFiles(prev => [...prev, ...pdfFilesSelected]);
    }
  };

  const processCsvFile = async (fileToProcess: File) => {
    setIsProcessing(true);
    setErrors([]);
    setWarnings([]);

    try {
      const text = await fileToProcess.text();

      // Tentar interpretar como CSV simples
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        setErrors(['Arquivo deve ter pelo menos cabeçalho e uma linha de dados.']);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const boletos: BoletoWithPDF[] = [];
      const csvErrors: string[] = [];
      const csvWarnings: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());

        const unit = values[0] || '';
        const referenceMonth = values[1] || '';
        const dueDate = values[2] || '';
        const amountStr = values[3] || '';
        const pdfPath = values[4] || ''; // Caminho do PDF (opcional)
        const amount = parseFloat(amountStr.replace(/[^\d,.-]/g, '').replace(',', '.'));

        if (!unit || !referenceMonth || !dueDate || isNaN(amount) || amount <= 0) {
          csvErrors.push(`Linha ${i + 1}: Dados inválidos`);
          continue;
        }

        // Procurar morador
        const resident = allResidents.find(r => r.unit.toLowerCase() === unit.toLowerCase());
        if (!resident) {
          csvErrors.push(`Linha ${i + 1}: Morador não encontrado para unidade "${unit}"`);
          continue;
        }

        // Verificar duplicata
        const exists = existingBoletos.some(b =>
          b.unit === resident.unit && b.referenceMonth === referenceMonth
        );
        if (exists) {
          csvErrors.push(`Linha ${i + 1}: Boleto já existe para ${resident.unit} - ${referenceMonth}`);
          continue;
        }

        let parsedDate: Date;
        try {
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
          csvErrors.push(`Linha ${i + 1}: Data inválida: ${dueDate}`);
          continue;
        }

        // Procurar PDF correspondente baseado no nome do arquivo
        let pdfFile: File | undefined;
        if (pdfPath) {
          // Se caminho especificado no CSV, procurar arquivo exato
          pdfFile = pdfFiles.find(pdf => pdf.name === pdfPath);
          if (!pdfFile) {
            csvWarnings.push(`Linha ${i + 1}: PDF "${pdfPath}" não encontrado nos arquivos selecionados`);
          }
        } else {
          // Procurar PDF automaticamente baseado no padrão de nome
          const expectedPdfName = `${unit}_${referenceMonth.replace('/', '_')}.pdf`;
          pdfFile = pdfFiles.find(pdf =>
            pdf.name.toLowerCase().includes(unit.toLowerCase()) &&
            pdf.name.toLowerCase().includes(referenceMonth.replace('/', '_'))
          );
          if (!pdfFile) {
            csvWarnings.push(`Linha ${i + 1}: PDF não encontrado automaticamente. Nome esperado: "${expectedPdfName}"`);
          }
        }

        boletos.push({
          id: Date.now().toString() + i,
          residentName: resident.name,
          unit: resident.unit,
          referenceMonth: referenceMonth,
          dueDate: parsedDate.toISOString().split('T')[0],
          amount: amount,
          status: 'Pendente',
          boletoType: 'condominio',
          resident_id: resident.id,
          unidade_id: resident.unit,
          nosso_numero: Date.now().toString() + i,
          pdfFile: pdfFile
        });
      }

      if (csvErrors.length > 0) {
        setErrors(csvErrors);
      }
      if (csvWarnings.length > 0) {
        setWarnings(csvWarnings);
      }
      setPreviewData(boletos);

    } catch (error) {
      setErrors([`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      setErrors(['Nenhum boleto válido para importar.']);
      return;
    }
    setIsImporting(true);
    setErrors([]);
    try {
      // Primeiro importar os boletos
      const boletosSemPdf = previewData.map(b => {
        const { pdfFile, ...boletoData } = b;
        return boletoData as Boleto;
      });
      await onImport(boletosSemPdf);

      // Depois anexar PDFs aos boletos que têm arquivo
      const boletosComPdf = previewData.filter(b => b.pdfFile);
      if (boletosComPdf.length > 0) {
        console.log(`Anexando PDFs a ${boletosComPdf.length} boletos...`);

        for (const boleto of boletosComPdf) {
          try {
            const result = await addBoletoOriginalPdf(boleto.id, boleto.pdfFile!);
            if (!result.success) {
              console.warn(`Falha ao anexar PDF ao boleto ${boleto.id}:`, result.error);
            } else {
              console.log(`PDF anexado com sucesso ao boleto ${boleto.id}`);
            }
          } catch (error) {
            console.error(`Erro ao anexar PDF ao boleto ${boleto.id}:`, error);
          }
        }
      }

      handleClose();
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e ?? '')).trim() || 'Erro ao importar.';
      setErrors([message]);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setCsvFile(null);
    setPdfFiles([]);
    setPreviewData([]);
    setErrors([]);
    setWarnings([]);
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
    if (pdfInputRef.current) {
      pdfInputRef.current.value = '';
    }
    onClose();
  };

  const downloadTemplate = () => {
    const template = `unidade,mes,vencimento,valor,pdf_filename
102A,01/2025,10/01/2025,450.00,102A_01_2025.pdf
405B,01/2025,10/01/2025,120.50,405B_01_2025.pdf
301,02/2025,15/02/2025,85.00,301_02_2025.pdf`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_boletos_com_pdf.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">Importar Boletos</h3>
            <p className="text-xs opacity-40 mt-1">Importe boletos via arquivo CSV.</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl">
          <h4 className="text-sm font-bold mb-2">📋 Formato CSV</h4>
          <p className="text-xs opacity-80 mb-2">
            O arquivo deve ter as colunas: unidade, mes, vencimento, valor, pdf_filename (opcional)
          </p>
          <p className="text-xs opacity-60">
            • Se pdf_filename não for informado, o sistema tentará encontrar automaticamente<br/>
            • Nome sugerido: unidade_mes_ano.pdf (ex: 102A_01_2025.pdf)
          </p>
        </div>

        <div className="mb-6 space-y-4">
          {/* Upload CSV */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Arquivo CSV com dados dos boletos *
            </label>
            <div
              onClick={() => csvInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-6 text-center cursor-pointer hover:border-[var(--text-primary)]/30 transition-all"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold mb-1">
                {csvFile ? csvFile.name : 'Clique para selecionar CSV'}
              </p>
              <p className="text-xs opacity-60">Arquivo obrigatório</p>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Upload PDFs */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Arquivos PDF dos boletos (opcional)
            </label>
            <div
              onClick={() => pdfInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-6 text-center cursor-pointer hover:border-[var(--text-primary)]/30 transition-all"
            >
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-bold mb-1">
                {pdfFiles.length > 0 ? `${pdfFiles.length} PDF(s) selecionado(s)` : 'Clique para selecionar PDFs'}
              </p>
              <p className="text-xs opacity-60">Para download pelos moradores</p>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            {pdfFiles.length > 0 && (
              <div className="mt-2 text-xs opacity-70">
                PDFs selecionados: {pdfFiles.map(f => f.name).join(', ')}
              </div>
            )}
          </div>

          <button
            onClick={downloadTemplate}
            className="text-xs opacity-60 hover:opacity-100 flex items-center gap-2 transition-opacity"
          >
            📥 Baixar template CSV com coluna PDF
          </button>
        </div>

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

        {warnings.length > 0 && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <p className="text-xs font-black text-amber-400">Avisos (não impedem importação):</p>
            </div>
            <ul className="text-xs opacity-80 space-y-1 max-h-32 overflow-y-auto">
              {warnings.map((warning, index) => (
                <li key={index}>• {warning}</li>
              ))}
            </ul>
          </div>
        )}

        {isProcessing && (
          <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-blue-400">Processando arquivo...</p>
            </div>
          </div>
        )}

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
            <div className="mb-4 p-3 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-lg">
              <p className="text-xs opacity-80">
                📊 Resumo: {previewData.filter(b => b.pdfFile).length} com PDF • {previewData.filter(b => !b.pdfFile).length} sem PDF
              </p>
            </div>
            <div className="max-h-72 overflow-y-auto border border-[var(--border-color)] rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="p-3 text-left font-black uppercase">Unidade</th>
                    <th className="p-3 text-left font-black uppercase">Morador</th>
                    <th className="p-3 text-left font-black uppercase">Mês</th>
                    <th className="p-3 text-left font-black uppercase">Valor</th>
                    <th className="p-3 text-left font-black uppercase">PDF</th>
                    <th className="p-3 text-left font-black uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((boleto, index) => (
                    <tr key={boleto.id} className="border-t border-[var(--border-color)]">
                      <td className="p-3">{boleto.unit}</td>
                      <td className="p-3">{boleto.residentName}</td>
                      <td className="p-3">{boleto.referenceMonth}</td>
                      <td className="p-3">{formatCurrency(boleto.amount)}</td>
                      <td className="p-3">
                        {boleto.pdfFile ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-black bg-green-500/20 text-green-400">
                            ✅ PDF
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[10px] font-black bg-red-500/20 text-red-400">
                            ❌ Sem PDF
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-400">
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