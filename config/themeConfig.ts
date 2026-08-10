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
    name: 'Default',
    description: 'Paleta verde (marca QualiVida)',
    path: './themes/default',
    colors: {
      primary: '#0b7a4b',
      secondary: '#1e9f63',
      accent: '#7fcf6b',
      background: '#0c1a13',
      surface: 'rgba(12, 26, 19, 0.6)'
    }
  },
  alternative: {
    name: 'Alternative',
    description: 'Paleta verde clara',
    path: './themes/alternative',
    colors: {
      primary: '#0b7a4b',
      secondary: '#3c5f4a',
      accent: '#1e9f63',
      background: '#f8f9fa',
      surface: 'rgba(255, 255, 255, 0.9)'
    }
  }
};

export const getThemeConfig = (variant: ThemeVariant): ThemeConfig => {
  return themes[variant];
};

