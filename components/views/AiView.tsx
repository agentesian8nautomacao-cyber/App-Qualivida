import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { BrainCircuit, Mic, SendHorizontal, X, Activity, Radio, Cpu, Sparkles, MessageSquare, History, Settings } from 'lucide-react';
import { getInternalInstructions } from '../../services/ai/internalInstructions';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { getGeminiVoiceName } from '../../utils/voiceConfig';
import { useLiveVoiceConversation } from '../../hooks/useLiveVoiceConversation';
import ChatAssistant from './sentinela/ChatAssistant';
import type { SentinelaUserProfile, OccurrenceItemSentinela, SentinelaRole } from '../../types/sentinela';

interface AiViewProps {
  allPackages: any[];
  visitorLogs: any[];
  allOccurrences: any[];
  allResidents: any[];
  dayReservations: any[];
  allNotices: any[];
  chatMessages: any[];
  role?: 'MORADOR' | 'PORTEIRO' | 'SINDICO';
  adminName?: string | null;
  onAddOccurrenceFromSentinela?: (item: OccurrenceItemSentinela) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isStreaming?: boolean;
  isError?: boolean;
}

interface VoiceSettings {
  gender: 'male' | 'female';
  style: 'serious' | 'animated';
}

// Helper para montar URL da API de IA.
// Em produção: chama `/api/ai` normalmente (Vercel).
// Em desenvolvimento: se VITE_API_BASE_URL estiver definida, usa `${VITE_API_BASE_URL}/api/ai`,
// evitando 404 do Vite dev server.
const getAiApiUrl = () => {
  // Vite injeta import.meta.env em tempo de build; para evitar erro de tipo em TS,
  // fazemos um cast explícito.
  const env = (import.meta as any).env || {};
  const base = env.VITE_API_BASE_URL as string | undefined;
  if (env.DEV && base) {
    return `${base.replace(/\/+$/, '')}/api/ai`;
  }
  return '/api/ai';
};

