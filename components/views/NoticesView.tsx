
import React, { useRef } from 'react';
import { Pin, Crown, BadgeInfo, Check, CheckCheck, MessageSquareText, ChevronUp, X, Paperclip, SendHorizontal, RefreshCw, Trash2, Plus, Edit2, Trash2 as TrashIcon, Phone } from 'lucide-react';
import { Notice, ChatMessage, UserRole } from '../../types';

interface NoticesViewProps {
  filteredNotices: Notice[];
  setNoticeFilter: (filter: 'all' | 'urgent' | 'unread') => void;
  noticeFilter: 'all' | 'urgent' | 'unread';
  activeNoticeTab: 'wall' | 'chat';
  setActiveNoticeTab: (tab: 'wall' | 'chat') => void;
  isChatOpen: boolean;
  setIsChatOpen: (val: boolean) => void;
  chatMessages: ChatMessage[];
  role: UserRole;
  chatInput: string;
  setChatInput: (val: string) => void;
  handleSendChatMessage: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
  handleAcknowledgeNotice: (id: string) => void;
  onRefreshChat?: () => void;
  onClearChat?: () => void;
  /** Portaria e Síndico: adicionar novo aviso */
  onAddNotice?: () => void;
  /** Portaria e Síndico: editar aviso */
  onEditNotice?: (notice: Notice) => void;
  /** Portaria e Síndico: excluir aviso por id */
  onDeleteNotice?: (id: string) => void;
  /** Abre a tela de chamada de voz ao vivo (LiveConversation). O componente não processa áudio. */
  onLiveCall?: () => void;
}

