
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob, Type, FunctionDeclaration } from "@google/genai";
import { X, Mic, MicOff, PhoneOff, CheckCircle2, Lock, AudioLines, Building2, Bot } from 'lucide-react';
import { UserProfile, OccurrenceItem, UserRole } from '../types';
import { getGeminiApiKey } from '../../utils/geminiApiKey';

interface LiveConversationProps {
  onClose: () => void;
  userProfile?: UserProfile | null;
  onAddOccurrence?: (item: OccurrenceItem) => void;
}

const LiveConversation: React.FC<LiveConversationProps> = ({ onClose, userProfile, onAddOccurrence }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [status, setStatus] = useState("Sintonizando frequência...");
  const [loggedItem, setLoggedItem] = useState<string | null>(null);
  
  // Audio Visualization State
  const [userVolume, setUserVolume] = useState(0);
  const [aiVolume, setAiVolume] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState<'user' | 'ai' | 'none'>('none');

  // Refs for Audio Processing
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Timer State for 15 min limit
  const [secondsActive, setSecondsActive] = useState(0);
  const LIMIT_SECONDS = 15 * 60; // 15 Minutes
  const isLimitReached = secondsActive >= LIMIT_SECONDS;

  // Role Helpers
  const isManager = userProfile?.role === UserRole.Manager;
  const assistantName = isManager ? userProfile?.managerConfig.assistantName : userProfile?.doormanConfig.assistantName;
  const assistantAvatar = isManager ? userProfile?.managerConfig.assistantAvatar : userProfile?.doormanConfig.assistantAvatar;
  // Theme Colors
  const accentColor = isManager ? '#f59e0b' : '#10b981'; // Amber for Manager, Emerald for Doorman
  const glowColor = isManager ? 'rgba(245, 158, 11, 0.5)' : 'rgba(16, 185, 129, 0.5)';

  // Tool Definition — involvedParties OBRIGATÓRIO para Encomenda (para o morador ser notificado)
  const logEventTool: FunctionDeclaration = {
    name: "logEvent",
    description: "Registra uma ocorrência, visitante ou encomenda no sistema. Para ENCOMENDA, o morador só recebe notificação se involvedParties tiver a unidade ou nome do morador.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { 
            type: Type.STRING, 
            enum: ["Visitante", "Encomenda", "Serviço", "Ocorrência", "Aviso"],
            description: "Categoria do evento."
        },
        title: { type: Type.STRING, description: "Título curto (ex: tipo da encomenda)." },
        description: { type: Type.STRING, description: "Detalhes." },
        involvedParties: { type: Type.STRING, description: "OBRIGATÓRIO para Encomenda: unidade (ex: 102, Bloco A 201) ou nome do morador. Para outros tipos: unidade ou pessoa envolvida." }
      },
      required: ["type", "title", "description"]
    }
  };

  // Helper Functions
  const createBlob = (data: Float32Array): Blob => {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, data[i] * 32768));
    }
    const uint8 = new Uint8Array(int16.buffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return {
      data: btoa(binary),
      mimeType: 'audio/pcm;rate=16000',
    };
  };

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

  // Visualizer Loop
  const updateVisualizer = () => {
      let uVol = 0;
      let aVol = 0;

      // Analyze Input (User)
      if (inputAnalyserRef.current && isMicOn) {
          const dataArray = new Uint8Array(inputAnalyserRef.current.frequencyBinCount);
          inputAnalyserRef.current.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          uVol = sum / dataArray.length;
      }

      // Analyze Output (AI)
      if (outputAnalyserRef.current) {
          const dataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
          outputAnalyserRef.current.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          aVol = sum / dataArray.length;
      }

      // Normalize and Set State
      setUserVolume(Math.min(100, uVol)); 
      setAiVolume(Math.min(100, aVol));

      // Determine active speaker for UI states with hysteresis
      if (aVol > 5) setActiveSpeaker('ai');
      else if (uVol > 10) setActiveSpeaker('user');
      else setActiveSpeaker('none');

      animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  useEffect(() => {
    let interval: any;
    if (isConnected && !isLimitReached) {
        interval = setInterval(() => {
            setSecondsActive(prev => prev + 1);
        }, 1000);
        updateVisualizer();
    } else {
        if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
        clearInterval(interval);
        if(animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isConnected, isLimitReached, isMicOn]);

  useEffect(() => {
    if (isLimitReached) return;

    const initSession = async () => {
      try {
        const apiKey = getGeminiApiKey();
        const apiKeyTrim = (apiKey || '').trim();
        if (!apiKeyTrim) {
          console.warn('[Sentinela LiveConversation] Chave Gemini ausente. Configure VITE_GEMINI_API_KEY ou VITE_API_KEY.');
          setStatus("Chave da API não configurada");
          setIsConnected(false);
          return;
        }

        const ai = new GoogleGenAI({ apiKey: apiKeyTrim });

        const roleInstruction = isManager
            ? userProfile?.managerConfig.instructions 
            : userProfile?.doormanConfig.instructions;

        let systemInstruction = `
          Você é o ${assistantName || 'Assistente'}, a IA de voz oficial do condomínio.
          Suas instruções operacionais:
          ${roleInstruction || "Foque em segurança e brevidade."}
          
          REGRAS PARA REGISTRO VIA VOZ:
          1. Fale de forma clara, profissional e amigável.
          2. Para ENCOMENDA: pergunte sempre a unidade ou o nome do morador antes de registrar. Preencha SEMPRE o campo 'involvedParties' com a unidade (ex: 102, Bloco A 201) ou o nome do morador — assim o morador recebe a notificação no app.
          3. Para visitante, ocorrência ou aviso, use 'logEvent' com os dados informados; preencha 'involvedParties' quando houver unidade ou pessoa envolvida.
        `;

        // Context Construction
        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        // Input Setup (Mic -> Analyser -> ScriptProcessor)
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        inputAnalyserRef.current = inputAudioContextRef.current.createAnalyser();
        inputAnalyserRef.current.fftSize = 256;
        inputAnalyserRef.current.smoothingTimeConstant = 0.5;
        
        const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
        source.connect(inputAnalyserRef.current);
        
        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
        inputAnalyserRef.current.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContextRef.current.destination);

        // Output Setup (Analyser -> Destination)
        outputAnalyserRef.current = outputAudioContextRef.current.createAnalyser();
        outputAnalyserRef.current.fftSize = 256;
        outputAnalyserRef.current.smoothingTimeConstant = 0.5;
        outputAnalyserRef.current.connect(outputAudioContextRef.current.destination);

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              setStatus("Conectado");
              setIsConnected(true);
              
              scriptProcessor.onaudioprocess = (e) => {
                if (!isMicOn) return;
                const inputData = e.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };
            },
            onmessage: async (msg: LiveServerMessage) => {
              // Tool Handling
              if (msg.toolCall) {
                const responses = [];
                for (const fc of msg.toolCall.functionCalls) {
                    if (fc.name === 'logEvent' && onAddOccurrence) {
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
                        
                        onAddOccurrence(newItem);
                        setLoggedItem(`${args.type}: ${args.title}`);
                        setTimeout(() => setLoggedItem(null), 3000);

                        responses.push({
                            id: fc.id,
                            name: fc.name,
                            response: { result: "Success: Event logged." }
                        });
                    }
                }
                if (responses.length > 0) {
                    sessionPromise.then(session => {
                        session.sendToolResponse({ functionResponses: responses });
                    });
                }
              }

              // Audio Playback
              const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audioData && outputAudioContextRef.current && outputAnalyserRef.current) {
                const ctx = outputAudioContextRef.current;
                const buffer = await decodeAudioData(audioData, ctx);
                
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                // Connect source -> Output Analyser -> Destination
                source.connect(outputAnalyserRef.current);
                
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
              }

              if (msg.serverContent?.interrupted) {
                 nextStartTimeRef.current = 0;
              }
            },
            onclose: () => {
              setStatus("Desconectado");
              setIsConnected(false);
            },
            onerror: (err) => {
              console.error(err);
              setStatus("Erro na conexão");
            }
          },
          config: {
             responseModalities: [Modality.AUDIO],
             tools: [{ functionDeclarations: [logEventTool] }],
             speechConfig: {
               voiceConfig: { prebuiltVoiceConfig: { voiceName: userProfile?.aiVoice || 'Puck' } }
             },
             systemInstruction: systemInstruction
          }
        });

      } catch (err) {
        console.error("Failed to connect", err);
        setStatus("Erro ao acessar microfone ou API");
      }
    };

    initSession();

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (inputAudioContextRef.current) inputAudioContextRef.current.close();
      if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    };
  }, [userProfile, isLimitReached]);

  const toggleMic = () => {
    setIsMicOn(!isMicOn);
  };

  // --- RENDERING ---

  if (isLimitReached) {
      return (
        <div className="fixed inset-0 bg-[#09090b] z-[60] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 font-sans text-white lg:pl-24">
            <Lock size={64} className="text-white mb-6 opacity-80" />
            <h2 className="text-3xl font-serif mb-4">Sessão Finalizada</h2>
            <button onClick={onClose} className="bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform">
                Voltar ao Painel
            </button>
        </div>
      );
  }

  // --- PREMIUM "LIVING ORB" ANIMATION ---
  
  // Base scale is 1. When AI speaks, scale up to 1.5 based on volume
  const orbScale = activeSpeaker === 'ai' ? 1 + (aiVolume / 250) : 1;
  
  // Glow effect intensifies when User speaks (Listening Mode)
  const userGlowIntensity = activeSpeaker === 'user' ? 20 + (userVolume * 1.5) : 0;
  
  // Ripple Effect for AI Speaking
  // We use CSS keyframes for ripples, but scale them with volume.
  
  return (
    <div className="fixed inset-0 bg-[#000000] z-50 flex flex-col animate-in fade-in duration-700 font-sans overflow-hidden lg:pl-24">
       
       <style>{`
          @keyframes ripple {
             0% { transform: scale(1); opacity: 0.8; }
             100% { transform: scale(3); opacity: 0; }
          }
          .ripple-effect {
             animation: ripple 2s infinite cubic-bezier(0, 0.2, 0.8, 1);
          }
          .orb-idle {
             animation: breathe 4s infinite ease-in-out;
          }
          @keyframes breathe {
             0% { transform: scale(0.95); opacity: 0.8; }
             50% { transform: scale(1.05); opacity: 1; }
             100% { transform: scale(0.95); opacity: 0.8; }
          }
       `}</style>

       {/* Top Status Bar */}
       <div className="absolute top-0 w-full p-8 flex justify-between items-start z-30">
          <div>
              <div className="flex items-center gap-3 mb-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? (isManager ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]') : 'bg-red-500 animate-pulse'}`}></div>
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-500">{isManager ? "Canal Prioritário" : "Frequência Aberta"}</span>
              </div>
              <h2 className="text-2xl font-serif text-white">{assistantName || "Portaria.ai"}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-4 bg-white/5 rounded-full text-zinc-400 hover:bg-white/10 hover:text-white transition-all backdrop-blur-md border border-white/5"
          >
             <X size={20} />
          </button>
       </div>

       {/* Main Visualizer Stage */}
       <div className="flex-1 flex flex-col items-center justify-center relative">
          
          {/* THE LIVING ORB */}
          <div className="relative w-64 h-64 flex items-center justify-center">
             
             {/* AI Speaking: Shockwaves */}
             {activeSpeaker === 'ai' && (
                 <>
                    <div className="absolute inset-0 rounded-full border border-white/20 ripple-effect" style={{ animationDelay: '0s', borderColor: glowColor }}></div>
                    <div className="absolute inset-0 rounded-full border border-white/10 ripple-effect" style={{ animationDelay: '0.6s', borderColor: glowColor }}></div>
                    <div className="absolute inset-0 rounded-full border border-white/5 ripple-effect" style={{ animationDelay: '1.2s', borderColor: glowColor }}></div>
                 </>
             )}

             {/* Listening Glow (User Speaking) */}
             <div 
                className="absolute inset-0 rounded-full transition-all duration-100 ease-out blur-3xl opacity-40"
                style={{ 
                    backgroundColor: accentColor, 
                    transform: `scale(${1 + userVolume/100})`,
                    opacity: userVolume > 5 ? 0.6 : 0
                }}
             />

             {/* Core Orb */}
             <div 
                className={`relative w-40 h-40 rounded-full shadow-2xl z-20 overflow-hidden transition-transform duration-75 ease-linear ${activeSpeaker === 'none' ? 'orb-idle' : ''}`}
                style={{ 
                    transform: `scale(${orbScale})`,
                    boxShadow: activeSpeaker === 'user' 
                        ? `0 0 ${userGlowIntensity}px ${glowColor}, inset 0 0 20px ${glowColor}` // Inner glow when listening
                        : `0 0 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(255,255,255,0.1)` // Default depth
                }}
             >
                {/* Assistant Avatar Background */}
                <div className="absolute inset-0 bg-zinc-900">
                    {assistantAvatar ? (
                        <img 
                            src={assistantAvatar} 
                            className="w-full h-full object-cover opacity-80 mix-blend-overlay" 
                            style={{ filter: activeSpeaker === 'ai' ? 'brightness(1.5)' : 'brightness(1)' }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-800 to-black">
                            <Bot size={64} className="text-white/20" />
                        </div>
                    )}
                </div>

                {/* Glassy Overlay / Shine */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/60 pointer-events-none"></div>
                
                {/* Active Speaking Core Light */}
                {activeSpeaker === 'ai' && (
                    <div className="absolute inset-0 bg-white/20 mix-blend-overlay animate-pulse"></div>
                )}
             </div>

          </div>

          {/* Status Text */}
          <div className="mt-16 h-8 flex items-center justify-center">
              <p className="text-zinc-500 font-medium tracking-widest text-sm uppercase animate-pulse">
                  {activeSpeaker === 'ai' ? "Transmitindo..." : activeSpeaker === 'user' ? "Ouvindo..." : "Aguardando..."}
              </p>
          </div>
       </div>

       {/* Toast Notification */}
       {loggedItem && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[#18181b]/90 backdrop-blur-md border border-white/10 px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-500">
             <div className="bg-green-500/20 p-1.5 rounded-full">
                <CheckCircle2 className="text-green-500" size={18} />
             </div>
             <div>
                <span className="text-zinc-400 text-[10px] uppercase font-bold block mb-0.5">Sistema</span>
                <span className="text-white font-medium text-sm">{loggedItem}</span>
             </div>
          </div>
       )}

       {/* Bottom Controls */}
       <div className="pb-12 px-8 flex justify-center gap-6 items-center relative z-30">
          <button 
             onClick={toggleMic}
             className={`p-6 rounded-full transition-all duration-300 backdrop-blur-md ${
               isMicOn 
               ? 'bg-white/10 text-white border border-white/20 hover:bg-white/20 shadow-[0_0_30px_rgba(255,255,255,0.1)]' 
               : 'bg-red-500/20 text-red-400 border border-red-500/30'
             }`}
          >
             {isMicOn ? <Mic size={28} /> : <MicOff size={28} />}
          </button>

          <button 
             onClick={onClose}
             className="px-8 py-6 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold tracking-wide transition-all shadow-lg hover:shadow-red-900/50 hover:scale-105 flex items-center gap-2"
          >
             <PhoneOff size={20} />
             <span className="text-sm">ENCERRAR</span>
          </button>
       </div>
    </div>
  );
};

export default LiveConversation;
