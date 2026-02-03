
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BrainCircuit, Mic, SendHorizontal, X, Activity, Radio, Cpu, Sparkles, MessageSquare, History, Settings, User } from 'lucide-react';
import { getInternalInstructions } from '../../services/ai/internalInstructions';
import { useAppConfig } from '../../contexts/AppConfigContext';

interface AiViewProps {
  allPackages: any[];
  visitorLogs: any[];
  allOccurrences: any[];
  allResidents: any[];
  dayReservations: any[];
  allNotices: any[];
  chatMessages: any[];
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

const AiView: React.FC<AiViewProps> = ({ 
  allPackages, 
  visitorLogs, 
  allOccurrences, 
  allResidents,
  dayReservations,
  allNotices,
  chatMessages
}) => {
  const { config, updateAIConfig } = useAppConfig();
  // Chat State
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
  const voiceSettings: VoiceSettings = { 
    gender: config.aiConfig?.voiceGender ?? 'male', 
    style: config.aiConfig?.voiceStyle ?? 'serious' 
  };

  // Live State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiveConnecting, setIsLiveConnecting] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [liveResponse, setLiveResponse] = useState<string>('');
  const [liveListening, setLiveListening] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveAudioSources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const recognitionRef = useRef<any>(null);
  const isLiveProcessingRef = useRef(false);
  const isLiveActiveRef = useRef(false);

  // Salvar histórico
  useEffect(() => {
    localStorage.setItem('sentinela_history', JSON.stringify(messages));
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Carregar lista de vozes (Chrome/Edge populam getVoices() de forma assíncrona)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    const onVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', onVoicesChanged);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', onVoicesChanged);
  }, []);

