
import { GoogleGenAI } from "@google/genai";
import { extractGeminiText } from "../utils/geminiHelpers";
import { logger } from "../utils/logger";

export class AIService {
  static async analyzeCondoData(data: string): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analise os seguintes dados do condomínio Qualivida e forneça um resumo executivo com recomendações rápidas: ${data}`,
        config: {
          systemInstruction: "Você é um assistente inteligente especializado em gestão condominial de alto luxo. Use um tom profissional, direto e elegante em português brasileiro.",
        }
      });
      return extractGeminiText(response) || "Não foi possível gerar uma análise no momento.";
    } catch (error) {
      logger.error("AI Error:", error);
      return "Erro ao processar análise inteligente.";
    }
  }

  static async getPackageAdvice(): Promise<string> {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Quais as melhores práticas atuais para entrega de encomendas em condomínios de luxo para evitar acúmulo na portaria?",
      });
      return extractGeminiText(response) || "";
    } catch (error) {
      return "";
    }
  }
}
