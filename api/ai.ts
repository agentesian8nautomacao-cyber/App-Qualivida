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
  /** Base de conhecimento opcional (ex.: Regimento/Convenção em PDF) */
  knowledgeBase?: {
    name: string;
    mimeType: string;
    data: string; // Base64
  } | null;
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
            ? (profile?.managerConfig?.instructions ?? 'Nenhuma instrução específica para o Síndico definida.')
            : (profile?.doormanConfig?.instructions ?? 'Nenhuma instrução específica para o Porteiro definida.');

          // --- System Instruction espelhando o app "chat sentinela" (AI Studio) ---
          let systemInstruction = `
      Você é o **${assistantName || 'Portaria.ai'}**, o assistente inteligente para Condomínios.
      
      CONTEXTO DO USUÁRIO E DO APP:
      - Nome do Usuário Local: ${profile?.name}
      - Cargo Ativo: **${profile?.role || 'Porteiro'}**
      - Condomínio: ${profile?.condoName || 'Não informado'}
      
      [CONSCIÊNCIA SISTÊMICA E DO APLICATIVO]:
      Você deve entender e agir como parte integrante deste software. Você tem consciência de todo o ecossistema do aplicativo "Portaria.ai".

      [PROTOCOLO DE COMUNICAÇÃO HÍBRIDA - IMPORTANTE]:
      Este chat pode conter mensagens de terceiros (Moradores ou Sistemas Externos).
      Você receberá as mensagens formatadas com tags como:
      - [Usuário Local]: O porteiro ou síndico usando este app.
      - [Mensagem Externa de NOME]: Um morador ou visitante falando de outro app.
      
      SUA FUNÇÃO COMO MEDIADOR:
      Se um [Morador] mandar uma mensagem, ajude o [Usuário Local] a responder ou registre a solicitação.
      Não finja ser o morador. Você é o assistente do condomínio.

      SUA MISSÃO ESPECÍFICA (${isManager ? 'MODO SÍNDICO' : 'MODO PORTEIRO'}):
      ${
        isManager
          ? `1. Atuar como um ASSESSOR ADMINISTRATIVO e JURÍDICO do Síndico.
       2. Redigir **Comunicados, Circulares e Advertências** com linguagem formal, culta e impessoal.
       3. Analisar o Regimento Interno (se disponível) para dar pareceres sobre regras.
       4. Sugerir soluções diplomáticas para conflitos entre vizinhos.`
          : `1. Auxiliar no controle de acesso, encomendas e ocorrências do dia a dia.
       2. Ser direto, breve e focado na segurança.
       3. Registrar eventos com rapidez.`
      }

      ESTILIZAÇÃO DE RESPOSTAS (Markdown):
      - Use **Negrito** para dados críticos.
      - Para documentos (Circulares/Multas), use blocos de citação (>) ou code blocks para facilitar a cópia.
    `;

          // Anexar contexto de logs + instruções personalizadas (quando existirem)
          if (profile || recentLogs.length > 0) {
            systemInstruction += `
        ÚLTIMOS REGISTROS DO SISTEMA (Logs/Ocorrências):
        ${JSON.stringify(recentLogs || [])}
      `;

            systemInstruction += `\n\n[INSTRUÇÕES PERSONALIZADAS]:
      ${specificInstructions}
      `;

            if (profile?.knowledgeBase) {
              systemInstruction += `\n\n[BASE DE CONHECIMENTO]: O usuário carregou o REGIMENTO INTERNO ou CONVENÇÃO. Cite artigos ou cláusulas se possível ao tirar dúvidas.`;
            }
          }

          // Deixe explícito para o modelo que deve usar a ferramenta de log quando necessário
          systemInstruction += `\nSE o usuário confirmar a criação de um registro, multa ou circular, chame a função 'logEvent'.`;

          // Tool "logEvent" com mesma definição do app AI Studio
          const logEventTool = {
            name: 'logEvent',
            description:
              'Registra um evento oficial, ocorrência, multa ou circular no sistema do condomínio.',
            parameters: {
              type: Type.OBJECT,
              properties: {
                type: {
                  type: Type.STRING,
                  enum: [
                    'Visitante',
                    'Encomenda',
                    'Serviço',
                    'Ocorrência',
                    'Aviso',
                    'Multa',
                    'Circular',
                  ],
                  description: 'Categoria do evento.',
                },
                title: {
                  type: Type.STRING,
                  description:
                    'Título curto (Ex: Entrega Sedex, Multa Apto 102, Circular sobre Obras).',
                },
                description: {
                  type: Type.STRING,
                  description:
                    'Detalhes completos ou texto do documento gerado.',
                },
                involvedParties: {
                  type: Type.STRING,
                  description: 'Unidade ou pessoas envolvidas (Ex: Apto 504, Bloco B, Todos).',
                },
              },
              required: ['type', 'title', 'description'],
            },
          };

          // History formatado para distinguir [Usuário Local] x [Mensagem Externa]
          const formattedHistory: { role: string; parts: { text: string }[] }[] = messages.map(
            (m) => {
              let textContent = m.text;
              if (m.isExternal) {
                textContent = `[Mensagem Externa de ${m.senderName ?? 'Morador'}]: ${m.text}`;
              } else if (m.role === 'user') {
                textContent = `[Usuário Local - ${profile?.role || 'Operador'}]: ${m.text}`;
              }
              return {
                role: m.role,
                parts: [{ text: textContent }],
              };
            }
          );

          // Mensagem atual (pode anexar knowledgeBase, se existir)
          let messageContent: any = [{ text: `[Usuário Local]: ${newMessage}` }];
          if (profile?.knowledgeBase) {
            messageContent = [
              { text: '**[CONTEXTO DO ARQUIVO ANEXADO - REGIMENTO/CONVENÇÃO]**' },
              {
                inlineData: {
                  mimeType: profile.knowledgeBase.mimeType,
                  data: profile.knowledgeBase.data,
                },
              },
              { text: '\n\n**MENSAGEM DO USUÁRIO:**\n' + newMessage },
            ];
          }

          // Modelo e config alinhados ao app "chat sentinela"
          let conciergeModel: string = 'gemini-2.5-flash';
          const conciergeConfig: any = { systemInstruction };
          if (isManager) {
            conciergeModel = 'gemini-3-pro-preview';
            conciergeConfig.thinkingConfig = { thinkingBudget: 32768 };
          }
          conciergeConfig.tools = [{ functionDeclarations: [logEventTool] }];

          const chat = ai.chats.create({
            model: conciergeModel,
            history: formattedHistory as any,
            config: conciergeConfig,
          });

          let result: unknown = await chat.sendMessage({ message: messageContent });

          // Tratamento de toolCalls (logEvent) – pode haver múltiplas chamadas
          let logEvent: OccurrenceItemSentinela | undefined;
          const toolCalls =
            (result as any).candidates?.[0]?.content?.parts?.filter(
              (p: any) => p.functionCall
            ) ?? [];

          if (toolCalls.length > 0) {
            const functionResponseParts: any[] = [];
            for (const part of toolCalls) {
              const fc = part.functionCall;
              if (fc?.name === 'logEvent') {
                const args = fc.args as any;
                const newItem: OccurrenceItemSentinela = {
                  id: String(Date.now()),
                  type: args.type ?? 'Ocorrência',
                  title: args.title ?? '',
                  description: args.description ?? '',
                  timestamp: Date.now(),
                  involvedParties: args.involvedParties,
                  status: 'Logged',
                };
                logEvent = newItem;
                functionResponseParts.push({
                  functionResponse: {
                    id: fc.id,
                    name: fc.name,
                    response: {
                      result: `Evento do tipo ${args.type} registrado com sucesso: ${args.title}`,
                    },
                  },
                });
              }
            }
            if (functionResponseParts.length > 0) {
              result = await chat.sendMessage({ message: functionResponseParts as any });
            }
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
