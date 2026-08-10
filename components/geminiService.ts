
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { UserProfile, DailyPlan, MealItem, LogItem, Recipe } from "../types";

// Helper to retry functions on failure (e.g. Network Error)
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

// Tool Definition for Logging Meals in Chat
const logMealTool: FunctionDeclaration = {
  name: "logMeal",
  description: "Registra uma refeição consumida pelo usuário no diário alimentar. Use esta ferramenta AUTOMATICAMENTE quando o usuário afirmar que comeu, bebeu ou consumiu algo, extraindo as informações.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      foodName: { type: Type.STRING, description: "Nome do alimento consumido" },
      calories: { type: Type.NUMBER, description: "Calorias estimadas (se não informado, estimar)" },
      protein: { type: Type.NUMBER, description: "Proteínas estimadas em gramas (estimar se necessário)" },
      carbs: { type: Type.NUMBER, description: "Carboidratos estimados em gramas (estimar se necessário)" },
      fats: { type: Type.NUMBER, description: "Gorduras estimadas em gramas (estimar se necessário)" },
      mealType: { 
          type: Type.STRING, 
          enum: ["Breakfast", "Lunch", "Dinner", "Snack"],
          description: "Tipo da refeição (Café, Almoço, Jantar, Lanche). Inferir pelo horário ou contexto."
      },
      description: { type: Type.STRING, description: "Uma descrição atraente em português citando os benefícios nutricionais." },
      emoji: { type: Type.STRING, description: "Um único emoji que represente este alimento (ex: 🍎, 🥩, 🥗)." }
    },
    required: ["foodName", "calories", "protein", "carbs", "fats", "mealType", "description", "emoji"]
  }
};

export const generateDietPlan = async (
    profile: UserProfile, 
    customInstructions?: string, 
    attachment?: { data: string, mimeType: string },
    usePantry: boolean = true
): Promise<DailyPlan> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const schema = {
    type: Type.OBJECT,
    properties: {
      totalCalories: { type: Type.NUMBER },
      targetMacros: {
        type: Type.OBJECT,
        properties: {
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
        },
        required: ["protein", "carbs", "fats"],
      },
      nutritionalAnalysis: { type: Type.STRING, description: "Análise estratégica do nutricionista explicando o cálculo e o foco." },
      meals: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["Breakfast", "Lunch", "Dinner", "Snack"] },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  calories: { type: Type.NUMBER },
                  description: { type: Type.STRING },
                  substitutions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  emoji: { type: Type.STRING, description: "Um emoji representando o alimento" },
                  macros: {
                    type: Type.OBJECT,
                    properties: {
                      protein: { type: Type.NUMBER },
                      carbs: { type: Type.NUMBER },
                      fats: { type: Type.NUMBER },
                    },
                    required: ["protein", "carbs", "fats"],
                  }
                },
                required: ["name", "calories", "macros", "description", "substitutions", "emoji"]
              }
            }
          },
          required: ["type", "items"]
        }
      },
      behavioralTips: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Dicas de organização, fome, eventos sociais." },
      shoppingList: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de compras essencial." },
      hydrationTarget: { type: Type.NUMBER },
      notes: { type: Type.STRING }
    },
    required: ["totalCalories", "targetMacros", "meals", "notes", "nutritionalAnalysis", "behavioralTips", "shoppingList", "hydrationTarget"]
  };

  const pantryList = usePantry && profile.pantryItems && profile.pantryItems.length > 0 
      ? profile.pantryItems.map(i => i.name).join(', ') 
      : "None (User opted not to use pantry or has no items)";

  // Different Prompt Strategy if an attachment exists
  let systemInstruction = "";
  
  if (attachment) {
      systemInstruction = `
        You are Nutri.ai, a Data Extraction Specialist for Nutrition.
        
        TASK:
        The user has uploaded an EXISTING Diet Plan (PDF or Image).
        Your goal is NOT to create a new plan, but to DIGITIZE and STRUCTURE the plan from the file into the JSON format.
        
        RULES:
        1. Read the attached file carefully. Extract meals, portions, and food items.
        2. Map them to 'Breakfast', 'Lunch', 'Dinner', 'Snack'.
        3. If the file has calories/macros, use them. If not, ESTIMATE them scientifically based on the food description.
        4. If the user provided extra text instructions ("${customInstructions || ''}"), apply those as modifications to the file's plan.
        5. 'nutritionalAnalysis': Explain that this is the digitized version of their uploaded plan.
        6. Language: Portuguese (Brazil).
        7. Always provide an EMOJI for each food item.
      `;
  } else {
      systemInstruction = `
        You are Nutri.ai, a World-Class Nutritionist.
        MISSION: Nutri.ai é um app de nutrição que gera planos alimentares personalizados.
        
        PROFILE DATA:
        - Bio: ${profile.age} years, ${profile.gender}, ${profile.height}cm, ${profile.weight}kg.
        - Activity: ${profile.activityLevel}.
        - Main Goal: ${profile.goal}.
        - Medical History: ${profile.medicalHistory || 'None stated'}.
        - Routine & Lifestyle: ${profile.routineDescription || 'Standard'}.
        - Preferences: ${profile.foodPreferences || 'None stated'}.
        - Restrictions: ${profile.restrictions || 'None'}.
        - Meal Freq: ${profile.mealsPerDay} meals/day.
        
        AVAILABLE INGREDIENTS (PANTRY):
        - The user has these items at home: ${pantryList}.
        
        ${usePantry ? '- CRITICAL RULE: You MUST prioritize using these pantry ingredients in the meals to reduce waste and cost.' : '- NOTE: Ignore pantry items for this generation.'}
        
        USER CUSTOM REQUESTS (Highest Priority):
        "${customInstructions || "No specific custom instructions. Follow standard medical guidelines for the profile."}"

        OUTPUT RULES:
        - Language: Portuguese (Brazil).
        - Tone: Professional, encouraging, and personalized.
        - 'nutritionalAnalysis': Explain WHY you chose these calories/macros. Mention specifically how you used their pantry items or addressed their custom request.
        - 'substitutions': For every food item, provide 1-2 simple alternatives.
        - 'emoji': Assign a relevant emoji to each meal item.
      `;
  }

  const parts: any[] = [{ text: systemInstruction }];
  
  if (attachment) {
      parts.unshift({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
  }

  // Use gemini-3-pro-preview for the main diet plan generation as it is a complex reasoning task.
  // We use responseSchema to ensure the output is parseable JSON.
  return callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: { parts: parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: attachment ? 0.2 : 0.7, 
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      return JSON.parse(text) as DailyPlan;
  });
};

