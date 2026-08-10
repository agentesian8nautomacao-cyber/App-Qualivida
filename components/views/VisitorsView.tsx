
import React from 'react';
import { Search, Plus, MapPin, Clock, Car, LogOut, Check } from 'lucide-react';
import { formatUnit } from '../../utils/unitFormatter';

import { UserRole } from '../../types';

interface VisitorsViewProps {
  visitorLogs: any[];
  visitorSearch: string;
  setVisitorSearch: (val: string) => void;
  setIsVisitorModalOpen: (val: boolean) => void;
  visitorTab: 'pending' | 'confirmed' | 'history';
  setVisitorTab: (tab: 'pending' | 'confirmed' | 'history') => void;
  handleVisitorCheckOut: (id: string) => void;
  handleConfirmVisitor?: (id: string) => void;
  calculatePermanence: (receivedAt: string) => string;
  role?: UserRole;
}

const VisitorsView: React.FC<VisitorsViewProps> = ({
  visitorLogs,
  visitorSearch,
  setVisitorSearch,
  setIsVisitorModalOpen,
  visitorTab,
  setVisitorTab,
  handleVisitorCheckOut,
  calculatePermanence,
  role = 'PORTEIRO'
}) => {
  const isResident = role === 'MORADOR';
  const isDoorman = role === 'PORTEIRO';
  const canCreateVisitor = isResident; // Novo fluxo: morador cadastra antecipadamente
  const canConfirmVisitor = isDoorman; // Porteiro confirma entrada
  const canCheckoutVisitor = isResident; // Morador finaliza quando sair (mantém histórico)
  const displayVisitors = visitorLogs.filter(v => {
    const displayName = v.visitorName || v.visitorNames || '';
    const matchSearch = (displayName || '').toLowerCase().includes(visitorSearch.toLowerCase()) ||
                        (v.residentName || '').toLowerCase().includes(visitorSearch.toLowerCase()) ||
                        (v.unit || '').toLowerCase().includes(visitorSearch.toLowerCase());

    const st = String(v.status || '').toLowerCase();
    const showToResident = !isResident || true;

    if (visitorTab === 'pending') return (st === 'pendente') && matchSearch && showToResident;
    if (visitorTab === 'confirmed') return (st === 'confirmado') && matchSearch && showToResident;
    if (visitorTab === 'history') return (st === 'finalizado') && matchSearch && showToResident;
    return false;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tighter">Visitantes</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">Controle de Acesso em Tempo Real</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
             <input 
                type="text" 
                placeholder="Nome, Unidade, Placa..." 
                value={visitorSearch}
                onChange={e => setVisitorSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-bold outline-none focus:border-white/30 transition-all placeholder:opacity-20"
             />
          </div>
          {canCreateVisitor && (
            <button 
              onClick={() => setIsVisitorModalOpen(true)}
              className="px-6 py-3 bg-white text-black rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" /> Cadastrar Visitante
            </button>
          )}
        </div>
      </header>

      {/* Abas de Navegação */}
      <div className="flex gap-2 border-b border-white/10 pb-4 overflow-x-auto">
         {['pending', 'confirmed', 'history'].map((tab) => (
           <button 
             key={tab}
             onClick={() => setVisitorTab(tab as any)}
             className={`px-4 sm:px-6 py-3 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all shrink-0 whitespace-nowrap ${
               visitorTab === tab 
               ? 'bg-white text-black shadow-lg scale-105' 
               : 'bg-white/5 text-white/40 hover:bg-white/10'
             }`}
           >
             {tab === 'pending' && (isDoorman ? 'Aguardando' : 'Pendentes')}
             {tab === 'confirmed' && 'Confirmados'}
             {tab === 'history' && 'Histórico'}
           </button>
         ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayVisitors.map(visitor => {
          const permanence = visitor.entryTime ? calculatePermanence(visitor.entryTime) : '';
          const isLongStay = visitor.entryTime
            ? (new Date().getTime() - new Date(visitor.entryTime).getTime()) > 8 * 60 * 60 * 1000
            : false;
          const displayName = visitor.visitorName || visitor.visitorNames || '';
          const st = String(visitor.status || '').toLowerCase();
          
          return (
            <div 
              key={visitor.id} 
              className={`premium-glass p-6 rounded-[32px] relative overflow-hidden group transition-all hover:scale-[1.01] ${isLongStay && st === 'confirmado' ? 'border-red-500/30' : ''}`}
            >
              <div className="flex justify-between items-start mb-6">
                 <h4 className="text-xl font-black uppercase tracking-tight">{displayName}</h4>
                 <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                   st === 'pendente' ? 'bg-amber-100 text-amber-600' :
                   st === 'confirmado' ? 'bg-blue-100 text-blue-600' :
                   'bg-green-100 text-green-600'
                 }`}>
                   {st === 'pendente' ? 'Pendente' : st === 'confirmado' ? 'Confirmado' : 'Finalizado'}
                 </span>
              </div>

              <div className="space-y-3 mb-6">
                 <div className="flex items-center gap-3 opacity-60">
                    <MapPin className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">Indo para: {formatUnit(visitor.unit)} ({visitor.residentName})</span>
                 </div>
                 <div className="flex items-center gap-3 opacity-60">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase">
                       {st === 'pendente' && (visitor.confirmedAt ? `Confirmação: ${new Date(visitor.confirmedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : 'Aguardando confirmação')}
                       {st === 'confirmado' && visitor.entryTime && `Entrada: ${new Date(visitor.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • Há ${permanence}`}
                       {st === 'finalizado' && visitor.exitTime && `Saída: ${new Date(visitor.exitTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                    </span>
                 </div>
                 {visitor.observation && (
                   <div className="text-xs opacity-60 font-bold">
                     Obs: <span className="opacity-80 font-medium">{visitor.observation}</span>
                   </div>
                 )}
                 {visitor.vehicle && (
                   <div className="flex items-center gap-3 opacity-60">
                      <Car className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">{visitor.vehicle} {visitor.plate && `• ${visitor.plate}`}</span>
                   </div>
                 )}
              </div>

              {st === 'pendente' && canConfirmVisitor && handleConfirmVisitor && (
                <button 
                  onClick={() => handleConfirmVisitor(visitor.id)}
                  className="w-full py-4 bg-zinc-100 dark:bg-white/10 text-black dark:text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Confirmar Entrada
                </button>
              )}

              {st === 'confirmado' && canCheckoutVisitor && (
                <button 
                  onClick={() => handleVisitorCheckOut(visitor.id)}
                  className="w-full py-4 bg-zinc-100 dark:bg-white/10 text-black dark:text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Finalizar Visita
                </button>
              )}
            </div>
          );
        })}
        
        {displayVisitors.length === 0 && (
           <div className="col-span-full py-20 text-center opacity-20 font-black uppercase text-sm tracking-widest border-2 border-dashed border-white/5 rounded-[48px]">
              Nenhum visitante encontrado nesta categoria
           </div>
        )}
      </div>
    </div>
  );
};

export default VisitorsView;
