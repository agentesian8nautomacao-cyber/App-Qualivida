/**
 * API serverless Vercel: integração Gemini no backend.
 * A chave GEMINI_API_KEY é lida apenas aqui (process.env); nunca exposta ao client.
 * Runtime Node.js obrigatório para compatibilidade com o SDK do Gemini.
 */

import { GoogleGenAI, Type } from '@google/genai';

export const runtime = 'nodejs';

export const config = {
  runtime: 'nodejs',
};

function extractGeminiText(response: unknown): string {
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Perfil e mensagens no formato Sentinela (concierge) */
interface SentinelaProfile {
  name?: string;
  role?: string;
  condoName?: string;
  doormanConfig?: { assistantName?: string; instructions?: string };
  managerConfig?: { assistantName?: string; instructions?: string };
}
interface SentinelaChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  isExternal?: boolean;
  senderName?: string;
}
interface OccurrenceItemSentinela {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: number;
  involvedParties?: string;
  status: string;
}

type Body = {
  action?: string;
  prompt?: string;
  context?: string;
  persona?: string;
  dataContext?: string;
  reportPrompt?: string;
  /** Concierge (Sentinela) */
  messages?: SentinelaChatMessage[];
  newMessage?: string;
  profile?: SentinelaProfile | null;
  recentLogs?: OccurrenceItemSentinela[];
};

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (request.method !== 'POST') {
        return Response.json(
          { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
          { status: 405, headers: corsHeaders }
        );
      }

      // Validar variável ANTES de usar (evita 503 genérico)
      if (!process.env.GEMINI_API_KEY) {
        return Response.json(
          { error: 'GEMINI_API_KEY não definida no ambiente', code: 'GEMINI_API_KEY_MISSING' },
          { status: 500, headers: corsHeaders }
        );
      }

      const apiKey =
        typeof process.env.GEMINI_API_KEY === 'string' ? process.env.GEMINI_API_KEY.trim() : '';
      if (!apiKey) {
        return Response.json(
          { error: 'GEMINI_API_KEY não definida no ambiente', code: 'GEMINI_API_KEY_MISSING' },
          { status: 500, headers: corsHeaders }
        );
      }

      let body: Body = {};
      try {
        const raw = await request.json();
        body = (raw && typeof raw === 'object' ? raw : {}) as Body;
      } catch {
        return Response.json(
          { error: 'Body inválido', code: 'BAD_REQUEST' },
          { status: 400, headers: corsHeaders }
        );
      }

      const { action } = body;
      if (action !== 'chat' && action !== 'chat-stream' && action !== 'report' && action !== 'concierge') {
        return Response.json(
          { error: 'action deve ser "chat", "chat-stream", "report" ou "concierge"', code: 'BAD_REQUEST' },
          { status: 400, headers: corsHeaders }
        );
      }

      const model = 'gemini-2.0-flash';
      try {
        const ai = new GoogleGenAI({ apiKey });

        if (action === 'chat' || action === 'chat-stream') {
          const { prompt, context = '', persona = '' } = body;
          if (!prompt || typeof prompt !== 'string') {
            return Response.json(
              { error: 'prompt obrigatório', code: 'BAD_REQUEST' },
              { status: 400, headers: corsHeaders }
            );
          }
          const fullContent = `${persona}\n\nCONTEXTO EM TEMPO REAL (CONDOMÍNIO QUALIVIDA):\n${context}\n\nSOLICITAÇÃO DO USUÁRIO:\n${prompt}`;

          if (action === 'chat-stream') {
            const stream = await ai.models.generateContentStream({
              model,
              contents: fullContent,
            });
            const encoder = new TextEncoder();
            const readable = new ReadableStream({
              async start(controller) {
                try {
                  for await (const chunk of stream) {
                    const text = (chunk as { text?: string }).text ?? extractGeminiText(chunk);
                    if (text) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
                    }
                  }
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
                } finally {
                  controller.close();
                }
              },
            });
            return new Response(readable, {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
              },
            });
          }

          const response = await ai.models.generateContent({
            model,
            contents: fullContent,
          });
          const text = (response as { text?: string }).text ?? extractGeminiText(response);
          return Response.json(
            { text: (text && String(text).trim()) || 'Desculpe, não consegui gerar uma resposta. Tente novamente.' },
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (action === 'report') {
          const { dataContext = '', reportPrompt = '' } = body;
          const fullContent = reportPrompt.includes('${dataContext}')
            ? reportPrompt.replace(/\$\{dataContext\}/g, dataContext)
            : `${reportPrompt}\n\n${dataContext}`;
          const response = await ai.models.generateContent({
            model,
            contents: fullContent,
          });
          const text = (response as { text?: string }).text ?? extractGeminiText(response);
          return Response.json(
            { text: (text && String(text).trim()) || 'Não foi possível gerar o relatório.' },
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (action === 'concierge') {
          const { messages = [], newMessage = '', profile, recentLogs = [] } = body;
          if (!newMessage || typeof newMessage !== 'string') {
            return Response.json(
              { error: 'newMessage obrigatório para action concierge', code: 'BAD_REQUEST' },
              { status: 400, headers: corsHeaders }
            );
          }
          const isManager = profile?.role === 'Síndico';
          const assistantName = isManager
            ? (profile?.managerConfig?.assistantName ?? 'Conselheiro')
            : (profile?.doormanConfig?.assistantName ?? 'Sentinela');
          const specificInstructions = isManager
            ? (profile?.managerConfig?.instructions ?? 'Atue como assessor administrativo do Síndico.')
            : (profile?.doormanConfig?.instructions ?? 'Foco em segurança e controle de acesso.');
          const systemInstruction = `Você é o **${assistantName}**, assistente para Condomínios.
CONTEXTO: Usuário ${profile?.name ?? 'Operador'}, Cargo ${profile?.role ?? 'Porteiro'}, Condomínio ${profile?.condoName ?? 'Não informado'}.
ÚLTIMOS REGISTROS: ${JSON.stringify(recentLogs)}
INSTRUÇÕES: ${specificInstructions}
Use **negrito** para dados críticos. Se o usuário confirmar criação de registro/ocorrência, chame a função logEvent.`;
          const logEventTool = {
            name: 'logEvent',
            description: 'Registra evento oficial no condomínio (visitante, encomenda, ocorrência, aviso, multa, circular).',
            parameters: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, description: 'Categoria: Visitante, Encomenda, Serviço, Ocorrência, Aviso, Multa, Circular' },
                title: { type: Type.STRING, description: 'Título curto' },
                description: { type: Type.STRING, description: 'Detalhes' },
                involvedParties: { type: Type.STRING, description: 'Unidade ou pessoas envolvidas' },
              },
              required: ['type', 'title', 'description'],
            },
          };
          const historyContent: { role: string; parts: { text: string }[] }[] = messages.map((m) => {
            const text = m.isExternal
              ? `[Mensagem Externa de ${m.senderName ?? 'Morador'}]: ${m.text}`
              : m.role === 'user'
                ? `[Usuário Local]: ${m.text}`
                : m.text;
            return { role: m.role, parts: [{ text }] };
          });
          const chat = ai.chats.create({
            model,
            history: historyContent as any,
            config: {
              systemInstruction,
              tools: [{ functionDeclarations: [logEventTool] }],
            },
          });
          let result = await chat.sendMessage({ message: `[Usuário Local]: ${newMessage}` });
          const parts = (result as any).candidates?.[0]?.content?.parts ?? [];
          const functionCall = parts.find((p: any) => p.functionCall);
          let logEvent: OccurrenceItemSentinela | undefined;
          if (functionCall?.functionCall?.name === 'logEvent') {
            const args = functionCall.functionCall.args as any;
            logEvent = {
              id: String(Date.now()),
              type: args.type ?? 'Ocorrência',
              title: args.title ?? '',
              description: args.description ?? '',
              timestamp: Date.now(),
              involvedParties: args.involvedParties,
              status: 'Logged',
            };
            const functionResponseParts = [{
              functionResponse: {
                id: functionCall.functionCall.id,
                name: 'logEvent',
                response: { result: `Evento ${args.type} registrado: ${args.title}` },
              },
            }];
            result = await chat.sendMessage({ message: functionResponseParts as any });
          }
          const text = extractGeminiText(result);
          return Response.json(
            { text: (text && String(text).trim()) || 'Sem resposta.', ...(logEvent && { logEvent }) },
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const apiMsg = (err as { error?: { message?: string } })?.error?.message ?? message;
        const fullMsg = apiMsg || message;
        // Log seguro: só a mensagem (nunca a chave); ver em Vercel → Project → Logs
        console.error('Erro Gemini:', fullMsg);
        if (
          /API key|PERMISSION_DENIED|invalid|expired|quota|403|401/i.test(fullMsg)
        ) {
          return Response.json(
            {
              error:
                'Erro na chave da API no servidor. Verifique GEMINI_API_KEY nas variáveis do Vercel e restrições em aistudio.google.com/apikey.',
              code: 'GEMINI_API_ERROR',
            },
            { status: 500, headers: corsHeaders }
          );
        }
        return Response.json(
          { error: 'Falha ao processar IA', code: 'INTERNAL_ERROR' },
          { status: 500, headers: corsHeaders }
        );
      }

      return Response.json(
        { error: 'Ação inválida', code: 'BAD_REQUEST' },
        { status: 400, headers: corsHeaders }
      );
    } catch (topErr: unknown) {
      const msg = topErr instanceof Error ? topErr.message : String(topErr);
      return Response.json(
        { error: msg || 'Erro interno no servidor.', code: 'INTERNAL_ERROR' },
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
