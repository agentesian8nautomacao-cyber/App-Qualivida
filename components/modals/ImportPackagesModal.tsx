import React, { useState, useRef } from 'react';
import { Upload, FileText, X, CheckCircle2, AlertCircle, Download, Package } from 'lucide-react';
import { Package as PackageType } from '../../types';

interface ImportPackagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (packages: PackageType[]) => void;
  existingPackages: PackageType[];
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
  return result;
}

const ImportPackagesModal: React.FC<ImportPackagesModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingPackages
}) => {
  const [importMethod, setImportMethod] = useState<'file' | 'paste'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [pastedData, setPastedData] = useState('');
  const [previewData, setPreviewData] = useState<PackageType[]>([]);
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
      } else if (fileType === 'json') {
        await processJSONFile(fileToProcess);
      } else {
        setErrors(['Formato não suportado. Use CSV ou JSON.']);
      }
    } catch (error) {
      setErrors([`Erro ao processar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  const processCSV = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) {
      setErrors(['CSV deve ter cabeçalho e ao menos uma linha.']);
      return;
    }
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    const needRecipient = headers.some(h => h.includes('destinat') || h.includes('recipient') || h.includes('nome'));
    const needUnit = headers.some(h => h.includes('unidade') || h.includes('unit') || h.includes('apto'));
    const needType = headers.some(h => h.includes('tipo') || h.includes('type'));
    if (!needRecipient || !needUnit || !needType) {
      setErrors(['CSV deve ter colunas: Destinatário, Unidade, Tipo.']);
      return;
    }

    const packages: PackageType[] = [];
    const csvErrors: string[] = [];

    const getVal = (row: Record<string, string>, ...keys: string[]) => {
      for (const k of keys) {
        const v = row[k];
        if (v !== undefined && v !== '') return v;
        const found = Object.keys(row).find(h => h.includes(k) || k.includes(h));
        if (found && row[found]) return row[found];
      }
      return '';
    };

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      const recipient = getVal(row, 'destinatário', 'destinatario', 'recipient', 'nome') || '';
      const unit = getVal(row, 'unidade', 'unit', 'apto') || '';
      const type = getVal(row, 'tipo', 'type') || 'Outros';

      if (!recipient.trim() || !unit.trim()) {
        csvErrors.push(`Linha ${i + 1}: Destinatário e Unidade são obrigatórios.`);
        continue;
      }

      let receivedAt = getVal(row, 'data/hora recebimento', 'data', 'received_at', 'receivedat', 'recebimento') || '';
      if (!receivedAt) {
        receivedAt = new Date().toISOString();
      } else if (receivedAt.includes('/')) {
        const parts = receivedAt.split(/[\s/]+/);
        if (parts.length >= 3) {
          const d = parts[0];
          const m = parts[1];
          const y = parts[2].length === 4 ? parts[2] : parts[2].length === 2 ? '20' + parts[2] : parts[2];
          receivedAt = `${y}-${m}-${d}T12:00:00.000Z`;
        } else {
          receivedAt = new Date(receivedAt).toISOString();
        }
      } else {
        receivedAt = new Date(receivedAt).toISOString();
      }

      const displayTime = getVal(row, 'hora exibição', 'display_time', 'displaytime') || new Date(receivedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const statusRaw = String(getVal(row, 'status') || '').trim().toLowerCase();
      const status: PackageType['status'] = (statusRaw === 'recebida' || statusRaw === 'entregue') ? 'recebida' : 'pendente';
      const itemsStr = getVal(row, 'itens', 'items') || '';
      const items = itemsStr ? itemsStr.split(';').map(s => ({ id: '', name: s.trim(), description: '' })).filter(it => it.name) : [];

      packages.push({
        id: `import-${i}-${Date.now()}`,
        recipient: recipient.trim(),
        unit: unit.trim(),
        type: type.trim(),
        receivedAt,
        displayTime: String(displayTime),
        status,
        deadlineMinutes: 45,
        items: items.length ? items : undefined
      });
    }

    if (csvErrors.length) setErrors(csvErrors);
    setPreviewData(packages);
  };

  const processJSONFile = async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : (data.packages || []);
    const packages: PackageType[] = [];
    const jsonErrors: string[] = [];

    list.forEach((item: any, index: number) => {
      const recipient = item.recipient || item.recipient_name || item.destinatário || item.nome || '';
      const unit = item.unit || item.unidade || '';
      const type = item.type || item.tipo || 'Outros';
      if (!recipient || !unit) {
        jsonErrors.push(`Item ${index + 1}: Destinatário e Unidade obrigatórios.`);
        return;
      }
      let receivedAt = item.receivedAt || item.received_at || '';
      if (!receivedAt) receivedAt = new Date().toISOString();
      else if (typeof receivedAt === 'string' && !receivedAt.includes('T')) receivedAt = new Date(receivedAt).toISOString();
      const displayTime = item.displayTime || item.display_time || new Date(receivedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const statusRaw = String(item.status || '').trim().toLowerCase();
      const status: PackageType['status'] = (statusRaw === 'recebida' || statusRaw === 'entregue') ? 'recebida' : 'pendente';
      const rawItems = item.items || [];
      const items = Array.isArray(rawItems) ? rawItems.map((it: any) => ({
        id: '',
        name: typeof it === 'string' ? it : (it.name || it.nome || ''),
        description: typeof it === 'string' ? '' : (it.description || it.descricao || '')
      })).filter((it: { name: string }) => it.name) : [];

      packages.push({
        id: `import-${index}-${Date.now()}`,
        recipient: String(recipient).trim(),
        unit: String(unit).trim(),
        type: String(type).trim(),
        receivedAt,
        displayTime: String(displayTime),
        status,
        deadlineMinutes: item.deadlineMinutes ?? 45,
        residentPhone: item.residentPhone || item.resident_phone,
        items: items.length ? items : undefined
      });
    });

    if (jsonErrors.length) setErrors(jsonErrors);
    setPreviewData(packages);
  };

  const handlePasteProcess = () => {
    setIsProcessing(true);
    setErrors([]);
    setPreviewData([]);
    try {
      const data = JSON.parse(pastedData);
      const list = Array.isArray(data) ? data : (data.packages || []);
      if (!list.length) {
        setErrors(['JSON deve ser um array ou objeto com "packages".']);
        setIsProcessing(false);
        return;
      }
      const packages: PackageType[] = [];
      list.forEach((item: any, index: number) => {
        const recipient = item.recipient || item.recipient_name || item.destinatário || item.nome || '';
        const unit = item.unit || item.unidade || '';
        const type = item.type || item.tipo || 'Outros';
        if (!recipient || !unit) return;
        let receivedAt = item.receivedAt || item.received_at || new Date().toISOString();
        if (typeof receivedAt === 'string' && !receivedAt.includes('T')) receivedAt = new Date(receivedAt).toISOString();
        const displayTime = item.displayTime || item.display_time || new Date(receivedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const status = (item.status || 'Pendente') === 'Entregue' ? 'Entregue' : 'Pendente';
        const rawItems = item.items || [];
        const items = Array.isArray(rawItems) ? rawItems.map((it: any) => ({
          id: '',
          name: typeof it === 'string' ? it : (it.name || ''),
          description: typeof it === 'string' ? '' : (it.description || '')
        })).filter((it: { name: string }) => it.name) : [];

        packages.push({
          id: `import-${index}-${Date.now()}`,
          recipient: String(recipient).trim(),
          unit: String(unit).trim(),
          type: String(type).trim(),
          receivedAt,
          displayTime: String(displayTime),
          status,
          deadlineMinutes: item.deadlineMinutes ?? 45,
          items: items.length ? items : undefined
        });
      });
      setPreviewData(packages);
    } catch {
      setErrors(['JSON inválido. Use o formato exportado pelo sistema (Exportar JSON).']);
    }
    setIsProcessing(false);
  };

  const handleConfirmImport = () => {
    if (previewData.length === 0) return;
    onImport(previewData);
    setPreviewData([]);
    setFile(null);
    setPastedData('');
    setErrors([]);
    onClose();
  };

  const handleClose = () => {
    setPreviewData([]);
    setFile(null);
    setPastedData('');
    setErrors([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border shadow-xl flex flex-col" style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <h3 className="text-lg font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Importar encomendas
          </h3>
          <button type="button" onClick={handleClose} className="p-2 rounded-xl hover:opacity-80 transition-opacity" style={{ color: 'var(--text-primary)' }} aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs opacity-70" style={{ color: 'var(--text-secondary)' }}>
            Use CSV ou JSON (igual ao exportado). Colunas obrigatórias: Destinatário, Unidade, Tipo.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImportMethod('file')}
              className={`px-4 py-2 rounded-xl text-sm font-bold uppercase ${importMethod === 'file' ? 'opacity-100' : 'opacity-60'}`}
              style={importMethod === 'file' ? { backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' } : { color: 'var(--text-primary)' }}
            >
              Arquivo
            </button>
            <button
              type="button"
              onClick={() => setImportMethod('paste')}
              className={`px-4 py-2 rounded-xl text-sm font-bold uppercase ${importMethod === 'paste' ? 'opacity-100' : 'opacity-60'}`}
              style={importMethod === 'paste' ? { backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' } : { color: 'var(--text-primary)' }}
            >
              Colar JSON
            </button>
          </div>

          {importMethod === 'file' && (
            <div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
                <Upload className="w-4 h-4" /> {file ? file.name : 'Selecionar CSV ou JSON'}
              </button>
            </div>
          )}

          {importMethod === 'paste' && (
            <div>
              <textarea
                value={pastedData}
                onChange={e => setPastedData(e.target.value)}
                placeholder='[{"recipient":"Nome","unit":"101","type":"Correios"}, ...] ou {"packages":[...]}'
                className="w-full h-32 px-4 py-3 rounded-xl border text-sm font-mono resize-none outline-none focus:border-[var(--text-primary)]"
                style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              />
              <button type="button" onClick={handlePasteProcess} disabled={isProcessing || !pastedData.trim()} className="mt-2 px-4 py-2 rounded-xl text-sm font-bold uppercase disabled:opacity-50" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' }}>
                Processar JSON
              </button>
            </div>
          )}

          {errors.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <ul className="text-xs text-red-200 list-disc list-inside">
                {errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                {errors.length > 5 && <li>… e mais {errors.length - 5} erro(s)</li>}
              </ul>
            </div>
          )}

          {previewData.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                {previewData.length} encomenda(s) para importar
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border p-2 space-y-1" style={{ borderColor: 'var(--border-color)' }}>
                {previewData.slice(0, 10).map((p, i) => (
                  <div key={i} className="flex justify-between text-xs py-1 border-b border-white/5 last:border-0" style={{ color: 'var(--text-secondary)' }}>
                    <span>{p.recipient} • {p.unit}</span>
                    <span>{p.type} • {p.status}</span>
                  </div>
                ))}
                {previewData.length > 10 && <p className="text-[10px] opacity-60 py-1">… e mais {previewData.length - 10}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t shrink-0" style={{ borderColor: 'var(--border-color)' }}>
          <button type="button" onClick={handleClose} className="px-4 py-2 rounded-xl border text-sm font-bold uppercase" style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            Cancelar
          </button>
          <button type="button" onClick={handleConfirmImport} disabled={previewData.length === 0} className="px-4 py-2 rounded-xl text-sm font-bold uppercase disabled:opacity-50 flex items-center gap-2" style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-color)' }}>
            <Package className="w-4 h-4" /> Importar {previewData.length ? `(${previewData.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportPackagesModal;