export const analyzeFoodImage = async (base64Image: string): Promise<MealItem | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      calories: { type: Type.NUMBER },
      macros: {
        type: Type.OBJECT,
        properties: {
          protein: { type: Type.NUMBER },
          carbs: { type: Type.NUMBER },
          fats: { type: Type.NUMBER },
        },
        required: ["protein", "carbs", "fats"],
      },
      description: { type: Type.STRING },
      emoji: { type: Type.STRING }
    },
    required: ["name", "calories", "macros", "description", "emoji"]
  };

  const prompt = "Analyze this food image. Identify the food, estimate portion size, total calories, and macros. Return the description in Portuguese and a relevant emoji.";

  return callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", 
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Image } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });
      
      const text = response.text;
      if (!text) return null;
      return JSON.parse(text) as MealItem;
  });
};

export const searchFoodAI = async (query: string): Promise<MealItem[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                calories: { type: Type.NUMBER },
                macros: {
                    type: Type.OBJECT,
                    properties: {
                        protein: { type: Type.NUMBER },
                        carbs: { type: Type.NUMBER },
                        fats: { type: Type.NUMBER },
                    },
                    required: ["protein", "carbs", "fats"],
                },
                description: { type: Type.STRING },
                emoji: { type: Type.STRING }
            },
            required: ["name", "calories", "macros", "description", "emoji"]
        }
    };

    const prompt = `Search and generate nutritional data for 3-5 food items matching the query: "${query}". Return in Portuguese with emojis.`;

    return callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        return JSON.parse(response.text || "[]");
    }, 2).catch(e => {
        console.error("Search error", e);
        return [];
    });
};

export const generateRecipeAI = async (ingredients: string[], pantryItems?: string[]): Promise<Recipe> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            time: { type: Type.STRING },
            calories: { type: Type.NUMBER },
            description: { type: Type.STRING },
            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            emoji: { type: Type.STRING }
        },
        required: ["title", "time", "calories", "description", "steps", "emoji"]
    };

    let prompt = `Create a healthy recipe using these specific ingredients: ${ingredients.join(', ')}.`;
    
    if (pantryItems && pantryItems.length > 0) {
        prompt += ` You can also use ingredients from the user's pantry if they pair well: ${pantryItems.join(', ')}.`;
    }

    prompt += ` Return in Portuguese with a main emoji representing the dish.`;

    return callWithRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json", responseSchema: schema }
        });
        const recipe = JSON.parse(response.text || "{}");
        return recipe;
    });
};

