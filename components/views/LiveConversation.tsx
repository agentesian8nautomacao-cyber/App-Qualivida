/**
 * LiveConversation: canal de voz ao vivo (microfone, envio/recebimento de áudio, modelo de voz).
 * Toda a parte de áudio (captura, Gemini Live API, TTS do assistente) é delegada ao hook useLiveVoiceConversation.
 * Este componente não é usado na Interface Neural do Gestão Qualivida.
 */
import React, { useEffect } from 'react';
import { Type } from "@google/genai";
import { X, Mic, MicOff, PhoneOff, Activity, CheckCircle2, Lock, Home, BookOpen, User, Mic as MicIcon, ArrowDown, Zap, Clock, Infinity, Check } from 'lucide-react';
import { UserProfile, DailyPlan, LogItem, MealItem } from '../types';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { getGeminiVoiceName } from '../../utils/voiceConfig';
import { useLiveVoiceConversation } from '../../hooks/useLiveVoiceConversation';

interface LiveConversationProps {
  onClose: () => void;
  userProfile?: UserProfile | null;
  dietPlan?: DailyPlan | null;
  dailyLog?: LogItem[];
  onAddFood?: (item: MealItem, type: string) => void;
}

const LiveConversation: React.FC<LiveConversationProps> = ({ onClose, userProfile, dietPlan, dailyLog, onAddFood }) => {
  const { config } = useAppConfig();
  const activeVoiceName = getGeminiVoiceName(
    config.aiConfig.voiceGender,
    config.aiConfig.voiceStyle,
  );

  // Montar contexto (igual ao Nutri.ai, mas reaproveitando o hook genérico)
  const sanitize = (key: string, value: any) => {
    if (key === 'image') return undefined;
    return value;
  };

  const contextData = `
    CONTEXTO DO USUÁRIO:
    - Perfil: ${JSON.stringify(userProfile || {})}
    - Plano Alimentar do Dia: ${JSON.stringify(dietPlan || {}, sanitize)}
    - O que comeu hoje: ${JSON.stringify(dailyLog || [], sanitize)}
  `;

  let systemInstruction = `
    Você é um assistente de voz especializado em saúde e alimentação.
    
    Instruções:
    1. Responda de forma natural e conversacional.
    2. Se o usuário disser que comeu algo, você DEVE usar a ferramenta 'logMeal'.
    3. Estime as calorias e macros para a ferramenta se o usuário não fornecer.
    4. Confirme verbalmente quando registrar.
    5. Fale sempre em Português do Brasil.
  `;

  if (userProfile?.customChatInstructions) {
    systemInstruction += `\n\nInstruções Personalizadas: ${userProfile.customChatInstructions}`;
  }

  const {
    isConnected,
    isMicOn,
    volume,
    status,
    secondsActive,
    isLimitReached,
    loggedItem,
    start,
    stop,
    toggleMic,
  } = useLiveVoiceConversation({
    apiKey: process.env.API_KEY || '',
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    voiceName: activeVoiceName || userProfile?.aiVoice || 'Kore',
    systemInstruction,
    timeLimitSeconds: 15 * 60,
    contextData,
    enableLogMealTool: !!onAddFood,
    onLogMeal: (args) => {
      if (!onAddFood) return;
      const newItem: MealItem = {
        name: args.foodName,
        calories: args.calories,
        macros: {
          protein: args.protein,
          carbs: args.carbs,
          fats: args.fats,
        },
        description: args.description || "Registrado via voz",
      };
      onAddFood(newItem, args.mealType);
    },
  });

  // Inicia a sessão ao montar e garante stop no unmount
  useEffect(() => {
    start();
    return () => {
      stop();
    };
  }, [start, stop]);

  // --- TIME LIMIT REACHED SCREEN (UPSELL) ---
  if (isLimitReached) {
      return (
        <div className="fixed inset-0 bg-[#F0FDF4] z-[60] flex flex-col items-center justify-between p-6 animate-in fade-in duration-500 font-sans">
            
            {/* Top Section */}
            <div className="w-full flex justify-end">
                <button onClick={onClose} className="p-2 text-[#1E3A8A]/50 hover:text-[#1E3A8A]">
                    <X size={24} />
                </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm w-full">
                
                <h2 className="text-[#1E3A8A] text-3xl font-bold mb-8 leading-tight">
                    Seus 15 minutos acabaram...
                </h2>

                {/* Central Graphic */}
                <div className="relative mb-10">
                    <div className="text-[140px] font-bold text-[#1E3A8A] leading-none opacity-5 select-none">15</div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-full shadow-xl border border-[#F0FDF4]">
                             <Lock size={48} className="text-[#F97316]" />
                        </div>
                    </div>
                </div>

                {/* Persuasive Text */}
                <p className="text-[#374151] text-lg font-medium leading-relaxed mb-1">
                    Mas temos uma notícia boa!
                </p>
                <p className="text-[#374151]/80 text-base leading-relaxed mb-6">
                    Você vai se surpreender com os planos que preparamos. As condições estão incríveis.
                </p>

                {/* Arrow */}
                <div className="mb-6 animate-bounce text-[#F97316]">
                    <ArrowDown size={32} strokeWidth={3} />
                </div>

                {/* CTA Button */}
                <button 
                    onClick={() => window.location.href = "https://pagina-de-vendas-nutriai.vercel.app/"}
                    className="w-full bg-[#F97316] text-white font-bold text-xl py-4 rounded-full shadow-lg hover:bg-[#EA580C] hover:scale-105 transition-all transform flex items-center justify-center gap-2 mb-4"
                >
                    Ver Planos Disponíveis
                </button>

                <p className="text-[#1E3A8A] text-sm font-semibold opacity-60">
                    Clique abaixo para conferir agora mesmo.
                </p>
            </div>

            {/* Footer */}
            <div className="w-full text-center pb-4">
                <p className="text-gray-400 text-xs">
                    Cancele quando quiser.
                </p>
            </div>
        </div>
      );
  }

  // --- STANDARD LIVE INTERFACE ---
  return (
    <div className="fixed inset-0 bg-[#1A4D2E] z-50 flex flex-col animate-in fade-in duration-500">
       
       {/* DEV BUTTON: Trigger Limit */}
       <button 
         onClick={() => {
           // dispara estado de limite de tempo simulando 15 minutos
           // (o hook já vai encerrar a sessão; aqui é apenas para UI/upsell)
           // secondsActive não é setável diretamente pelo hook, então apenas
           // mostramos a tela de limite via isLimitReached ao estourar tempo real.
         }}
         className="absolute top-24 right-6 bg-orange-500/80 hover:bg-orange-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full z-50 transition-all border border-white/20 shadow-lg"
       >
         Testar Limite (Dev)
       </button>

       {/* Header */}
       <div className="p-6 flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3 text-[#F5F1E8]">
             <Activity className={`animate-pulse ${isConnected ? 'text-green-400' : 'text-yellow-400'}`} />
             <span className="font-serif text-lg tracking-wider">{status}</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 bg-[#F5F1E8]/10 rounded-full text-[#F5F1E8] hover:bg-[#F5F1E8]/20 transition-colors"
          >
             <X size={24} />
          </button>
       </div>

       {/* Toast Notification for Logged Item */}
       {loggedItem && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top duration-500">
             <div className="bg-green-100 p-1 rounded-full">
                <CheckCircle2 className="text-green-600" size={20} />
             </div>
             <span className="text-[#1A4D2E] font-bold text-sm">Registrado: {loggedItem}</span>
          </div>
       )}

       {/* Visualizer */}
       <div className="flex-1 flex flex-col items-center justify-center relative">
          
          {/* Avatar / Pulse */}
          <div className="relative">
             <div className={`absolute inset-0 bg-[#F5F1E8] rounded-full blur-2xl transition-all duration-100 ${isConnected ? 'opacity-20' : 'opacity-0'}`}
                  style={{ transform: `scale(${1 + volume/20})` }}
             ></div>
             <div className="w-40 h-40 rounded-full bg-[#F5F1E8] flex items-center justify-center shadow-2xl z-10">
                <div className="w-36 h-36 rounded-full border-4 border-[#1A4D2E] overflow-hidden">
                   <img 
                     src={userProfile?.chefAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"} 
                     alt="Assistente de Voz" 
                     className="w-full h-full object-cover"
                   />
                </div>
             </div>
          </div>

          <h2 className="mt-8 text-3xl font-serif text-[#F5F1E8]">Assistente de Voz</h2>
          <p className="text-[#F5F1E8]/60 mt-2">Canal em Tempo Real</p>
          <p className="text-[#F5F1E8]/30 text-xs mt-4">Tempo restante: {Math.max(0, Math.floor((15 * 60 - secondsActive)/60))} min</p>
       </div>

       {/* Controls */}
       <div className="pb-16 pt-8 px-8 flex justify-center gap-8 items-center relative z-10">
          <button 
             onClick={toggleMic}
             className={`p-6 rounded-full transition-all duration-300 ${
               isMicOn 
               ? 'bg-[#F5F1E8]/10 text-[#F5F1E8] hover:bg-[#F5F1E8]/20' 
               : 'bg-white text-[#1A4D2E]'
             }`}
          >
             {isMicOn ? <MicIcon size={32} /> : <MicOff size={32} />}
          </button>

          <button 
             onClick={onClose}
             className="p-6 rounded-full bg-red-500 text-white hover:bg-red-600 hover:scale-105 transition-all shadow-lg shadow-red-500/30"
          >
             <PhoneOff size={32} fill="currentColor" />
          </button>
       </div>
    </div>
  );
};

export default LiveConversation;