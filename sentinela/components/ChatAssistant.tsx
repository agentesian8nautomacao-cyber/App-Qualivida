

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Loader2, AudioLines, Package, Users, AlertTriangle, FileText, Gavel, Scale, Bot, Plus, CheckSquare, RefreshCcw, Settings2, UserCircle2 } from 'lucide-react';
import { ChatMessage, UserProfile, OccurrenceItem, UserRole, Task } from '../types';
import { chatWithConcierge } from '../services/geminiService';
import TaskCreator from './TaskCreator';

interface ChatAssistantProps {
  onClose?: () => void;
  onLiveCall?: () => void;
  onSettings?: () => void;
  userProfile?: UserProfile | null;
  occurrences?: OccurrenceItem[];
  onAddOccurrence?: (item: OccurrenceItem) => void;
  isFullScreen?: boolean;
  externalMessages?: ChatMessage[]; // New Prop for Integration
}

// --- CONFIGURATION PER ROLE (STRATEGY PATTERN) ---
const ROLE_CONFIG = {
    [UserRole.Manager]: {
        theme: {
            accentText: 'text-amber-500',
            accentBg: 'bg-amber-500',
            accentBorder: 'border-amber-500/20',
            fabColor: 'bg-amber-500 text-black hover:bg-amber-400',
            userMessageBg: 'bg-amber-500/10'
        },
        labels: {
            module: "Módulo Síndico",
            placeholder: "Digite sua solicitação administrativa..."
        },
        quickActions: [
            { text: "Redigir uma circular formal sobre: ", label: "Nova Circular", icon: FileText, color: "text-amber-100 bg-[#18181B] border-amber-500/20" },
            { text: "Com base no Regimento, é permitido: ", label: "Consultar Regra", icon: Scale, color: "text-amber-100 bg-[#18181B] border-amber-500/20" },
            { text: "Gerar uma notificação de advertência para a unidade: ", label: "Gerar Advertência", icon: Gavel, color: "text-amber-100 bg-[#18181B] border-amber-500/20" }
        ]
    },
    [UserRole.Doorman]: {
        theme: {
            accentText: 'text-white', // Defaulting to white for cleaner doorman look
            accentBg: 'bg-white',
            accentBorder: 'border-white/20',
            fabColor: 'bg-emerald-500 text-black hover:bg-emerald-400',
            userMessageBg: 'bg-white'
        },
        labels: {
            module: "Módulo Portaria",
            placeholder: "Descreva a ocorrência..."
        },
        quickActions: [
            { text: "Registrar Visitante: ", label: "Visitante", icon: Users, color: "text-zinc-300 bg-[#18181B] border-white/5" },
            { text: "Chegou Encomenda para: ", label: "Encomenda", icon: Package, color: "text-zinc-300 bg-[#18181B] border-white/5" },
            { text: "Redigir comunicado rápido sobre: ", label: "Aviso Geral", icon: AlertTriangle, color: "text-zinc-300 bg-[#18181B] border-white/5" }
        ]
    },
    [UserRole.Resident]: { // Fallback/Future
         theme: { accentText: 'text-blue-500', accentBg: 'bg-blue-500', accentBorder: 'border-blue-500', fabColor: 'bg-blue-500', userMessageBg: 'bg-blue-500' },
         labels: { module: "Morador", placeholder: "Como posso ajudar?" },
         quickActions: []
    }
};

