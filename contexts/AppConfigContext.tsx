import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface WhatsAppTemplate {
  packageReceived: string;
  packageReminder: string;
  visitorArrival: string;
  [key: string]: string;
}

export interface KeyboardShortcut {
  key: string;
  action: string;
  description: string;
}

export interface AIConfig {
  name: string;
  voiceGender: 'male' | 'female';
  voiceStyle: 'serious' | 'animated';
  externalInstructions: string;
}

export interface AppConfig {
  condominiumName: string;
  condominiumWhatsApp: string;
  whatsappTemplates: WhatsAppTemplate;
  keyboardShortcuts: KeyboardShortcut[];
  aiConfig: AIConfig;
  theme: 'default' | 'alternative';
}

const defaultConfig: AppConfig = {
  condominiumName: 'Qualivida',
  condominiumWhatsApp: '',
  whatsappTemplates: {
    packageReceived: 'Olá, {residentName}! Recebemos um volume para você ({packageType}) na portaria do {condominiumName}. Favor retirar assim que possível.',
    packageReminder: 'Olá, {residentName}! Temos um volume ({packageType}) aguardando por você na portaria do {condominiumName} há {permanence}. Favor retirar assim que possível.',
    visitorArrival: 'Olá, {residentName}! Seu visitante {visitorName} chegou na portaria do {condominiumName}.'
  },
  keyboardShortcuts: [
    { key: 'Ctrl+C', action: 'packages', description: 'Abrir Encomendas' },
    { key: 'Ctrl+V', action: 'visitors', description: 'Abrir Visitantes' },
    { key: 'Ctrl+D', action: 'dashboard', description: 'Voltar ao Dashboard' },
    { key: 'Ctrl+S', action: 'settings', description: 'Abrir Configurações' }
  ],
  aiConfig: {
    name: 'Sentinela',
    // Padrão alinhado com a voz Kore (Nutri.IA) para paridade inicial.
    voiceGender: 'female',
    voiceStyle: 'serious',
    externalInstructions: 'Você é um assistente operacional profissional. Seja objetivo, prestativo e eficiente.'
  },
  theme: 'default'
};

interface AppConfigContextType {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  updateCondominiumName: (name: string) => void;
  updateWhatsAppTemplate: (key: string, template: string) => void;
  updateKeyboardShortcut: (index: number, shortcut: KeyboardShortcut) => void;
  updateAIConfig: (updates: Partial<AIConfig>) => void;
  resetConfig: () => void;
}

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);

export const AppConfigProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('app_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge profundo de aiConfig para não perder voiceGender/voiceStyle ao carregar
        const merged: AppConfig = {
          ...defaultConfig,
          ...parsed,
          aiConfig: { ...defaultConfig.aiConfig, ...(parsed?.aiConfig || {}) },
        };
        return merged;
      } catch {
        return defaultConfig;
      }
    }
    return defaultConfig;
  });

  useEffect(() => {
    // Persistir config completo (aiConfig sempre com todos os campos)
    const toSave: AppConfig = {
      ...config,
      aiConfig: { ...defaultConfig.aiConfig, ...config.aiConfig },
    };
    localStorage.setItem('app_config', JSON.stringify(toSave));
    document.documentElement.setAttribute('data-theme', config.theme);
  }, [config]);

  const updateConfig = (updates: Partial<AppConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateCondominiumName = (name: string) => {
    setConfig(prev => ({ ...prev, condominiumName: name }));
  };

  const updateWhatsAppTemplate = (key: string, template: string) => {
    setConfig(prev => ({
      ...prev,
      whatsappTemplates: { ...prev.whatsappTemplates, [key]: template }
    }));
  };

  const updateKeyboardShortcut = (index: number, shortcut: KeyboardShortcut) => {
    setConfig(prev => {
      const newShortcuts = [...prev.keyboardShortcuts];
      newShortcuts[index] = shortcut;
      return { ...prev, keyboardShortcuts: newShortcuts };
    });
  };

  const updateAIConfig = (updates: Partial<AIConfig>) => {
    setConfig(prev => ({
      ...prev,
      aiConfig: { ...prev.aiConfig, ...updates }
    }));
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
    localStorage.removeItem('app_config');
  };

  return (
    <AppConfigContext.Provider
      value={{
        config,
        updateConfig,
        updateCondominiumName,
        updateWhatsAppTemplate,
        updateKeyboardShortcut,
        updateAIConfig,
        resetConfig
      }}
    >
      {children}
    </AppConfigContext.Provider>
  );
};

export const useAppConfig = () => {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error('useAppConfig must be used within AppConfigProvider');
  }
  return context;
};
