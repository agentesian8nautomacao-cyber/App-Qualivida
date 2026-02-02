/**
 * API serverless Vercel: integração Gemini no backend.
 * A chave GEMINI_API_KEY é lida apenas aqui (process.env); nunca exposta ao client.
 * Runtime Node.js obrigatório para compatibilidade com o SDK do Gemini.
 */

import { GoogleGenAI } from '@google/genai';

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

      // REMOVER depois do debug
      console.log('GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);

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
      if (action !== 'chat' && action !== 'report') {
        return Response.json(
          { error: 'action deve ser "chat" ou "report"', code: 'BAD_REQUEST' },
          { status: 400, headers: corsHeaders }
        );
      }

      const model = 'gemini-2.0-flash';
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
      } catch (err: unknown) {
        console.error('Erro Gemini:', err);
        const message = err instanceof Error ? err.message : String(err);
        const apiMsg = (err as { error?: { message?: string } })?.error?.message ?? message;
        const fullMsg = apiMsg || message;
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
