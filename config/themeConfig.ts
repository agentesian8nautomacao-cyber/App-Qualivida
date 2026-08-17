export type ThemeVariant = 'default' | 'alternative';

export interface ThemeConfig {
  name: string;
  description: string;
  path: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
  };
}

export const themes: Record<ThemeVariant, ThemeConfig> = {
  default: {
    name: 'Sentinela Dark',
    description: 'Navy operacional com azul elétrico e ciano',
    path: './themes/default',
    colors: {
      primary: '#2563eb',
      secondary: '#0f3b82',
      accent: '#22d3ee',
      background: '#06101f',
      surface: 'rgba(11, 25, 48, 0.72)'
    }
  },
  alternative: {
    name: 'Sentinela Light',
    description: 'Superfícies claras com contraste azul operacional',
    path: './themes/alternative',
    colors: {
      primary: '#2563eb',
      secondary: '#1d4ed8',
      accent: '#0891b2',
      background: '#f2f7fc',
      surface: 'rgba(255, 255, 255, 0.9)'
    }
  }
};

export const getThemeConfig = (variant: ThemeVariant): ThemeConfig => {
  return themes[variant];
};