const formatText = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user' && !message.isExternal;
  const isExternal = message.isExternal;

  // 1. External User Message (Left, Distinct Color)
  if (isExternal) {
      return (
        <div className="flex justify-start animate-in slide-in-from-left fade-in duration-300 mb-6">
            <div className="flex items-end gap-2 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white mb-2 shadow-lg">
                    <UserCircle2 size={16} />
                </div>
                <div className="bg-[#1e293b] border border-blue-500/30 text-zinc-100 px-6 py-4 rounded-[2rem] rounded-bl-sm shadow-md">
                    <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">
                        {message.senderName || "Morador"}
                    </div>
                    <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{message.text}</p>
                </div>
            </div>
        </div>
      );
  }

  // 2. Local User Message (Right, White/Accent)
  if (isUser) {
    return (
       <div className="flex justify-end animate-in slide-in-from-right fade-in duration-300 mb-6">
          <div className="max-w-[85%] bg-white text-black px-6 py-4 rounded-[2rem] rounded-tr-sm shadow-glow">
             <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{message.text}</p>
          </div>
       </div>
    );
  }

  // 3. System/Task Messages (Model)
  
  // Check for Task Confirmation Block (starts with [TASK])
  if (message.text.startsWith('[TASK]')) {
      const taskData = JSON.parse(message.text.replace('[TASK]', ''));
      return (
        <div className="flex justify-start animate-in slide-in-from-left fade-in duration-300 mb-6">
            <div className="w-[90%] bg-[#18181B] border border-white/10 p-5 rounded-[2rem] rounded-tl-none relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1 h-full ${taskData.priority === 'urgent' ? 'bg-red-500' : taskData.priority === 'high' ? 'bg-orange-500' : 'bg-blue-500'}`}></div>
                
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-white/5 rounded-full text-zinc-300"><CheckSquare size={16} /></div>
                    <span className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Nova Demanda Criada</span>
                </div>
                
                <h3 className="text-lg font-serif text-white mb-1">{taskData.title}</h3>
                <p className="text-sm text-zinc-400 mb-4 line-clamp-2">{taskData.description}</p>
                
                <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-white/5 rounded-lg text-[10px] text-zinc-400 uppercase font-bold border border-white/5">
                        {taskData.category}
                    </span>
                    <span className="px-2 py-1 bg-white/5 rounded-lg text-[10px] text-zinc-400 uppercase font-bold border border-white/5">
                        Prazo: {taskData.deadline}
                    </span>
                </div>
            </div>
        </div>
      );
  }

  const isLogConfirmation = message.text.includes("Evento registrado") || 
                            message.text.includes("Ocorrência registrada") ||
                            message.text.includes("registrado com sucesso");

  if (isLogConfirmation) {
     return (
        <div className="flex justify-start animate-in slide-in-from-left fade-in duration-300 mb-6">
            <div className="max-w-[90%] bg-[#18181B] border border-green-500/30 p-5 rounded-[2rem] rounded-tl-none">
                <div className="flex items-center gap-2 mb-2 text-green-400">
                    <div className="p-1 bg-green-500/20 rounded-full"><Users size={14}/></div>
                    <span className="text-xs font-bold uppercase tracking-wider">Ação Confirmada</span>
                </div>
                <p className="text-zinc-300 text-sm leading-relaxed">{formatText(message.text)}</p>
            </div>
        </div>
     );
  }

  // Standard Parsing for Model Text
  const lines = message.text.split('\n');
  const blocks: any[] = [];
  let currentList: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent = "";

  lines.forEach((line) => {
    const trimmed = line.trim();
    
    // Handle Code Blocks (often used for document drafts)
    if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
             blocks.push({ type: 'document', content: codeBlockContent });
             codeBlockContent = "";
             inCodeBlock = false;
        } else {
            inCodeBlock = true;
        }
        return;
    }
    if (inCodeBlock) {
        codeBlockContent += line + "\n";
        return;
    }

    if (trimmed.startsWith('##') || trimmed.startsWith('#')) {
        if (currentList.length) {
            blocks.push({ type: 'list', items: [...currentList] });
            currentList = [];
        }
        blocks.push({ type: 'header', content: trimmed.replace(/^#+\s*/, '') });
    }
    else if (trimmed.startsWith('>')) {
         blocks.push({ type: 'quote', content: trimmed.replace(/^>\s*/, '') });
    }
    else if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\./.test(trimmed)) {
        const content = trimmed.replace(/^[-*]|\d+\.\s*/, '').trim();
        currentList.push(content);
    } 
    else {
        if (currentList.length) {
            blocks.push({ type: 'list', items: [...currentList] });
            currentList = [];
        }
        if (trimmed) blocks.push({ type: 'paragraph', content: trimmed });
    }
  });
  if (currentList.length) blocks.push({ type: 'list', items: [...currentList] });
  if (codeBlockContent) blocks.push({ type: 'document', content: codeBlockContent });

  return (
    <div className="flex justify-start animate-in slide-in-from-left fade-in duration-300 mb-6">
       <div className="max-w-[95%] md:max-w-[85%] text-zinc-300 rounded-[2rem] rounded-tl-none overflow-hidden">
          {blocks.map((block, i) => {
             if (block.type === 'header') {
                return (
                    <div key={i} className="mb-3 mt-4 first:mt-0">
                        <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                           {block.content}
                        </h3>
                    </div>
                );
             }
             if (block.type === 'quote') {
                 return (
                     <div key={i} className="my-3 p-4 bg-[#18181B] border-l-2 border-white/20 rounded-r-xl">
                         <p className="text-sm italic text-zinc-400">{formatText(block.content)}</p>
                     </div>
                 )
             }
             if (block.type === 'document') {
                return (
                    <div key={i} className="my-3 p-5 bg-[#18181B] border border-white/10 rounded-xl relative group">
                        <div className="absolute top-2 right-2 opacity-50 text-[10px] uppercase font-bold text-zinc-500">Documento</div>
                        <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">{block.content}</pre>
                        <button 
                            onClick={() => navigator.clipboard.writeText(block.content)}
                            className="mt-3 text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                            <FileText size={12}/> Copiar Texto
                        </button>
                    </div>
                )
             }
             if (block.type === 'list') {
                return (
                    <div key={i} className="space-y-2 mb-3 pl-2 border-l border-zinc-800">
                        {block.items.map((item: string, j: number) => (
                            <div key={j} className="flex gap-3 items-start">
                                <div className="mt-1.5 min-w-[6px] h-[6px] rounded-full bg-zinc-500"></div>
                                <span className="text-sm text-zinc-300 leading-relaxed">{formatText(item)}</span>
                            </div>
                        ))}
                    </div>
                );
             }
             return (
                 <div key={i} className="mb-2">
                    <p className="text-sm leading-7 text-zinc-300">{formatText(block.content)}</p>
                 </div>
             );
          })}
       </div>
    </div>
  );
};

