
import React from 'react';
import { Search, Plus, MapPin, Clock, Car, LogOut } from 'lucide-react';
import { formatUnit } from '../../utils/unitFormatter';

import { UserRole } from '../../types';

interface VisitorsViewProps {
  visitorLogs: any[];
  visitorSearch: string;
  setVisitorSearch: (val: string) => void;
  setIsVisitorModalOpen: (val: boolean) => void;
  visitorTab: 'active' | 'history' | 'service';
  setVisitorTab: (tab: 'active' | 'history' | 'service') => void;
  handleVisitorCheckOut: (id: string) => void;
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
  const canCreateVisitor = isResident || isDoorman;
  const canCheckoutVisitor = isResident;
  const displayVisitors = visitorLogs.filter(v => {
    const matchSearch = (v.visitorNames || '').toLowerCase().includes(visitorSearch.toLowerCase()) || 
                        (v.residentName || '').toLowerCase().includes(visitorSearch.toLowerCase()) ||
                        (v.unit || '').toLowerCase().includes(visitorSearch.toLowerCase());
    
    if (visitorTab === 'active') return v.status === 'active' && matchSearch;
    if (visitorTab === 'history') return v.status === 'completed' && matchSearch;
    if (visitorTab === 'service') return v.status === 'active' && v.type === 'Prestador' && matchSearch;
    return false;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tighter">Visitantes</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">Controle de Acesso em Tempo Real</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
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
              className="px-6 py-3 bg-white text-black rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {isResident ? 'Registrar Visita' : 'Novo Acesso'}
            </button>
          )}
        </div>
      </header>

      {/* Abas de Navegação */}
      <div className="flex gap-2 border-b border-white/10 pb-4">
         {['active', 'history', 'service'].map((tab) => (
           <button 
             key={tab}
             onClick={() => setVisitorTab(tab as any)}
             className={`px-6 py-3 rounded-[16px] text-[10px] font-black uppercase tracking-widest transition-all ${
               visitorTab === tab 
               ? 'bg-white text-black shadow-lg scale-105' 
               : 'bg-white/5 text-white/40 hover:bg-white/10'
             }`}
           >
             {tab === 'active' && 'No Condomínio'}
             {tab === 'history' && 'Histórico'}
             {tab === 'service' && 'Prestadores'}
           </button>
         ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayVisitors.map(visitor => {
          const permanence = calculatePermanence(visitor.entryTime);
          const isLongStay = (new Date().getTime() - new Date(visitor.entryTime).getTime()) > 8 * 60 * 60 * 1000;
          
          return (
            <div 
              key={visitor.id} 
              className={`premium-glass p-6 rounded-[32px] relative overflow-hidden group transition-all hover:scale-[1.01] ${isLongStay && visitor.status === 'active' ? 'border-red-500/30' : ''}`}
            >
              <div className="flex justify-between items-start mb-6">
                 <h4 className="text-xl font-black uppercase tracking-tight">{visitor.visitorNames}</h4>
                 <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                   visitor.type === 'Prestador' ? 'bg-amber-100 text-amber-600' : 
                   visitor.type === 'Delivery' ? 'bg-blue-100 text-blue-600' : 
                   'bg-purple-100 text-purple-600'
                 }`}>
                   {visitor.type || 'Visita'}
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
                       {visitor.status === 'active' 
                         ? `Entrada: ${new Date(visitor.entryTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • Há ${permanence}`
                         : `Saída: ${new Date(visitor.exitTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`
                       }
                    </span>
                 </div>
                 {visitor.vehicle && (
                   <div className="flex items-center gap-3 opacity-60">
                      <Car className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">{visitor.vehicle} {visitor.plate && `• ${visitor.plate}`}</span>
                   </div>
                 )}
              </div>

              {visitor.status === 'active' && canCheckoutVisitor && (
                <button 
                  onClick={() => handleVisitorCheckOut(visitor.id)}
                  className="w-full py-4 bg-zinc-100 dark:bg-white/10 text-black dark:text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Concluir Visita
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
