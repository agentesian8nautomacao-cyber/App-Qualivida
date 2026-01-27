import React, { useState } from 'react';
import { MessageCircle, Save, Check, Info } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { useToast } from '../../contexts/ToastContext';
import { normalizePhoneForWhatsApp } from '../../utils/phoneNormalizer';

const CondominiumWhatsAppSection: React.FC = () => {
  const { config, updateConfig } = useAppConfig();
  const toast = useToast();
  const [whatsapp, setWhatsapp] = useState(config.condominiumWhatsApp || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // Normalizar número antes de salvar
    const normalization = normalizePhoneForWhatsApp(whatsapp.trim());
    
    if (!normalization.isValid || !normalization.normalized) {
      toast.error(`Número de WhatsApp inválido: ${normalization.error || 'Formato incorreto'}. Verifique o número e tente novamente. Exemplo: 5511999999999 (código do país + DDD + número)`);
      return;
    }
    
    setIsSaving(true);
    updateConfig({ condominiumWhatsApp: normalization.normalized });
    setTimeout(() => {
      setIsSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 500);
  };

  // Formatar número para exibição
  const formatWhatsApp = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    return numbers;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatWhatsApp(e.target.value);
    setWhatsapp(formatted);
  };

  return (
    <div className="premium-glass rounded-[32px] p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[var(--glass-bg)] flex items-center justify-center border border-[var(--border-color)]">
          <MessageCircle className="w-6 h-6 text-[var(--text-primary)]" />
        </div>
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight">WhatsApp do Condomínio</h3>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            Número usado para notificações quando o morador não tem WhatsApp cadastrado
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold uppercase tracking-wide mb-2 text-[var(--text-secondary)]">
            Número do WhatsApp (apenas números)
          </label>
          <input
            type="text"
            value={whatsapp}
            onChange={handleChange}
            placeholder="Ex: 5511999999999 (código do país + DDD + número)"
            className="w-full px-4 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 transition-all font-medium"
            style={{ color: 'var(--text-primary)' }}
            maxLength={15}
          />
          <div className="flex items-start gap-2 mt-2 text-xs text-[var(--text-secondary)]">
            <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <div>
              <p>Digite apenas números, incluindo código do país (ex: 55 para Brasil) e DDD.</p>
              <p className="mt-1">Este número será usado quando o morador não tiver WhatsApp cadastrado ou como alternativa para envio de notificações.</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
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
              {isSaving ? 'Salvando...' : 'Salvar WhatsApp'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CondominiumWhatsAppSection;
