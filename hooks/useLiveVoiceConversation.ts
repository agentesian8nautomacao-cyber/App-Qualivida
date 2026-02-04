import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Blob,
  Type,
  FunctionDeclaration,
} from "@google/genai";

type LogMealArgs = {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  description?: string;
};

interface UseLiveVoiceConversationOptions {
  apiKey: string;
  /** Modelo de áudio – padrão recomendado para voz neural Gemini */
  model?: string;
  /** Nome da voz pré-treinada (ex: "Kore") */
  voiceName?: string;
  /** Prompt de sistema (persona + idioma + instruções) */
  systemInstruction: string;
  /** Limite de tempo em segundos (padrão 15 min) */
  timeLimitSeconds?: number;
  /** Texto opcional de contexto (perfil, plano, diário, etc.) */
  contextData?: string;
  /** Se true, habilita a ferramenta logMeal (como no Nutri.ai) */
  enableLogMealTool?: boolean;
  /** Callback opcional quando o modelo chamar logMeal */
  onLogMeal?: (data: LogMealArgs) => void;
}

/**
 * Hook para conversa de voz em tempo real com Gemini.
 * - Captura microfone
 * - Envia áudio PCM16 para o modelo
 * - Reproduz áudio de resposta
 * - (Opcional) trata a ferramenta logMeal
 */