const ChatAssistant: React.FC<ChatAssistantProps> = ({ onClose, onLiveCall, onSettings, userProfile, occurrences, onAddOccurrence, isFullScreen, externalMessages }) => {
  const [input, setInput] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [isTaskCreatorOpen, setIsTaskCreatorOpen] = useState(false);
  
  // Determine Role Config
  const role = userProfile?.role || UserRole.Doorman;
  const config = ROLE_CONFIG[role];
  const isManager = role === UserRole.Manager;

  const assistantName = isManager ? userProfile?.managerConfig?.assistantName : userProfile?.doormanConfig?.assistantName;
  const assistantAvatar = isManager ? userProfile?.managerConfig?.assistantAvatar : userProfile?.doormanConfig?.assistantAvatar;

  // Merge Local and External Messages for display & context
  const allMessages = useMemo(() => {
     const combined = [...localMessages, ...(externalMessages || [])];
     return combined.sort((a, b) => a.timestamp - b.timestamp);
  }, [localMessages, externalMessages]);

  // Initial Greeting Effect based on Role
  useEffect(() => {
    if (localMessages.length === 0) {
        const greeting = isManager 
            ? `Olá, Síndico(a) ${userProfile?.name?.split(' ')[0]}.\n\nSou ${assistantName}, seu assistente administrativo. Como posso ajudar na gestão hoje?`
            : `Olá, ${userProfile?.name?.split(' ')[0]}.\n\nSou ${assistantName}, o assistente de portaria. Posso registrar visitantes, encomendas ou ocorrências.`;
            
        setLocalMessages([{ 
            id: '1', 
            role: 'model', 
            text: greeting, 
            timestamp: Date.now() 
        }]);
    }
  }, [userProfile?.role]); // Re-run if role changes

  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [allMessages]); // Scroll on any new message (local or external)

  const handleReset = () => {
    if (confirm("Limpar histórico de conversa?")) {
        setLocalMessages([]); // Will trigger useEffect to reset greeting
    }
  };

  const handleQuickAction = (text: string) => {
      setInput(text);
  };

  const handleTaskCreated = (task: Task) => {
      // 1. Add System Message for User
      setLocalMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'user',
          text: isManager ? `Criei uma tarefa de delegação: ${task.title}` : `Novo lembrete registrado: ${task.title}`,
          timestamp: Date.now()
      }]);

      // 2. Add Model Response with Task Card
      setTimeout(() => {
          setLocalMessages(prev => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'model',
              text: `[TASK]${JSON.stringify(task)}`,
              timestamp: Date.now()
          }]);
      }, 500);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setLocalMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // We pass the Full Hybrid History to the AI service
      const responseText = await chatWithConcierge(
        allMessages, 
        userMsg.text,
        { profile: userProfile, recentLogs: occurrences },
        {}, 
        (data) => { 
             if(onAddOccurrence) {
                 onAddOccurrence(data);
             }
        }
      );

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setLocalMessages(prev => [...prev, botMsg]);
    } catch (error) {
       const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Sem sinal da central. Tente novamente.",
        timestamp: Date.now()
      };
      setLocalMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 bg-[#09090b] z-50 flex flex-col ${isFullScreen ? '' : 'animate-in slide-in-from-bottom duration-300'}`}>
      
      <TaskCreator 
         isOpen={isTaskCreatorOpen}
         onClose={() => setIsTaskCreatorOpen(false)}
         userRole={userProfile?.role || UserRole.Doorman}
         onSave={handleTaskCreated}
      />

      {/* Header - Adaptive Style */}
      <div className={`bg-[#09090b]/80 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-10 border-b ${config.theme.accentBorder}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full border overflow-hidden flex items-center justify-center bg-zinc-900 relative ${isManager ? 'border-amber-500 text-amber-500' : 'border-zinc-700 text-white'}`}>
            {assistantAvatar ? (
                <img src={assistantAvatar} className="w-full h-full object-cover" alt="AI" />
            ) : (
                <Bot size={20} />
            )}
          </div>
          <div>
              <h3 className={`font-serif text-lg tracking-wide leading-none ${config.theme.accentText}`}>{assistantName}</h3>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{config.labels.module}</span>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
            <button 
                onClick={onLiveCall}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 text-white hover:bg-white hover:text-black transition-all border border-white/10"
                title="Rádio / Voz"
            >
                <AudioLines size={18} />
            </button>
            
            <button onClick={handleReset} className="text-zinc-500 hover:text-white transition-colors">
                <RefreshCcw size={18} />
            </button>
            <button onClick={onSettings} className="text-zinc-500 hover:text-white transition-colors">
                <Settings2 size={18} />
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-[#09090b]">
        {allMessages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
             <div className="flex items-center gap-2 text-zinc-500 text-sm pl-2">
                <Loader2 className="animate-spin" size={14} />
                <span>{isManager ? "Redigindo..." : "Consultando..."}</span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* FAB - Floating Action Button for Task Creation */}
      <div className="absolute bottom-28 right-6 z-20">
          <button 
             onClick={() => setIsTaskCreatorOpen(true)}
             className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${config.theme.fabColor}`}
          >
              <Plus size={28} />
          </button>
      </div>

      {/* Input Area & Quick Actions */}
      <div className="p-4 bg-[#09090b]">
        
        {/* Quick Actions - ROLE BASED */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-2 no-scrollbar px-2">
            {config.quickActions.map((action, idx) => {
                const Icon = action.icon;
                return (
                    <button 
                        key={idx} 
                        onClick={() => handleQuickAction(action.text)} 
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors hover:brightness-125 ${action.color}`}
                    >
                        <Icon size={12} /> {action.label}
                    </button>
                );
            })}
        </div>

        <div className="flex items-end gap-3 max-w-2xl mx-auto">
            <div className={`flex-1 bg-[#18181B] rounded-[1.5rem] px-5 py-3 border transition-colors shadow-lg shadow-black/50 ${config.theme.accentBorder}`}>
                <textarea 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    placeholder={config.labels.placeholder}
                    rows={1}
                    className="w-full bg-transparent outline-none text-white placeholder:text-zinc-600 font-medium text-base resize-none max-h-32"
                    style={{ minHeight: '24px' }}
                />
            </div>
          
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0 ${
              input.trim() 
              ? config.theme.fabColor
              : 'bg-zinc-800 text-zinc-500'
            }`}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;
