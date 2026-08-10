/**
 * Humanização de texto para síntese de voz (Web Speech API).
 * Objetivo: ritmo conversacional, frases curtas, pausas naturais.
 * SSML não é suportado no Chrome para SpeechSynthesisUtterance, então
 * usamos quebra por frases e pausas via múltiplos utterances.
 */

const SENTENCE_END = /[.!?]+|\n+/g;
const MAX_CHARS_PER_CHUNK = 120;
const MIN_CHUNK_LENGTH = 10;

/**
 * Quebra texto em frases para fala com pausas naturais.
 * Evita chunks longos demais (monotonia) e curtos demais (cortes).
 */
export function splitIntoSpeakableChunks(text: string): string[] {
  if (!text || !text.trim()) return [];

  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/\s*([.!?])\s*/g, '$1 ')
    .trim();

  const rawSentences: string[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(SENTENCE_END.source, 'g');
  while ((m = re.exec(normalized)) !== null) {
    const sentence = normalized.slice(lastIndex, m.index + m[0].length).trim();
    if (sentence.length >= MIN_CHUNK_LENGTH) rawSentences.push(sentence);
    lastIndex = m.index + m[0].length;
  }
  const tail = normalized.slice(lastIndex).trim();
  if (tail.length >= MIN_CHUNK_LENGTH) rawSentences.push(tail);
  else if (tail.length > 0 && rawSentences.length > 0) {
    rawSentences[rawSentences.length - 1] = rawSentences[rawSentences.length - 1] + ' ' + tail;
  } else if (tail.length > 0) rawSentences.push(tail);

  const chunks: string[] = [];
  for (const s of rawSentences) {
    if (s.length <= MAX_CHARS_PER_CHUNK) {
      chunks.push(s);
      continue;
    }
    const parts = s.split(/,|;|:/).map(p => p.trim()).filter(Boolean);
    let acc = '';
    for (const p of parts) {
      const candidate = acc ? acc + ', ' + p : p;
      if (candidate.length <= MAX_CHARS_PER_CHUNK) {
        acc = candidate;
      } else {
        if (acc) chunks.push(acc);
        acc = p.length <= MAX_CHARS_PER_CHUNK ? p : p.slice(0, MAX_CHARS_PER_CHUNK);
      }
    }
    if (acc) chunks.push(acc);
  }

  return chunks.filter(c => c.length > 0);
}

/**
 * Ajustes leves no texto para soar mais natural na fala.
 * Normaliza espaços e evita quebras estranhas; contrações/estilo vêm do modelo via persona.
 */
export function humanizeTextForSpeech(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s*([.,!?;:])\s*/g, '$1 ')
    .trim();
}