export const generateArticleContentAI = async (title: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Write a short, engaging, and educational article about "${title}" for a nutrition app. Use Markdown. In Portuguese.`;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] }
        });
        return response.text || "Conteúdo indisponível.";
    } catch (e) {
        return "Erro ao carregar artigo.";
    }
};

/** Transcrição de áudio avulsa (ex.: upload de arquivo). Áudio ao vivo bidirecional fica em LiveConversation.tsx. */
export const transcribeAudio = async (audioBase64: string, mimeType: string = "audio/webm"): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: audioBase64 } },
          { text: "Transcreva este áudio exatamente como falado, em português." }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Audio transcription error", error);
    return "";
  }
};

export const generateImageBackground = async (prompt: string): Promise<string | null> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: `Create a high quality, artistic background texture or pattern. Style: ${prompt}. Aspect ratio 9:16 vertical.` }]
            },
             config: {
                imageConfig: {
                    aspectRatio: "9:16",
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
        return null;
    } catch (e) {
        console.error("Image gen error", e);
        return null;
    }
};

export const chatWithNutritionist = async (
  history: {role: string, parts: {text: string}[]}[], 
  message: string,
  context?: {
    profile?: UserProfile | null,
    plan?: DailyPlan | null,
    log?: LogItem[]
  },
  options?: {
    useThinking?: boolean,
    useSearch?: boolean
  },
  onLogMeal?: (data: MealItem, type: string) => void
) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    let systemInstruction = `
      Você é a Nutri.ai, um assistente pessoal de nutrição de classe mundial.
      SUA MISSÃO: Gerar planos alimentares personalizados e orientar o usuário em sua jornada de saúde.
      Sua personalidade: Encorajadora, experiente, prática e amigável.
      Idioma: Sempre responda em Português do Brasil.
      Use Markdown para deixar a resposta bonita.
    `;
    
    if (context) {
      const sanitize = (key: string, value: any) => {
          if (key === 'image') return undefined;
          return value;
      };

      systemInstruction += `
        CONTEXTO DO USUÁRIO:
        - Perfil: ${JSON.stringify(context.profile)}
        - Plano Alimentar do Dia: ${JSON.stringify(context.plan, sanitize)}
        - Registro de Hoje: ${JSON.stringify(context.log, sanitize)}
        - Itens na Despensa: ${context.profile?.pantryItems?.map(i => i.name).join(', ') || 'Nenhum'}
      `;

      if (context.profile?.customChatInstructions) {
          systemInstruction += `\n\nINSTRUÇÕES PERSONALIZADAS DO USUÁRIO (Obrigatório seguir):
          ${context.profile.customChatInstructions}
          `;
      }

      if (context?.profile?.knowledgeBase) {
          systemInstruction += `\n\n[AVISO]: O usuário carregou um arquivo como BASE DE CONHECIMENTO. As informações do arquivo estão anexadas à mensagem atual. Use-as como fonte principal se relevante.`;
      }
    }

    if (onLogMeal) {
        systemInstruction += `
        \nSE o usuário mencionar que comeu algo, chame a função 'logMeal'.
        `;
    }

    let model = "gemini-2.5-flash"; 
    
    let config: any = { 
        systemInstruction: systemInstruction 
    };

    if (options?.useThinking) {
      model = "gemini-3-pro-preview";
      config.thinkingConfig = { thinkingBudget: 32768 }; 
    } else if (options?.useSearch) {
      model = "gemini-2.5-flash";
      config.tools = [{ googleSearch: {} }];
    }

    if (onLogMeal) {
        if (!config.tools) config.tools = [];
        config.tools.push({ functionDeclarations: [logMealTool] });
    }

    let messageContent: any = [{ text: message }];

    if (context?.profile?.knowledgeBase) {
        messageContent = [
            { text: "**[CONTEXTO DO ARQUIVO ANEXADO - BASE DE CONHECIMENTO]**" },
            { 
                inlineData: { 
                    mimeType: context.profile.knowledgeBase.mimeType, 
                    data: context.profile.knowledgeBase.data 
                } 
            },
            { text: "\n\n**MENSAGEM DO USUÁRIO:**\n" + message }
        ];
    }

    return callWithRetry(async () => {
        const chat = ai.chats.create({ model, history, config });
        let result = await chat.sendMessage({ message: messageContent });
        
        const toolCalls = result.candidates?.[0]?.content?.parts?.filter((p: any) => p.functionCall);
        
        if (toolCalls && toolCalls.length > 0) {
            const functionResponseParts: any[] = [];
            for (const part of toolCalls) {
                const fc = part.functionCall;
                if (fc.name === 'logMeal' && onLogMeal) {
                    const args = fc.args as any;
                    onLogMeal({
                        name: args.foodName,
                        calories: args.calories,
                        macros: { protein: args.protein, carbs: args.carbs, fats: args.fats },
                        description: args.description || `Uma porção nutritiva de ${args.foodName}.`,
                        emoji: args.emoji || "🍽️"
                    }, args.mealType);

                    functionResponseParts.push({
                        functionResponse: {
                            id: fc.id, name: fc.name,
                            response: { result: `Successfully logged ${args.foodName}.` }
                        }
                    });
                }
            }
            if (functionResponseParts.length > 0) {
                result = await chat.sendMessage({ message: functionResponseParts });
            }
        }
        
        if (options?.useSearch && result.candidates?.[0]?.groundingMetadata?.groundingChunks) {
             const chunks = result.candidates[0].groundingMetadata.groundingChunks;
             let searchSources = "\n\n## Fontes:\n";
             chunks.forEach((chunk: any) => {
               if (chunk.web?.uri) {
                 searchSources += `- [${chunk.web.title}](${chunk.web.uri})\n`;
               }
             });
             return result.text + searchSources;
        }

        return result.text;
    });
}

// HUMAN COACH PERSONA
export const chatWithPersonalTrainer = async (
    history: {role: string, parts: {text: string}[]}[], 
    message: string,
    profile?: UserProfile | null,
    dailyLog?: LogItem[] | null,
    attachment?: { data: string, mimeType: string }
) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Sanitize log for token limit
    const sanitize = (key: string, value: any) => {
        if (key === 'image') return undefined; // Remove large images from history context
        return value;
    };

    const todayLogSummary = dailyLog ? JSON.stringify(dailyLog, sanitize) : "Nenhum registro hoje.";

    let systemInstruction = `
      Você é o **Coach Bruno**, um Nutricionista Humano e Treinador Comportamental que atende pelo app Nutri.ai.
      
      **SUA PERSONA:**
      - Você NÃO é um robô. Aja como um humano real conversando no WhatsApp/Chat.
      - Você é focado em **ACCOUNTABILITY** (Prestação de Contas).
      - Seu tom é: Profissional, Direto, Motivador, mas cobra disciplina.
      - Use gírias leves do mundo fitness (ex: "foco", "bater os macros", "sem errar", "tá pago").
      - Use emojis, mas não exagere.
      
      **DADOS DO ALUNO:**
      ${profile ? `- Nome: ${profile.name}
      - Objetivo: ${profile.goal}
      - Restrições: ${profile.restrictions || 'Nenhuma'}
      ` : 'Perfil não informado.'}

      **DIÁRIO ALIMENTAR DE HOJE (O que ele comeu até agora):**
      ${todayLogSummary}

      **MISSÃO DA SEMANA:**
      Zero Álcool e 3L de Água por dia.

      **SUAS TAREFAS:**
      1. Se o aluno mandar "Enviei meu diário", ANALISE os dados acima. Se ele comeu besteira, COBRE. Se comeu bem, ELOGIE. Dê uma nota de 0 a 10 para o dia.
      2. Se o aluno mandar uma foto de prato, analise se parece saudável e dê um veredito (Aprovado/Reprovado).
      3. Se o aluno reclamar de fome/preguiça, dê uma bronca motivacional.
      4. Mantenha as respostas curtas, como num chat real.

      Idioma: Português do Brasil.
    `;

    const config = {
        systemInstruction: systemInstruction,
        temperature: 0.8, // Slightly higher for human-like variance
    };

    // Handle Image Attachment in Message
    const messageParts: any[] = [{ text: message }];
    if (attachment) {
        messageParts.unshift({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
        // Update instructions for image analysis
        messageParts.push({ text: "\n[SISTEMA: O usuário enviou uma imagem (foto do prato ou do corpo). Analise como um Coach Nutricional. Se for comida, diga se aprova ou não.]" });
    }

    return callWithRetry(async () => {
        const chat = ai.chats.create({ 
            model: "gemini-2.5-flash", 
            history, 
            config 
        });
        const result = await chat.sendMessage({ message: messageParts });
        return result.text;
    });
};
