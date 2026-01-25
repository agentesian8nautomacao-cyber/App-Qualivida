
import React from 'react';
import { SearchCode, Search, Package as PackageIcon, ArrowRight, Users, ShieldAlert, ChevronRight, Home } from 'lucide-react';
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
  setIsNewPackageModalOpen
}) => {
  const { config } = useAppConfig();
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10 relative">
      <header className="px-2">
          <h3 className="text-2xl md:text-3xl font-black tracking-tighter text-contrast-high leading-tight uppercase">Central Operacional</h3>
          <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-contrast-low">{config.condominiumName} Gestão Premium</p>
      </header>

      <div className="relative group z-[100]">
        <SearchCode className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 opacity-40 group-hover:text-[var(--text-primary)] transition-all" />
        <input 
          type="text" 
          placeholder="Busca Geral: Nome, Unidade, Status (Pendente, Entregue), Categoria..." 
          value={globalSearchQuery}
          onChange={(e) => setGlobalSearchQuery(e.target.value)}
          className="w-full pl-16 pr-6 py-6 text-xl bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-[32px] outline-none font-black tracking-tight focus:ring-4 focus:ring-[var(--text-primary)]/10 transition-all placeholder:opacity-20 shadow-lg"
        />

        {/* PAINEL DE BUSCA GLOBAL (COMMAND PALETTE STYLE) */}
        {globalSearchQuery.length >= 2 && (
          <div className="absolute top-full left-0 right-0 mt-3 p-4 premium-glass rounded-[40px] shadow-2xl animate-in slide-in-from-top-4 duration-300 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* ... Global Search Content ... */}
            {hasAnyGlobalResult ? (
              <div className="space-y-6 p-2">
                {globalResults?.residents.length > 0 && (
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
                {/* ... other categories (simplified for brevity) ... */}
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
          onClick={() => setIsNewPackageModalOpen(true)}
          className="w-full contrast-card rounded-[48px] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between transition-all shadow-2xl relative overflow-hidden group cursor-pointer border-none"
        >
          {/* ... Main Card Content ... */}
          <div className="flex flex-col md:flex-row items-center gap-10 relative z-10 w-full">
            <div className="w-24 h-24 rounded-[32px] bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-500 shadow-xl">
               <PackageIcon className="w-10 h-10" />
            </div>
            <div className="text-center md:text-left">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Gestão de Recebimentos</span>
              <h4 className="text-4xl md:text-5xl font-black tracking-tighter leading-none uppercase mt-2">Registro de Encomendas</h4>
              <p className="text-sm font-medium opacity-60 mt-3 max-w-lg">Fácil de registrar.</p>
            </div>
            <div className="md:ml-auto">
               <div className="w-16 h-16 rounded-full border border-black/10 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all active:scale-90">
                  <ArrowRight className="w-6 h-6" />
               </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-black opacity-[0.02] rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div onClick={() => setActiveTab('visitors')} className="group secondary-card p-8 h-[240px] rounded-[48px] flex flex-col justify-between cursor-pointer shadow-xl transition-all">
           <Users className="w-8 h-8 opacity-20" />
           <div className="mt-auto">
              <h3 className="text-2xl font-black uppercase tracking-tight leading-none">VISITANTES</h3>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-2">Controle de acesso</p>
           </div>
           <div className="flex justify-end mt-4">
              <ChevronRight className="w-6 h-6 opacity-20 group-hover:translate-x-1 transition-transform" />
           </div>
        </div>
        
        <div onClick={() => setActiveTab('occurrences')} className="group secondary-card p-8 h-[240px] rounded-[48px] flex flex-col justify-between cursor-pointer shadow-xl transition-all">
           <ShieldAlert className="w-8 h-8 opacity-20" />
           <div className="mt-auto">
              <h3 className="text-2xl font-black uppercase tracking-tight leading-none">OCORRÊNCIAS</h3>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-2">Segurança e Relatos</p>
           </div>
           <div className="flex justify-end mt-4">
              <ChevronRight className="w-6 h-6 opacity-20 group-hover:translate-x-1 transition-transform" />
           </div>
        </div>
        <div onClick={() => setActiveTab('residents')} className="group secondary-card p-8 h-[240px] rounded-[48px] flex flex-col justify-between cursor-pointer shadow-xl transition-all">
           <Home className="w-8 h-8 opacity-20" />
           <div className="mt-auto">
              <h3 className="text-2xl font-black uppercase tracking-tight leading-none">MORADORES</h3>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-2">Base de unidades</p>
           </div>
           <div className="flex justify-end mt-4">
              <ChevronRight className="w-6 h-6 opacity-20 group-hover:translate-x-1 transition-transform" />
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
