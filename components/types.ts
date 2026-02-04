// Tipos usados pelo componente de conversa de voz em tempo real.

export interface UserProfile {
  name?: string;
  /** URL/BASE64 do avatar do assistente de voz */
  chefAvatar?: string | null;
  /** Nome da voz prebuilt do Gemini (ex.: Kore, Aoede, Fenrir, Puck) */
  aiVoice?: string | null;
  /** Instruções personalizadas para o chat/voz */
  customChatInstructions?: string;
}

export interface DailyPlan {
  // Estrutura detalhada não é usada diretamente aqui; mantido como dicionário genérico.
  [key: string]: any;
}

export interface LogItem {
  // Apenas serializado para contexto; sem acesso de campos tipados neste componente.
  [key: string]: any;
}

export interface MealItem {
  name: string;
  calories: number;
  macros: {
    protein: number;
    carbs: number;
    fats: number;
  };
  description?: string;
}