const NoticesView: React.FC<NoticesViewProps> = ({
  filteredNotices,
  setNoticeFilter,
  noticeFilter,
  activeNoticeTab,
  setActiveNoticeTab,
  isChatOpen,
  setIsChatOpen,
  chatMessages,
  role,
  chatInput,
  setChatInput,
  handleSendChatMessage,
  chatEndRef,
  handleAcknowledgeNotice,
  onRefreshChat,
  onClearChat,
  onAddNotice,
  onEditNotice,
  onDeleteNotice,
  onLiveCall
}) => {
  const canManageNotices = (role === 'PORTEIRO' || role === 'SINDICO') && (onAddNotice != null || onEditNotice != null || onDeleteNotice != null);
  const lastMessage = chatMessages[chatMessages.length - 1];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const suffix = chatInput.trim() ? ` [Anexo: ${file.name}]` : `[Anexo: ${file.name}]`;
    setChatInput(chatInput.trim() ? chatInput + suffix : suffix);
    e.target.value = '';
  };

  return (
    <div className="relative h-[calc(100vh-140px)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500 overflow-hidden">
      
      {/* Header Mobile Switcher (Hidden in Desktop due to Glass Bottom Sheet design, but kept for fallback) */}
      <div className="md:hidden flex justify-center mb-4 hidden">
         <div className="bg-white/5 p-1 rounded-full flex">
            <button 
              onClick={() => setActiveNoticeTab('wall')}
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeNoticeTab === 'wall' ? 'bg-white text-black' : 'text-zinc-500'}`}
            >
               Mural
            </button>
            <button 
              onClick={() => setActiveNoticeTab('chat')}
              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activeNoticeTab === 'chat' ? 'bg-white text-black' : 'text-zinc-500'}`}
            >
               Chat
            </button>
         </div>
      </div>

      {/* COLUNA ESQUERDA: MURAL DE VIDRO (MASONRY) */}
      <div className="flex-1 flex flex-col min-h-0 relative">
         {/* Overlay Escuro para Mobile quando Chat está Aberto */}
         <div 
            className={`absolute inset-0 backdrop-blur-sm z-40 transition-opacity duration-500 md:hidden ${isChatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
            onClick={() => setIsChatOpen(false)}
         />

         <div className="flex justify-between items-end mb-6 pb-6 border-b border-[var(--border-color)] flex-shrink-0 flex-wrap gap-3">
            <div>
               <h3 className="text-3xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>Mural Digital</h3>
               <p className="text-[10px] font-bold uppercase tracking-[0.3em] mt-1" style={{ color: 'var(--text-secondary)' }}>Avisos & Comunicados</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
               {canManageNotices && onAddNotice && (
                  <button
                     type="button"
                     onClick={onAddNotice}
                     className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 bg-green-600 text-white border-green-600 hover:bg-green-500 hover:border-green-500"
                  >
                     <Plus className="w-4 h-4" /> Adicionar aviso
                  </button>
               )}
               {['all', 'urgent', 'unread'].map(f => (
                  <button
                     key={f}
                     onClick={() => setNoticeFilter(f as any)}
                     className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                        noticeFilter === f 
                           ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]' 
                           : 'bg-[var(--glass-bg)] text-[var(--text-secondary)] border-[var(--border-color)] hover:border-[var(--text-primary)]/50'
                     }`}
                  >
                     {f === 'all' ? 'Todos' : f === 'urgent' ? 'Urgentes' : 'Não Lidos'}
                  </button>
               ))}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-32 md:pb-20">
            <div className="columns-1 lg:columns-2 gap-6 space-y-6">
               {filteredNotices.map((notice) => {
                  const isSindico = notice.authorRole === 'SINDICO';
                  const isMorador = notice.authorRole === 'MORADOR';
                  const roleLabel = isSindico ? 'Administração' : isMorador ? 'Morador' : 'Operacional';
                  const roleStyles = isSindico
                     ? { bg: 'bg-amber-500/10 dark:bg-amber-950/10 border-amber-500/40', stripe: 'from-amber-400 via-yellow-200 to-amber-600', icon: 'bg-amber-500/10 text-amber-400', label: 'text-amber-600 dark:text-amber-500', btn: 'bg-amber-500 text-white hover:bg-amber-400 dark:text-black dark:hover:bg-amber-400' }
                     : isMorador
                        ? { bg: 'bg-emerald-500/10 dark:bg-emerald-950/10 border-emerald-500/40', stripe: 'from-emerald-400 via-green-200 to-emerald-600', icon: 'bg-emerald-500/10 text-emerald-400', label: 'text-emerald-600 dark:text-emerald-500', btn: 'bg-emerald-500 text-white hover:bg-emerald-400 dark:text-black dark:hover:bg-emerald-400' }
                        : { bg: 'bg-cyan-500/10 dark:bg-cyan-950/10 border-cyan-500/40', stripe: 'from-cyan-400 via-blue-200 to-cyan-600', icon: 'bg-cyan-500/10 text-cyan-400', label: 'text-cyan-600 dark:text-cyan-500', btn: 'bg-cyan-500 text-white hover:bg-cyan-400 dark:text-black dark:hover:bg-cyan-400' };
                  
                  return (
                     <div 
                        key={notice.id}
                        className={`break-inside-avoid relative overflow-hidden rounded-[32px] border backdrop-blur-xl transition-all duration-500 hover:-translate-y-1 shadow-2xl group ${roleStyles.bg} ${notice.read ? 'opacity-60 grayscale-[0.3]' : 'opacity-100'}`}
                        style={{ backgroundColor: isSindico ? 'rgba(245, 158, 11, 0.1)' : isMorador ? 'rgba(16, 185, 129, 0.1)' : 'rgba(6, 182, 212, 0.1)' }}
                     >
                        {/* Role Indicator Stripe */}
                        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${roleStyles.stripe} opacity-80`} />

                        {/* Top-right: Pinned + Editar/Excluir (Portaria e Síndico) */}
                        <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
                           {notice.pinned && (
                              <div className="rotate-45" style={{ color: 'var(--text-primary)' }}>
                                 <Pin className="w-5 h-5" style={{ fill: 'currentColor' }} />
                              </div>
                           )}
                           {canManageNotices && onEditNotice && (
                              <button
                                 type="button"
                                 onClick={(e) => { e.stopPropagation(); onEditNotice(notice); }}
                                 className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
                                 style={{ color: 'var(--text-primary)' }}
                                 title="Editar aviso"
                              >
                                 <Edit2 className="w-4 h-4" />
                              </button>
                           )}
                           {canManageNotices && onDeleteNotice && (
                              <button
                                 type="button"
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Excluir este aviso? A ação não pode ser desfeita.')) onDeleteNotice(notice.id);
                                 }}
                                 className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors text-red-400"
                                 title="Excluir aviso"
                              >
                                 <TrashIcon className="w-4 h-4" />
                              </button>
                           )}
                        </div>

                        <div className="p-8">
                           <div className="flex items-center gap-3 mb-6">
                              <div className={`p-2 rounded-xl ${roleStyles.icon}`}>
                                 {isSindico ? <Crown className="w-4 h-4" /> : <BadgeInfo className="w-4 h-4" />}
                              </div>
                              <div>
                                 <span className={`text-[9px] font-black uppercase tracking-widest block ${roleStyles.label}`}>
                                    {roleLabel}
                                 </span>
                                 <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-secondary)' }}>{notice.author} • {new Date(notice.date).toLocaleDateString()}</span>
                              </div>
                           </div>

                           <h4 className="text-2xl font-black uppercase leading-tight mb-4" style={{ color: 'var(--text-primary)' }}>{notice.title}</h4>
                           {notice.imageUrl && (
                              <div className="rounded-xl overflow-hidden mb-4 border" style={{ borderColor: 'var(--border-color)' }}>
                                 <img src={notice.imageUrl} alt="" className="w-full h-auto max-h-48 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              </div>
                           )}
                           <p className="text-sm font-medium leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>{notice.content}</p>

                           <button 
                              onClick={() => handleAcknowledgeNotice(notice.id)}
                              disabled={notice.read}
                              className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${
                                 notice.read 
                                    ? 'bg-[var(--glass-bg)] cursor-default border border-[var(--border-color)]' 
                                    : `hover:scale-[1.02] active:scale-95 shadow-lg ${roleStyles.btn}`
                              }`}
                              style={notice.read ? { color: 'var(--text-secondary)' } : {}}
                           >
                              {notice.read ? (
                                 <>Lido <CheckCheck className="w-4 h-4" /></>
                              ) : (
                                 <>Confirmar Leitura <Check className="w-4 h-4" /></>
                              )}
                           </button>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
      </div>

      {/* COLUNA DIREITA (DESKTOP) / BOTTOM SHEET (MOBILE): CHAT "LINHA DIRETA" — apenas Portaria e Síndico */}
      {(role === 'PORTEIRO' || role === 'SINDICO') && (
      <div 
         className={`
            flex flex-col flex-shrink-0 backdrop-blur-2xl border-[var(--border-color)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            md:relative md:h-auto md:w-[380px] lg:w-[420px] md:rounded-l-[40px] md:border-l
            absolute left-0 right-0 z-50 md:z-0
            ${isChatOpen 
               ? 'bottom-0 h-[85%] rounded-t-[32px] border-t shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)]' 
               : 'bottom-0 h-[80px] md:h-auto rounded-t-[32px] md:rounded-none border-t md:border-t-0 cursor-pointer md:cursor-default'
            }
         `}
         style={{ 
            backgroundColor: 'var(--sidebar-bg)'
         }}
         onMouseEnter={(e) => {
            if (!isChatOpen && window.innerWidth >= 768) {
               e.currentTarget.style.backgroundColor = 'var(--border-color)';
            }
         }}
         onMouseLeave={(e) => {
            if (!isChatOpen && window.innerWidth >= 768) {
               e.currentTarget.style.backgroundColor = 'var(--sidebar-bg)';
            }
         }}
         onClick={() => !isChatOpen && window.innerWidth < 768 && setIsChatOpen(true)}
      >
         {/* Mobile Handle */}
         <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={(e) => { e.stopPropagation(); setIsChatOpen(!isChatOpen); }}>
            <div className="w-12 h-1.5 rounded-full" style={{ backgroundColor: 'var(--border-color)' }} />
         </div>

         {/* Mobile Minimized Header (Peeking Bar Content) */}
         <div className={`md:hidden px-6 pb-4 flex items-center justify-between transition-opacity duration-300 ${isChatOpen ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
            <div className="flex items-center gap-3 w-full">
               <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white shadow-lg">
                     <MessageSquareText className="w-5 h-5" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 animate-pulse" style={{ borderColor: 'var(--bg-color)' }} />
               </div>
               <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-black uppercase" style={{ color: 'var(--text-primary)' }}>Linha Direta</h4>
                  <p className="text-[10px] font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{lastMessage ? lastMessage.text : 'Nenhuma mensagem'}</p>
               </div>
               <div className="animate-pulse">
                  <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
               </div>
            </div>
         </div>

         {/* Desktop Header / Expanded Mobile Header */}
         <div className={`p-6 border-b border-[var(--border-color)] flex items-center justify-between md:rounded-tl-[40px] transition-all duration-300 ${!isChatOpen ? 'hidden md:flex' : 'flex'}`} style={{ backgroundColor: 'var(--glass-bg)' }}>
            <div className="flex items-center gap-4">
               <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white shadow-lg">
                     <MessageSquareText className="w-6 h-6" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 animate-pulse" style={{ borderColor: 'var(--bg-color)' }} />
               </div>
               <div>
                  <h4 className="text-sm font-black uppercase" style={{ color: 'var(--text-primary)' }}>Linha Direta</h4>
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Online Agora</p>
               </div>
            </div>
            <div className="flex items-center gap-1">
               {onLiveCall && (
                  <button
                     type="button"
                     className="flex items-center gap-2 px-3 py-2 rounded-full transition-colors hover:bg-[var(--border-color)] font-bold text-xs uppercase tracking-wider"
                     style={{ color: 'var(--text-primary)' }}
                     onClick={(e) => { e.stopPropagation(); onLiveCall(); }}
                     title="Iniciar chamada de voz"
                  >
                     <Phone className="w-5 h-5" />
                     Iniciar chamada de voz
                  </button>
               )}
               <button
                  type="button"
                  className="p-2.5 rounded-full transition-colors hover:bg-[var(--border-color)]"
                  style={{ color: 'var(--text-secondary)' }}
                  onClick={(e) => { e.stopPropagation(); onRefreshChat?.(); }}
                  title="Atualizar mensagens"
               >
                  <RefreshCw className="w-5 h-5" />
               </button>
               <button
                  type="button"
                  className="p-2.5 rounded-full transition-colors hover:bg-[var(--border-color)]"
                  style={{ color: 'var(--text-secondary)' }}
                  onClick={(e) => { e.stopPropagation(); onClearChat?.(); }}
                  title="Apagar todas as mensagens"
               >
                  <Trash2 className="w-5 h-5" />
               </button>
               {/* Mobile Close Button */}
               <button 
                  className="md:hidden p-2 rounded-full"
                  style={{ backgroundColor: 'var(--glass-bg)', color: 'var(--text-secondary)' }}
                  onClick={(e) => { e.stopPropagation(); setIsChatOpen(false); }}
               >
                  <X className="w-5 h-5" />
               </button>
            </div>
         </div>

         {/* Messages Stream */}
         <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 ${!isChatOpen ? 'hidden md:block' : 'block'}`}>
            {chatMessages.map((msg) => {
               const isMe = msg.senderRole === role;
               const senderLabel = msg.senderRole === 'MORADOR'
                  ? 'Morador'
                  : msg.senderRole === 'SINDICO'
                     ? 'Síndico'
                     : 'Portaria';

               return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                     <div
                        className={`max-w-[85%] p-4 relative group transition-all hover:scale-[1.01] rounded-2xl ${
                           isMe
                              ? 'bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-tr-sm shadow-lg shadow-emerald-900/20'
                              : 'backdrop-blur-md rounded-tl-sm border'
                        }`}
                        style={
                           !isMe
                              ? {
                                   backgroundColor: 'var(--glass-bg)',
                                   color: 'var(--text-primary)',
                                   borderColor: 'var(--border-color)'
                                }
                              : {}
                        }
                     >
                        <div className="flex items-center justify-between mb-1">
                           <span className="text-[9px] font-black uppercase tracking-widest opacity-70">
                              {senderLabel}{isMe ? ' (Você)' : ''}
                           </span>
                        </div>
                        <p className="text-xs font-bold leading-relaxed">{msg.text}</p>
                        <div className="flex items-center justify-end gap-1 mt-2 opacity-50">
                           <span className="text-[9px] font-black uppercase">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                           </span>
                           {isMe && <CheckCheck className="w-3 h-3 text-blue-300" />}
                        </div>
                     </div>
                  </div>
               );
            })}
            <div ref={chatEndRef} />
         </div>

         {/* Input Area */}
         <div className={`p-4 border-t border-[var(--border-color)] md:rounded-bl-[40px] ${!isChatOpen ? 'hidden md:block' : 'block'}`} style={{ backgroundColor: 'var(--glass-bg)' }}>
            <input
               ref={fileInputRef}
               type="file"
               className="hidden"
               accept="*/*"
               onChange={handleFileSelect}
               aria-label="Anexar arquivo"
            />
            <div className="relative flex items-center gap-2">
               <button
                  type="button"
                  className="p-3 transition-colors rounded-full hover:bg-[var(--border-color)]"
                  style={{ color: 'var(--text-secondary)' }}
                  onClick={handleAttachClick}
                  title="Anexar arquivo"
               >
                  <Paperclip className="w-5 h-5" />
               </button>
               <div className="flex-1 relative">
                  <input 
                     type="text" 
                     value={chatInput}
                     onChange={(e) => setChatInput(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                     onFocus={() => { if(window.innerWidth < 768) setIsChatOpen(true); }}
                     placeholder="Digite sua mensagem..."
                     className="w-full rounded-full pl-5 pr-12 py-3 text-sm font-medium outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
                     style={{
                        backgroundColor: 'var(--bg-color)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)'
                     }}
                  />
                  <button 
                     onClick={handleSendChatMessage}
                     disabled={!chatInput.trim()}
                     className={`absolute right-1 top-1 p-2 rounded-full transition-all ${
                        chatInput.trim() 
                           ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95' 
                           : 'cursor-not-allowed'
                     }`}
                     style={!chatInput.trim() ? {
                        backgroundColor: 'var(--glass-bg)',
                        color: 'var(--text-secondary)'
                     } : {}}
                  >
                     <SendHorizontal className="w-4 h-4" />
                  </button>
               </div>
            </div>
         </div>
      </div>
      )}

   </div>
  );
};

export default NoticesView;
