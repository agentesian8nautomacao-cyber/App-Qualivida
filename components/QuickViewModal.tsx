
import React from 'react';
import { Package, UserCircle, AlertCircle, Calendar, Edit3, Bell, Plus, X, ChevronRight, Check, ExternalLink as LinkIcon } from 'lucide-react';
import { QuickViewCategory } from '../types';

interface QuickViewModalProps {
  category: QuickViewCategory;
  data: any[];
  onClose: () => void;
  onGoToPage: (cat: string) => void;
  onSelectItem: (item: any) => void;
  onMarkAsDone?: (item: any) => void;
  onAddNew?: () => void;
}

const QuickViewModal: React.FC<QuickViewModalProps> = ({ 
  category, 
  data, 
  onClose, 
  onGoToPage,
  onSelectItem,
  onMarkAsDone,
  onAddNew
}) => {
  if (!category) return null;

  const config = {
    packages: { title: 'Volumes Pendentes', icon: Package, color: 'text-blue-500', tab: 'packages' },
    visitors: { title: 'Visitantes no Prédio', icon: UserCircle, color: 'text-purple-500', tab: 'visitors' },
    occurrences: { title: 'Ocorrências Ativas', icon: AlertCircle, color: 'text-red-500', tab: 'occurrences' },
    reservations: { title: 'Agenda de Hoje', icon: Calendar, color: 'text-amber-500', tab: 'reservations' },
    notices: { title: 'Últimos Comunicados', icon: Bell, color: 'text-green-500', tab: 'notices' },
  }[category];

  const isClickable = category === 'packages' || category === 'visitors' || category === 'occurrences' || category === 'reservations' || category === 'notices';

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white text-black rounded-[40px] shadow-2xl p-8 md:p-10 animate-in zoom-in duration-300">
        <header className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
            <div className={`p-4 rounded-3xl bg-zinc-50 ${config.color}`}>
              <config.icon className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-2xl font-black uppercase tracking-tight">{config.title}</h4>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Visualização Rápida</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {category === 'visitors' && onAddNew && (
              <button 
                onClick={onAddNew}
                className="px-4 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Novo Acesso
              </button>
            )}
            <button onClick={onClose} className="p-3 bg-zinc-100 rounded-2xl hover:bg-zinc-200 transition-all"><X className="w-5 h-5"/></button>
          </div>
        </header>

        <div className="space-y-3 mb-8 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
          {data && data.length > 0 ? (
            data.map((item: any, idx: number) => (
              <div 
                key={idx} 
                onClick={() => isClickable ? onSelectItem(item) : null}
                className={`p-5 bg-zinc-50 border border-black/5 rounded-3xl flex items-center justify-between group transition-all ${isClickable ? 'cursor-pointer hover:bg-zinc-100 hover:scale-[1.02] active:scale-95' : ''}`}
              >
                <div>
                  <h6 className="font-black text-sm uppercase">{item.title || item.recipient || item.visitorNames || item.area || item.content || item.residentName}</h6>
                  <p className="text-xs opacity-50 font-medium">{item.subtitle || (item.unit ? `Unidade ${item.unit}` : null) || item.date}</p>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-[10px] font-black opacity-30">{item.time || item.displayTime || ''}</span>
                   

                   {isClickable && <ChevronRight className="w-4 h-4 opacity-10 group-hover:opacity-100 transition-opacity" />}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center opacity-20 italic font-black uppercase text-xs border-2 border-dashed border-zinc-100 rounded-3xl">
              Nenhuma informação pendente
            </div>
          )}
        </div>

        <button 
          onClick={() => { onGoToPage(config.tab); onClose(); }}
          className="w-full py-5 bg-black text-white rounded-[24px] font-black uppercase text-[11px] tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <LinkIcon className="w-4 h-4" /> Acessar Gestão Completa
        </button>
      </div>
    </div>
  );
};

export default QuickViewModal;
