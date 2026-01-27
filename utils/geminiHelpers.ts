/**
 * Extrai texto do retorno de generateContent (@google/genai).
 * Suporta .text, .text() e candidates[0].content.parts para compatibilidade com mudanças da API.
 */
export function extractGeminiText(response: unknown): string {
  if (!response || typeof response !== 'object') return '';
  const r = response as Record<string, unknown>;
  if (typeof r.text === 'function') return String((r.text as () => string)() ?? '');
  if (typeof r.text === 'string') return r.text;
  const candidates = r.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
  const parts = candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const p = parts.find((x) => x?.text != null);
    return p?.text ?? '';
  }
  return '';
}
