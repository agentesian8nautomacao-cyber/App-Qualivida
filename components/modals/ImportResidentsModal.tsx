
import React, { useState, useRef } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertCircle, Download, Copy, FileSpreadsheet, FileJson } from 'lucide-react';
import { Resident } from '../../types';

interface ImportResidentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (residents: Resident[]) => void;
  existingResidents: Resident[];
}

const ImportResidentsModal: React.FC<ImportResidentsModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingResidents
}) => {
  const [importMethod, setImportMethod] = useState<'file' | 'paste'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pastedData, setPastedData] = useState('');
  const [previewData, setPreviewData] = useState<Resident[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processFile(selectedFile);
    }
  };

  const processFile = async (fileToProcess: File) => {
    setIsProcessing(true);
    setErrors([]);
    setPreviewData([]);

    try {
      const fileType = fileToProcess.name.split('.').pop()?.toLowerCase();
      
      if (fileType === 'csv') {
        await processCSV(fileToProcess);
      } else if (fileType === 'xlsx' || fileType === 'xls') {
        await processExcel(fileToProcess);
      } else if (fileType === 'json') {
        await processJSON(fileToProcess);
      } else {
        setErrors(['Formato de arquivo não suportado. Use CSV, XLSX ou JSON.']);
      }
    } catch (error) {
      setErrors([`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const processCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      setErrors(['Arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados.']);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredFields = ['nome', 'unidade'];
    const missingFields = requiredFields.filter(field => !headers.some(h => h.includes(field)));
    
    if (missingFields.length > 0) {
      setErrors([`Campos obrigatórios não encontrados: ${missingFields.join(', ')}`]);
      return;
    }

    const residents: Resident[] = [];
    const csvErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const resident: Partial<Resident> = { id: Date.now().toString() + i };
      const extraData: Record<string, any> = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        const headerLower = header.toLowerCase().trim();
        
        // Mapear campos conhecidos
        if (headerLower.includes('nome') || headerLower.includes('name')) {
          resident.name = value;
        } else if (headerLower.includes('unidade') || headerLower.includes('unit') || headerLower.includes('apto') || headerLower.includes('apartamento')) {
          resident.unit = value;
        } else if (headerLower.includes('email') || headerLower.includes('e-mail')) {
          resident.email = value;
        } else if ((headerLower.includes('telefone') || headerLower.includes('phone') || headerLower.includes('tel')) && !headerLower.includes('whatsapp')) {
          resident.phone = value;
        } else if (headerLower.includes('whatsapp') || headerLower.includes('whats')) {
          resident.whatsapp = value;
        } else {
          // Armazenar campos extras
          extraData[header] = value;
        }
      });

      if (!resident.name || !resident.unit) {
        csvErrors.push(`Linha ${i + 1}: Nome e Unidade são obrigatórios`);
        return;
      }

      // Verificar se já existe
      const exists = existingResidents.some(r => r.unit === resident.unit);
      if (exists) {
        csvErrors.push(`Linha ${i + 1}: Unidade ${resident.unit} já existe`);
        return;
      }

      residents.push({
        id: resident.id!,
        name: resident.name!,
        unit: resident.unit!,
        email: resident.email || '',
        phone: resident.phone || '',
        whatsapp: resident.whatsapp || resident.phone || '',
        extraData: Object.keys(extraData).length > 0 ? extraData : undefined
      });
    }

    if (csvErrors.length > 0) {
      setErrors(csvErrors);
    }
    setPreviewData(residents);
  };

  const processExcel = async (file: File) => {
    // Para Excel, vamos usar uma biblioteca ou converter para CSV primeiro
    // Por enquanto, vamos mostrar uma mensagem
    setErrors(['Importação de Excel requer biblioteca adicional. Por favor, converta para CSV ou use JSON.']);
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

    const residents: Resident[] = [];
    const jsonErrors: string[] = [];

    data.forEach((item, index) => {
      if (!item.nome && !item.name) {
        jsonErrors.push(`Item ${index + 1}: Nome é obrigatório`);
        return;
      }
      if (!item.unidade && !item.unit && !item.apto) {
        jsonErrors.push(`Item ${index + 1}: Unidade é obrigatória`);
        return;
      }

      const unit = item.unidade || item.unit || item.apto;
      const exists = existingResidents.some(r => r.unit === unit);
      if (exists) {
        jsonErrors.push(`Item ${index + 1}: Unidade ${unit} já existe`);
        return;
      }

      residents.push({
        id: Date.now().toString() + index,
        name: item.nome || item.name,
        unit: unit,
        email: item.email || item.e_mail || '',
        phone: item.telefone || item.phone || item.tel || '',
        whatsapp: item.whatsapp || item.whats || item.telefone || item.phone || ''
      });
    });

    if (jsonErrors.length > 0) {
      setErrors(jsonErrors);
    }
    setPreviewData(residents);
  };

  const handlePasteProcess = () => {
    setIsProcessing(true);
    setErrors([]);
    setPreviewData([]);

    try {
      // Tentar processar como JSON primeiro
      try {
        const data = JSON.parse(pastedData);
        if (Array.isArray(data)) {
          processJSONData(data);
          return;
        }
      } catch {
        // Não é JSON, tentar como CSV
        processPastedCSV();
      }
    } catch (error) {
      setErrors([`Erro ao processar dados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const processJSONData = (data: any[]) => {
    const residents: Resident[] = [];
    const jsonErrors: string[] = [];

    data.forEach((item, index) => {
      if (!item.nome && !item.name) {
        jsonErrors.push(`Item ${index + 1}: Nome é obrigatório`);
        return;
      }
      if (!item.unidade && !item.unit && !item.apto && !item.apartamento) {
        jsonErrors.push(`Item ${index + 1}: Unidade é obrigatória`);
        return;
      }

      const unit = item.unidade || item.unit || item.apto || item.apartamento;
      const exists = existingResidents.some(r => r.unit === unit);
      if (exists) {
        jsonErrors.push(`Item ${index + 1}: Unidade ${unit} já existe`);
        return;
      }

      // Campos conhecidos
      const knownFields = ['nome', 'name', 'unidade', 'unit', 'apto', 'apartamento', 'email', 'e_mail', 'telefone', 'phone', 'tel', 'whatsapp', 'whats'];
      const extraData: Record<string, any> = {};

      // Capturar todos os campos extras
      Object.keys(item).forEach(key => {
        const keyLower = key.toLowerCase();
        if (!knownFields.some(field => keyLower === field || keyLower.includes(field))) {
          extraData[key] = item[key];
        }
      });

      residents.push({
        id: Date.now().toString() + index,
        name: item.nome || item.name,
        unit: unit,
        email: item.email || item.e_mail || '',
        phone: item.telefone || item.phone || item.tel || '',
        whatsapp: item.whatsapp || item.whats || item.telefone || item.phone || '',
        extraData: Object.keys(extraData).length > 0 ? extraData : undefined
      });
    });

    if (jsonErrors.length > 0) {
      setErrors(jsonErrors);
    }
    setPreviewData(residents);
  };

  const processPastedCSV = () => {
    const lines = pastedData.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      setErrors(['Dados devem ter pelo menos um cabeçalho e uma linha de dados.']);
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const residents: Resident[] = [];
    const csvErrors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const resident: Partial<Resident> = { id: Date.now().toString() + i };
      const extraData: Record<string, any> = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        const headerLower = header.toLowerCase().trim();
        
        // Mapear campos conhecidos
        if (headerLower.includes('nome') || headerLower.includes('name')) {
          resident.name = value;
        } else if (headerLower.includes('unidade') || headerLower.includes('unit') || headerLower.includes('apto') || headerLower.includes('apartamento')) {
          resident.unit = value;
        } else if (headerLower.includes('email') || headerLower.includes('e-mail')) {
          resident.email = value;
        } else if ((headerLower.includes('telefone') || headerLower.includes('phone') || headerLower.includes('tel')) && !headerLower.includes('whatsapp')) {
          resident.phone = value;
        } else if (headerLower.includes('whatsapp') || headerLower.includes('whats')) {
          resident.whatsapp = value;
        } else {
          // Armazenar campos extras
          extraData[header] = value;
        }
      });

      if (!resident.name || !resident.unit) {
        csvErrors.push(`Linha ${i + 1}: Nome e Unidade são obrigatórios`);
        continue;
      }

      const exists = existingResidents.some(r => r.unit === resident.unit);
      if (exists) {
        csvErrors.push(`Linha ${i + 1}: Unidade ${resident.unit} já existe`);
        continue;
      }

      residents.push({
        id: resident.id!,
        name: resident.name!,
        unit: resident.unit!,
        email: resident.email || '',
        phone: resident.phone || '',
        whatsapp: resident.whatsapp || resident.phone || '',
        extraData: Object.keys(extraData).length > 0 ? extraData : undefined
      });
    }

    if (csvErrors.length > 0) {
      setErrors(csvErrors);
    }
    setPreviewData(residents);
  };

  const handleImport = () => {
    if (previewData.length === 0) {
      setErrors(['Nenhum dado válido para importar.']);
      return;
    }
    onImport(previewData);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setPastedData('');
    setPreviewData([]);
    setErrors([]);
    setImportMethod('file');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const downloadTemplate = () => {
    const template = `nome,unidade,email,telefone,whatsapp
João Silva,101A,joao@email.com,11999999999,11999999999
Maria Santos,202B,maria@email.com,11888888888,11888888888`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_moradores.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">Importar Moradores</h3>
            <p className="text-xs opacity-40 mt-1">Importe moradores de arquivo CSV, Excel ou JSON</p>
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
                  {file ? file.name : 'Clique para selecionar arquivo'}
                </p>
                <p className="text-xs opacity-40">CSV, XLSX ou JSON</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
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
                placeholder="Cole aqui os dados em formato CSV ou JSON...&#10;&#10;Exemplo CSV:&#10;nome,unidade,email,telefone,whatsapp&#10;João Silva,101A,joao@email.com,11999999999,11999999999&#10;&#10;Exemplo JSON:&#10;[{&quot;nome&quot;: &quot;João Silva&quot;, &quot;unidade&quot;: &quot;101A&quot;, &quot;email&quot;: &quot;joao@email.com&quot;}]"
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
                  {previewData.length} morador(es) pronto(s) para importar
                </p>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto border border-[var(--border-color)] rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="p-3 text-left font-black uppercase">Nome</th>
                    <th className="p-3 text-left font-black uppercase">Unidade</th>
                    <th className="p-3 text-left font-black uppercase">Email</th>
                    <th className="p-3 text-left font-black uppercase">Telefone</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((resident, index) => (
                    <tr key={index} className="border-t border-[var(--border-color)]">
                      <td className="p-3">{resident.name}</td>
                      <td className="p-3">{resident.unit}</td>
                      <td className="p-3 opacity-60">{resident.email || '-'}</td>
                      <td className="p-3 opacity-60">{resident.phone || '-'}</td>
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
            disabled={previewData.length === 0 || isProcessing}
            className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-xl text-xs font-black uppercase hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Importar {previewData.length > 0 && `(${previewData.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportResidentsModal;

