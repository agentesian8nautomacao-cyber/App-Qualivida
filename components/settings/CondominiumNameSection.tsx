import React, { useState } from 'react';
import { Building2, Save, Check } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext';

const CondominiumNameSection: React.FC = () => {
  const { config, updateCondominiumName } = useAppConfig();
  const [name, setName] = useState(config.condominiumName);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    updateCondominiumName(name);
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  return (
    <div className="premium-glass rounded-[32px] p-4 sm:p-6 md:p-8 min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 mb-6 min-w-0">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[var(--glass-bg)] flex items-center justify-center border border-[var(--border-color)] shrink-0">
          <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-primary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">Nome do Condomínio</h3>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            White Label - O nome será atualizado em todo o sistema
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold uppercase tracking-wide mb-2 text-[var(--text-secondary)]">
            Nome Atual do Condomínio
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Digite o nome do condomínio"
            className="w-full px-4 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 transition-all font-medium"
            style={{ color: 'var(--text-primary)' }}
          />
          <p className="text-xs text-[var(--text-secondary)] mt-2">
            Este nome substituirá "Qualivida" em todo o sistema, incluindo mensagens, títulos e interface.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || name.trim() === ''}
          className="flex items-center gap-2 px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-xl font-black uppercase tracking-wide transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saved ? (
            <>
              <Check className="w-4 h-4" />
              Salvo!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Nome'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CondominiumNameSection;

