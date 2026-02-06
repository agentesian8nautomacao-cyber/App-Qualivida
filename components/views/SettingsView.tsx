import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import CondominiumNameSection from '../settings/CondominiumNameSection';
import CondominiumWhatsAppSection from '../settings/CondominiumWhatsAppSection';
import WhatsAppTemplatesSection from '../settings/WhatsAppTemplatesSection';
import ThemeSelectionSection from '../settings/ThemeSelectionSection';

const SettingsView: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      <header className="px-2">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-8 h-8 text-[var(--text-primary)]" />
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-contrast-high leading-tight uppercase">
            Configurações
          </h2>
        </div>
        <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-contrast-low">
          Personalize o sistema conforme suas necessidades
        </p>
      </header>

      <div className="space-y-6">
        <CondominiumNameSection />
        <CondominiumWhatsAppSection />
        <ThemeSelectionSection />
        <WhatsAppTemplatesSection />
      </div>
    </div>
  );
};

export default SettingsView;
