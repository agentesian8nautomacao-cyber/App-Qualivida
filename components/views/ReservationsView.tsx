
import React from 'react';
import { Plus, Search, Calendar as CalendarIcon, Users, Clock, Check, Timer, AlertOctagon, Home, UtensilsCrossed, Flame, Dumbbell } from 'lucide-react';
import { formatUnit } from '../../utils/unitFormatter';

interface ReservationsViewProps {
  dayReservations: any[];
  reservationFilter: 'all' | 'today' | 'pending';
  setReservationFilter: (filter: 'all' | 'today' | 'pending') => void;
  setIsReservationModalOpen: (val: boolean) => void;
  areasStatus: any[];
  handleReservationAction: (id: string) => void;
}

const ReservationsView: React.FC<ReservationsViewProps> = ({
  dayReservations,
  reservationFilter,
  setReservationFilter,
  setIsReservationModalOpen,
  areasStatus,
  handleReservationAction
}) => {
  const displayReservations = dayReservations.filter(r => {
    if (reservationFilter === 'all') return true;
    if (reservationFilter === 'today') return r.date.includes('JAN'); 
    if (reservationFilter === 'pending') return r.status === 'active' || r.status === 'scheduled';
    return true;
  });

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Cabeçalho Premium com Busca Integrada */}
      <div className="space-y-6">
          <div>
             <h3 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">RESERVAS</h3>
             <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Gestão Inteligente de Espaços</p>
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-center">
             <div className="relative flex-1 w-full">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                <input 
                   type="text" 
                   placeholder="Buscar por morador, unidade ou área..." 
                   className="w-full pl-16 pr-6 py-5 bg-zinc-900 border border-white/5 rounded-[24px] text-sm font-bold outline-none text-white placeholder:text-zinc-600 focus:border-white/20 transition-all shadow-lg"
                />
             </div>
             <button 
               onClick={() => setIsReservationModalOpen(true)}
               className="w-full md:w-auto px-10 py-5 bg-white text-black rounded-[24px] text-[11px] font-black uppercase hover:scale-[1.02] active:scale-95 transition-all shadow-[0_0_30px_-10px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3"
             >
                <Plus className="w-5 h-5" /> Nova Reserva
             </button>
          </div>
      </div>

      {/* Grid de Status Minimalista */}
      <div>
         <div className="flex flex-col md:flex-row justify-between items-end mb-6 gap-4">
            <h6 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Visão Geral dos Espaços</h6>
            
            {/* Filtros One-Tap */}
            <div className="flex gap-2 overflow-x-auto pb-1 w-full md:w-auto no-scrollbar">
               <button 
                  onClick={() => setReservationFilter('today')}
                  className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${reservationFilter === 'today' ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}
               >
                  Hoje
               </button>
               <button 
                  onClick={() => setReservationFilter('pending')}
                  className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${reservationFilter === 'pending' ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}
               >
                  Pendentes
               </button>
               <button 
                  onClick={() => setReservationFilter('all')}
                  className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${reservationFilter === 'all' ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}
               >
                  Todos
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {areasStatus.map((area: any) => {
              // Mapear ícones baseado no nome da área
              const getAreaIcon = (name: string) => {
                if (name.includes('SALÃO') || name.includes('FESTAS')) return Home;
                if (name.includes('GOURMET')) return UtensilsCrossed;
                if (name.includes('CHURRASQUEIRA')) return Flame;
                if (name.includes('ACADEMIA')) return Dumbbell;
                return Home; // Default
              };
              
              const AreaIcon = getAreaIcon(area.name);
              const todayCount = parseInt(area.today) || 0;
              
              return (
              <div key={area.id} className="group relative overflow-hidden p-6 bg-[#18181b] rounded-[32px] h-40 flex flex-col justify-between hover:bg-[#202023] transition-all cursor-default border border-transparent hover:border-white/5">
                 <div className="flex justify-between items-start z-10">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white transition-colors ${todayCount > 0 ? 'bg-red-500/20 text-red-500' : 'bg-[#27272a] group-hover:bg-white/10'}`}>
                       <AreaIcon className="w-5 h-5" />
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest py-1.5 px-3 rounded-lg ${todayCount > 0 ? 'text-red-500 bg-red-500/10' : 'text-zinc-500 bg-zinc-800'}`}>
                       {todayCount > 0 ? 'EM USO' : 'LIVRE'}
                    </span>
                 </div>
                 <div className="z-10">
                    <h6 className="font-black text-xs uppercase leading-tight text-white tracking-tight">{area.name}</h6>
                    <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest mt-2">
                       Max {area.capacity} • {area.today}
                    </p>
                 </div>
                 {/* Efeito Glow Sutil no Hover */}
                 <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-white/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              );
           })}
         </div>
      </div>

      {/* Timeline Visual (Mock) */}
      <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden flex mb-2 opacity-50">
         {/* Mockup visual de ocupação do dia (Barra) */}
         <div className="w-[30%] bg-zinc-800" /> {/* Manhã livre */}
         <div className="w-[10%] bg-blue-900/40" /> {/* Ocupado */}
         <div className="w-[20%] bg-zinc-800" />
         <div className="w-[15%] bg-blue-900/40" /> 
         <div className="w-[25%] bg-zinc-800" />
      </div>
      <div className="flex justify-between text-[8px] font-black text-zinc-600 uppercase tracking-widest mb-8 px-1">
         <span>06:00</span>
         <span>12:00</span>
         <span>18:00</span>
         <span>00:00</span>
      </div>

      {/* Lista de Reservas (Cards) */}
      <div>
         {displayReservations.length > 0 ? (
           <div className="space-y-4">
             {displayReservations.map(res => {
                // Parse Mock Date for Calendar Badge
                const [month, day] = res.date.split(' ');
                
                return (
                <div key={res.id} className={`p-1 bg-gradient-to-r ${res.status === 'active' ? 'from-green-500/20 to-transparent' : 'from-transparent to-transparent'} rounded-[36px] transition-all`}>
                  <div className="p-6 md:p-8 bg-[#09090b] rounded-[32px] border border-white/5 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-center gap-6 group">
                     
                     {/* Date Badge */}
                     <div className="flex-shrink-0 flex md:block items-center gap-4">
                        <div className="bg-[#121214] rounded-2xl w-16 h-16 md:w-20 md:h-20 flex flex-col items-center justify-center border border-white/5 group-hover:border-white/20 transition-colors shadow-inner">
                           <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{month}</span>
                           <span className="text-2xl md:text-3xl font-black text-white leading-none mt-1">{day}</span>
                        </div>
                     </div>

                     {/* Info */}
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                           <h5 className="font-black text-lg md:text-xl uppercase text-white leading-tight tracking-tight truncate">{res.area}</h5>
                           {res.status === 'active' && (
                              <span className="px-2 py-0.5 rounded-md bg-green-500 text-black text-[8px] font-black uppercase tracking-widest animate-pulse">
                                 Em Andamento
                              </span>
                           )}
                        </div>
                        <div className="flex items-center gap-2 text-zinc-400 mb-1">
                           <Users className="w-4 h-4" />
                           <p className="text-xs font-bold uppercase tracking-wide text-white">{res.resident} <span className="text-zinc-600">• {formatUnit(res.unit)}</span></p>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-500">
                           <Clock className="w-3 h-3" />
                           <span className="text-[10px] font-bold uppercase tracking-widest">{res.time}</span>
                        </div>
                     </div>

                     {/* Action Button */}
                     <div className="w-full md:w-auto flex-shrink-0">
                        {res.status === 'scheduled' && (
                           <button 
                             onClick={() => handleReservationAction(res.id)}
                             className="w-full md:w-40 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-[0_0_25px_-5px_rgba(37,99,235,0.4)] active:scale-[0.98] flex items-center justify-center gap-2"
                           >
                              <Check className="w-4 h-4" /> Check-in
                           </button>
                        )}
                        {res.status === 'active' && (
                           <button 
                             onClick={() => handleReservationAction(res.id)}
                             className="w-full md:w-40 py-4 bg-zinc-800 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                           >
                              <Timer className="w-4 h-4" /> Check-out
                           </button>
                        )}
                        {res.status === 'completed' && (
                           <div className="w-full md:w-40 py-4 bg-zinc-900/50 text-zinc-600 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-white/5 flex items-center justify-center gap-2 cursor-default">
                              Finalizado
                           </div>
                        )}
                     </div>
                  </div>
                </div>
                );
             })}
           </div>
         ) : (
            <div className="py-24 text-center opacity-30 font-black uppercase text-xs tracking-[0.2em] border-2 border-dashed border-white/5 rounded-[48px] flex flex-col items-center gap-4">
               <CalendarIcon className="w-10 h-10 opacity-50" />
               Nenhuma reserva encontrada para este filtro
            </div>
         )}
      </div>
    </div>
  );
};

export default ReservationsView;
