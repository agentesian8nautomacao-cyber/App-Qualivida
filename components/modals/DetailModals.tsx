
import React from 'react';
import { X, Edit2, MessageCircle, Mail, Package as PackageIcon, CheckCircle2, Check, ShieldCheck, UserCircle, Plus, Clock, ArrowUpRight, LogOut, AlertTriangle, Save, Trash2, Bell, Camera, Image as ImageIcon } from 'lucide-react';
import { Resident, Package, VisitorLog, Occurrence, Notice } from '../../types';
import { formatUnit } from '../../utils/unitFormatter';
import { openWhatsApp } from '../../utils/phoneNormalizer';
import { useToast } from '../../contexts/ToastContext';

// --- PROFILE RESIDENTE 360 ---
export const ResidentProfileModal = ({
  resident, onClose, onEdit, onDelete, allPackages, visitorLogs, onPackageSelect, onCheckOutVisitor
}: { resident: Resident | null, onClose: () => void, onEdit?: () => void, onDelete?: () => void, allPackages: Package[], visitorLogs: VisitorLog[], onPackageSelect: (p: Package) => void, onCheckOutVisitor: (id: string) => void }) => {
  const toast = useToast();
  if (!resident) return null;
  let residentAvatar: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      residentAvatar = localStorage.getItem(`resident_avatar_${resident.id}`);
    } catch {
      residentAvatar = null;
    }
  }
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-zinc-900 text-white rounded-[32px] sm:rounded-[48px] shadow-2xl p-4 sm:p-6 md:p-8 lg:p-12 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/10">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 mb-6 sm:mb-8 md:mb-12 pb-4 sm:pb-6 md:pb-8 border-b border-white/10">
          <div className="flex items-center gap-3 sm:gap-4 md:gap-6 w-full sm:w-auto">
             <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-[24px] sm:rounded-[28px] md:rounded-[32px] bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-black shadow-lg flex-shrink-0 overflow-hidden">
                {residentAvatar ? (
                  <img
                    src={residentAvatar}
                    alt={`Foto de ${resident.name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  resident.name.substring(0, 2).toUpperCase()
                )}
             </div>
             <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight truncate">{resident.name}</h2>
                  {(onEdit != null || onDelete != null) && (
                    <div className="flex items-center gap-2">
                      {onEdit != null && (
                        <button onClick={onEdit} className="p-1.5 sm:p-2 bg-white/5 rounded-lg sm:rounded-xl hover:bg-white text-white hover:text-black transition-all flex-shrink-0" title="Editar"><Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                      )}
                      {onDelete != null && (
                        <button onClick={onDelete} className="p-1.5 sm:p-2 bg-red-500/20 text-red-400 rounded-lg sm:rounded-xl hover:bg-red-500 hover:text-white transition-all flex-shrink-0" title="Excluir morador"><Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                      )}
                    </div>
                  )}
                </div>
                <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 bg-white text-black rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest">{formatUnit(resident.unit)}</span>
                <div className="flex gap-2 sm:gap-3 mt-2 sm:mt-4">
                   {resident.whatsapp && <button onClick={() => openWhatsApp(resident.whatsapp, undefined, (error) => toast.error(`Erro ao abrir WhatsApp: ${error}`))} className="p-1.5 sm:p-2 bg-green-500/20 text-green-400 rounded-lg sm:rounded-xl hover:bg-green-500 hover:text-white transition-all flex-shrink-0" title="WhatsApp"><MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" /></button>}
                   {resident.email ? (
                     <a href={`mailto:${resident.email}`} className="p-1.5 sm:p-2 bg-white/5 rounded-lg sm:rounded-xl hover:bg-white hover:text-black transition-all flex-shrink-0 inline-flex" title="E-mail"><Mail className="w-4 h-4 sm:w-5 sm:h-5" /></a>
                   ) : (
                     <span className="p-1.5 sm:p-2 bg-white/5 rounded-lg sm:rounded-xl opacity-40 cursor-not-allowed inline-flex" title="E-mail não cadastrado"><Mail className="w-4 h-4 sm:w-5 sm:h-5" /></span>
                   )}
                </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2 sm:p-3 md:p-4 bg-white/5 rounded-2xl sm:rounded-3xl hover:bg-white/20 transition-all flex-shrink-0 self-end sm:self-auto"><X className="w-5 h-5 sm:w-6 sm:h-6"/></button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 md:gap-10">
          <div className="space-y-8">
             <div className="flex items-center gap-3 mb-4"><PackageIcon className="w-6 h-6 text-blue-400" /><h3 className="text-xl font-black uppercase tracking-tight">Logística</h3></div>
             {allPackages.filter(p => p.recipient === resident.name && p.status === 'Pendente').length > 0 ? (
                <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-[32px] space-y-4">
                   <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase tracking-widest text-blue-400 animate-pulse">Aguardando Retirada</span><span className="px-3 py-1 bg-blue-500 text-white rounded-lg text-[10px] font-bold">Prioridade</span></div>
                   {allPackages.filter(p => p.recipient === resident.name && p.status === 'Pendente').map(pkg => (
                      <div key={pkg.id} className="p-4 bg-zinc-900/50 rounded-2xl flex justify-between items-center group cursor-pointer hover:bg-black/40 transition-all" onClick={() => onPackageSelect(pkg)}>
                         <div><h6 className="font-bold text-sm uppercase text-blue-100">{pkg.type}</h6><p className="text-[10px] opacity-60 font-medium">Chegou às {pkg.displayTime}</p></div>
                         <div className="p-2 bg-blue-500 text-white rounded-xl shadow-lg group-hover:scale-110 transition-transform"><MessageCircle className="w-4 h-4" /></div>
                      </div>
                   ))}
                </div>
             ) : (
                <div className="p-6 bg-white/5 border border-white/5 rounded-[32px] flex items-center justify-center gap-3 opacity-40"><CheckCircle2 className="w-5 h-5" /><span className="text-xs font-black uppercase">Nada pendente</span></div>
             )}
             <div className="bg-white/5 rounded-[32px] p-6">
                <h6 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-6">Histórico</h6>
                <div className="space-y-6 relative pl-2">
                   <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-white/10" />
                   {allPackages.filter(p => p.recipient === resident.name && p.status === 'Entregue').slice(0, 4).map(pkg => (
                      <div key={pkg.id} className="relative flex items-center gap-4 pl-6 group">
                         <div className="absolute left-0 w-8 h-8 rounded-full bg-zinc-800 border-2 border-green-500 flex items-center justify-center z-10"><Check className="w-3 h-3 text-green-500" /></div>
                         <div className="flex-1 p-3 rounded-xl hover:bg-white/5 transition-all"><h6 className="text-sm font-bold uppercase">{pkg.type}</h6><p className="text-[10px] opacity-40">Entregue em {new Date(pkg.receivedAt).toLocaleDateString()}</p></div>
                      </div>
                   ))}
                </div>
             </div>
          </div>
          <div className="space-y-8">
             <div className="flex items-center gap-3 mb-4"><ShieldCheck className="w-6 h-6 text-purple-400" /><h3 className="text-xl font-black uppercase tracking-tight">Acessos</h3></div>
             <div className="space-y-4">
                <h6 className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2">Visitantes (Agora)</h6>
                {visitorLogs.filter(v => v.residentName === resident.name && v.status === 'active').map(visitor => (
                   <div key={visitor.id} className="p-6 bg-purple-500/10 border border-purple-500/20 rounded-[32px] flex justify-between items-center">
                      <div><h6 className="font-black text-sm uppercase text-purple-200">{visitor.visitorNames}</h6><p className="text-[10px] text-purple-300/60 font-medium">Entrada: {new Date(visitor.entryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div>
                      <button onClick={() => onCheckOutVisitor(visitor.id)} className="px-4 py-2 bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase hover:bg-purple-400 transition-colors">Saída</button>
                   </div>
                ))}
             </div>
             <div className="bg-white/5 rounded-[32px] p-6">
                <h6 className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4">Frequentes</h6>
                <div className="grid grid-cols-1 gap-2">
                   <div className="p-3 hover:bg-white/5 rounded-xl flex items-center justify-between cursor-pointer group transition-all"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black"><UserCircle className="w-4 h-4" /></div><div><h6 className="text-xs font-bold uppercase">Maria (Mãe)</h6><p className="text-[9px] opacity-40">12 visitas este mês</p></div></div><Plus className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MODAL DETALHE PACOTE ---
export const PackageDetailModal = ({ pkg, onClose, onDeliver, onNotify, calculatePermanence, currentRole, currentResident }: any) => {
  if (!pkg) return null;
  
  // Verificar se o morador pode dar baixa (só em encomendas da sua unidade)
  const canResidentDeliver = currentRole === 'MORADOR' && currentResident && pkg.unit === currentResident.unit && pkg.status === 'Pendente';
  // Porteiro/Síndico sempre pode dar baixa
  const canStaffDeliver = (currentRole === 'PORTEIRO' || currentRole === 'SINDICO') && pkg.status === 'Pendente';
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white text-black rounded-[32px] sm:rounded-[48px] shadow-2xl p-4 sm:p-6 md:p-8 lg:p-12 animate-in zoom-in duration-500 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <header className="flex justify-between items-start gap-4 mb-6 sm:mb-8 md:mb-10">
          <div className="flex items-center gap-3 sm:gap-4 md:gap-6 min-w-0 flex-1">
            <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-zinc-50 flex items-center justify-center shadow-inner flex-shrink-0"><PackageIcon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 opacity-40" /></div>
            <div className="min-w-0 flex-1"><h4 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tighter leading-none truncate">{pkg.recipient}</h4><p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.3em] opacity-30 mt-1 sm:mt-2">Unidade {pkg.unit} • Bloco Central</p></div>
          </div>
          <button onClick={onClose} className="p-2 sm:p-3 md:p-4 bg-zinc-50 rounded-2xl sm:rounded-3xl hover:bg-zinc-100 transition-all flex-shrink-0"><X className="w-5 h-5 sm:w-6 sm:h-6"/></button>
        </header>
        <div className="space-y-4 sm:space-y-6 md:space-y-8">
           {/* Imagem da encomenda */}
           {pkg.imageUrl && (
             <section className="space-y-2 sm:space-y-4">
               <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-30 px-2">Foto da Encomenda</label>
               <div className="rounded-[24px] sm:rounded-[32px] border border-black/5 overflow-hidden bg-zinc-50">
                 <img 
                   src={pkg.imageUrl} 
                   alt={`Encomenda ${pkg.type} para ${pkg.recipient}`}
                   className="w-full h-auto max-h-[250px] sm:max-h-[300px] md:max-h-[400px] object-contain"
                   onError={(e) => {
                     const target = e.target as HTMLImageElement;
                     target.style.display = 'none';
                     const parent = target.parentElement;
                     if (parent) {
                       parent.innerHTML = '<div class="p-6 sm:p-8 text-center text-xs opacity-40">Imagem não disponível</div>';
                     }
                   }}
                 />
               </div>
             </section>
           )}
           
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-4 sm:p-6 md:p-8 bg-zinc-50 rounded-[24px] sm:rounded-[32px] border border-black/5 shadow-inner"><span className="text-[8px] font-black uppercase tracking-widest opacity-30 block mb-1 sm:mb-2">Registro de Entrada</span><div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-40" /><span className="text-base sm:text-lg font-black uppercase">{pkg.displayTime}</span></div></div>
              <div className="p-4 sm:p-6 md:p-8 bg-black text-white rounded-[24px] sm:rounded-[32px] shadow-2xl relative overflow-hidden"><span className="text-[8px] font-black uppercase tracking-widest opacity-40 block mb-1 sm:mb-2">Tempo em Custódia</span><div className="flex items-center gap-2"><ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" /><span className="text-base sm:text-lg font-black uppercase">{pkg.status === 'Entregue' ? 'FINALIZADO' : calculatePermanence(pkg.receivedAt)}</span></div><div className="absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-blue-500 opacity-10 rounded-full blur-2xl -mr-8 -mt-8 sm:-mr-10 sm:-mt-10" /></div>
           </div>
           <section className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest opacity-30 px-2">Detalhes do Volume</label>
              <div className="p-4 sm:p-6 md:p-8 bg-zinc-50 rounded-[32px] sm:rounded-[40px] border border-black/5 space-y-3 sm:space-y-4">
                 <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-black/5 gap-2"><span className="text-[10px] sm:text-xs font-bold opacity-40 uppercase">Transportadora</span><span className="text-xs sm:text-sm font-black uppercase truncate">{pkg.type}</span></div>
                 {pkg.items && pkg.items.length > 0 ? (<div className="space-y-2 sm:space-y-3 pt-2"><span className="text-[9px] font-black uppercase opacity-20 block">Inventário</span>{pkg.items.map((it: any, idx: number) => (<div key={idx} className="flex items-start gap-2 sm:gap-3"><div className="w-1.5 h-1.5 rounded-full bg-black mt-1.5 flex-shrink-0" /><div className="min-w-0"><p className="text-xs sm:text-sm font-bold uppercase break-words">{it.name}</p>{it.description && <p className="text-[9px] sm:text-[10px] opacity-40 break-words">{it.description}</p>}</div></div>))}</div>) : (<p className="text-xs opacity-20 italic">Nenhum item específico detalhado.</p>)}
              </div>
           </section>
           <div className="flex flex-col gap-4">
             {pkg.status === 'Pendente' ? (
               <>
                 {/* Botão de notificar - apenas para porteiro/síndico */}
                 {(currentRole === 'PORTEIRO' || currentRole === 'SINDICO') && (
                   <button onClick={() => onNotify(pkg)} className="w-full py-4 sm:py-6 md:py-8 bg-green-600 text-white rounded-[24px] sm:rounded-[32px] font-black uppercase text-[10px] sm:text-[11px] tracking-[0.2em] flex items-center justify-center gap-2 sm:gap-4 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"><MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" /> <span className="whitespace-nowrap">Notificar Morador agora</span></button>
                 )}
                 {/* Botão de dar baixa - para porteiro/síndico ou morador (quando é sua encomenda) */}
                 {(canStaffDeliver || canResidentDeliver) && (
                   <button 
                     onClick={() => onDeliver(pkg.id)} 
                     className={`w-full py-4 sm:py-6 md:py-8 rounded-[24px] sm:rounded-[32px] font-black uppercase text-[10px] sm:text-[11px] tracking-[0.2em] flex items-center justify-center gap-2 sm:gap-4 active:scale-95 transition-all shadow-xl ${
                       canResidentDeliver 
                         ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-[1.02]' 
                         : 'bg-zinc-100 text-black hover:bg-zinc-200'
                     }`}
                   >
                     <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /> 
                     <span className="whitespace-nowrap">
                       {canResidentDeliver ? 'Confirmar Retirada' : 'Marcar como Entregue'}
                     </span>
                   </button>
                 )}
                 {/* Mensagem quando morador não pode dar baixa (não é sua encomenda) */}
                 {currentRole === 'MORADOR' && !canResidentDeliver && pkg.status === 'Pendente' && (
                   <div className="w-full py-4 bg-amber-50 border border-amber-200 rounded-[24px] text-center">
                     <p className="text-xs font-bold text-amber-800">Esta encomenda não pertence à sua unidade</p>
                   </div>
                 )}
               </>
             ) : (
               <div className="w-full py-8 bg-zinc-50 border border-black/5 rounded-[32px] flex items-center justify-center gap-4"><Check className="w-6 h-6 text-green-600" /><span className="text-[11px] font-black uppercase tracking-widest opacity-40 text-black">Este volume já foi entregue</span></div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

// --- MODAL DETALHE VISITANTE ---
export const VisitorDetailModal = ({ visitor, onClose, onCheckout, calculatePermanence }: any) => {
  if (!visitor) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white text-black rounded-[32px] sm:rounded-[48px] shadow-2xl p-4 sm:p-6 md:p-8 lg:p-12 animate-in zoom-in duration-300">
         <header className="flex justify-between items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
               <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl sm:rounded-3xl bg-zinc-100 flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-black shadow-inner flex-shrink-0">{visitor.visitorNames?.substring(0, 1).toUpperCase()}</div>
               <div className="min-w-0 flex-1"><h4 className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-tight leading-none truncate">{visitor.visitorNames}</h4><span className={`inline-block mt-1 sm:mt-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest ${visitor.type === 'Prestador' ? 'bg-amber-100 text-amber-600' : visitor.type === 'Delivery' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>{visitor.type || 'Visita'}</span></div>
            </div>
            <button onClick={onClose} className="p-2 sm:p-3 bg-zinc-100 rounded-xl sm:rounded-2xl hover:bg-zinc-200 flex-shrink-0"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
         </header>
         <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
               <div className="p-4 sm:p-5 bg-zinc-50 rounded-[20px] sm:rounded-[24px] border border-black/5"><p className="text-[9px] font-black uppercase opacity-30 mb-1">Destino</p><p className="text-xs sm:text-sm font-bold uppercase break-words">{visitor.unit} - {visitor.residentName}</p></div>
               <div className="p-4 sm:p-5 bg-zinc-50 rounded-[20px] sm:rounded-[24px] border border-black/5"><p className="text-[9px] font-black uppercase opacity-30 mb-1">Entrada</p><p className="text-xs sm:text-sm font-bold uppercase">{new Date(visitor.entryTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div>
            </div>
            <div className="p-4 sm:p-6 bg-zinc-50 rounded-[24px] sm:rounded-[32px] border border-black/5 flex items-center gap-3 sm:gap-4"><div className="p-2 sm:p-3 bg-white rounded-full shadow-sm flex-shrink-0"><Clock className="w-4 h-4 sm:w-5 sm:h-5 opacity-40"/></div><div className="min-w-0"><p className="text-[9px] sm:text-[10px] font-black uppercase opacity-30 tracking-widest">Permanência Atual</p><p className="text-lg sm:text-xl font-black uppercase">{calculatePermanence(visitor.entryTime)}</p></div></div>
            <button onClick={() => { onCheckout(visitor.id); onClose(); }} className="w-full py-4 sm:py-5 md:py-6 bg-black text-white rounded-[24px] sm:rounded-[32px] font-black uppercase text-[10px] sm:text-[11px] tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-2 sm:gap-3"><LogOut className="w-4 h-4" /> <span className="whitespace-nowrap">Registrar Saída Agora</span></button>
         </div>
      </div>
    </div>
  );
};

// --- MODAL DETALHE OCORRENCIA ---
export const OccurrenceDetailModal = ({ occurrence, onClose, onSave, setOccurrence, currentRole, currentResident, currentAdminUser }: any) => {
  const [newMessage, setNewMessage] = React.useState('');
  const [messages, setMessages] = React.useState(occurrence?.messages || []);

  React.useEffect(() => {
    setMessages(occurrence?.messages || []);
  }, [occurrence]);

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      text: newMessage.trim(),
      senderRole: currentRole,
      senderName: currentRole === 'MORADOR' && currentResident ? currentResident.name :
                  currentAdminUser ? currentAdminUser.name : 'Sistema',
      timestamp: new Date().toISOString(),
      read: false
    };

    const updatedMessages = [...messages, message];
    const updatedOccurrence = { ...occurrence, messages: updatedMessages };

    setMessages(updatedMessages);
    setOccurrence(updatedOccurrence);
    setNewMessage('');
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  if (!occurrence) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white text-black rounded-[32px] sm:rounded-[48px] shadow-2xl p-4 sm:p-6 md:p-8 lg:p-12 animate-in zoom-in duration-300 max-h-[90vh] overflow-hidden flex flex-col">
         <header className="flex justify-between items-start gap-3 sm:gap-4 mb-6 sm:mb-8 flex-shrink-0">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
               <div className={`p-3 sm:p-4 rounded-2xl sm:rounded-3xl flex-shrink-0 ${occurrence.status === 'Aberto' ? 'bg-red-100 text-red-600' : occurrence.status === 'Em Andamento' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}><AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" /></div>
               <div className="min-w-0"><h4 className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-tight leading-none">Ocorrência</h4><p className="text-[9px] sm:text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">Detalhes & Comunicação</p></div>
            </div>
            <button onClick={onClose} className="p-2 sm:p-3 bg-zinc-100 rounded-xl sm:rounded-2xl hover:bg-zinc-200 flex-shrink-0"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
         </header>
         <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 pr-2">
            <div className="p-4 sm:p-5 bg-zinc-50 rounded-[20px] sm:rounded-[24px] border border-black/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
               <div className="min-w-0"><p className="text-[9px] font-black uppercase opacity-30 mb-1">Unidade Afetada</p><p className="text-xs sm:text-sm font-bold uppercase break-words">{occurrence.unit} - {occurrence.residentName}</p></div>
               <div className="text-left sm:text-right"><p className="text-[9px] font-black uppercase opacity-30 mb-1">Data</p><p className="text-[10px] sm:text-xs font-bold uppercase opacity-60">{occurrence.date}</p></div>
            </div>

            {(currentRole === 'SINDICO' || currentRole === 'PORTEIRO') && (
              <div>
                 <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Status Atual</label>
                 <div className="flex gap-2">
                    {['Aberto', 'Em Andamento', 'Resolvido'].map(status => (
                       <button key={status} onClick={() => setOccurrence({...occurrence, status: status as any})} className={`flex-1 py-2.5 sm:py-3 rounded-[12px] sm:rounded-[16px] text-[8px] sm:text-[9px] font-black uppercase tracking-widest transition-all border ${occurrence.status === status ? (status === 'Aberto' ? 'bg-red-500 text-white border-red-500' : status === 'Resolvido' ? 'bg-green-500 text-white border-green-500' : 'bg-amber-500 text-white border-amber-500') : 'bg-white border-zinc-100 text-zinc-400 hover:bg-zinc-50'}`}>{status}</button>
                    ))}
                 </div>
              </div>
            )}

            <div className="space-y-3">
               <div>
                 <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Descrição {(currentRole === 'SINDICO' || currentRole === 'PORTEIRO') ? '(Editável)' : ''}</label>
                 {(currentRole === 'SINDICO' || currentRole === 'PORTEIRO') ? (
                   <textarea value={occurrence.description} onChange={(e) => setOccurrence({...occurrence, description: e.target.value})} className="w-full h-28 sm:h-32 p-4 sm:p-5 bg-zinc-50 rounded-[20px] sm:rounded-[24px] font-medium text-xs sm:text-sm outline-none border-2 border-transparent focus:border-black/5 resize-none shadow-inner" />
                 ) : (
                   <div className="w-full h-28 sm:h-32 p-4 sm:p-5 bg-zinc-50 rounded-[20px] sm:rounded-[24px] font-medium text-xs sm:text-sm border-2 border-transparent shadow-inner overflow-y-auto">
                     {occurrence.description}
                   </div>
                 )}
               </div>
               {occurrence.imageUrl && (
                 <div className="mt-1 rounded-[20px] sm:rounded-[24px] overflow-hidden border border-zinc-100">
                   <img
                     src={occurrence.imageUrl}
                     alt="Registro da ocorrência"
                     className="w-full max-h-64 object-cover"
                   />
                 </div>
               )}
            </div>

            {/* Sistema de Mensagens */}
            <div className="space-y-3">
              <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Comunicação</label>

              {/* Área de mensagens */}
              <div className="bg-zinc-50 rounded-[20px] sm:rounded-[24px] border border-black/5 p-4 max-h-64 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-xs opacity-60 text-center py-4">Nenhuma mensagem ainda. Use este espaço para se comunicar sobre a ocorrência.</p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.senderRole === currentRole ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                          message.senderRole === currentRole
                            ? 'bg-blue-500 text-white'
                            : message.senderRole === 'MORADOR'
                              ? 'bg-zinc-200 text-black'
                              : 'bg-green-100 text-black'
                        }`}>
                          <p className="text-xs font-medium">{message.text}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] opacity-70">{message.senderName}</span>
                            <span className="text-[9px] opacity-70 ml-2">{formatMessageTime(message.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Campo para nova mensagem */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 p-3 bg-zinc-50 rounded-xl font-medium text-xs outline-none border-2 border-transparent focus:border-black/5"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-3 bg-blue-500 text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
         </div>

         {/* Botão de salvar - apenas para síndico/porteiro */}
         {(currentRole === 'SINDICO' || currentRole === 'PORTEIRO') && (
           <div className="flex-shrink-0 mt-6 pt-4 border-t border-zinc-100">
             <button onClick={onSave} className="w-full py-4 sm:py-5 md:py-6 bg-black text-white rounded-[24px] sm:rounded-[32px] font-black uppercase text-[10px] sm:text-[11px] tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-2 sm:gap-3"><Save className="w-4 h-4" /> <span className="whitespace-nowrap">Salvar Alterações</span></button>
           </div>
         )}
      </div>
    </div>
  );
};

// --- MODAL FORMULARIO RESIDENTE ---
export const ResidentFormModal = ({ isOpen, onClose, data, setData, onSave, role, residentPassword }: any) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
       <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
       <div className="relative w-full max-w-lg bg-white text-black rounded-[32px] sm:rounded-[48px] shadow-2xl p-4 sm:p-6 md:p-8 lg:p-10 animate-in duration-300">
          <header className="flex justify-between items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
             <div className="min-w-0"><h4 className="text-xl sm:text-2xl font-black uppercase tracking-tight">{data.id ? 'Editar Morador' : 'Novo Morador'}</h4><p className="text-[9px] sm:text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">Cadastro de Unidade</p></div>
             <button onClick={onClose} className="p-2 sm:p-3 bg-zinc-100 rounded-xl sm:rounded-2xl hover:bg-zinc-200 transition-all flex-shrink-0"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
          </header>
          <div className="space-y-4 sm:space-y-5">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-1 sm:col-span-2"><label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">Nome Completo</label><input type="text" value={data.name || ''} onChange={e => setData({...data, name: e.target.value})} className="w-full p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none border focus:border-black/10" placeholder="Ex: Carlos Silva" /></div>
                <div><label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">Unidade</label><input type="text" value={data.unit || ''} onChange={e => setData({...data, unit: e.target.value})} className="w-full p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none border focus:border-black/10" placeholder="Ex: 03/005" /></div>
                <div><label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">Telefone</label><input type="text" value={data.phone} onChange={e => setData({...data, phone: e.target.value})} className="w-full p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none border focus:border-black/10" placeholder="Apenas números" /></div>
                <div className="col-span-1 sm:col-span-2"><label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">WhatsApp (Opcional)</label><input type="text" value={data.whatsapp} onChange={e => setData({...data, whatsapp: e.target.value})} className="w-full p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none border focus:border-black/10" placeholder="5511999999999" /></div>
                <div className="col-span-1 sm:col-span-2"><label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">Email {!data.id ? '(Obrigatório para login e recuperação de senha)' : '(Opcional)'}</label><input type="email" value={data.email} onChange={e => setData({...data, email: e.target.value})} className="w-full p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm outline-none border focus:border-black/10" placeholder="email@exemplo.com" /></div>
                {/* Campo de senha - apenas para síndico */}
                {role === 'SINDICO' && data.id && (
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-1 block">Senha do Morador</label>
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                      {residentPassword ? (
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-amber-800 mb-2">Hash da Senha (Armazenado no Banco):</p>
                          <code className="block text-[10px] font-mono bg-white p-2 rounded-lg border border-amber-300 text-amber-900 break-all">
                            {residentPassword}
                          </code>
                          <p className="text-[9px] text-amber-700 opacity-70 mt-2">
                            ⚠️ A senha está armazenada como hash (criptografada) por segurança. Não é possível visualizar a senha original.
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-amber-700">
                          Este morador ainda não possui senha cadastrada.
                        </p>
                      )}
                    </div>
                  </div>
                )}
             </div>
             <button onClick={onSave} className="w-full py-4 sm:py-5 bg-black text-white rounded-[20px] sm:rounded-[24px] font-black uppercase text-[10px] sm:text-[11px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 sm:gap-3 mt-4"><Save className="w-4 h-4" /> <span className="whitespace-nowrap">{data.id ? 'Atualizar Dados' : 'Cadastrar Morador'}</span></button>
          </div>
       </div>
    </div>
  );
};

// --- MODAL CRIAR OCORRENCIA ---
export const NewOccurrenceModal = ({ isOpen, onClose, description, setDescription, onSave }: any) => {
  if (!isOpen) return null;
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImagePreview(null);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreview(dataUrl || null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white text-black rounded-[32px] sm:rounded-[40px] shadow-2xl p-4 sm:p-6 md:p-8 lg:p-10 animate-in zoom-in duration-300">
         <header className="flex justify-between items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
           <h4 className="text-xl sm:text-2xl font-black uppercase">Reportar Ocorrência</h4>
           <button onClick={onClose} className="p-2 sm:p-3 bg-zinc-100 rounded-xl sm:rounded-2xl flex-shrink-0">
             <X className="w-4 h-4 sm:w-5 sm:h-5"/>
           </button>
         </header>
         <div className="space-y-3 sm:space-y-4">
            <textarea
              placeholder="Descreva o ocorrido..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full h-28 sm:h-32 p-3 sm:p-4 bg-zinc-50 rounded-xl sm:rounded-2xl outline-none font-medium text-xs sm:text-sm resize-none border border-transparent focus:border-red-100"
            />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                  Foto / Anexo (opcional)
                </span>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Remover
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  Abrir câmera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  Galeria / Arquivo
                </button>
              </div>

              {imagePreview && (
                <div className="mt-2 rounded-2xl border border-zinc-100 overflow-hidden bg-zinc-50">
                  <img
                    src={imagePreview}
                    alt="Prévia da ocorrência"
                    className="w-full h-40 object-cover"
                  />
                </div>
              )}
            </div>

            <button
              onClick={() => onSave(imagePreview)}
              className="w-full py-3 sm:py-4 bg-red-600 text-white rounded-xl sm:rounded-2xl font-black uppercase text-[9px] sm:text-[10px] shadow-xl mt-4"
            >
              Registrar
            </button>
         </div>
      </div>
    </div>
  );
};

// --- MODAL CRIAR/EDITAR AVISO (MURAL) ---
export const NoticeEditModal = ({ notice, onClose, onChange, onSave, onDelete }: any) => {
  const isNew = !notice?.id;
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(notice?.imageUrl ?? null);

  React.useEffect(() => {
    setImagePreview(notice?.imageUrl ?? null);
  }, [notice?.id, notice?.imageUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = (ev.target?.result as string) || null;
      setImagePreview(dataUrl);
      if (notice) onChange({ ...notice, imageUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeImage = () => {
    setImagePreview(null);
    if (notice) onChange({ ...notice, imageUrl: undefined });
  };

  if (!notice) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white text-black rounded-[32px] sm:rounded-[48px] shadow-2xl p-4 sm:p-6 md:p-8 lg:p-12 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
         <header className="flex justify-between items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-green-100 text-green-600 flex-shrink-0"><Bell className="w-5 h-5 sm:w-6 sm:h-6" /></div>
              <div className="min-w-0">
                <h4 className="text-lg sm:text-xl md:text-2xl font-black uppercase tracking-tight leading-none">Aviso Mural</h4>
                <p className="text-[9px] sm:text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">{isNew ? 'Novo comunicado' : 'Editar comunicado'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 sm:p-3 bg-zinc-100 rounded-xl sm:rounded-2xl hover:bg-zinc-200 flex-shrink-0"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
         </header>
         <div className="space-y-4 sm:space-y-6">
            <div><label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Título</label><input type="text" value={notice.title || ''} onChange={(e) => onChange({...notice, title: e.target.value})} className="w-full p-4 sm:p-5 bg-zinc-50 rounded-[20px] sm:rounded-[24px] font-bold text-base sm:text-lg outline-none border-2 border-transparent focus:border-black/5" placeholder="Título do aviso" /></div>
            <div><label className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Conteúdo (texto)</label><textarea value={notice.content || ''} onChange={(e) => onChange({...notice, content: e.target.value})} className="w-full h-28 sm:h-32 p-4 sm:p-5 bg-zinc-50 rounded-[20px] sm:rounded-[24px] font-medium text-xs sm:text-sm outline-none border-2 border-transparent focus:border-black/5 resize-none shadow-inner" placeholder="Escreva o aviso ou use uma imagem abaixo" /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Imagem (opcional)</span>
                {imagePreview && (
                  <button type="button" onClick={removeImage} className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1">Remover</button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              <div className="flex gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 transition-colors"><Camera className="w-4 h-4" /> Câmera</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:bg-zinc-50 transition-colors"><ImageIcon className="w-4 h-4" /> Galeria</button>
              </div>
              {imagePreview && (
                <div className="mt-2 rounded-[20px] sm:rounded-[24px] overflow-hidden border border-zinc-100 bg-zinc-50">
                  <img src={imagePreview} alt="Aviso" className="w-full max-h-48 object-contain" />
                </div>
              )}
            </div>
            {!isNew && (
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-zinc-50 p-3 sm:p-4 rounded-[20px] sm:rounded-[24px]">
                <div className="min-w-0"><p className="text-[9px] font-black uppercase opacity-30">Autor</p><p className="text-[10px] sm:text-xs font-bold uppercase truncate">{notice.author}</p></div>
                <div className="text-left sm:text-right"><p className="text-[9px] font-black uppercase opacity-30">Data</p><p className="text-[10px] sm:text-xs font-bold uppercase">{new Date(notice.date).toLocaleDateString()}</p></div>
              </div>
            )}
            <div className={`grid gap-3 sm:gap-4 ${isNew ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {!isNew && <button type="button" onClick={onDelete} className="py-4 sm:py-5 md:py-6 bg-red-100 text-red-600 rounded-[24px] sm:rounded-[32px] font-black uppercase text-[10px] sm:text-[11px] tracking-widest hover:bg-red-200 active:scale-95 transition-all flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> <span className="whitespace-nowrap">Excluir</span></button>}
                <button type="button" onClick={onSave} className="py-4 sm:py-5 md:py-6 bg-black text-white rounded-[24px] sm:rounded-[32px] font-black uppercase text-[10px] sm:text-[11px] tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-2 sm:gap-3"><Save className="w-4 h-4" /> <span className="whitespace-nowrap">{isNew ? 'Criar aviso' : 'Salvar'}</span></button>
            </div>
         </div>
      </div>
    </div>
  );
};
