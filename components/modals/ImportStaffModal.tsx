import React, { useState } from 'react';
import { X, Upload, Copy, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { Staff } from '../../types';

interface ImportStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (staffList: Staff[]) => Promise<void> | void;
  existingStaff: Staff[];
}

const ImportStaffModal: React.FC<ImportStaffModalProps> = ({
  isOpen,
  onClose,
  onImport,
  existingStaff
}) => {
  const [pastedData, setPastedData] = useState('');
  const [previewData, setPreviewData] = useState<Staff[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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

  const processPastedJson = () => {
    setIsProcessing(true);
    setErrors([]);
    setPreviewData([]);

    try {
      const data = JSON.parse(pastedData);
      if (!Array.isArray(data)) {
        setErrors(['JSON deve ser um array de objetos.']);
        return;
      }

      const list: Staff[] = [];
      const jsonErrors: string[] = [];

      data.forEach((item, index) => {
        const name = item.name || item.nome;
        const role = item.role || item.cargo;
        if (!name || !role) {
          jsonErrors.push(`Item ${index + 1}: Nome e cargo são obrigatórios`);
          return;
        }

        const normalizedName = String(name).trim();
        const normalizedRole = String(role).trim();

        // Evitar duplicidade simples por nome + cargo
        const exists = existingStaff.some(
          s =>
            s.name.toLowerCase() === normalizedName.toLowerCase() &&
            s.role.toLowerCase() === normalizedRole.toLowerCase()
        );
        if (exists) {
          jsonErrors.push(`Item ${index + 1}: Funcionário "${normalizedName}" (${normalizedRole}) já existe`);
          return;
        }

        const status = (item.status || 'Ativo') as 'Ativo' | 'Férias' | 'Licença';
        const shift =
          (item.shift ||
            item.turno ||
            'Comercial') as 'Manhã' | 'Tarde' | 'Noite' | 'Madrugada' | 'Comercial';

        list.push({
          id: `temp-${Date.now()}-${index}`,
          name: normalizedName,
          role: normalizedRole,
          status,
          shift,
          phone: item.phone || item.telefone || '',
          email: item.email || ''
        });
      });

      if (jsonErrors.length > 0) setErrors(jsonErrors);
      setPreviewData(list);
    } catch (e) {
      setErrors(['JSON inválido. Verifique o formato e tente novamente.']);
    } finally {
      setIsProcessing(false);
    }
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-3xl p-6 sm:p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>
              Importar Funcionários
            </h3>
            <p className="text-xs opacity-60 mt-1" style={{ color: 'var(--text-secondary)' }}>
              Cole uma lista em JSON com os dados dos colaboradores para cadastro em lote.
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
          <pre className="bg-black/40 border border-[var(--border-color)] rounded-xl p-3 text-[10px] overflow-x-auto">
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
            <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-60" style={{ color: 'var(--text-secondary)' }}>
              Colar JSON com funcionários
            </label>
            <textarea
              value={pastedData}
              onChange={(e) => setPastedData(e.target.value)}
              className="w-full h-48 p-4 bg-white/5 border border-[var(--border-color)] rounded-xl text-xs font-mono outline-none focus:border-[var(--text-primary)]/40 transition-all resize-none"
              placeholder='Cole aqui um array JSON com os dados dos colaboradores...'
            />
            <button
              onClick={processPastedJson}
              disabled={!pastedData.trim() || isProcessing}
              className="mt-3 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[var(--text-primary)] text-[var(--bg-color)] hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
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
            <div className="max-h-60 overflow-y-auto border border-[var(--border-color)] rounded-xl">
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
                    <tr key={idx} className="border-t border-[var(--border-color)]">
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
            className="px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-white/5 border border-[var(--border-color)] hover:bg-white/10 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={previewData.length === 0 || isImporting}
            className="px-6 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest bg-[var(--text-primary)] text-[var(--bg-color)] hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-2"
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

