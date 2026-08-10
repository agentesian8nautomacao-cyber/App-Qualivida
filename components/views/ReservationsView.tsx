import React, { useState, useMemo } from 'react';
import { Plus, Search, Calendar as CalendarIcon, Users, Clock, Check, Timer, Home, UtensilsCrossed, Trash2, DollarSign, Pencil } from 'lucide-react';
import { formatUnit } from '../../utils/unitFormatter';
import { useAppConfig } from '../../contexts/AppConfigContext';

interface ReservationsViewProps {
  theme?: 'dark' | 'light';
  dayReservations: any[];
  reservationFilter: 'all' | 'today' | 'pending';
  setReservationFilter: (filter: 'all' | 'today' | 'pending') => void;
  setIsReservationModalOpen: (val: boolean) => void;
  areasStatus: any[];
  handleReservationAction: (id: string) => void;
  /** Excluir reserva (admin e morador). */
  onDeleteReservation?: (id: string) => void;
  /** Botão "+ Nova reserva" visível apenas para morador. Admin/porteiro/síndico só visualizam. */
  canCreateReservation?: boolean;
  /** Administração/admin podem editar o valor (R$) de cada área; o valor aparece no boleto do morador. */
  canManageAreaPrices?: boolean;
}

const todayLabel = () => {
  const d = new Date();
  const month = d.toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
  return `${month} ${d.getDate()}`;
};

/** Retorna a URL da imagem da área (arquivos em public/). */
function getAreaImageUrl(areaName: string): string | null {
  const n = areaName.toLowerCase();
  if (n.includes('gourmet')) return '/Espaço Gourmet.jpg';
  if (n.includes('salão') || n.includes('festas') || n.includes('fetas')) return '/Salão de fetas.jpg';
  return null;
}

/** Valor padrão (R$) por nome da área quando ainda não configurado. */
function getDefaultAreaPrice(areaName: string): number | null {
  const n = areaName.toLowerCase();
  if (n.includes('gourmet')) return 79.46;
  if (n.includes('salão') || n.includes('festas') || n.includes('fetas')) return 119.2;
  return null;
}

