

import { GoogleGenAI, Type, FunctionDeclaration, Schema } from "@google/genai";
import { UserProfile, OccurrenceItem, UserRole, MealItem, Recipe, LogItem, ChatMessage } from "../types";

// Helper to retry functions
const callWithRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;
        console.warn(`API Call failed, retrying... (${retries} left)`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callWithRetry(fn, retries - 1, delay * 2);
    }
};

// Tool Definition for Logging Condo Events
const logEventTool: FunctionDeclaration = {
  name: "logEvent",
  description: "Registra um evento oficial, ocorrência, multa ou circular no sistema do condomínio.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: { 
          type: Type.STRING, 
          enum: ["Visitante", "Encomenda", "Serviço", "Ocorrência", "Aviso", "Multa", "Circular"],
          description: "Categoria do evento."
      },
      title: { type: Type.STRING, description: "Título curto (Ex: Entrega Sedex, Multa Apto 102, Circular sobre Obras)." },
      description: { type: Type.STRING, description: "Detalhes completos ou texto do documento gerado." },
      involvedParties: { type: Type.STRING, description: "Unidade ou pessoas envolvidas (Ex: Apto 504, Bloco B, Todos)." }
    },
    required: ["type", "title", "description"]
  }
};

export const chatWithConcierge = async (
  messages: ChatMessage[], // Changed to accept full message objects for context parsing
  newMessage: string,
  context?: {
    profile?: UserProfile | null,
    recentLogs?: OccurrenceItem[]
  },
  options?: {
    useThinking?: boolean
  },
  onLogEvent?: (data: OccurrenceItem) => void
) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const isManager = context?.profile?.role === UserRole.Manager;
    
    // Select the correct instruction set based on role from new config structure
    const specificInstructions = isManager 
        ? (context?.profile?.managerConfig.instructions || "Nenhuma instrução específica para o Síndico definida.")
        : (context?.profile?.doormanConfig.instructions || "Nenhuma instrução específica para o Porteiro definida.");
        
    const assistantName = isManager
        ? context?.profile?.managerConfig.assistantName
        : context?.profile?.doormanConfig.assistantName;

    let systemInstruction = `
      Você é o **${assistantName || 'Portaria.ai'}**, o assistente inteligente para Condomínios.
      
      CONTEXTO DO USUÁRIO E DO APP:
      - Nome do Usuário Local: ${context?.profile?.name}
      - Cargo Ativo: **${context?.profile?.role || "Porteiro"}**
      - Condomínio: ${context?.profile?.condoName || "Não informado"}
      
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

      SUA MISSÃO ESPECÍFICA (${isManager ? "MODO SÍNDICO" : "MODO PORTEIRO"}):
      ${isManager ? 
      `1. Atuar como um ASSESSOR ADMINISTRATIVO e JURÍDICO do Síndico.
       2. Redigir **Comunicados, Circulares e Advertências** com linguagem formal, culta e impessoal.
       3. Analisar o Regimento Interno (se disponível) para dar pareceres sobre regras.
       4. Sugerir soluções diplomáticas para conflitos entre vizinhos.` 
      : 
      `1. Auxiliar no controle de acesso, encomendas e ocorrências do dia a dia.
       2. Ser direto, breve e focado na segurança.
       3. Registrar eventos com rapidez.`}

      ESTILIZAÇÃO DE RESPOSTAS (Markdown):
      - Use **Negrito** para dados críticos.
      - Para documentos (Circulares/Multas), use blocos de citação (>) ou code blocks para facilitar a cópia.
    `;
    
    if (context) {
      systemInstruction += `
        ÚLTIMOS REGISTROS DO SISTEMA (Logs/Ocorrências):
        ${JSON.stringify(context.recentLogs || [])}
      `;

      // Append specific role instructions
      systemInstruction += `\n\n[INSTRUÇÕES PERSONALIZADAS]:
      ${specificInstructions}
      `;

      if (context?.profile?.knowledgeBase) {
          systemInstruction += `\n\n[BASE DE CONHECIMENTO]: O usuário carregou o REGIMENTO INTERNO ou CONVENÇÃO. Cite artigos ou cláusulas se possível ao tirar dúvidas.`;
      }
    }

    if (onLogEvent) {
        systemInstruction += `\nSE o usuário confirmar a criação de um registro, multa ou circular, chame a função 'logEvent'.`;
    }

    let config: any = { 
        systemInstruction: systemInstruction 
    };

    let model = "gemini-2.5-flash"; 
    
    // Managers often need more complex reasoning for drafting docs
    if (isManager || options?.useThinking) {
      model = "gemini-3-pro-preview"; 
      config.thinkingConfig = { thinkingBudget: 32768 };
    }

    if (onLogEvent) {
        if (!config.tools) config.tools = [];
        config.tools.push({ functionDeclarations: [logEventTool] });
    }

    // --- HISTORY FORMATTING FOR CONTEXT AWARENESS ---
    const formattedHistory = messages.map(m => {
        let textContent = m.text;
        
        // Tagging content for the model to distinguish speakers
        if (m.isExternal) {
            textContent = `[Mensagem Externa de ${m.senderName || 'Morador'}]: ${m.text}`;
        } else if (m.role === 'user') {
            textContent = `[Usuário Local - ${context?.profile?.role || 'Operador'}]: ${m.text}`;
        }
        
        return {
            role: m.role,
            parts: [{ text: textContent }]
        };
    });

    let messageContent: any = [{ text: `[Usuário Local]: ${newMessage}` }];

    if (context?.profile?.knowledgeBase) {
        messageContent = [
            { text: "**[CONTEXTO DO ARQUIVO ANEXADO - REGIMENTO/CONVENÇÃO]**" },
            { 
                inlineData: { 
                    mimeType: context.profile.knowledgeBase.mimeType, 
                    data: context.profile.knowledgeBase.data 
                } 
            },
            { text: "\n\n**MENSAGEM DO USUÁRIO:**\n" + newMessage }
        ];
    }

    return callWithRetry(async () => {
        const chat = ai.chats.create({ model, history: formattedHistory, config });
        let result = await chat.sendMessage({ message: messageContent });
        
        const toolCalls = result.candidates?.[0]?.content?.parts?.filter((p: any) => p.functionCall);
        
        if (toolCalls && toolCalls.length > 0) {
            const functionResponseParts: any[] = [];
            for (const part of toolCalls) {
                const fc = part.functionCall;
                if (fc.name === 'logEvent' && onLogEvent) {
                    const args = fc.args as any;
                    
                    const newItem: OccurrenceItem = {
                        id: Date.now().toString(),
                        type: args.type,
                        title: args.title,
                        description: args.description,
                        involvedParties: args.involvedParties,
                        timestamp: Date.now(),
                        status: "Logged"
                    };

                    onLogEvent(newItem);

                    functionResponseParts.push({
                        functionResponse: {
                            id: fc.id, name: fc.name,
                            response: { result: `Evento do tipo ${args.type} registrado com sucesso: ${args.title}` }
                        }
                    });
                }
            }
            if (functionResponseParts.length > 0) {
                result = await chat.sendMessage({ message: functionResponseParts });
            }
        }
        
        return result.text;
    });
}

