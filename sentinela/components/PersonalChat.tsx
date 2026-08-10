
import React, { useState, useRef, useEffect } from 'react';
import { Send, Camera, User, ArrowLeft, MoreVertical, Paperclip, CheckCircle2, AlertCircle, TrendingUp, Scale, Utensils } from 'lucide-react';
import { ChatMessage, UserProfile, LogItem, WellnessState } from '../types';
import { chatWithPersonalTrainer } from '../services/geminiService';

interface PersonalChatProps {
  userProfile?: UserProfile | null;
  dailyLog?: LogItem[];
  wellness?: WellnessState;
  onBack: () => void;
}

const PersonalChat: React.FC<PersonalChatProps> = ({ userProfile, dailyLog, wellness, onBack }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
        id: '1', 
        role: 'model', 
        text: 'Fala! 👊\nTô de olho no seu progresso essa semana.\n\nLembra da nossa missão: **Zero Álcool e 3L de Água**.\n\nJá fez alguma refeição hoje? Manda o diário pra eu ver.', 
        timestamp: Date.now() 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string = input, attachment?: {data: string, mimeType: string}) => {
    if ((!text.trim() && !attachment) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      image: attachment ? `data:${attachment.mimeType};base64,${attachment.data}` : undefined,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Filter out system event messages from history if needed, or pass them as text context
      const history = messages
        .filter(m => !m.isSystemEvent)
        .map(m => ({
            role: m.role,
            parts: [{ text: m.text }] // Simplified for history
        }));

      const responseText = await chatWithPersonalTrainer(
        history, 
        text,
        userProfile,
        dailyLog,
        attachment
      );

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
       console.error(error);
       const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Opa, deu um erro na conexão aqui. Tenta mandar de novo.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareLog = () => {
      // Create a visual "System Card" in the chat
      const calories = dailyLog?.reduce((acc, item) => acc + item.calories, 0) || 0;
      const protein = dailyLog?.reduce((acc, item) => acc + item.macros.protein, 0) || 0;
      
      const summaryText = `📅 **Diário Compartilhado**\nCalorias: ${calories} kcal\nProteína: ${protein}g\nItens: ${dailyLog?.length || 0}`;
      
      // We send a specific prompt to the AI hiddenly or explicitly
      handleSend("Acabei de enviar meu resumo do diário. Analisa aí, Coach.");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const base64String = event.target?.result as string;
              const base64Data = base64String.split(',')[1];
              handleSend("Dá uma olhada nisso, Coach.", { data: base64Data, mimeType: file.type });
          };
          reader.readAsDataURL(file);
      }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F0F2F5]">
      
      {/* Header (Human Style) */}
      <div className="bg-[#1A4D2E] text-white p-4 pt-6 flex items-center justify-between shadow-md relative z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full">
             <ArrowLeft size={24} />
          </button>
          <div className="w-10 h-10 rounded-full bg-white border-2 border-green-400 overflow-hidden">
             {/* Coach Avatar */}
             <img src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=200&q=80" className="w-full h-full object-cover" />
          </div>
          <div>
             <h3 className="font-bold text-base leading-tight">Coach Bruno</h3>
             <span className="text-xs text-green-300 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span> Online agora
             </span>
          </div>
        </div>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 hover:bg-white/10 rounded-full">
            <MoreVertical size={20} />
        </button>
      </div>

      {/* Fixed Mission Card */}
      <div className="bg-white border-b border-gray-200 p-3 flex items-center justify-between shadow-sm relative z-0">
         <div className="flex items-center gap-3">
             <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                 <CheckCircle2 size={18} />
             </div>
             <div>
                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Missão da Semana</p>
                 <p className="text-xs font-bold text-[#1A4D2E]">Zero Álcool & 3L Água</p>
             </div>
         </div>
         <div className="flex items-center gap-2">
             <div className="text-right">
                 <p className="text-[10px] text-gray-400">Progresso Água</p>
                 <p className="text-xs font-bold text-blue-600">{wellness?.waterGlasses || 0}/12 copos</p>
             </div>
         </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#E5DDD5]">
         {/* Date Divider */}
         <div className="flex justify-center my-4">
             <span className="bg-[#DCF8C6] text-gray-600 text-xs px-3 py-1 rounded-lg shadow-sm border border-[#C5E1A5]">
                 Hoje
             </span>
         </div>

         {messages.map((msg) => {
             const isMe = msg.role === 'user';
             return (
                 <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                     <div 
                        className={`max-w-[80%] p-3 rounded-lg shadow-sm relative ${
                            isMe 
                            ? 'bg-[#DCF8C6] text-gray-800 rounded-tr-none' 
                            : 'bg-white text-gray-800 rounded-tl-none'
                        }`}
                     >
                         {/* Name Label for Coach */}
                         {!isMe && <p className="text-[10px] font-bold text-orange-600 mb-1">Bruno (Coach)</p>}
                         
                         {/* Image Content */}
                         {msg.image && (
                             <div className="mb-2 rounded-lg overflow-hidden border border-gray-200">
                                 <img src={msg.image} alt="Enviado" className="w-full h-auto max-h-60 object-cover" />
                             </div>
                         )}

                         {/* Text Content */}
                         <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {msg.text}
                         </p>

                         {/* Timestamp */}
                         <div className="flex justify-end mt-1">
                             <span className="text-[10px] text-gray-400">
                                 {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 {isMe && <span className="ml-1 text-blue-400">✓✓</span>}
                             </span>
                         </div>
                     </div>
                 </div>
             );
         })}
         
         {isLoading && (
             <div className="flex justify-start">
                 <div className="bg-white p-3 rounded-lg rounded-tl-none shadow-sm flex items-center gap-2">
                    <p className="text-[10px] font-bold text-orange-600">Bruno (Coach)</p>
                    <span className="text-xs text-gray-500 italic">gravando áudio...</span>
                 </div>
             </div>
         )}
         <div ref={messagesEndRef} />
      </div>

      {/* Action Bar */}
      <div className="bg-[#F0F2F5] p-2 flex gap-2 overflow-x-auto no-scrollbar border-t border-gray-200">
          <button 
            onClick={handleShareLog}
            className="flex items-center gap-1 bg-white border border-gray-300 rounded-full px-3 py-1.5 text-xs font-bold text-gray-600 whitespace-nowrap active:scale-95"
          >
              <Utensils size={14} className="text-orange-500" /> Enviar Diário
          </button>
          <button className="flex items-center gap-1 bg-white border border-gray-300 rounded-full px-3 py-1.5 text-xs font-bold text-gray-600 whitespace-nowrap active:scale-95">
              <Scale size={14} className="text-blue-500" /> Atualizar Peso
          </button>
          <button className="flex items-center gap-1 bg-white border border-gray-300 rounded-full px-3 py-1.5 text-xs font-bold text-gray-600 whitespace-nowrap active:scale-95">
              <TrendingUp size={14} className="text-green-500" /> Foto Físico
          </button>
      </div>

      {/* Input Area */}
      <div className="p-2 pb-4 bg-[#F0F2F5] flex items-end gap-2">
         <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-white text-gray-500 rounded-full shadow-sm hover:bg-gray-100 mb-1">
             <Camera size={20} />
         </button>
         <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

         <div className="flex-1 bg-white rounded-[1.5rem] px-4 py-2 shadow-sm border border-gray-200 flex items-center">
             <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Mensagem"
                className="w-full bg-transparent outline-none text-sm resize-none max-h-24 py-2"
                rows={1}
                onKeyDown={(e) => {
                    if(e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
             />
         </div>
         
         <button 
            onClick={() => handleSend()}
            disabled={!input.trim() && !isLoading}
            className={`p-3 rounded-full shadow-md mb-1 transition-all ${input.trim() ? 'bg-[#1A4D2E] text-white hover:scale-105' : 'bg-gray-200 text-gray-400'}`}
         >
             <Send size={20} />
         </button>
      </div>
    </div>
  );
};

export default PersonalChat;