function formatPrice(value: number): string {
  return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const toMins = (t: string) => {
  const [h, m] = (t || '0:0').trim().split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

type Slot = { label: string; start: number; end: number };
const SLOTS: Slot[] = [
  { label: 'Manhã', start: 6 * 60, end: 12 * 60 },
  { label: 'Tarde', start: 12 * 60, end: 18 * 60 },
  { label: 'Noite', start: 18 * 60, end: 24 * 60 }
];

function occupancyFromReservations(reservations: { time: string }[]): { occupied: boolean; pct: number }[] {
  const slotOccupied = SLOTS.map(s => {
    const overlaps = reservations.some(r => {
      const [startStr, endStr] = (r.time || '').split(' - ').map(s => s.trim());
      const resStart = toMins(startStr);
      const resEnd = toMins(endStr);
      return resStart < s.end && resEnd > s.start;
    });
    return overlaps;
  });
  const total = SLOTS.length;
  return SLOTS.map((_, i) => ({
    occupied: slotOccupied[i],
    pct: 100 / total
  }));
}

const ReservationsView: React.FC<ReservationsViewProps> = ({
  theme = 'dark',
  dayReservations,
  reservationFilter,
  setReservationFilter,
  setIsReservationModalOpen,
  areasStatus,
  handleReservationAction,
  onDeleteReservation,
  canCreateReservation = true,
  canManageAreaPrices = false,
}) => {
  const isLight = theme === 'light';
  const { config, updateConfig } = useAppConfig();
  const [reservationSearch, setReservationSearch] = useState('');
  const [editingAreaPriceId, setEditingAreaPriceId] = useState<string | null>(null);
  const [editingPriceInput, setEditingPriceInput] = useState('');

  const getAreaPrice = (areaId: string, areaName: string): number | null => {
    const fromConfig = config.areaPrices?.[areaId];
    if (fromConfig != null && !Number.isNaN(Number(fromConfig))) return Number(fromConfig);
    return getDefaultAreaPrice(areaName);
  };

  const setAreaPrice = (areaId: string, value: number) => {
    updateConfig({ areaPrices: { ...(config.areaPrices || {}), [areaId]: value } });
    setEditingAreaPriceId(null);
    setEditingPriceInput('');
  };

  const displayReservations = useMemo(() => {
    let list = dayReservations.filter(r => {
      if (reservationFilter === 'all') return true;
      if (reservationFilter === 'today') return r.date === todayLabel();
      if (reservationFilter === 'pending') return r.status === 'active' || r.status === 'scheduled';
      return true;
    });
    const q = reservationSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(
        r =>
          (r.resident && r.resident.toLowerCase().includes(q)) ||
          (r.unit && r.unit.toLowerCase().includes(q)) ||
          (r.area && r.area.toLowerCase().includes(q))
      );
    }
    return list;
  }, [dayReservations, reservationFilter, reservationSearch]);

  const todayReservations = useMemo(
    () => dayReservations.filter(r => r.date === todayLabel()),
    [dayReservations]
  );
  const timelineSegments = useMemo(() => occupancyFromReservations(todayReservations), [todayReservations]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Cabeçalho Premium com Busca Integrada */}
      <div className="space-y-6">
          <div>
             <h3 className={`text-4xl md:text-5xl font-black uppercase tracking-tighter ${isLight ? 'text-zinc-900' : 'text-white'}`}>RESERVAS</h3>
             <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Gestão Inteligente de Espaços</p>
          </div>
          <div className="flex flex-col md:flex-row gap-4 items-center">
             <div className="relative flex-1 w-full">
                <Search className={`absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`} />
                <input 
                   type="text" 
                   placeholder="Buscar por morador, unidade ou área..." 
                   value={reservationSearch}
                   onChange={(e) => setReservationSearch(e.target.value)}
                   className={`w-full pl-16 pr-6 py-5 rounded-[24px] text-sm font-bold outline-none transition-all shadow-lg ${isLight ? 'bg-zinc-100 border border-zinc-200 text-zinc-900 placeholder:text-zinc-500 focus:border-zinc-400' : 'bg-zinc-900 border border-white/5 text-white placeholder:text-zinc-600 focus:border-white/20'}`}
                />
             </div>
             {canCreateReservation && (
               <button 
                 onClick={() => setIsReservationModalOpen(true)}
                 className={`w-full md:w-auto px-10 py-5 rounded-[24px] text-[11px] font-black uppercase hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 ${isLight ? 'bg-zinc-900 text-white shadow-lg hover:bg-zinc-800' : 'bg-white text-black shadow-[0_0_30px_-10px_rgba(255,255,255,0.3)]'}`}
               >
                  <Plus className="w-5 h-5" /> Nova Reserva
               </button>
             )}
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
                  className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${reservationFilter === 'today' ? (isLight ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-black border-white') : (isLight ? 'bg-transparent text-zinc-600 border-zinc-300 hover:border-zinc-400' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600')}`}
               >
                  Hoje
               </button>
               <button 
                  onClick={() => setReservationFilter('pending')}
                  className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${reservationFilter === 'pending' ? (isLight ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-black border-white') : (isLight ? 'bg-transparent text-zinc-600 border-zinc-300 hover:border-zinc-400' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600')}`}
               >
                  Pendentes
               </button>
               <button 
                  onClick={() => setReservationFilter('all')}
                  className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${reservationFilter === 'all' ? (isLight ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-black border-white') : (isLight ? 'bg-transparent text-zinc-600 border-zinc-300 hover:border-zinc-400' : 'bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-600')}`}
               >
                  Todos
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {areasStatus.map((area: any) => {
              // Mapear ícones baseado no nome da área
              const getAreaIcon = (name: string) => {
                const n = name.toLowerCase();
                if (n.includes('salão') || n.includes('festas')) return Home;
                if (n.includes('gourmet')) return UtensilsCrossed;
                return Home;
              };
              
              const AreaIcon = getAreaIcon(area.name);
              const areaImageUrl = getAreaImageUrl(area.name);
              const todayCount = parseInt(area.today) || 0;
              const areaReservationsToday = dayReservations.filter(
                r => r.area === area.name && r.date === todayLabel()
              );
              
              return (
              <div key={area.id} className={`group relative overflow-hidden rounded-[32px] min-h-[160px] flex flex-col transition-all cursor-default border border-transparent ${isLight ? 'bg-zinc-100 hover:bg-zinc-200 hover:border-zinc-300' : 'bg-[#18181b] hover:bg-[#202023] hover:border-white/5'}`}>
                 {/* Imagem da área (quando existir em public/) – exibição completa para melhor visualização */}
                 {areaImageUrl && (
                   <div className="relative w-full min-h-[200px] h-52 sm:h-64 shrink-0 overflow-hidden rounded-t-[32px]">
                     <img
                       src={encodeURI(areaImageUrl)}
                       alt={area.name}
                       className="w-full h-full object-contain bg-black/10"
                       onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                     />
                     {/* Gradiente só na parte inferior para não tapar a imagem */}
                     <div className={`absolute bottom-0 left-0 right-0 h-16 pointer-events-none bg-gradient-to-t ${isLight ? 'from-zinc-100 to-transparent' : 'from-[#18181b] to-transparent'}`} />
                   </div>
                 )}
                 <div className={`flex flex-col justify-between flex-1 p-6 ${!areaImageUrl ? 'min-h-[160px]' : ''}`}>
                   <div className="flex justify-between items-start z-10">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${todayCount > 0 ? 'bg-red-500/20 text-red-500' : isLight ? 'bg-zinc-200 text-zinc-600 group-hover:bg-zinc-300' : 'bg-[#27272a] text-white group-hover:bg-white/10'}`}>
                         <AreaIcon className="w-5 h-5" />
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest py-1.5 px-3 rounded-lg ${todayCount > 0 ? 'text-red-500 bg-red-500/10' : isLight ? 'text-zinc-600 bg-zinc-200' : 'text-zinc-500 bg-zinc-800'}`}>
                         {todayCount > 0 ? 'EM USO' : 'LIVRE'}
                      </span>
                   </div>
                   <div className="z-10 mt-2">
                      <h6 className={`font-black text-xs uppercase leading-tight tracking-tight ${isLight ? 'text-zinc-900' : 'text-white'}`}>{area.name}</h6>
                      <p className={`text-[9px] font-bold uppercase tracking-widest mt-2 ${isLight ? 'text-zinc-600' : 'text-zinc-600'}`}>
                         Max {area.capacity} • {area.today}
                      </p>
                      {/* Valor da área (exibido para todos; editável só para administração) */}
                      {(() => {
                        const price = getAreaPrice(area.id, area.name);
                        const isEditing = canManageAreaPrices && editingAreaPriceId === area.id;
                        return (
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            {isEditing ? (
                              <>
                                <span className={`text-[10px] font-bold uppercase ${isLight ? 'text-zinc-600' : 'text-zinc-500'}`}>R$</span>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0,00"
                                  value={editingPriceInput}
                                  onChange={(e) => setEditingPriceInput(e.target.value)}
                                  onBlur={() => {
                                    const raw = editingPriceInput.trim().replace(',', '.');
                                    const v = parseFloat(raw);
                                    if (!Number.isNaN(v) && v >= 0) setAreaPrice(area.id, v);
                                    setEditingAreaPriceId(null);
                                    setEditingPriceInput('');
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const raw = editingPriceInput.trim().replace(',', '.');
                                      const v = parseFloat(raw);
                                      if (!Number.isNaN(v) && v >= 0) setAreaPrice(area.id, v);
                                      setEditingAreaPriceId(null);
                                      setEditingPriceInput('');
                                    }
                                    if (e.key === 'Escape') { setEditingAreaPriceId(null); setEditingPriceInput(''); }
                                  }}
                                  className={`w-24 px-2 py-1 rounded-lg text-xs font-bold border ${isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-800 border-white/20 text-white'}`}
                                  autoFocus
                                />
                              </>
                            ) : (
                              <>
                                {price != null ? (
                                  <span className={`inline-flex items-center gap-1 text-[11px] font-black uppercase ${isLight ? 'text-zinc-700' : 'text-zinc-400'}`}>
                                    <DollarSign className="w-3.5 h-3.5" />
                                    {formatPrice(price)}
                                  </span>
                                ) : null}
                                {canManageAreaPrices && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingAreaPriceId(area.id);
                                      setEditingPriceInput(price != null ? String(price) : '');
                                    }}
                                    className={`p-1.5 rounded-lg transition-colors ${isLight ? 'text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800' : 'text-zinc-500 hover:bg-white/10 hover:text-white'}`}
                                    title="Definir valor da área (aparece no boleto do morador)"
                                    aria-label="Editar valor"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}
                      {areaReservationsToday.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {areaReservationsToday.map((res) => (
                            <p key={res.id} className={`text-[10px] font-bold uppercase tracking-wide ${isLight ? 'text-zinc-700' : 'text-white/90'}`}>
                              {res.time} — {res.resident} ({formatUnit(res.unit)})
                            </p>
                          ))}
                        </div>
                      )}
                   </div>
                 </div>
                 {/* Efeito Glow Sutil no Hover */}
                 <div className={`absolute -bottom-10 -right-10 w-24 h-24 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isLight ? 'bg-zinc-300' : 'bg-white/5'}`} />
              </div>
              );
           })}
         </div>
      </div>

      {/* Timeline de ocupação do dia (baseada nas reservas de hoje) */}
      <div className={`w-full h-2 rounded-full overflow-hidden flex mb-2 ${isLight ? 'bg-zinc-200' : 'bg-zinc-900'}`}>
         {timelineSegments.map((seg, i) => (
           <div
             key={i}
             className={`h-full transition-colors ${seg.occupied ? 'bg-blue-500/50' : isLight ? 'bg-zinc-300' : 'bg-zinc-800'}`}
             style={{ width: `${seg.pct}%` }}
             title={`${SLOTS[i].label}: ${seg.occupied ? 'Ocupado' : 'Livre'}`}
           />
         ))}
      </div>
      <div className={`flex justify-between text-[8px] font-black uppercase tracking-widest mb-8 px-1 ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>
         <span>06:00</span>
         <span>12:00</span>
         <span>18:00</span>
         <span>24:00</span>
      </div>

      {/* Lista de Reservas (Cards) */}
      <div>
         {displayReservations.length > 0 ? (
           <div className="space-y-4">
             {displayReservations.map(res => {
                const [month, day] = res.date.split(' ');
                
                return (
                <div key={res.id} className={`p-1 bg-linear-to-r ${res.status === 'active' ? 'from-green-500/20 to-transparent' : 'from-transparent to-transparent'} rounded-[36px] transition-all`}>
                  <div className={`p-6 md:p-8 rounded-[32px] border transition-all flex flex-col md:flex-row md:items-center gap-6 group ${isLight ? 'bg-white border-zinc-200 hover:border-zinc-300' : 'bg-[#09090b] border-white/5 hover:border-white/10'}`}>
                     
                     {/* Date Badge */}
                     <div className="shrink-0 flex md:block items-center gap-4">
                        <div className={`rounded-2xl w-16 h-16 md:w-20 md:h-20 flex flex-col items-center justify-center border transition-colors shadow-inner ${isLight ? 'bg-zinc-100 border-zinc-200 group-hover:border-zinc-300' : 'bg-[#121214] border-white/5 group-hover:border-white/20'}`}>
                           <span className={`text-[9px] font-black uppercase tracking-widest ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{month}</span>
                           <span className={`text-2xl md:text-3xl font-black leading-none mt-1 ${isLight ? 'text-zinc-900' : 'text-white'}`}>{day}</span>
                        </div>
                     </div>

                     {/* Info */}
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                           <h5 className={`font-black text-lg md:text-xl uppercase leading-tight tracking-tight truncate ${isLight ? 'text-zinc-900' : 'text-white'}`}>{res.area}</h5>
                           {res.status === 'active' && (
                              <span className="px-2 py-0.5 rounded-md bg-green-500 text-black text-[8px] font-black uppercase tracking-widest animate-pulse">
                                 Em Andamento
                              </span>
                           )}
                        </div>
                        <div className={`flex items-center gap-2 mb-1 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                           <Users className="w-4 h-4" />
                           <p className={`text-xs font-bold uppercase tracking-wide ${isLight ? 'text-zinc-800' : 'text-white'}`}>{res.resident} <span className={isLight ? 'text-zinc-500' : 'text-zinc-600'}>• {formatUnit(res.unit)}</span></p>
                        </div>
                        <div className={`flex items-center gap-2 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                           <Clock className="w-3 h-3" />
                           <span className="text-[10px] font-bold uppercase tracking-widest">{res.time}</span>
                        </div>
                     </div>

                     {/* Action Buttons: Check-in/Check-out + Excluir */}
                     <div className="w-full md:w-auto shrink-0 flex flex-wrap items-center gap-2 justify-end">
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
                             className={`w-full md:w-40 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-red-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${isLight ? 'bg-zinc-100 text-red-600 hover:bg-red-500 hover:text-white' : 'bg-zinc-800 text-red-500 hover:bg-red-500 hover:text-white'}`}
                           >
                              <Timer className="w-4 h-4" /> Check-out
                           </button>
                        )}
                        {res.status === 'completed' && (
                           <div className={`w-full md:w-40 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border flex items-center justify-center gap-2 cursor-default ${isLight ? 'bg-zinc-100 text-zinc-500 border-zinc-200' : 'bg-zinc-900/50 text-zinc-600 border-white/5'}`}>
                              Finalizado
                           </div>
                        )}
                        {onDeleteReservation && (
                           <button
                             type="button"
                             onClick={() => {
                               if (window.confirm('Excluir esta reserva? A ação não pode ser desfeita.')) {
                                 onDeleteReservation(res.id);
                               }
                             }}
                             className={`p-3 rounded-2xl border transition-all hover:scale-105 active:scale-95 ${isLight ? 'border-red-200 text-red-600 hover:bg-red-500 hover:text-white' : 'border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white'}`}
                             title="Excluir reserva"
                             aria-label="Excluir reserva"
                           >
                             <Trash2 className="w-5 h-5" />
                           </button>
                        )}
                     </div>
                  </div>
                </div>
                );
             })}
           </div>
         ) : (
            <div className={`py-24 text-center opacity-30 font-black uppercase text-xs tracking-[0.2em] border-2 border-dashed rounded-[48px] flex flex-col items-center gap-4 ${isLight ? 'border-zinc-300 text-zinc-500' : 'border-white/5 text-zinc-400'}`}>
               <CalendarIcon className="w-10 h-10 opacity-50" />
               {reservationSearch.trim() ? 'Nenhuma reserva encontrada para este filtro ou busca' : 'Nenhuma reserva encontrada para este filtro'}
            </div>
         )}
      </div>
    </div>
  );
};

export default ReservationsView;
