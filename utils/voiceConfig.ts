/**
 * Mapeamento de gênero/estilo → voz prebuilt do Gemini Live.
 * Mantém a mesma convenção usada no Nutri.IA:
 * - Fenrir: Deep/Authoritative (Male Serious)
 * - Puck:   Playful/Mid        (Male Animated)
 * - Kore:   Calm/Professional  (Female Serious)
 * - Aoede:  Expressive         (Female Animated)
 */

export type VoiceGender = 'male' | 'female';
export type VoiceStyle = 'serious' | 'animated';

export function getGeminiVoiceName(
  gender: VoiceGender,
  style: VoiceStyle,
): string {
  if (gender === 'male') {
    return style === 'serious' ? 'Fenrir' : 'Puck';
  }
  return style === 'serious' ? 'Kore' : 'Aoede';
}

