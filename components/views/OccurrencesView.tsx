
import React from 'react';
import { Search, Plus, X } from 'lucide-react';
import { Occurrence } from '../../types';
import { formatUnit } from '../../utils/unitFormatter';

interface OccurrencesViewProps {
  allOccurrences: Occurrence[];
  occurrenceSearch: string;
  setOccurrenceSearch: (val: string) => void;
  setIsOccurrenceModalOpen: (val: boolean) => void;
  handleDeleteOccurrence: (id: string) => void;
  onOccurrenceClick?: (occurrence: Occurrence) => void;
  /** Porteiro só visualiza; Síndico pode criar/resolver/excluir. Resolver fica no modal de detalhes. */
  canAddOccurrence?: boolean;
  canResolve?: boolean;
  canDelete?: boolean;
}

function formatOccurrenceDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!Number.isFinite(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

const OccurrencesView: React.FC<OccurrencesViewProps> = ({
  allOccurrences,
  occurrenceSearch,
  setOccurrenceSearch,
  setIsOccurrenceModalOpen,
  handleDeleteOccurrence,
  onOccurrenceClick,
  canAddOccurrence = true,
  canResolve = true,
  canDelete = true,
}) => {
  const displayOccurrences = allOccurrences.filter(occ => {
    const name = (occ.residentName ?? '').toString().toLowerCase();
    const unit = (occ.unit ?? '').toString().toLowerCase();
    const desc = (occ.description ?? '').toString().toLowerCase();
    const date = (occ.date ?? '').toString().toLowerCase();
    const status = (occ.status ?? '').toString().toLowerCase();
    const q = (occurrenceSearch ?? '').trim().toLowerCase();
    if (!q) return true;
    return name.includes(q) || unit.includes(q) || desc.includes(q) || date.includes(q) || status.includes(q);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h3 className="text-3xl font-black uppercase tracking-tighter">Ocorrências</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
             <input 
                type="text" 
                placeholder="Pesquisar Ocorrência..." 
                value={occurrenceSearch}
                onChange={e => setOccurrenceSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-full text-xs font-bold outline-none focus:border-white/30 transition-all placeholder:opacity-20"
             />
          </div>
          {canAddOccurrence && (
            <button onClick={() => setIsOccurrenceModalOpen(true)} className="px-6 py-3 bg-red-600 text-white rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap w-full sm:w-auto flex items-center justify-center"><Plus className="w-4 h-4 mr-2" /> Nova Ocorrência</button>
          )}
        </div>
      </header>
      <div className="space-y-4">
        {displayOccurrences.map(occ => {
          const unreadMessages = occ.messages?.filter(msg => !msg.read && msg.senderRole !== 'MORADOR') || [];
          const hasUnreadMessages = unreadMessages.length > 0;

          return (
            <button
              key={occ.id}
              onClick={() => onOccurrenceClick && onOccurrenceClick(occ)}
              className="text-left premium-glass p-6 rounded-[32px] hover:border-[var(--text-primary)]/30 transition-all group"
            >
              <div className="flex justify-between items-start gap-3 mb-4">
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-lg uppercase leading-tight">{(occ.residentName ?? 'Morador')} - {formatUnit(occ.unit ?? '')}</h4>
                  <span className="text-[10px] font-black uppercase opacity-40 mt-1 block">{formatOccurrenceDate(occ.date)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasUnreadMessages && (
                    <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" title={`${unreadMessages.length} mensagem(ns) não lida(s)`} />
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOccurrence(occ.id);
                      }}
                      className="p-1.5 rounded-xl hover:bg-red-500/20 transition-all flex items-center justify-center border border-red-500/20 text-red-500 opacity-70 hover:opacity-100"
                      title={occ.status === 'Resolvido' ? 'Excluir ocorrência' : 'Apenas ocorrências resolvidas podem ser excluídas'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm opacity-70 mb-4 line-clamp-2">{occ.description ?? ''}</p>
              <div className="flex items-center gap-2">
                <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase ${occ.status === 'Aberto' ? 'bg-red-500/10 text-red-500' : occ.status === 'Em Andamento' ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'}`}>
                  {occ.status}
                </span>
                {occ.messages && occ.messages.length > 0 && (
                  <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-[8px] font-black uppercase">
                    {occ.messages.length} MSG
                  </span>
                )}
              </div>
            </button>
          );
        })}
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
