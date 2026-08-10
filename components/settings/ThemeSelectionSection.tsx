import React from 'react';
import { Palette, Check } from 'lucide-react';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { themes, ThemeVariant } from '../../config/themeConfig';

const ThemeSelectionSection: React.FC = () => {
  const { config, updateConfig } = useAppConfig();

  const handleThemeChange = (theme: ThemeVariant) => {
    updateConfig({ theme });
    // Aplicar tema dinamicamente
    document.documentElement.setAttribute('data-theme', theme);
  };

  return (
    <div className="premium-glass rounded-[32px] p-4 sm:p-6 md:p-8 min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 mb-6 min-w-0">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[var(--glass-bg)] flex items-center justify-center border border-[var(--border-color)] shrink-0">
          <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--text-primary)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">Versão de Design</h3>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mt-1">
            Escolha entre duas versões visuais do sistema
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(themes).map(([key, theme]) => {
          const isSelected = config.theme === key;
          return (
            <button
              key={key}
              onClick={() => handleThemeChange(key as ThemeVariant)}
              className={`relative p-6 rounded-[24px] border-2 transition-all hover:scale-[1.02] text-left ${
                isSelected
                  ? 'border-[var(--text-primary)] bg-[var(--glass-bg)]'
                  : 'border-[var(--border-color)] bg-[var(--glass-bg)]/50 hover:border-[var(--text-secondary)]'
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </div>
              )}
              
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-12 h-12 rounded-xl"
                  style={{ 
                    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.accent} 100%)` 
                  }}
                />
                <div>
                  <h4 className="text-lg font-black uppercase tracking-tight text-[var(--text-primary)]">
                    {theme.name}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    {theme.description}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                {Object.entries(theme.colors).slice(0, 4).map(([name, color]) => (
                  <div
                    key={name}
                    className="flex-1 h-8 rounded-lg border border-[var(--border-color)]"
                    style={{ backgroundColor: color }}
                    title={name}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-[var(--glass-bg)] rounded-xl border border-[var(--border-color)]">
        <p className="text-xs text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">Nota:</strong> A mudança de tema afeta apenas a aparência visual. 
          Todas as funcionalidades permanecem idênticas em ambas as versões.
        </p>
      </div>
    </div>
  );
};

export default ThemeSelectionSection;