  // Cleanup Live Voice ao desmontar
  useEffect(() => {
    return () => {
      isLiveActiveRef.current = false;
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  // Mapa de Vozes do Gemini Live API (exibição)
  const getVoiceConfig = () => {
    // Fenrir: Deep/Authoritative (Male Serious)
    // Puck: Playful/Mid (Male Animated)
    // Kore: Calm/Professional (Female Serious)
    // Aoede: Expressive (Female Animated)
    if (voiceSettings.gender === 'male') {
      return voiceSettings.style === 'serious' ? 'Fenrir' : 'Puck';
    } else {
      return voiceSettings.style === 'serious' ? 'Kore' : 'Aoede';
    }
  };

  // Seleciona voz da Web Speech API por gênero (pt-BR), priorizando vozes mais naturais (Google, Microsoft, neural).
  const getSpeechVoiceByGender = (gender: 'male' | 'female'): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    const ptVoices = voices
      .filter(v => v.lang.startsWith('pt'))
      .sort((a, b) => (a.lang === 'pt-BR' ? -1 : 0) - (b.lang === 'pt-BR' ? -1 : 0)); // pt-BR primeiro
    if (ptVoices.length === 0) return null;
    const wantMale = gender === 'male';
    const name = (v: SpeechSynthesisVoice) => (v.name || '').toLowerCase();
    // 1) Priorizar vozes de melhor qualidade (Google, Microsoft, Natural, Premium) — soam mais humanas
    const premiumHint = /google|microsoft|natural|premium|neural|online|enhanced/i;
    const premiumPt = ptVoices.filter(v => premiumHint.test(name(v)));
    const maleNames = /daniel|ricardo|luciano|antonio|male|david|paulo|tiago|google.*homem|male/i;
    const femaleNames = /maria|francisca|luciana|helena|female|ana|fernanda|camila|google.*mulher|female/i;
    const pickFrom = premiumPt.length > 0 ? premiumPt : ptVoices;
    const match = pickFrom.find(v => {
      const n = name(v);
      return wantMale ? maleNames.test(n) : femaleNames.test(n);
    });
    if (match) return match;
    // 2) Fallback: voz padrão pt-BR (geralmente a mais fluida)
    const defaultPt = ptVoices.find(v => v.default) || ptVoices[0];
    if (defaultPt) return defaultPt;
    if (ptVoices.length >= 2 && wantMale) return ptVoices[1];
    if (ptVoices.length >= 2 && !wantMale) return ptVoices[0];
    return ptVoices[0];
  };

  const getSystemPersona = () => {
    const internalInstructions = getInternalInstructions();
    const externalInstructions = config.aiConfig.externalInstructions;
    
    return `${internalInstructions}

PERSONALIZAÇÃO DO AGENTE:
Nome: ${aiName}
${externalInstructions}

INSTRUÇÕES DE PERSONALIDADE:
${voiceSettings.style === 'serious' 
  ? `Você é o ${aiName}, uma IA militar e objetiva. Responda de forma curta, precisa e profissional. Foque em segurança e eficiência.`
  : `Você é o ${aiName}, um parceiro de trabalho amigável e prestativo. Use uma linguagem mais natural e colaborativa. Seja proativo.`
}`;
  };

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
      const persona = getSystemPersona();
      const res = await fetch('/api/ai', {
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

  // --- Enviar transcrição de voz para a IA e falar a resposta (Live Voice) — só voz, sem escrever no chat ---
  const sendVoiceToAI = useCallback(async (transcript: string) => {
    const text = (transcript || '').trim();
    if (!text || isLiveProcessingRef.current) return;
    isLiveProcessingRef.current = true;
    setLiveTranscript(text);
    setLiveResponse('');
    setLiveListening(false);
    try {
      const context = getSystemContext();
      const persona = getSystemPersona();
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'chat', prompt: text, context, persona }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = res.ok ? (data.text ?? '') : (data.error ?? 'Erro ao processar.');
      const replyText = reply || 'Desculpe, não consegui gerar uma resposta.';
      setLiveResponse(replyText);
      // Falar a resposta (Web Speech API) — voz mais natural: pt-BR, ritmo e tom suaves
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(replyText);
        u.lang = 'pt-BR';
        u.rate = 0.92;   // Ritmo um pouco mais lento = mais natural e claro
        u.pitch = 1;     // Tom neutro (evita robótico)
        u.volume = 1;
        const chosenVoice = getSpeechVoiceByGender(voiceSettings.gender);
        if (chosenVoice) u.voice = chosenVoice;
        u.onend = () => {
          isLiveProcessingRef.current = false;
          setLiveResponse('');
          if (recognitionRef.current && isLiveActiveRef.current) {
            try { recognitionRef.current.start(); } catch { /* já iniciado ou fechado */ }
            setLiveListening(true);
          }
        };
        window.speechSynthesis.speak(u);
      } else {
        isLiveProcessingRef.current = false;
        setLiveResponse('');
        if (recognitionRef.current && isLiveActiveRef.current) {
          try { recognitionRef.current.start(); } catch { /* já iniciado ou fechado */ }
          setLiveListening(true);
        }
      }
    } catch (err) {
      console.error('Erro Live Voice:', err);
      const errMsg = 'Erro de conexão. Tente novamente.';
      setLiveResponse(errMsg);
      isLiveProcessingRef.current = false;
      if (recognitionRef.current && isLiveActiveRef.current) {
        try { recognitionRef.current.start(); } catch { /* */ }
        setLiveListening(true);
      }
    }
  }, [getSystemContext, getSystemPersona]);

  // --- Live Voice: inicia overlay e reconhecimento de voz ---
  const startLiveMode = async () => {
    setIsLiveConnecting(true);
    setLiveTranscript('');
    setLiveResponse('');
    const SpeechRecognitionAPI = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    if (!SpeechRecognitionAPI) {
      setIsLiveConnecting(false);
      setIsLiveActive(true);
      setLiveResponse('Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.');
      return;
    }
    await new Promise(r => setTimeout(r, 800));
    setIsLiveConnecting(false);
    setIsLiveActive(true);
    isLiveActiveRef.current = true;
    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'pt-BR';
      recognition.maxAlternatives = 1;
      recognition.onresult = (event: any) => {
        const result = event.results[event.resultIndex];
        if (result?.isFinal) {
          const transcript = result[0]?.transcript?.trim();
          if (transcript) {
            recognition.stop();
            sendVoiceToAI(transcript);
          }
        }
      };
      recognition.onend = () => {
        if (!isLiveActiveRef.current) return;
        if (!isLiveProcessingRef.current && recognitionRef.current) {
          try { recognition.start(); } catch { /* */ }
        }
      };
      recognition.onerror = (event: any) => {
        if (event?.error === 'no-speech' || event?.error === 'aborted') return;
        console.warn('[Live Voice] Reconhecimento:', event?.error);
      };
      recognitionRef.current = recognition;
      recognition.start();
      setLiveListening(true);
    } catch (e) {
      console.error('Erro ao iniciar reconhecimento de voz:', e);
      setLiveResponse('Não foi possível ativar o microfone. Verifique as permissões.');
    }
  };

  const stopLiveMode = useCallback(() => {
    isLiveActiveRef.current = false;
    if (liveSessionRef.current) liveSessionRef.current.close();
    liveAudioSources.current.forEach(s => s.stop());
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* */ }
      recognitionRef.current = null;
    }
    isLiveProcessingRef.current = false;
    setIsLiveActive(false);
    setIsLiveConnecting(false);
    setLiveTranscript('');
    setLiveResponse('');
    setLiveListening(false);
  }, []);

  return (
    <div className="h-[calc(100vh-140px)] min-h-0 flex flex-col lg:flex-row gap-4 lg:gap-6 animate-in fade-in duration-500 overflow-hidden relative">
      {/* SELETOR DE VOZ (MODAL INTERNO) */}
      {isVoiceSettingsOpen && (
        <div className="fixed md:absolute top-4 right-4 md:top-20 md:right-8 z-50 bg-black/90 backdrop-blur-xl p-4 md:p-6 rounded-[32px] border border-white/10 w-[calc(100vw-2rem)] md:w-72 max-w-sm shadow-2xl animate-in fade-in slide-in-from-top-4">
           <div className="flex justify-between items-center mb-6">
              <h5 className="text-white font-black uppercase text-sm">Configuração Neural</h5>
              <button onClick={() => setIsVoiceSettingsOpen(false)}><X className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
           </div>
           
           <div className="space-y-6">
              <div>
                 <label className="text-[10px] font-black uppercase text-zinc-500 mb-3 block">Gênero da Voz</label>
                 <div className="flex gap-2">
                    <button onClick={() => updateAIConfig({ voiceGender: 'male' })} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${voiceSettings.gender === 'male' ? 'bg-cyan-500 text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>Masculino</button>
                    <button onClick={() => updateAIConfig({ voiceGender: 'female' })} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${voiceSettings.gender === 'female' ? 'bg-purple-500 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}>Feminino</button>
                 </div>
              </div>
              
              <div>
                 <label className="text-[10px] font-black uppercase text-zinc-500 mb-3 block">Estilo Operacional</label>
                 <div className="flex gap-2">
                    <button onClick={() => updateAIConfig({ voiceStyle: 'serious' })} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${voiceSettings.style === 'serious' ? 'border-white text-white bg-white/10' : 'border-transparent text-zinc-500 hover:text-white'}`}>Sério</button>
                    <button onClick={() => updateAIConfig({ voiceStyle: 'animated' })} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all border ${voiceSettings.style === 'animated' ? 'border-green-400 text-green-400 bg-green-400/10' : 'border-transparent text-zinc-500 hover:text-white'}`}>Animado</button>
                 </div>
              </div>
           </div>
           
           <div className="mt-6 pt-4 border-t border-white/10 text-[10px] text-zinc-500 text-center">
              Voz Ativa: <span className="text-white font-bold">{getVoiceConfig()}</span>
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
                className={`relative w-[240px] h-[240px] md:w-[260px] md:h-[260px] rounded-full p-[1px] ${liveListening ? 'radar-energy-vibration' : ''}`}
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
                 <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isLiveConnecting ? 'bg-amber-500' : liveListening ? 'bg-green-500' : 'bg-cyan-500'} animate-pulse`} />
                 <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider md:tracking-[0.5em] text-cyan-400/90">
                    {isLiveConnecting ? 'Sincronizando...' : liveListening ? 'OUVINDO — FALE AGORA' : liveTranscript ? 'Processando...' : `Voz: ${getVoiceConfig()} (${voiceSettings.style})`}
                 </span>
              </div>
              <h2 className="text-xl md:text-3xl font-black text-white/95 uppercase tracking-tighter">
                 {isLiveConnecting ? 'Conectando...' : liveListening ? 'Sentinela operacional' : liveTranscript ? 'Respondendo...' : 'Sentinela operacional'}
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

      {/* ÁREA DE CHAT CENTRAL */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-950/60 border border-white/5 rounded-[32px] lg:rounded-[40px] relative overflow-hidden">
         
         {/* Chat Header */}
         <div className="p-4 md:p-6 lg:p-8 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-black/30 backdrop-blur-xl z-10 flex-shrink-0">
            <div className="flex items-center gap-3 md:gap-5 min-w-0 flex-1">
               <div className="relative flex-shrink-0">
                  <div className={`w-10 h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-2xl md:rounded-3xl bg-gradient-to-br flex items-center justify-center shadow-2xl ${voiceSettings.gender === 'male' ? 'from-cyan-600 to-blue-800 shadow-cyan-900/40' : 'from-purple-600 to-pink-800 shadow-purple-900/40'}`}>
                     <BrainCircuit className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7 text-white" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-green-500 rounded-full border-2 md:border-4 border-black animate-pulse" />
               </div>
               <div className="min-w-0 flex-1">
                  <h2 className="text-base md:text-lg lg:text-xl font-black uppercase text-white tracking-tight leading-none mb-1 truncate">Interface Neural</h2>
                  <p className="text-[9px] md:text-[10px] font-bold text-zinc-500 uppercase tracking-wider md:tracking-widest flex items-center gap-2">
                     <Radio className="w-3 h-3 flex-shrink-0" /> <span className="truncate">Conectado: Notas & Chat</span>
                  </p>
               </div>
            </div>
            
            <div className="flex gap-2 md:gap-3 flex-shrink-0">
               <button 
                  onClick={() => setIsVoiceSettingsOpen(!isVoiceSettingsOpen)}
                  className={`p-3 md:p-4 rounded-xl md:rounded-2xl hover:bg-white/10 transition-all ${isVoiceSettingsOpen ? 'bg-white text-black' : 'bg-white/5 text-zinc-500'}`}
                  title="Configurar Voz"
               >
                  <Settings className="w-4 h-4 md:w-5 md:h-5" />
               </button>
               <button 
                  onClick={() => setMessages([{ id: '0', role: 'model', text: 'Memória limpa. Reindexando dados do condomínio...', timestamp: new Date() }])}
                  className="p-3 md:p-4 bg-white/5 rounded-xl md:rounded-2xl hover:bg-white/10 transition-all text-zinc-500"
                  title="Limpar Histórico"
               >
                  <History className="w-4 h-4 md:w-5 md:h-5" />
               </button>
               <button 
                  onClick={startLiveMode}
                  title="Ativar canal de voz ao vivo"
                  className={`group flex items-center gap-2 md:gap-4 px-4 md:px-6 lg:px-8 py-3 md:py-4 text-white rounded-2xl md:rounded-3xl transition-all shadow-2xl active:scale-95 ${voiceSettings.gender === 'male' ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-purple-600 hover:bg-purple-500'}`}
               >
                  <Mic className="w-4 h-4 md:w-5 md:h-5 group-hover:animate-bounce" />
                  <span className="text-[9px] md:text-[10px] lg:text-[11px] font-black uppercase tracking-wider md:tracking-widest hidden sm:inline">Live Voice</span>
               </button>
            </div>
         </div>

         {/* Messages Area - Interface Neural Sentinela (Condomínio Qualivida) */}
         <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 lg:space-y-10 relative min-h-0">
            {messages.map((msg) => {
               const isModel = msg.role === 'model';
               const isStreaming = isModel && msg.isStreaming;
               const isError = isModel && msg.isError;
               return (
                  <div key={msg.id} className={`flex ${isModel ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-4 duration-500`}>
                     <div className={`max-w-[90%] sm:max-w-[85%] md:max-w-[75%] p-4 md:p-6 lg:p-7 rounded-[24px] md:rounded-[32px] relative group ${
                        isModel 
                           ? isError 
                              ? 'bg-red-950/40 border border-red-500/30 text-red-200 rounded-tl-sm shadow-xl'
                              : 'bg-zinc-900/80 border border-white/5 text-zinc-300 rounded-tl-sm shadow-xl' 
                           : 'bg-white text-black rounded-tr-sm shadow-2xl'
                     }`}>
                        {isModel && (
                           <div className="flex items-center gap-2 mb-3 opacity-40">
                              <Sparkles className="w-3 h-3" />
                              <span className="text-[9px] font-black uppercase tracking-widest">Sentinela ({voiceSettings.gender === 'male' ? 'M' : 'F'})</span>
                           </div>
                        )}
                        <p className="text-xs md:text-sm font-bold leading-relaxed whitespace-pre-wrap break-words">
                           {msg.text}
                           {isStreaming && (
                              <span className="inline-block w-2 h-4 ml-0.5 bg-cyan-400 animate-pulse align-middle" />
                           )}
                        </p>
                        <div className={`flex items-center gap-2 mt-4 ${isModel ? 'justify-end' : 'justify-start'} opacity-20`}>
                           <span className="text-[8px] font-black uppercase">
                              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </span>
                        </div>
                     </div>
                  </div>
               );
            })}
            
            {isProcessing && !messages.some(m => m.role === 'model' && m.isStreaming) && (
               <div className="flex justify-start animate-pulse">
                  <div className="bg-zinc-900 border border-white/5 p-6 rounded-[24px] flex gap-3">
                     <div className={`w-2 h-2 rounded-full animate-bounce ${voiceSettings.gender === 'male' ? 'bg-cyan-500' : 'bg-purple-500'}`} />
                     <div className={`w-2 h-2 rounded-full animate-bounce delay-150 ${voiceSettings.gender === 'male' ? 'bg-cyan-500' : 'bg-purple-500'}`} />
                     <div className={`w-2 h-2 rounded-full animate-bounce delay-300 ${voiceSettings.gender === 'male' ? 'bg-cyan-500' : 'bg-purple-500'}`} />
                  </div>
               </div>
            )}
            <div ref={chatEndRef} />
         </div>

         {/* Input Area */}
         <div className="p-4 md:p-6 lg:p-8 bg-black/40 border-t border-white/5 backdrop-blur-md flex-shrink-0">
            <div className="relative group">
               <div className={`absolute inset-0 bg-gradient-to-r rounded-[24px] md:rounded-[32px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity ${voiceSettings.gender === 'male' ? 'from-cyan-600/10 via-blue-600/10 to-transparent' : 'from-purple-600/10 via-pink-600/10 to-transparent'}`} />
               <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Pergunte sobre notas, chat ou operações..."
                  className="w-full relative bg-zinc-900/50 border border-white/10 rounded-[24px] md:rounded-[32px] pl-4 md:pl-8 pr-16 md:pr-20 py-4 md:py-6 lg:py-7 text-xs md:text-sm font-bold text-white outline-none focus:border-white/20 transition-all placeholder:text-zinc-600 shadow-inner"
               />
               <button 
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isProcessing}
                  className={`absolute right-2 md:right-3 top-1/2 -translate-y-1/2 p-3 md:p-4 lg:p-5 rounded-xl md:rounded-2xl transition-all ${
                     input.trim() && !isProcessing
                        ? 'bg-white text-black shadow-2xl hover:scale-105 active:scale-95' 
                        : 'bg-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
                  }`}
               >
                  <SendHorizontal className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6" />
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default AiView;