// --- NUTRITION APP FUNCTIONS ---

export const searchFoodAI = async (query: string): Promise<MealItem[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Search food items matching query: "${query}". Return list of 3-5 items with calories and macros.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        calories: { type: Type.INTEGER },
                        macros: {
                            type: Type.OBJECT,
                            properties: {
                                protein: { type: Type.INTEGER },
                                carbs: { type: Type.INTEGER },
                                fats: { type: Type.INTEGER }
                            }
                        },
                        emoji: { type: Type.STRING }
                    }
                }
            }
        }
    });
    return JSON.parse(response.text || "[]");
};

export const generateImageBackground = async (prompt: string): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "9:16",
                    imageSize: "1K"
                }
            }
        });
        
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (e) {
        console.error("Image generation failed", e);
        return null;
    }
};

export const analyzeFoodImage = async (base64Data: string): Promise<MealItem | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
            parts: [
                { inlineData: { mimeType: "image/jpeg", data: base64Data } },
                { text: "Identify the main food item in this image. Estimate calories and macros." }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    calories: { type: Type.INTEGER },
                    macros: {
                        type: Type.OBJECT,
                        properties: {
                            protein: { type: Type.INTEGER },
                            carbs: { type: Type.INTEGER },
                            fats: { type: Type.INTEGER }
                        }
                    },
                    description: { type: Type.STRING }
                }
            }
        }
    });
    return JSON.parse(response.text || "null");
};

export const generateRecipeAI = async (ingredients: string[], pantryItems: string[] = []): Promise<Recipe | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Create a healthy recipe using these ingredients: ${ingredients.join(', ')}. 
    Available pantry items to use if needed: ${pantryItems.join(', ')}.
    Return a structured recipe.`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
                    steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    calories: { type: Type.INTEGER },
                    time: { type: Type.STRING },
                    image: { type: Type.STRING, description: "A placeholder image URL from Unsplash matching the recipe" }
                }
            }
        }
    });
    const recipe = JSON.parse(response.text || "null");
    if (recipe) {
        // Fallback image since model can't browse real unsplash
        recipe.image = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"; 
    }
    return recipe;
};

export const generateArticleContentAI = async (title: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Write a short, engaging educational article (approx 400 words) with the title: "${title}". Use markdown formatting.`
    });
    return response.text || "";
};

export const chatWithPersonalTrainer = async (
  history: {role: string, parts: {text: string}[]}[],
  message: string,
  userProfile?: UserProfile | null,
  dailyLog?: LogItem[],
  attachment?: {data: string, mimeType: string}
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let systemInstruction = `
      You are Coach Bruno, an elite personal nutritionist and trainer AI.
      User: ${userProfile?.name}, Goal: ${userProfile?.goal}.
      Tone: Motivational, tough love, slang (pt-BR), direct.
      
      Recent Log: ${JSON.stringify(dailyLog?.slice(-5) || [])}
    `;

    const messageParts: any[] = [{ text: message }];
    if (attachment) {
        messageParts.push({
            inlineData: { mimeType: attachment.mimeType, data: attachment.data }
        });
    }

    const chat = ai.chats.create({
        model: "gemini-2.5-flash",
        history: history,
        config: { systemInstruction }
    });

    const result = await chat.sendMessage({ message: messageParts });
    return result.text;
};
