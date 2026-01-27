
import React from 'react';
import { Search, UserPlus, Edit2, Trash2, MessageCircle, Mail, UserCircle, Upload } from 'lucide-react';
import { Resident, Package, VisitorLog } from '../../types';
import { formatUnit } from '../../utils/unitFormatter';
import { openWhatsApp } from '../../utils/phoneNormalizer';
import { useToast } from '../../contexts/ToastContext';

interface ResidentsViewProps {
  allResidents: Resident[];
  residentSearch: string;
  setResidentSearch: (val: string) => void;
  handleOpenResidentModal: (resident?: Resident) => void;
  setSelectedResidentProfile: (resident: Resident) => void;
  handleDeleteResident: (id: string) => void;
  allPackages: Package[];
  visitorLogs: VisitorLog[];
  onImportClick?: () => void;
}

const ResidentsView: React.FC<ResidentsViewProps> = ({
  allResidents,
  residentSearch,
  setResidentSearch,
  handleOpenResidentModal,
  setSelectedResidentProfile,
  handleDeleteResident,
  allPackages,
  visitorLogs,
  onImportClick
}) => {
  const toast = useToast();
  const displayResidents = allResidents.filter(r => 
    r.name.toLowerCase().includes(residentSearch.toLowerCase()) || 
    r.unit.toLowerCase().includes(residentSearch.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tighter">Moradores</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">Gestão de Unidades</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
             <input 
                type="text" 
                placeholder="Buscar por Nome ou Unidade..." 
                value={residentSearch}
                onChange={e => setResidentSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-xs font-bold outline-none focus:border-[var(--text-primary)]/50 transition-all placeholder:opacity-40"
                style={{ color: 'var(--text-primary)' }}
             />
          </div>
          {onImportClick && (
            <button 
              onClick={onImportClick} 
              className="px-6 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-2 hover:bg-[var(--border-color)]"
            >
              <Upload className="w-4 h-4" /> Importar
            </button>
          )}
          <button 
            onClick={() => handleOpenResidentModal()} 
            className="px-6 py-3 bg-[var(--text-primary)] text-[var(--bg-color)] rounded-full text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" /> Novo Morador
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayResidents.map(resident => {
          const hasPendingPackage = allPackages.some(p => p.recipient === resident.name && p.status === 'Pendente');
          const hasActiveVisitor = visitorLogs.some(v => v.residentName === resident.name && v.status === 'active');
          
          return (
            <div 
              key={resident.id} 
              onClick={() => setSelectedResidentProfile(resident)}
              className="premium-glass p-6 rounded-[32px] group relative overflow-hidden transition-all hover:scale-[1.01] hover:shadow-2xl hover:bg-[var(--border-color)] cursor-pointer"
            >
              <div className="flex items-start justify-between mb-6">
                 <div className="relative">
                   <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/5 flex items-center justify-center text-xl font-black relative overflow-hidden">
                      {resident.name.substring(0, 2).toUpperCase()}
                      {/* Status dots attached to avatar */}
                      <div className="absolute top-1 right-1 flex gap-1">
                         {hasPendingPackage && <span className="w-2.5 h-2.5 bg-blue-500 rounded-full ring-2 ring-black animate-pulse" title="Encomenda Pendente" />}
                         {hasActiveVisitor && <span className="w-2.5 h-2.5 bg-purple-500 rounded-full ring-2 ring-black" title="Visitante Ativo" />}
                      </div>
                   </div>
                 </div>
                 
                 <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenResidentModal(resident); }}
                      className="p-2 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl hover:bg-[var(--text-primary)] hover:text-[var(--bg-color)] transition-all" 
                      style={{ color: 'var(--text-primary)' }}
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteResident(resident.id); }}
                      className="p-2 bg-red-500/10 text-red-500 border border-red-500/30 rounded-xl hover:bg-red-500 hover:text-white transition-all" 
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                 </div>
              </div>

              <div>
                 <span className="px-3 py-1 rounded-lg bg-[var(--glass-bg)] text-[9px] font-black uppercase tracking-widest border border-[var(--border-color)]" style={{ color: 'var(--text-primary)' }}>{formatUnit(resident.unit)}</span>
                 <h4 className="text-xl font-black uppercase mt-3 leading-tight truncate group-hover:text-blue-400 transition-colors">{resident.name}</h4>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex gap-2">
                 {resident.whatsapp && (
                   <button 
                     onClick={(e) => { 
                       e.stopPropagation(); 
                       openWhatsApp(resident.whatsapp, undefined, (error) => {
                         toast.error(`Erro ao abrir WhatsApp: ${error}`);
                       });
                     }}
                     className="flex-1 py-3 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all text-[10px] font-black uppercase flex items-center justify-center gap-2"
                   >
                     <MessageCircle className="w-3 h-3" /> WhatsApp
                   </button>
                 )}
                 {resident.email && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); window.open(`mailto:${resident.email}`, '_blank'); }}
                     className="flex-1 py-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--border-color)] hover:bg-[var(--text-primary)] hover:text-[var(--bg-color)] transition-all text-[10px] font-black uppercase flex items-center justify-center gap-2"
                     style={{ color: 'var(--text-primary)' }}
                   >
                     <Mail className="w-3 h-3" /> Email
                   </button>
                 )}
              </div>
            </div>
          );
        })}
        
        {displayResidents.length === 0 && (
           <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[48px] opacity-30">
              <UserCircle className="w-12 h-12 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhum morador encontrado</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default ResidentsView;
