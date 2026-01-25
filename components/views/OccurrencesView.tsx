
import React from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { Occurrence } from '../../types';
import { formatUnit } from '../../utils/unitFormatter';

interface OccurrencesViewProps {
  allOccurrences: Occurrence[];
  occurrenceSearch: string;
  setOccurrenceSearch: (val: string) => void;
  setIsOccurrenceModalOpen: (val: boolean) => void;
  handleResolveOccurrence: (id: string) => void;
}

const OccurrencesView: React.FC<OccurrencesViewProps> = ({
  allOccurrences,
  occurrenceSearch,
  setOccurrenceSearch,
  setIsOccurrenceModalOpen,
  handleResolveOccurrence
}) => {
  const displayOccurrences = allOccurrences.filter(occ => 
    occ.residentName.toLowerCase().includes(occurrenceSearch.toLowerCase()) ||
    occ.unit.toLowerCase().includes(occurrenceSearch.toLowerCase()) ||
    occ.description.toLowerCase().includes(occurrenceSearch.toLowerCase()) ||
    occ.date.toLowerCase().includes(occurrenceSearch.toLowerCase()) ||
    occ.status.toLowerCase().includes(occurrenceSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="text-3xl font-black uppercase tracking-tighter">Ocorrências</h3>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
             <input 
                type="text" 
                placeholder="Pesquisar Ocorrência..." 
                value={occurrenceSearch}
                onChange={e => setOccurrenceSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-bold outline-none focus:border-white/30 transition-all placeholder:opacity-20"
             />
          </div>
          <button onClick={() => setIsOccurrenceModalOpen(true)} className="px-6 py-3 bg-red-600 text-white rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap"><Plus className="w-4 h-4 inline mr-2" /> Nova Ocorrência</button>
        </div>
      </header>
      <div className="space-y-4">
        {displayOccurrences.map(occ => (
          <div key={occ.id} className="premium-glass p-6 rounded-[32px]">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-black text-lg uppercase">{occ.residentName} - {formatUnit(occ.unit)}</h4>
              <span className="text-[10px] font-black uppercase opacity-40">{occ.date}</span>
            </div>
            <p className="text-sm opacity-70 mb-4">{occ.description}</p>
            <div className="flex justify-between items-center">
              <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${occ.status === 'Aberto' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                {occ.status}
              </span>
              {occ.status === 'Aberto' && (
                <button 
                  onClick={() => handleResolveOccurrence(occ.id)}
                  className="px-4 py-1.5 bg-zinc-100 text-black rounded-xl text-[9px] font-black uppercase hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-sm border border-black/5"
                >
                  <Check className="w-3 h-3" /> Resolver
                </button>
              )}
            </div>
          </div>
        ))}
        {displayOccurrences.length === 0 && (
          <div className="py-20 text-center opacity-20 font-black uppercase text-sm tracking-widest border-2 border-dashed border-white/5 rounded-[48px]">
             Nenhuma ocorrência encontrada
          </div>
        )}
      </div>
    </div>
  );
};

export default OccurrencesView;
