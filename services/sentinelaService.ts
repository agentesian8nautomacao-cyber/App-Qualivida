/**
 * Serviço Sentinela: chat com assistente Porteiro/Síndico (Sentinela/Conselheiro).
 * Usa a API /api/ai com action concierge quando disponível; fallback para chat-stream com persona.
 */

import type {
  SentinelaUserProfile,
  SentinelaChatMessage,
  OccurrenceItemSentinela,
} from '../types/sentinela';

const getAiApiUrl = () => {
  const env = (import.meta as any).env || {};
  const base = env.VITE_API_BASE_URL as string | undefined;
  if (env.DEV && base) {
    return `${base.replace(/\/+$/, '')}/api/ai`;
  }
  return '/api/ai';
};

export interface ConciergeContext {
  profile: SentinelaUserProfile | null;
  recentLogs: OccurrenceItemSentinela[];
}

export interface ConciergeResult {
  text: string;
  logEvent?: OccurrenceItemSentinela;
}

/**
 * Envia mensagem ao assistente Sentinela/Conselheiro e retorna resposta + eventual logEvent.
 */
export async function chatWithConcierge(
  messages: SentinelaChatMessage[],
  newMessage: string,
  context: ConciergeContext,
  onLogEvent?: (item: OccurrenceItemSentinela) => void
): Promise<string> {
  const url = getAiApiUrl();
  const body = {
    action: 'concierge',
    messages,
    newMessage,
    profile: context.profile,
    recentLogs: context.recentLogs,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? 'Erro ao falar com o assistente.');
  }

  const data = (await res.json()) as ConciergeResult;
  if (data.logEvent && onLogEvent) {
    onLogEvent(data.logEvent);
  }
  return data.text ?? 'Sem resposta. Tente novamente.';
}
