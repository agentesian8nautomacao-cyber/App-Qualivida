import React from 'react';
import { SearchCode, Search, Package as PackageIcon, ArrowRight, Users, ShieldAlert, ChevronRight, Home, MessageSquare, Calendar } from 'lucide-react';
import RecentEventsBar from '../RecentEventsBar';
import { QuickViewCategory } from '../../types';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { formatUnit } from '../../utils/unitFormatter';

interface DashboardViewProps {
  globalSearchQuery: string;
  setGlobalSearchQuery: (val: string) => void;
  hasAnyGlobalResult: boolean;
  globalResults: any;
  setActiveTab: (tab: string) => void;
  setResidentSearch: (val: string) => void;
  eventStates: any;
  setQuickViewCategory: (cat: QuickViewCategory) => void;
  setIsNewPackageModalOpen: () => void;
  setPackageSearch?: (val: string) => void;
  setOccurrenceSearch?: (val: string) => void;
  setVisitorSearch?: (val: string) => void;
  setSelectedPackageForDetail?: (pkg: any) => void;
  setSelectedVisitorForDetail?: (v: any) => void;
  setSelectedOccurrenceForDetail?: (o: any) => void;
  setReservationFilter?: (f: 'all' | 'today' | 'pending') => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({
  globalSearchQuery,
  setGlobalSearchQuery,
  hasAnyGlobalResult,
  globalResults,
  setActiveTab,
  setResidentSearch,
  eventStates,
  setQuickViewCategory,
  setIsNewPackageModalOpen,
  setPackageSearch,
  setOccurrenceSearch,
  setVisitorSearch,
  setSelectedPackageForDetail,
  setSelectedVisitorForDetail,
  setSelectedOccurrenceForDetail,
  setReservationFilter,
}) => {
  const { config } = useAppConfig();
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10 relative">
      <header className="px-2">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tighter text-contrast-high leading-tight uppercase">Central Operacional</h3>
          <p className="text-[9px] sm:text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-contrast-low">{config.condominiumName} Gestão Premium</p>
      </header>

      <div className="relative group z-[100]">
        <SearchCode className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 opacity-40 group-hover:text-[var(--text-primary)] transition-all" />
        <input 
          type="text" 
          placeholder="Busca Geral: Nome, Unidade, Status..." 
          value={globalSearchQuery}
          onChange={(e) => setGlobalSearchQuery(e.target.value)}
          className="w-full pl-12 sm:pl-16 pr-4 sm:pr-6 py-4 sm:py-5 md:py-6 text-base sm:text-lg md:text-xl bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-[24px] sm:rounded-[32px] outline-none font-black tracking-tight focus:ring-4 focus:ring-[var(--text-primary)]/10 transition-all placeholder:opacity-20 shadow-lg"
        />

        {/* PAINEL DE BUSCA GLOBAL (COMMAND PALETTE STYLE) */}
        {globalSearchQuery.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-3 p-4 premium-glass rounded-[40px] shadow-2xl animate-in slide-in-from-top-4 duration-300 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {hasAnyGlobalResult ? (
              <div className="space-y-6 p-2">
                {globalResults?.residents?.length > 0 && (
                  <section>
                    <header className="flex items-center gap-2 mb-3 px-3">
                      <Users className="w-3 h-3 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Moradores</span>
                    </header>
                    <div className="grid grid-cols-1 gap-2">
                      {globalResults.residents.map((r: any) => (
                        <button 
                          key={r.id} 
                          onClick={() => { setActiveTab('residents'); setGlobalSearchQuery(''); setResidentSearch(r.name); }}
                          className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between text-left transition-all group"
                        >
                          <div>
                            <h6 className="text-sm font-black uppercase tracking-tight">{r.name}</h6>
                            <p className="text-[10px] opacity-40 uppercase font-black">{formatUnit(r.unit)}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {globalResults?.packages?.length > 0 && setPackageSearch && setSelectedPackageForDetail && (
                  <section>
                    <header className="flex items-center gap-2 mb-3 px-3">
                      <PackageIcon className="w-3 h-3 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Encomendas</span>
                    </header>
                    <div className="grid grid-cols-1 gap-2">
                      {globalResults.packages.map((p: any) => (
                        <button 
                          key={p.id} 
                          onClick={() => { setActiveTab('packages'); setGlobalSearchQuery(''); setPackageSearch(p.recipient || ''); setSelectedPackageForDetail(p); }}
                          className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between text-left transition-all group"
                        >
                          <div>
                            <h6 className="text-sm font-black uppercase tracking-tight">{p.recipient}</h6>
                            <p className="text-[10px] opacity-40 uppercase font-black">{formatUnit(p.unit)} • {p.type} • {p.status}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {globalResults?.visitors?.length > 0 && setVisitorSearch && setSelectedVisitorForDetail && (
                  <section>
                    <header className="flex items-center gap-2 mb-3 px-3">
                      <Users className="w-3 h-3 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Visitantes</span>
                    </header>
                    <div className="grid grid-cols-1 gap-2">
                      {globalResults.visitors.map((v: any) => (
                        <button 
                          key={v.id} 
                          onClick={() => { setActiveTab('visitors'); setGlobalSearchQuery(''); setVisitorSearch?.(v.visitorNames || v.residentName || ''); setSelectedVisitorForDetail(v); }}
                          className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between text-left transition-all group"
                        >
                          <div>
                            <h6 className="text-sm font-black uppercase tracking-tight">{v.visitorNames || v.residentName || '—'}</h6>
                            <p className="text-[10px] opacity-40 uppercase font-black">{formatUnit(v.unit)} • {v.residentName}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {globalResults?.occurrences?.length > 0 && setOccurrenceSearch && setSelectedOccurrenceForDetail && (
                  <section>
                    <header className="flex items-center gap-2 mb-3 px-3">
                      <ShieldAlert className="w-3 h-3 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Ocorrências</span>
                    </header>
                    <div className="grid grid-cols-1 gap-2">
                      {globalResults.occurrences.map((o: any) => (
                        <button 
                          key={o.id} 
                          onClick={() => { setActiveTab('occurrences'); setGlobalSearchQuery(''); setOccurrenceSearch?.(o.description?.slice(0, 30) || ''); setSelectedOccurrenceForDetail(o); }}
                          className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between text-left transition-all group"
                        >
                          <div className="min-w-0 flex-1">
                            <h6 className="text-sm font-black uppercase tracking-tight truncate">{o.description}</h6>
                            <p className="text-[10px] opacity-40 uppercase font-black">{formatUnit(o.unit)} • {o.status}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {globalResults?.reservations?.length > 0 && setReservationFilter && (
                  <section>
                    <header className="flex items-center gap-2 mb-3 px-3">
                      <Calendar className="w-3 h-3 opacity-30" />
                      <span className="text-[9px] font-black uppercase tracking-widest opacity-30">Reservas</span>
                    </header>
                    <div className="grid grid-cols-1 gap-2">
                      {globalResults.reservations.map((r: any) => (
                        <button 
                          key={r.id} 
                          onClick={() => { setActiveTab('reservations'); setGlobalSearchQuery(''); setReservationFilter('all'); }}
                          className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-between text-left transition-all group"
                        >
                          <div>
                            <h6 className="text-sm font-black uppercase tracking-tight">{r.resident} • {r.area}</h6>
                            <p className="text-[10px] opacity-40 uppercase font-black">{formatUnit(r.unit)} • {r.date} • {r.time}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            ) : (
              <div className="py-12 text-center">
                 <Search className="w-8 h-8 opacity-10 mx-auto mb-4" />
                 <p className="text-xs font-black uppercase tracking-widest opacity-20">Nenhum resultado para "{globalSearchQuery}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-0">
        <RecentEventsBar eventStates={eventStates} onOpenQuickView={(cat) => setQuickViewCategory(cat)} />

        <div 
          onClick={() => setIsNewPackageModalOpen()}
          className="w-full contrast-card rounded-[32px] sm:rounded-[40px] md:rounded-[48px] p-6 sm:p-8 md:p-12 flex flex-col md:flex-row items-center justify-between transition-all shadow-2xl relative overflow-hidden group cursor-pointer border-none"
        >
          {/* ... Main Card Content ... */}
          <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8 md:gap-10 relative z-10 w-full">
            <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-[24px] sm:rounded-[28px] md:rounded-[32px] bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-500 shadow-xl flex-shrink-0">
               <PackageIcon className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10" />
            </div>
            <div className="text-center md:text-left flex-1 min-w-0">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Gestão de Recebimentos</span>
              <h4 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter leading-none uppercase mt-2">Registro de Encomendas</h4>
              <p className="text-xs sm:text-sm font-medium opacity-60 mt-2 sm:mt-3 max-w-lg">Fácil de registrar.</p>
            </div>
            <div className="md:ml-auto flex-shrink-0">
               <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border border-black/10 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all active:scale-90">
                  <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
               </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-black opacity-[0.02] rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
        <div onClick={() => setActiveTab('visitors')} className="group secondary-card p-6 sm:p-8 h-auto sm:h-[200px] md:h-[240px] rounded-[32px] sm:rounded-[40px] md:rounded-[48px] flex flex-col justify-between cursor-pointer shadow-xl transition-all">
           <Users className="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
           <div className="mt-auto">
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none">VISITANTES</h3>
              <p className="text-[9px] sm:text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1 sm:mt-2">Controle de acesso</p>
           </div>
           <div className="flex justify-end mt-3 sm:mt-4">
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 opacity-20 group-hover:translate-x-1 transition-transform" />
           </div>
        </div>
        
        <div onClick={() => setActiveTab('occurrences')} className="group secondary-card p-6 sm:p-8 h-auto sm:h-[200px] md:h-[240px] rounded-[32px] sm:rounded-[40px] md:rounded-[48px] flex flex-col justify-between cursor-pointer shadow-xl transition-all">
           <ShieldAlert className="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
           <div className="mt-auto">
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none">OCORRÊNCIAS</h3>
              <p className="text-[9px] sm:text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1 sm:mt-2">Segurança e Relatos</p>
           </div>
           <div className="flex justify-end mt-3 sm:mt-4">
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 opacity-20 group-hover:translate-x-1 transition-transform" />
           </div>
        </div>
        <div onClick={() => setActiveTab('residents')} className="group secondary-card p-6 sm:p-8 h-auto sm:h-[200px] md:h-[240px] rounded-[32px] sm:rounded-[40px] md:rounded-[48px] flex flex-col justify-between cursor-pointer shadow-xl transition-all sm:col-span-2 md:col-span-1">
           <Home className="w-6 h-6 sm:w-8 sm:h-8 opacity-20" />
           <div className="mt-auto">
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none">MORADORES</h3>
              <p className="text-[9px] sm:text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1 sm:mt-2">Base de unidades</p>
           </div>
           <div className="flex justify-end mt-3 sm:mt-4">
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 opacity-20 group-hover:translate-x-1 transition-transform" />
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
