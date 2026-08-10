import React, { useState } from 'react';
import { MessageSquare, Save, Check, Info } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext';

const WhatsAppTemplatesSection: React.FC = () => {
  const { config, updateWhatsAppTemplate } = useAppConfig();
  const [templates, setTemplates] = useState(config.whatsappTemplates);
  const [saved, setSaved] = useState<{ [key: string]: boolean }>({});

  const handleSave = (key: string) => {
    updateWhatsAppTemplate(key, templates[key]);
    setSaved({ ...saved, [key]: true });
    setTimeout(() => {
      setSaved({ ...saved, [key]: false });
    }, 2000);
  };

  const templateLabels: { [key: string]: { title: string; description: string } } = {
    packageReceived: {
      title: 'Encomenda Recebida',
      description: 'Mensagem enviada quando uma encomenda é registrada'
    },
    packageReminder: {
      title: 'Lembrete de Encomenda',
      description: 'Mensagem enviada para lembrar sobre encomenda pendente'
    },
    visitorArrival: {
      title: 'Chegada de Visitante',
      description: 'Mensagem enviada quando um visitante chega'
    }
  };

  const placeholders = {
    packageReceived: '{residentName}, {packageType}, {condominiumName}',
    packageReminder: '{residentName}, {packageType}, {condominiumName}, {permanence}',
    visitorArrival: '{residentName}, {visitorName}, {condominiumName}'
  };

  return (
    <div className="premium-glass rounded-[32px] p-4 sm:p-6 md:p-8 min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 mb-6 min-w-0">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[var(--glass-bg)] flex items-center justify-center border border-[var(--border-color)] shrink-0">
          <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-primary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">Templates de WhatsApp</h3>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            Personalize as mensagens automáticas enviadas pelo sistema
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(templates).map(([key, template]) => (
          <div key={key} className="space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex-1 min-w-0 w-full">
                <label className="block text-sm font-bold uppercase tracking-wide mb-1 text-[var(--text-primary)]">
                  {templateLabels[key]?.title || key}
                </label>
                <p className="text-xs text-[var(--text-secondary)] mb-2">
                  {templateLabels[key]?.description}
                </p>
                <textarea
                  value={template}
                  onChange={(e) => setTemplates({ ...templates, [key]: e.target.value })}
                  placeholder={`Ex: ${placeholders[key as keyof typeof placeholders]}`}
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl outline-none focus:ring-2 focus:ring-[var(--text-primary)]/20 transition-all font-medium resize-none"
                  style={{ color: 'var(--text-primary)' }}
                />
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[var(--text-secondary)]">
                  <Info className="w-3 h-3 shrink-0" />
                  <span>Use {`{residentName}`, `{packageType}`, `{condominiumName}`} como variáveis</span>
                </div>
              </div>
              <button
                onClick={() => handleSave(key)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-lg font-bold uppercase tracking-wide text-xs transition-all hover:scale-105 active:scale-95 whitespace-nowrap shrink-0"
              >
                {saved[key] ? (
                  <>
                    <Check className="w-3 h-3" />
                    Salvo
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WhatsAppTemplatesSection;

