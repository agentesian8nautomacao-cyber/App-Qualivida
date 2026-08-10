/**
 * Retorna a chave da API Gemini a partir das variáveis de ambiente.
 *
 * Suporta, em ordem de prioridade:
 * - VITE_GEMINI_API_KEY
 * - VITE_API_KEY
 * - VITE_GEMINI_LIVE_KEY
 * - GEMINI_API_KEY
 * - API_KEY (quando injetado via define)
 */
export function getGeminiApiKey(): string | undefined {
  // Ambiente de build/SSR (quando process existe)
  const fromProcess =
    typeof process !== 'undefined' &&
    process.env &&
    (process.env.VITE_GEMINI_API_KEY ||
      process.env.VITE_API_KEY ||
      process.env.VITE_GEMINI_LIVE_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.API_KEY);

  // Ambiente de browser (Vite)
  const fromMeta =
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env &&
    ((import.meta as any).env.VITE_GEMINI_API_KEY ||
      (import.meta as any).env.VITE_API_KEY ||
      (import.meta as any).env.VITE_GEMINI_LIVE_KEY ||
      (import.meta as any).env.GEMINI_API_KEY);

  const value = (fromMeta ?? fromProcess) as string | undefined;
  if (value == null || typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
