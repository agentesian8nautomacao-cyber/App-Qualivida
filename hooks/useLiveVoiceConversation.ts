import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Blob,
  Type,
  FunctionDeclaration,
} from "@google/genai";

/** Estado explícito do canal de voz (WebSocket interno do Gemini Live). Evita send() em CLOSING/CLOSED. */
export type SessionState = "idle" | "connecting" | "open" | "closing" | "closed";

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
 * Hook para conversa de voz em tempo real com Gemini (Gemini Live / WebSocket interno).
 *
 * - Captura microfone via AudioWorklet (live-voice-processor.js), envia áudio PCM16, reproduz resposta neural.
 * - (Opcional) trata a ferramenta logMeal.
 *
 * CAUSA RAIZ do erro "WebSocket is already in CLOSING or CLOSED state":
 * O effect que inicia a sessão tem deps [voiceName, systemInstruction, ...]. Ao trocar gênero ou
 * re-render com nova ref, o effect re-executa → cleanup() fecha o socket → o worklet/onmessage
 * da sessão antiga (closure) ainda pode disparar e chamar send() no socket já fechando/fechado.
 *
 * FLUXO CORRETO (como este hook evita o problema):
 * 1. cleanup() marca sessionStateRef = "closing" e isSessionOpenRef = false ANTES de session.close().
 * 2. Todos os envios (sendRealtimeInput, sendToolResponse) usam sessionPromiseRef.current (nunca
 *    a promise da closure) e só enviam quando sessionStateRef.current === "open".
 * 3. Ao trocar gênero, o effect re-roda: cleanup → initSession; apenas uma sessão ativa por vez.
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
  const scriptProcessorRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<ReturnType<GoogleGenAI["live"]["connect"]> | null>(null);
  const isSessionOpenRef = useRef(false);
  /** Controle explícito: só enviar dados quando === "open". Evita "WebSocket is already in CLOSING or CLOSED state". */
  const sessionStateRef = useRef<SessionState>("idle");
  const isMicOnRef = useRef(isMicOn);
  const onLogMealRef = useRef(onLogMeal);
  isMicOnRef.current = isMicOn;
  onLogMealRef.current = onLogMeal;

  // --- Tool logMeal opcional (estável por enableLogMealTool para não re-executar o effect a cada render) ---
  const logMealTool = useMemo<FunctionDeclaration | null>(
    () =>
      enableLogMealTool
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
        : null,
    [enableLogMealTool]
  );

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
  // CAUSA RAIZ (documentada): O efeito que chama initSession() tem deps [voiceName, systemInstruction, ...].
  // Ao trocar gênero ou re-render com nova ref, o effect re-roda → cleanup() é chamado → socket fechado.
  // O worklet/onmessage da sessão ANTIGA ainda pode disparar e chamar send() no socket já CLOSING/CLOSED.
  // Correção: (1) Marcar sessão como fechada ANTES de chamar session.close(); (2) Usar sessionPromiseRef
  // em todos os envios (nunca a promise da closure) e checar sessionStateRef === "open" antes de send().
  const cleanup = useCallback(() => {
    sessionStateRef.current = "closing";
    isSessionOpenRef.current = false;
    // A partir daqui nenhum sendRealtimeInput/sendToolResponse deve ser feito (worklet e onmessage checam o ref).

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
    sessionStateRef.current = "closed";
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
      scriptProcessorRef.current.port.onmessage = null;
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
      const apiKeyTrim = (apiKey || '').trim();
      if (!apiKeyTrim) {
        setStatus("Chave não configurada (VITE_GEMINI_LIVE_KEY)");
        console.warn('[LiveVoice] TTS neural: chave ausente. Configure VITE_GEMINI_LIVE_KEY no .env.local e no Vercel. Nenhum fallback para voz do navegador.');
        return;
      }

      sessionStateRef.current = "connecting";
      try {
        setStatus("Conectando...");
        const ai = new GoogleGenAI({ apiKey: apiKeyTrim });

        // Log de prova: engine, modelo, voz e idioma (voz mais humana)
        console.info('[LiveVoice/TTS] Engine=GeminiLive', {
          engine: 'Gemini Live (native audio)',
          model,
          voiceName,
          languageCode: 'pt-BR',
          enableAffectiveDialog: true,
          sampleRateIn: 16000,
          sampleRateOut: 24000,
          noBrowserTTS: true,
        });

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

        const tools: { functionDeclarations: FunctionDeclaration[] }[] = [];
        if (logMealTool) {
          tools.push({ functionDeclarations: [logMealTool] });
        }

        const sessionPromise = ai.live.connect({
          model,
          callbacks: {
            onopen: async () => {
              if (sessionStateRef.current !== "connecting") return;
              sessionStateRef.current = "open";
              setStatus("Conectado");
              setIsConnected(true);
              isSessionOpenRef.current = true;

              if (!inputAudioContextRef.current || !streamRef.current) return;

              const ctx = inputAudioContextRef.current;
              try {
                // AudioContext pode iniciar suspended (política do navegador); addModule falha com AbortError se não estiver running.
                if (ctx.state === "suspended") {
                  await ctx.resume();
                }
                // URL do worklet na mesma origem da página (evita AbortError "Unable to load a worklet's module").
                const workletUrl = new URL("/live-voice-processor.js", window.location.href).href;
                await ctx.audioWorklet.addModule(workletUrl);
              } catch (err) {
                console.error(
                  "[LiveVoice] Falha ao carregar AudioWorklet; a captura de áudio pode não funcionar.",
                  err
                );
                setStatus("Erro ao iniciar captura de áudio");
                return;
              }

              const source =
                inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
              const worklet = new AudioWorkletNode(
                inputAudioContextRef.current,
                "live-voice-processor"
              );

              sourceRef.current = source;
              scriptProcessorRef.current = worklet;

              // Recebe frames Float32Array do worklet. Usar sessionPromiseRef (nunca closure) para evitar
              // enviar para a sessão antiga quando o effect re-roda (ex.: troca de gênero).
              worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
                const inputData = event.data;
                if (!inputData || !isMicOnRef.current || sessionStateRef.current !== "open") {
                  return;
                }

                // Volume para visualização
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                  sum += inputData[i] * inputData[i];
                }
                setVolume(Math.sqrt(sum / inputData.length) * 100);

                const pcmBlob = createBlob(inputData);
                const currentPromise = sessionPromiseRef.current;
                if (!currentPromise) return;

                currentPromise
                  .then((session) => {
                    if (sessionStateRef.current !== "open") return;
                    try {
                      session.sendRealtimeInput({ media: pcmBlob });
                    } catch (err) {
                      console.warn(
                        "[LiveVoice] sendRealtimeInput falhou (provável WebSocket fechado). Bloqueando envios futuros.",
                        err
                      );
                      sessionStateRef.current = "closed";
                      isSessionOpenRef.current = false;
                    }
                  })
                  .catch(() => {
                    sessionStateRef.current = "closed";
                    isSessionOpenRef.current = false;
                  });
              };

              source.connect(worklet);
              // Opcional: conecta ao destino apenas para evitar warnings de nós desconectados
              worklet.connect(inputAudioContextRef.current.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
              // Tools: logMeal (usa ref para não depender de onLogMeal no effect)
              const onLogMealCb = onLogMealRef.current;
              if (msg.toolCall && logMealTool && onLogMealCb) {
                const responses: any[] = [];
                for (const fc of msg.toolCall.functionCalls ?? []) {
                  if (fc.name === "logMeal") {
                    const args = fc.args as any as LogMealArgs;
                    onLogMealCb(args);
                    setLoggedItem(`${args.foodName} (${args.calories} kcal)`);
                    setTimeout(() => setLoggedItem(null), 3000);
                    responses.push({
                      id: fc.id,
                      name: fc.name,
                      response: { result: "Success: Meal logged." },
                    });
                  }
                }
                if (responses.length > 0 && sessionStateRef.current === "open") {
                  const currentPromise = sessionPromiseRef.current;
                  if (currentPromise) {
                    currentPromise.then((session) => {
                      if (sessionStateRef.current !== "open") return;
                      try {
                        session.sendToolResponse({ functionResponses: responses });
                      } catch (err) {
                        console.warn("[LiveVoice] sendToolResponse falhou (WebSocket fechado).", err);
                        sessionStateRef.current = "closed";
                        isSessionOpenRef.current = false;
                      }
                    }).catch(() => {
                      sessionStateRef.current = "closed";
                      isSessionOpenRef.current = false;
                    });
                  }
                }
              }

              // Áudio de saída — somente via Gemini Live (nenhum fallback para Web Speech)
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
                // Prova: TTS é 100% neural (Gemini Live). Nenhum fallback para voz do navegador.
                if ((import.meta as any)?.env?.DEV) {
                  console.info('[LiveVoice/TTS] Playback=neural', { duration: buffer.duration });
                }
              }

              // Interrupções
              if (msg.serverContent?.interrupted) {
                activeSourcesRef.current.forEach((s) => s.stop());
                activeSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onclose: () => {
              sessionStateRef.current = "closed";
              setStatus("Desconectado");
              setIsConnected(false);
              isSessionOpenRef.current = false;
            },
            onerror: (err) => {
              console.error(err);
              sessionStateRef.current = "closed";
              setStatus("Erro na conexão");
              isSessionOpenRef.current = false;
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            tools: logMealTool ? tools : undefined,
            // Idioma e voz para saída mais natural (pt-BR + prebuilt HD)
            speechConfig: {
              languageCode: "pt-BR",
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
            // Adapta entonação ao contexto (mais humana)
            enableAffectiveDialog: true,
            // Leve variação para soar menos mecânico
            temperature: 0.85,
            systemInstruction: fullSystemInstruction,
          },
        });

        sessionPromiseRef.current = sessionPromise;
      } catch (err) {
        console.error("Failed to connect", err);
        sessionStateRef.current = "closed";
        setStatus("Erro ao acessar microfone ou API");
      }
    };

    initSession();

    // Cleanup ao desmontar ou quando deps mudam (ex.: troca de gênero). Marcar estado como closing
    // antes de fechar garante que nenhum send() use o socket já em fechamento.
    return () => {
      cleanup();
    };
    // voiceName/systemInstruction nas deps: ao trocar gênero/estilo, recriamos o canal TTS (uma sessão ativa).
    // O novo canal só recebe envios após onopen (sessionStateRef === "open").
  }, [
    started,
    apiKey,
    model,
    voiceName,
    systemInstruction,
    contextData,
    logMealTool,
    cleanup,
    isLimitReached,
    enableLogMealTool,
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