const AiView: React.FC<AiViewProps> = ({
  allPackages,
  visitorLogs,
  allOccurrences,
  allResidents,
  dayReservations,
  allNotices,
  chatMessages,
  role: appRole = 'PORTEIRO',
  adminName,
  onAddOccurrenceFromSentinela,
}) => {
  const { config, updateAIConfig } = useAppConfig();
  const sentinelaRole: SentinelaRole = appRole === 'SINDICO' ? 'Síndico' : 'Porteiro';
  const sentinelaProfile: SentinelaUserProfile | null = useMemo(
    () => ({
      name: adminName ?? (appRole === 'SINDICO' ? 'Síndico' : 'Porteiro'),
      role: sentinelaRole,
      condoName: config.condominiumName,
      doormanConfig: {
        assistantName: config.aiConfig?.name ?? 'Sentinela',
        instructions: config.aiConfig?.externalInstructions ?? 'Foco total em segurança e controle de acesso. Entregas apenas na portaria. Visitantes: exigir RG. Tom formal e breve.',
      },
      managerConfig: {
        assistantName: 'Conselheiro',
        instructions: 'Atue como gestor administrativo e jurídico. Redija comunicados cultos. Cite leis do condomínio. Tom diplomático e executivo.',
      },
    }),
    [config.condominiumName, config.aiConfig?.name, config.aiConfig?.externalInstructions, appRole, adminName, sentinelaRole]
  );
  const sentinelaOccurrences: OccurrenceItemSentinela[] = useMemo(
    () =>
      allOccurrences.slice(-20).map((o) => ({
        id: o.id,
        type: 'Ocorrência' as const,
        title: o.description.slice(0, 60) + (o.description.length > 60 ? '...' : ''),
        description: o.description,
        timestamp: new Date(o.date).getTime(),
        involvedParties: o.unit,
        status: 'Logged' as const,
      })),
    [allOccurrences]
  );

  // Chat State (legacy, usado apenas se não estiver no modo Sentinela embutido)
  const [input, setInput] = useState('');
  const aiName = config.aiConfig.name;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('sentinela_history');
    return saved ? JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })) : [
      { id: '0', role: 'model', text: `Olá. Sou o ${aiName}, seu copiloto operacional. Estou conectado a todas as camadas do sistema. Configure minha voz e comportamento nas Configurações.`, timestamp: new Date() }
    ];
  });

  // Voice & Persona State - usar do config (fallbacks para garantir UI sempre consistente)
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  // Estado pendente no modal: só aplicado ao assistente ao clicar em Salvar
  const [pendingGender, setPendingGender] = useState<VoiceSettings['gender']>(config.aiConfig?.voiceGender ?? 'female');
  const [pendingStyle, setPendingStyle] = useState<VoiceSettings['style']>(config.aiConfig?.voiceStyle ?? 'serious');
  const voiceSettings: VoiceSettings = { 
    gender: config.aiConfig?.voiceGender ?? 'male', 
    style: config.aiConfig?.voiceStyle ?? 'serious' 
  };

  // Ao abrir o modal, sincronizar pendentes com o que está salvo
  useEffect(() => {
    if (isVoiceSettingsOpen) {
      setPendingGender(config.aiConfig?.voiceGender ?? 'female');
      setPendingStyle(config.aiConfig?.voiceStyle ?? 'serious');
    }
  }, [isVoiceSettingsOpen, config.aiConfig?.voiceGender, config.aiConfig?.voiceStyle]);

  // Live State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);

  // Salvar histórico
  useEffect(() => {
    localStorage.setItem('sentinela_history', JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Nome da voz Gemini Live (usado para exibição / paridade com Nutri.IA)
  const activeGeminiVoiceName = getGeminiVoiceName(voiceSettings.gender, voiceSettings.style);

  // Persona e instruções estáveis por voz/gênero/estilo — evita reconexão a cada render e reforça voz humana
  const liveSystemInstruction = useMemo(() => {
    const internalInstructions = getInternalInstructions();
    const externalInstructions = config.aiConfig?.externalInstructions ?? '';
    const voiceDesc = voiceSettings.gender === 'male' ? 'masculina' : 'feminina';
    const styleDesc = voiceSettings.style === 'serious' ? 'sério e profissional' : 'animado e expressivo';
    return `${internalInstructions}

PERSONALIZAÇÃO DO AGENTE:
Nome: ${aiName}
${externalInstructions}

VOZ E CARACTERIZAÇÃO (OBRIGATÓRIO):
- Sua voz de saída é ${voiceDesc} e o tom é ${styleDesc}. Mantenha essa caracterização em todas as respostas.
- Responda SEMPRE em português do Brasil. Nunca use outro idioma.
- Fale como em uma chamada real: tom natural, humano e conversacional.

INSTRUÇÕES DE PERSONALIDADE:
${voiceSettings.style === 'serious'
  ? `Você é o ${aiName}, uma IA militar e objetiva. Responda de forma curta, precisa e profissional. Foque em segurança e eficiência.`
  : `Você é o ${aiName}, um parceiro de trabalho amigável e prestativo. Use linguagem natural e colaborativa. Seja proativo e expressivo.`}

INSTRUÇÕES PARA FALA:
- Use frases curtas e ritmo conversacional. Evite períodos longos.
- Prefira linguagem natural e direta, como um atendente humano ao telefone.
- Evite listas longas em uma única frase; quebre em duas ou três frases.
- Varie levemente a entonação (perguntas soam diferentes de afirmações).`;
  }, [
    config.aiConfig?.name,
    config.aiConfig?.voiceGender,
    config.aiConfig?.voiceStyle,
    config.aiConfig?.externalInstructions,
    aiName,
    voiceSettings.gender,
    voiceSettings.style,
  ]);

  // Montar contexto DO SISTEMA INTEIRO para a IA
  const getSystemContext = useCallback(() => {
    const activeVisitors = visitorLogs.filter(v => v.status === 'active');
    const pendingPackages = allPackages.filter(p => p.status === 'Pendente');
    const openOccurrences = allOccurrences.filter(o => o.status === 'Aberto');
    const urgentNotices = allNotices.filter(n => n.category === 'Urgente' || n.priority === 'high');
    
    // Processamento de Chat para Contexto Rico
    const recentChat = chatMessages.slice(-10).map(m => `[CHAT ${m.senderRole}]: ${m.text}`).join('\n');

    return `
      DADOS EM TEMPO REAL DO CONDOMÍNIO:
      
      1. COMUNICAÇÃO INTERNA (CRÍTICO):
      ${recentChat ? recentChat : 'Nenhuma mensagem recente.'}

      2. STATUS ATUAL:
      - Visitantes: ${activeVisitors.length} ativos.
      - Encomendas: ${pendingPackages.length} pendentes.
      - Alertas de Segurança: ${openOccurrences.map(o => o.description).join(', ')}.
      - Avisos do Síndico: ${urgentNotices.map(n => n.title).join(', ')}.

      INSTRUÇÃO:
      Use o histórico de CHAT para entender ordens e contextos não estruturados. 
      Se o Síndico pediu algo no chat, isso é uma regra ativa.
    `;
  }, [allPackages, visitorLogs, allOccurrences, chatMessages, allNotices]);

  // Contexto estável — só muda quando os dados do condomínio mudam (evita reconexão a cada render)
  const liveContextData = useMemo(
    () => getSystemContext(),
    [getSystemContext]
  );

  // --- Live Voice (Sentinela) via Gemini Live ---
  const {
    isConnected: liveIsConnected,
    isMicOn: liveIsMicOn,
    volume: liveVolume,
    status: liveStatus,
    secondsActive: liveSecondsActive,
    isLimitReached: liveIsLimitReached,
    loggedItem: liveLoggedItem,
    start: liveStart,
    stop: liveStop,
    toggleMic: liveToggleMic,
  } = useLiveVoiceConversation({
    // Chave exclusiva para Gemini Live no front (não é a mesma do backend /api/ai).
    // Configure VITE_GEMINI_LIVE_KEY no .env.local e no Vercel com as restrições de domínio corretas.
    apiKey: ((import.meta as any).env?.VITE_GEMINI_LIVE_KEY as string) || '',
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    voiceName: activeGeminiVoiceName,
    systemInstruction: liveSystemInstruction,
    timeLimitSeconds: 15 * 60,
    contextData: liveContextData,
    enableLogMealTool: false,
  });

  // --- CHAT via API com streaming (Sentinela condomínio Qualivida) ---
  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setIsProcessing(true);

    const modelMsgId = (Date.now() + 1).toString();
    const modelMsgPlaceholder: ChatMessage = {
      id: modelMsgId,
      role: 'model',
      text: '',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages(prev => [...prev, modelMsgPlaceholder]);

    try {
      const context = getSystemContext();
      const persona = liveSystemInstruction;
      const res = await fetch(getAiApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat-stream',
          prompt: currentInput,
          context,
          persona,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errText = data?.error ?? 'Erro ao processar sua solicitação.';
        setMessages(prev =>
          prev.map(m => m.id === modelMsgId ? { ...m, text: errText, isStreaming: false, isError: true } : m)
        );
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages(prev =>
          prev.map(m => m.id === modelMsgId ? { ...m, text: 'Erro: resposta sem stream.', isStreaming: false, isError: true } : m)
        );
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            if (payload === '[DONE]') continue;
            try {
              const data = JSON.parse(payload);
              if (data.error) {
                setMessages(prev =>
                  prev.map(m => m.id === modelMsgId ? { ...m, text: data.error, isStreaming: false, isError: true } : m)
                );
                return;
              }
              if (data.text) {
                accumulated += data.text;
                setMessages(prev =>
                  prev.map(m => m.id === modelMsgId ? { ...m, text: accumulated, isStreaming: true } : m)
                );
              }
            } catch {
              // ignore parse errors for incomplete chunks
            }
          }
        }
      }

      const finalText = accumulated.trim() || 'Desculpe, não consegui gerar uma resposta. Tente novamente.';
      setMessages(prev =>
        prev.map(m => m.id === modelMsgId ? { ...m, text: finalText, isStreaming: false } : m)
      );
    } catch (error: unknown) {
      console.error('Erro ao enviar mensagem:', error);
      const errMsg = 'Erro de conexão. Verifique a rede e se o servidor está disponível.';
      setMessages(prev =>
        prev.map(m => m.id === modelMsgId ? { ...m, text: errMsg, isStreaming: false, isError: true } : m)
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Live Voice (overlay Sentinela) controlado pelo Gemini Live ---
  const startLiveMode = async () => {
    setIsLiveConnecting(true);
    setIsLiveActive(true);
    // Log de prova: engine única é Gemini Live; gênero/estilo aplicados à voz
    console.info('[Sentinela/TTS] Iniciando canal de voz', {
      engine: 'Gemini Live (native audio)',
      voiceName: activeGeminiVoiceName,
      gender: voiceSettings.gender,
      style: voiceSettings.style,
      noBrowserTTS: true,
    });
    liveStart();
  };

  const stopLiveMode = useCallback(() => {
    liveStop();
    setIsLiveActive(false);
    setIsLiveConnecting(false);
  }, [liveStop]);

  // Quando o canal de voz conectar de fato, sair do estado "Sincronizando..." para "Canal ativo"
  useEffect(() => {
    if (liveIsConnected) setIsLiveConnecting(false);
  }, [liveIsConnected]);

  // Se a conexão falhar (erro, chave ausente, etc.), sair de "Conectando..." para mostrar a mensagem real
  useEffect(() => {
    if (!liveIsConnected && isLiveConnecting) {
      const isConnecting = liveStatus === 'Conectando...' || liveStatus === 'Aguardando servidor...';
      if (!isConnecting) setIsLiveConnecting(false);
    }
  }, [liveIsConnected, isLiveConnecting, liveStatus]);

  return (
    <div className="h-[calc(100vh-140px)] min-h-0 flex flex-col lg:flex-row gap-4 lg:gap-6 animate-in fade-in duration-500 overflow-hidden relative">
      {/* SELETOR DE VOZ (MODAL INTERNO) */}
      {isVoiceSettingsOpen && (
        <div
          className="fixed top-4 right-4 md:top-20 md:right-8 z-[100] w-[calc(100vw-2rem)] md:w-72 max-w-sm bg-black/90 backdrop-blur-xl rounded-[32px] border border-white/10 shadow-2xl animate-in fade-in slide-in-from-top-4 overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column' }}
          role="dialog"
          aria-labelledby="config-neural-title"
        >
           <div className="p-4 md:p-6 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
              <div className="flex justify-between items-center mb-3">
                 <h5 id="config-neural-title" className="text-white font-black uppercase text-sm">Configuração Neural</h5>
                 <button type="button" onClick={() => setIsVoiceSettingsOpen(false)} aria-label="Fechar"><X className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
              </div>
              <button
                type="button"
                onClick={() => {
                  updateAIConfig({ voiceGender: pendingGender, voiceStyle: pendingStyle });
                  setIsVoiceSettingsOpen(false);
                }}
                className="mb-4 w-full py-2.5 rounded-xl text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg"
              >
                Salvar e aplicar
              </button>
              <div className="space-y-6">
                 <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-3 block">Gênero da Voz</label>
                    <div className="flex gap-2">
                       <button type="button" onClick={() => setPendingGender('male')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${pendingGender === 'male' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>Masculino</button>
                       <button type="button" onClick={() => setPendingGender('female')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${pendingGender === 'female' ? 'bg-purple-500 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>Feminino</button>
                    </div>
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 mb-3 block">Estilo Operacional</label>
                    <div className="flex gap-2">
                       <button type="button" onClick={() => setPendingStyle('serious')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${pendingStyle === 'serious' ? 'border-white text-white bg-white/10' : 'border-transparent text-zinc-500 hover:text-white'}`}>Sério</button>
                       <button type="button" onClick={() => setPendingStyle('animated')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${pendingStyle === 'animated' ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-transparent text-zinc-500 hover:text-white'}`}>Animado</button>
                    </div>
                 </div>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 text-[10px] text-zinc-500 text-center">
                 Voz Ativa: <span className="text-white font-bold">{getGeminiVoiceName(pendingGender, pendingStyle)}</span>
              </div>
           </div>
           <div className="p-4 md:p-6 pt-0 bg-black/90 border-t border-white/10" style={{ flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  updateAIConfig({ voiceGender: pendingGender, voiceStyle: pendingStyle });
                  setIsVoiceSettingsOpen(false);
                }}
                className="w-full py-3 rounded-xl text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg"
              >
                Salvar e aplicar
              </button>
           </div>
        </div>
      )}

      {/* MODAL LIVE — Radar IA / Modo Sentinela (OVERLAY IMERSIVO) */}
      {(isLiveActive || isLiveConnecting) && (
        <div className="fixed inset-0 z-[999] bg-black/98 backdrop-blur-3xl flex flex-col items-center justify-center animate-in fade-in duration-700 p-4 md:p-8 overflow-auto">
           <button 
             onClick={stopLiveMode}
             className="absolute top-4 right-4 md:top-10 md:right-10 p-3 md:p-5 rounded-full bg-white/5 hover:bg-red-500 transition-all text-white border border-white/10 z-10"
           >
             <X className="w-6 h-6 md:w-8 md:h-8" />
           </button>

           {/* Wrapper com respiração digital (scale 1 → 1.03 → 1) */}
           <div 
             className={`radar-breathe-wrap relative flex items-center justify-center flex-shrink-0 transition-opacity duration-300 ${isLiveConnecting ? 'opacity-60 scale-90' : 'opacity-100'}`}
           >
              {/* Base do radar: círculo 200–280px, borda gradiente ciano → verde, glow; vibração energética quando OUVINDO */}
              <div 
                className={`relative w-[240px] h-[240px] md:w-[260px] md:h-[260px] rounded-full p-[1px] ${liveIsConnected && liveIsMicOn ? 'radar-energy-vibration' : ''}`}
                style={{
                  background: 'conic-gradient(from 0deg, rgba(6,182,212,0.9), rgba(34,197,94,0.85), rgba(6,182,212,0.9))',
                  boxShadow: '0 0 40px rgba(6,182,212,0.15), 0 0 80px rgba(34,197,94,0.08), inset 0 0 60px rgba(0,0,0,0.4)',
                }}
              >
                 <div className="w-full h-full rounded-full bg-black/95 relative overflow-hidden">
                    {/* Grade radar: círculos concêntricos */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       {[1, 2, 3, 4].map((i) => (
                         <div
                           key={i}
                           className="absolute rounded-full border border-cyan-500/20 border-green-500/10"
                           style={{
                             width: `${i * 22}%`,
                             height: `${i * 22}%`,
                             maxWidth: '96%',
                             maxHeight: '96%',
                           }}
                         />
                       ))}
                    </div>
                    {/* Grade: linhas cruzadas vertical e horizontal */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <div className="absolute w-px h-full bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />
                       <div className="absolute h-px w-full bg-gradient-to-r from-transparent via-green-500/20 to-transparent" />
                    </div>

                    {/* Linha de varredura (sonar) — rotação contínua 360°, 4s linear */}
                    <div
                      className="radar-sweep-line absolute left-1/2 top-1/2 w-0.5 origin-bottom pointer-events-none"
                      style={{
                        height: '50%',
                        marginLeft: '-1px',
                        transform: 'translateY(-100%)',
                        transformOrigin: '50% 100%',
                        background: 'linear-gradient(to top, rgba(6,182,212,0.85), rgba(34,197,94,0.5), transparent)',
                        boxShadow: '0 0 12px rgba(6,182,212,0.4), 0 0 24px rgba(34,197,94,0.2)',
                        filter: 'blur(0.5px)',
                      }}
                    />

                    {/* Pulsos de detecção — pontos/anéis assíncronos */}
                    {[
                      { left: '18%', top: '32%', delay: '0s' },
                      { left: '68%', top: '24%', delay: '0.8s' },
                      { left: '75%', top: '58%', delay: '1.6s' },
                      { left: '28%', top: '70%', delay: '2.4s' },
                      { left: '52%', top: '48%', delay: '3.2s' },
                      { left: '42%', top: '22%', delay: '1.2s' },
                    ].map((pos, i) => (
                      <div
                        key={i}
                        className="radar-pulse-dot absolute w-2 h-2 rounded-full bg-cyan-400/90 border border-green-400/60 pointer-events-none"
                        style={{
                          left: pos.left,
                          top: pos.top,
                          transform: 'translate(-50%, -50%)',
                          boxShadow: '0 0 8px rgba(6,182,212,0.6)',
                          animationDelay: pos.delay,
                        }}
                      />
                    ))}
                 </div>
              </div>
           </div>

           {/* Status fixo abaixo do radar: OUVINDO — FALE AGORA */}
           <div className="mt-8 md:mt-12 text-center space-y-4 md:space-y-6 px-4 max-w-xl flex-shrink-0">
              <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap">
                 <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isLiveConnecting ? 'bg-amber-500' : liveIsConnected ? 'bg-green-500' : 'bg-cyan-500'} animate-pulse`} />
                 <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-[0.5em] text-cyan-400/90">
                    {isLiveConnecting
                      ? 'Sincronizando...'
                      : liveIsConnected
                        ? (liveIsMicOn ? 'Canal ativo — Fale agora' : 'Canal ativo — Microfone em pausa')
                        : liveStatus || `Voz: ${activeGeminiVoiceName} (${voiceSettings.style})`}
                 </span>
              </div>
              <h2 className="text-xl md:text-3xl font-black text-white/95 uppercase tracking-tighter">
                 {isLiveConnecting ? 'Conectando...' : 'Sentinela operacional'}
              </h2>
           </div>

           <button onClick={stopLiveMode} className="mt-6 md:mt-10 px-6 md:px-10 py-3 md:py-5 bg-white/5 border border-white/10 rounded-full text-zinc-400 font-black uppercase text-[9px] md:text-[10px] tracking-widest hover:text-white transition-all">Encerrar</button>
        </div>
      )}

      {/* PAINEL LATERAL: STATUS & INSIGHTS */}
      <div className="hidden lg:flex w-72 lg:w-80 flex-col gap-4 lg:gap-6 p-4 lg:p-6 bg-white/5 border border-white/5 rounded-[32px] lg:rounded-[40px] flex-shrink-0">
         <div className="flex items-center gap-4 mb-2">
            <div className="p-4 bg-cyan-500/10 text-cyan-400 rounded-3xl border border-cyan-500/20">
               <Cpu className="w-6 h-6" />
            </div>
            <div>
               <h3 className="text-sm font-black uppercase text-white tracking-tight">Sentinela v3</h3>
               <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Núcleo de Comando</p>
            </div>
         </div>

         <div className="space-y-4">
             {/* Card de Memória de Chat */}
            <div className="p-5 bg-emerald-900/10 rounded-3xl border border-emerald-500/10 group hover:border-emerald-500/30 transition-all">
               <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold uppercase text-emerald-500/60">Comunicação</span>
                  <MessageSquare className="w-3 h-3 text-emerald-500 opacity-40" />
               </div>
               <span className="text-xs font-bold text-emerald-100 leading-tight">
                  {chatMessages.length > 0 ? "Última ordem do Síndico indexada." : "Nenhuma ordem recente no chat."}
               </span>
            </div>

            <div className="p-5 bg-black/40 rounded-3xl border border-white/5 group hover:border-cyan-500/30 transition-all">
               <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase text-zinc-500">Fluxo</span>
                  <Activity className="w-3 h-3 text-cyan-500 opacity-40" />
               </div>
               <span className="text-2xl font-black text-white">{visitorLogs.filter(v => v.status === 'active').length} Pessoas</span>
            </div>
         </div>
      </div>

      {/* ÁREA SENTINELA — Chat Assistente Porteiro/Síndico (lógica chat sentinela) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 rounded-[32px] lg:rounded-[40px] overflow-hidden border border-white/5 bg-zinc-950/60">
        <ChatAssistant
          userProfile={sentinelaProfile}
          occurrences={sentinelaOccurrences}
          onAddOccurrence={onAddOccurrenceFromSentinela}
          isFullScreen={false}
          onLiveCall={startLiveMode}
          onSettings={() => setIsVoiceSettingsOpen(true)}
        />
      </div>
    </div>
  );
};

export default AiView;
