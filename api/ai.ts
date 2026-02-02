/**
 * API serverless Vercel: integração Gemini no backend.
 * A chave GEMINI_API_KEY é lida apenas aqui (process.env); nunca exposta ao client.
 */

import { GoogleGenAI } from '@google/genai';

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

type Body = {
  action?: string;
  prompt?: string;
  context?: string;
  persona?: string;
  dataContext?: string;
  reportPrompt?: string;
};

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return Response.json(
        { error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' },
        { status: 405, headers: corsHeaders }
      );
    }

    const apiKey =
      typeof process.env.GEMINI_API_KEY === 'string' ? process.env.GEMINI_API_KEY.trim() : '';
    if (!apiKey) {
      return Response.json(
        {
          error:
            'Assistente IA indisponível. Configure GEMINI_API_KEY nas variáveis de ambiente do servidor (ex.: Vercel).',
          code: 'GEMINI_API_KEY_MISSING',
        },
        { status: 503, headers: corsHeaders }
      );
    }

    let body: Body = {};
    try {
      body = (await request.json()) as Body;
    } catch {
      return Response.json(
        { error: 'Body inválido', code: 'BAD_REQUEST' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { action } = body;
    if (action !== 'chat' && action !== 'report') {
      return Response.json(
        { error: 'action deve ser "chat" ou "report"', code: 'BAD_REQUEST' },
        { status: 400, headers: corsHeaders }
      );
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      if (action === 'chat') {
        const { prompt, context = '', persona = '' } = body;
        if (!prompt || typeof prompt !== 'string') {
          return Response.json(
            { error: 'prompt obrigatório', code: 'BAD_REQUEST' },
            { status: 400, headers: corsHeaders }
          );
        }
        const fullContent = `${persona}\n\nCONTEXTO EM TEMPO REAL:\n${context}\n\nSOLICITAÇÃO DO USUÁRIO:\n${prompt}`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: fullContent }] }],
          config: { temperature: 0.7 },
        });
        const text = extractGeminiText(response) || (response as { text?: () => string }).text?.() ?? '';
        return Response.json(
          { text: text || 'Desculpe, não consegui gerar uma resposta. Tente novamente.' },
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'report') {
        const { dataContext = '', reportPrompt = '' } = body;
        const fullContent = reportPrompt.includes('${dataContext}')
          ? reportPrompt.replace('${dataContext}', dataContext)
          : `${reportPrompt}\n\n${dataContext}`;
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: fullContent,
        });
        const text = extractGeminiText(response) || (response as { text?: () => string }).text?.() ?? '';
        return Response.json(
          { text: text || 'Não foi possível gerar o relatório.' },
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const apiMsg = (err as { error?: { message?: string } })?.error?.message ?? message;
      if (
        /API key|PERMISSION_DENIED|invalid|expired|quota|403|401/i.test(apiMsg) ||
        /API key|PERMISSION_DENIED|invalid|expired|quota|403|401/i.test(message)
      ) {
        return Response.json(
          {
            error:
              'Erro na chave da API no servidor. Verifique GEMINI_API_KEY nas variáveis do Vercel e restrições em aistudio.google.com/apikey.',
            code: 'GEMINI_API_ERROR',
          },
          { status: 503, headers: corsHeaders }
        );
      }
      return Response.json(
        { error: apiMsg || 'Erro ao processar solicitação.', code: 'INTERNAL_ERROR' },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      { error: 'Ação inválida', code: 'BAD_REQUEST' },
      { status: 400, headers: corsHeaders }
    );
  },
};