export function useLiveVoiceConversation(options: UseLiveVoiceConversationOptions) {
  const {
    apiKey,
    model = "gemini-2.5-flash-native-audio-preview-09-2025",
    voiceName = "Kore",
    systemInstruction,
    timeLimitSeconds = 15 * 60,
    contextData,
    enableLogMealTool = false,
    onLogMeal,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [volume, setVolume] = useState(0);
  const [status, setStatus] = useState("Aguardando conexão...");
  const [secondsActive, setSecondsActive] = useState(0);
  const [loggedItem, setLoggedItem] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  const isLimitReached = secondsActive >= timeLimitSeconds;

  // Audio + sessão refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<ReturnType<GoogleGenAI["live"]["connect"]> | null>(null);
  const isSessionOpenRef = useRef(false);

  // --- Tool logMeal opcional ---
  const logMealTool: FunctionDeclaration | null = enableLogMealTool
    ? {
        name: "logMeal",
        description:
          "Registra uma refeição consumida pelo usuário no diário alimentar. Use esta função quando o usuário disser que comeu algo.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            foodName: { type: Type.STRING, description: "Nome do alimento consumido" },
            calories: { type: Type.NUMBER, description: "Calorias estimadas" },
            protein: { type: Type.NUMBER, description: "Proteínas estimadas em gramas" },
            carbs: { type: Type.NUMBER, description: "Carboidratos estimados em gramas" },
            fats: { type: Type.NUMBER, description: "Gorduras estimadas em gramas" },
            mealType: {
              type: Type.STRING,
              enum: ["Breakfast", "Lunch", "Dinner", "Snack"],
              description:
                "Tipo da refeição (Café, Almoço, Jantar, Lanche). Inferir pelo horário ou contexto.",
            },
            description: {
              type: Type.STRING,
              description: "Uma descrição curta em português.",
            },
          },
          required: ["foodName", "calories", "protein", "carbs", "fats", "mealType"],
        },
      }
    : null;

  // --- Helper: Float32 -> PCM16 base64 Blob (igual ao Nutri.ai) ---
  const createBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, data[i] * 32768));
    }
    const uint8 = new Uint8Array(int16.buffer);
    let binary = "";
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);

    return {
      data: base64,
      mimeType: "audio/pcm;rate=16000",
    };
  };

  // --- Helper: base64 PCM16 -> AudioBuffer ---
  const decodeAudioData = async (base64: string, ctx: AudioContext): Promise<AudioBuffer> => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const dataInt16 = new Int16Array(bytes.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  // --- Timer do limite de tempo ---
  useEffect(() => {
    if (!started || !isConnected || isLimitReached) return;
    const id = setInterval(() => {
      setSecondsActive((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [started, isConnected, isLimitReached]);

  // --- Cleanup geral ---
  const cleanup = useCallback(() => {
    // encerra sessão live se ainda existir
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current
        .then((session: any) => {
          try {
            session.close?.();
          } catch {
            // ignore
          }
        })
        .catch(() => {
          // ignore
        });
      sessionPromiseRef.current = null;
    }
    isSessionOpenRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    activeSourcesRef.current.forEach((s) => s.stop());
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    setIsConnected(false);
    setStatus("Desconectado");
  }, []);

  // --- start / stop / toggle mic ---
  const start = useCallback(() => {
    setSecondsActive(0);
    setStarted(true);
  }, []);

  const stop = useCallback(() => {
    setStarted(false);
    cleanup();
  }, [cleanup]);

  const toggleMic = useCallback(() => {
    setIsMicOn((prev) => !prev);
  }, []);

  // --- Efetivamente inicia a sessão quando started=true ---
  useEffect(() => {
    if (!started) return;
    if (isLimitReached) {
      setStatus("Limite de tempo atingido");
      cleanup();
      return;
    }

    const initSession = async () => {
      try {
        setStatus("Conectando...");
        const ai = new GoogleGenAI({ apiKey });

        // Monta systemInstruction completo (contexto opcional)
        let fullSystemInstruction = systemInstruction;
        if (contextData) {
          fullSystemInstruction += `\n\n[CONTEXTO DO USUÁRIO]\n${contextData}`;
        }

        // AudioContexts
        const AnyAudioContext =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        inputAudioContextRef.current = new AnyAudioContext({ sampleRate: 16000 });
        outputAudioContextRef.current = new AnyAudioContext({ sampleRate: 24000 });

        // Microfone
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

        const tools = [];
        if (logMealTool) {
          tools.push({ functionDeclarations: [logMealTool] });
        }

        const sessionPromise = ai.live.connect({
          model,
          callbacks: {
            onopen: () => {
              setStatus("Conectado");
              setIsConnected(true);
              isSessionOpenRef.current = true;

              if (!inputAudioContextRef.current || !streamRef.current) return;

              const source =
                inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
              const processor =
                inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);

              sourceRef.current = source;
              scriptProcessorRef.current = processor;

              processor.onaudioprocess = (e) => {
                if (!isMicOn || !isSessionOpenRef.current) return;
                const inputData = e.inputBuffer.getChannelData(0);

                // Volume para visualização
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                setVolume(Math.sqrt(sum / inputData.length) * 100);

                const pcmBlob = createBlob(inputData);
                sessionPromise
                  .then((session) => {
                    try {
                      session.sendRealtimeInput({ media: pcmBlob });
                    } catch (err) {
                      console.warn('[LiveVoice] Falha ao enviar áudio, sessão pode estar fechada.', err);
                    }
                  })
                  .catch(() => {
                    // sessão já encerrada
                  });
              };

              source.connect(processor);
              processor.connect(inputAudioContextRef.current.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
              // Tools: logMeal
              if (msg.toolCall && logMealTool && onLogMeal) {
                const responses: any[] = [];
                for (const fc of msg.toolCall.functionCalls) {
                  if (fc.name === "logMeal") {
                    const args = fc.args as any as LogMealArgs;
                    onLogMeal(args);
                    setLoggedItem(`${args.foodName} (${args.calories} kcal)`);
                    setTimeout(() => setLoggedItem(null), 3000);
                    responses.push({
                      id: fc.id,
                      name: fc.name,
                      response: { result: "Success: Meal logged." },
                    });
                  }
                }
                if (responses.length > 0) {
                  sessionPromise.then((session) => {
                    session.sendToolResponse({ functionResponses: responses });
                  });
                }
              }

              // Áudio de saída
              const audioData =
                msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData && outputAudioContextRef.current) {
                const ctx = outputAudioContextRef.current;
                const buffer = await decodeAudioData(audioData, ctx);

                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);

                // Agendar sem cortes
                nextStartTimeRef.current = Math.max(
                  nextStartTimeRef.current,
                  ctx.currentTime
                );
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;

                activeSourcesRef.current.add(source);
                source.onended = () => activeSourcesRef.current.delete(source);
              }

              // Interrupções
              if (msg.serverContent?.interrupted) {
                activeSourcesRef.current.forEach((s) => s.stop());
                activeSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onclose: () => {
              setStatus("Desconectado");
              setIsConnected(false);
              isSessionOpenRef.current = false;
            },
            onerror: (err) => {
              console.error(err);
              setStatus("Erro na conexão");
              isSessionOpenRef.current = false;
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            tools: logMealTool ? tools : undefined,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
            systemInstruction: fullSystemInstruction,
          },
        });

        sessionPromiseRef.current = sessionPromise;
      } catch (err) {
        console.error("Failed to connect", err);
        setStatus("Erro ao acessar microfone ou API");
      }
    };

    initSession();

    return () => {
      cleanup();
    };
  }, [
    started,
    apiKey,
    model,
    voiceName,
    systemInstruction,
    contextData,
    logMealTool,
    isMicOn,
    cleanup,
    isLimitReached,
    enableLogMealTool,
    onLogMeal,
  ]);

  // Cleanup global quando o componente que usa o hook desmontar
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    // estado
    isConnected,
    isMicOn,
    volume,
    status,
    secondsActive,
    isLimitReached,
    loggedItem,
    // controles
    start,
    stop,
    toggleMic,
  };
}

