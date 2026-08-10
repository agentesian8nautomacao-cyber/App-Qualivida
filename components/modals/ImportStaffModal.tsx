import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Copy, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Staff } from '../../types';

interface ImportStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (staffList: Staff[]) => Promise<void> | void;
  existingStaff: Staff[];
  /** Conteúdo inicial (ex.: lido de arquivo) — ao abrir o modal, preenche o texto e processa. */
  initialPastedData?: string | null;
}

const ImportStaffModal: React.FC<ImportStaffModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingStaff,
  initialPastedData
}) => {
  const [pastedData, setPastedData] = useState('');
  const [previewData, setPreviewData] = useState<Staff[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quando o modal abre com dados iniciais (ex.: arquivo escolhido), preenche e processa
  useEffect(() => {
    if (!isOpen || !initialPastedData?.trim()) return;
    setPastedData(initialPastedData.trim());
    setPreviewData([]);
    setErrors([]);
    const timer = setTimeout(() => {
      processPastedJsonFromString(initialPastedData.trim());
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, initialPastedData]);

  if (!isOpen) return null;

  const resetState = () => {
    setPastedData('');
    setPreviewData([]);
    setErrors([]);
    setIsProcessing(false);
    setIsImporting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const loginRoles = ['porteiro', 'portaria', 'síndico', 'sindico'];

  const normalizeItemToStaff = (
    item: Record<string, unknown>,
    index: number,
    list: Staff[],
    jsonErrors: string[]
  ): void => {
    const name = (item.name ?? item.nome) as string | undefined;
    const role = (item.role ?? item.cargo) as string | undefined;
    if (!name || !role) {
      jsonErrors.push(`Item ${index + 1}: Nome e cargo são obrigatórios`);
      return;
    }
    const normalizedName = String(name).trim();
    const normalizedRole = String(role).trim();
    if (loginRoles.includes(normalizedRole.toLowerCase())) {
      const emailVal = String(item.email ?? '').trim();
      if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        jsonErrors.push(`Item ${index + 1}: E-mail obrigatório para ${normalizedRole} (login e recuperação de senha)`);
        return;
      }
    }
    const exists = existingStaff.some(
      s =>
        s.name.toLowerCase() === normalizedName.toLowerCase() &&
        s.role.toLowerCase() === normalizedRole.toLowerCase()
    );
    if (exists) {
      jsonErrors.push(`Item ${index + 1}: Funcionário "${normalizedName}" (${normalizedRole}) já existe`);
      return;
    }
    const status = ((item.status as string) || 'Ativo') as 'Ativo' | 'Férias' | 'Licença';
    const shift = ((item.shift ?? item.turno) || 'Comercial') as 'Manhã' | 'Tarde' | 'Noite' | 'Madrugada' | 'Comercial';
    list.push({
      id: `temp-${Date.now()}-${index}`,
      name: normalizedName,
      role: normalizedRole,
      status,
      shift,
      phone: String(item.phone ?? item.telefone ?? ''),
      email: String(item.email ?? '')
    });
  };

  const tryParseCsv = (text: string): { list: Staff[]; errors: string[] } | null => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return null;
    const sep = lines[0].includes('\t') && !lines[0].includes(',') ? '\t' : ',';
    const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
    const nameIdx = headers.findIndex((h) => h.includes('nome') || h.includes('name'));
    const roleIdx = headers.findIndex((h) => h.includes('cargo') || h.includes('role') || h.includes('função'));
    if (nameIdx === -1 || roleIdx === -1) return null;
    const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('e-mail'));
    const phoneIdx = headers.findIndex((h) => h.includes('telefone') || h.includes('phone') || h.includes('tel'));
    const statusIdx = headers.findIndex((h) => h.includes('status') || h.includes('situação'));
    const shiftIdx = headers.findIndex((h) => h.includes('turno') || h.includes('shift'));
    const list: Staff[] = [];
    const errors: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(sep).map((v) => v.trim());
      const item: Record<string, unknown> = {
        name: values[nameIdx] ?? '',
        nome: values[nameIdx] ?? '',
        role: values[roleIdx] ?? '',
        cargo: values[roleIdx] ?? '',
        email: emailIdx >= 0 ? values[emailIdx] ?? '' : '',
        phone: phoneIdx >= 0 ? values[phoneIdx] ?? '' : '',
        telefone: phoneIdx >= 0 ? values[phoneIdx] ?? '' : '',
        status: statusIdx >= 0 ? values[statusIdx] ?? 'Ativo' : 'Ativo',
        shift: shiftIdx >= 0 ? values[shiftIdx] ?? 'Comercial' : 'Comercial',
        turno: shiftIdx >= 0 ? values[shiftIdx] ?? 'Comercial' : 'Comercial'
      };
      normalizeItemToStaff(item, i - 1, list, errors);
    }
    return { list, errors };
  };

  const processPastedJsonFromString = (jsonString: string) => {
    setIsProcessing(true);
    setErrors([]);
    setPreviewData([]);

    let trimmed = jsonString.trim();
    if (!trimmed) {
      setErrors(['Cole ou importe um arquivo JSON ou CSV com os dados dos funcionários.']);
      setIsProcessing(false);
      return;
    }

    // Remover BOM e caracteres de controle que quebram o parse (colagem/arquivo)
    trimmed = trimmed.replace(/^\uFEFF/, '').replace(/[\u0000-\u001F\u007F]/g, (c) => (c === '\n' || c === '\r' || c === '\t' ? c : ''));
    // Aspas curvas e caracteres que quebram JSON ao colar de Word/editor
    trimmed = trimmed.replace(/\u201C/g, '"').replace(/\u201D/g, '"').replace(/\u2018/g, "'").replace(/\u2019/g, "'");
    trimmed = trimmed.replace(/\u00A0/g, ' ');
    // Remover vírgula final antes de ] ou } (JSON não permite, mas é um erro comum)
    trimmed = trimmed.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
    // Se o texto começar com ":" antes do "[", remover (ex.: colagem com "dados:[...]")
    if (/^:\s*\[/.test(trimmed)) {
      trimmed = trimmed.replace(/^:\s*/, '');
    }

    // Tentar parse direto primeiro (conteúdo já é só o array)
    let jsonAttempt = trimmed;

    // Encontrar o ] que fecha o array (ignorando ] que está dentro de strings)
    const findArrayEnd = (str: string, start: number): number => {
      let depth = 1;
      let i = start + 1;
      while (i < str.length) {
        const c = str[i];
        if (c === '"') {
          i++;
          while (i < str.length) {
            if (str[i] === '\\') {
              i += 2;
              continue;
            }
            if (str[i] === '"') {
              i++;
              break;
            }
            i++;
          }
          continue;
        }
        if (c === '[') {
          depth++;
          i++;
          continue;
        }
        if (c === ']') {
          depth--;
          if (depth === 0) return i;
          i++;
          continue;
        }
        i++;
      }
      return -1;
    };

    const firstBracket = trimmed.indexOf('[');
    if (firstBracket !== -1) {
      const endBracket = findArrayEnd(trimmed, firstBracket);
      if (endBracket !== -1) {
        jsonAttempt = trimmed.slice(firstBracket, endBracket + 1);
        jsonAttempt = jsonAttempt.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
      }
    }

    try {
      const data = JSON.parse(jsonAttempt);
      if (!Array.isArray(data)) {
        setErrors(['JSON deve ser um array de objetos.']);
        setIsProcessing(false);
        return;
      }

      const list: Staff[] = [];
      const jsonErrors: string[] = [];
      data.forEach((item: Record<string, unknown>, index: number) => {
        normalizeItemToStaff(item, index, list, jsonErrors);
      });

      if (jsonErrors.length > 0) setErrors(jsonErrors);
      setPreviewData(list);
    } catch {
      // Tentar CSV no trecho extraído ou no texto original
      const csvResult = tryParseCsv(jsonAttempt) ?? tryParseCsv(jsonString.trim());
      if (csvResult) {
        if (csvResult.errors.length > 0) setErrors(csvResult.errors);
        setPreviewData(csvResult.list);
      } else {
        setErrors([
          'Conteúdo não é JSON nem CSV válido. Use um arquivo JSON (exportado pelo sistema) ou CSV com colunas: nome, cargo, email, telefone.'
        ]);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const processPastedJson = () => {
    processPastedJsonFromString(pastedData);
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      setErrors(['Nenhum funcionário válido para importar.']);
      return;
    }
    setIsImporting(true);
    try {
      await onImport(previewData);
      handleClose();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Erro ao importar funcionários.']);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-(--sidebar-bg) border border-(--border-color) rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>
              Importar Funcionários
            </h3>
            <p className="text-xs opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>
              Cole ou importe um arquivo JSON ou CSV com os dados dos colaboradores para cadastro em lote.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-xl transition-all"
          >
            <X className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>
            <Copy className="w-4 h-4" />
            Formato esperado (exemplo):
          </div>
          <pre className="bg-black/40 border border-(--border-color) rounded-xl p-3 text-[10px] overflow-x-auto">
{`[
  {
    "name": "João da Silva",
    "role": "Porteiro",
    "status": "Ativo",
    "shift": "Manhã",
    "phone": "(11) 99999-9999",
    "email": "joao@condominio.com"
  }
]`}
          </pre>

          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-60" style={{ color: 'var(--text-secondary)' }}>
                Importar arquivo ou colar abaixo
              </label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const text = typeof reader.result === 'string' ? reader.result : '';
                    setPastedData(text);
                    setErrors([]);
                    processPastedJsonFromString(text);
                  };
                  reader.readAsText(file, 'UTF-8');
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all disabled:opacity-50"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                <Upload className="w-4 h-4" />
                Selecionar arquivo
              </button>
            </div>
            <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-60" style={{ color: 'var(--text-secondary)' }}>
              Ou colar JSON/CSV aqui
            </label>
            <textarea
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              className="w-full h-48 p-4 bg-white/5 border border-(--border-color) rounded-xl text-xs font-mono outline-none focus:border-(--text-primary)/40 transition-all resize-none"
              placeholder='Cole aqui um array JSON ou CSV (cabeçalho: nome, cargo, email, telefone)...'
            />
            <button
              onClick={processPastedJson}
              disabled={!pastedData.trim() || isProcessing}
              className="mt-3 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[var(--text-primary)] text-(--bg-color) hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              {isProcessing ? 'Processando...' : 'Processar Dados'}
            </button>
          </div>
        </div>

        {errors.length > 0 && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <p className="text-xs font-black text-red-400">Erros encontrados:</p>
            </div>
            <ul className="text-xs opacity-80 space-y-1 max-h-32 overflow-y-auto">
              {errors.map((err, idx) => (
                <li key={idx}>• {err}</li>
              ))}
            </ul>
          </div>
        )}

        {previewData.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <p className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>
                  {previewData.length} funcionário(s) pronto(s) para importar
                </p>
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto border border-(--border-color) rounded-xl">
              <table className="w-full text-[11px]">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="p-2 text-left font-black uppercase">Nome</th>
                    <th className="p-2 text-left font-black uppercase">Cargo</th>
                    <th className="p-2 text-left font-black uppercase">Status</th>
                    <th className="p-2 text-left font-black uppercase">Turno</th>
                    <th className="p-2 text-left font-black uppercase">Telefone</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((s, idx) => (
                    <tr key={idx} className="border-t border-(--border-color)">
                      <td className="p-2">{s.name}</td>
                      <td className="p-2">{s.role}</td>
                      <td className="p-2">{s.status}</td>
                      <td className="p-2">{s.shift}</td>
                      <td className="p-2">{s.phone || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={handleClose}
            className="px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-white/5 border border-(--border-color) hover:bg-white/10 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={previewData.length === 0 || isImporting}
            className="px-6 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[var(--text-primary)] text-(--bg-color) hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {isImporting ? 'Importando...' : `Importar (${previewData.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportStaffModal;

