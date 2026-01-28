
import React from 'react';
import { Search, UserPlus, Phone, MessageCircle, MoreVertical, Trash2, Edit2, Briefcase, Upload } from 'lucide-react';
import { Staff } from '../../types';
import { openWhatsApp } from '../../utils/phoneNormalizer';
import { useToast } from '../../contexts/ToastContext';

interface StaffViewProps {
  allStaff: Staff[];
  staffSearch: string;
  setStaffSearch: (val: string) => void;
  onAddStaff: () => void;
  onEditStaff: (staff: Staff) => void;
  onDeleteStaff: (id: string) => void;
  onImportClick?: () => void;
}

const StaffView: React.FC<StaffViewProps> = ({
  allStaff,
  staffSearch,
  setStaffSearch,
  onAddStaff,
  onEditStaff,
  onDeleteStaff,
  onImportClick
}) => {
  const toast = useToast();
  const displayStaff = allStaff.filter(s => 
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) || 
    s.role.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.shift.toLowerCase().includes(staffSearch.toLowerCase())
  );

  const activeCount = allStaff.filter(s => s.status === 'Ativo').length;
  const vacationCount = allStaff.filter(s => s.status === 'Férias').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* HEADER & DASHBOARD RÁPIDO */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tighter">Funcionários</h3>
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">Gestão de Equipe & Turnos</p>
        </div>
        
        <div className="flex gap-4">
           <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <div>
                 <span className="block text-xl font-black leading-none">{activeCount}</span>
                 <span className="text-[9px] font-bold uppercase opacity-40">Operando</span>
              </div>
           </div>
           <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-md flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <div>
                 <span className="block text-xl font-black leading-none">{vacationCount}</span>
                 <span className="text-[9px] font-bold uppercase opacity-40">Férias</span>
              </div>
           </div>
        </div>
      </div>

      {/* BARRA DE AÇÕES */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
         <div className="relative flex-1">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
             <input 
                type="text" 
                placeholder="Buscar por nome, cargo ou turno..." 
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold outline-none focus:border-white/30 transition-all placeholder:opacity-20"
             />
         </div>
         <div className="flex gap-2 justify-end flex-wrap sm:flex-nowrap w-full md:w-auto">
           <button 
             onClick={onAddStaff} 
             className="px-6 py-3 bg-white text-black rounded-2xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-transform whitespace-nowrap flex items-center gap-2 w-full sm:w-auto"
           >
             <UserPlus className="w-4 h-4" /> Novo Colaborador
           </button>
           {onImportClick && (
             <button
               onClick={onImportClick}
              className="px-6 py-3 bg-white/5 border border-white/10 text-[10px] font-black uppercase rounded-2xl hover:bg-white/10 transition-transform hover:scale-105 whitespace-nowrap flex items-center gap-2 w-full sm:w-auto"
             >
               <Upload className="w-4 h-4" /> Importar Funcionários
             </button>
           )}
         </div>
      </div>

      {/* GRID DE CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayStaff.map(staff => (
          <div 
            key={staff.id} 
            className="premium-glass p-6 rounded-[32px] group relative overflow-hidden transition-all hover:border-white/20 hover:shadow-2xl flex flex-col justify-between min-h-[280px]"
          >
             {/* Efeito Glow baseado no status */}
             <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-20 -mr-10 -mt-10 pointer-events-none transition-colors ${staff.status === 'Ativo' ? 'bg-green-500' : staff.status === 'Férias' ? 'bg-amber-500' : 'bg-red-500'}`} />

             <div>
                <div className="flex justify-between items-start mb-6">
                   <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/5 flex items-center justify-center text-2xl font-black shadow-inner">
                      {staff.name.substring(0, 2).toUpperCase()}
                   </div>
                   <div className="flex gap-1">
                      <button onClick={() => onEditStaff(staff)} className="p-2.5 bg-white/5 hover:bg-white hover:text-black rounded-xl transition-all"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => onDeleteStaff(staff.id)} className="p-2.5 bg-white/5 hover:bg-red-500 hover:text-white text-red-400 rounded-xl transition-all"><Trash2 className="w-4 h-4" /></button>
                   </div>
                </div>

                <div className="mb-6">
                   <h4 className="text-xl font-black uppercase leading-tight truncate">{staff.name}</h4>
                   <div className="flex items-center gap-2 mt-2">
                      <Briefcase className="w-3 h-3 opacity-40" />
                      <span className="text-xs font-bold uppercase opacity-60">{staff.role}</span>
                   </div>
                </div>

                <div className="flex gap-2 mb-6">
                   <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${staff.status === 'Ativo' ? 'bg-green-500/10 text-green-400 border-green-500/20' : staff.status === 'Férias' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                      {staff.status}
                   </span>
                   <span className="px-3 py-1.5 rounded-lg bg-white/5 text-[9px] font-black uppercase tracking-widest border border-white/5 text-zinc-400">
                      {staff.shift}
                   </span>
                </div>
             </div>

             <div className="mt-auto grid grid-cols-2 gap-3 pt-6 border-t border-white/5">
                <button 
                  disabled={!staff.phone}
                  onClick={() => window.open(`tel:${staff.phone}`)}
                  className="py-3 rounded-xl bg-white/5 hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                   <Phone className="w-4 h-4" />
                </button>
                <button 
                  disabled={!staff.phone}
                  onClick={() => openWhatsApp(staff.phone, undefined, (error) => toast.error(`Erro ao abrir WhatsApp: ${error}`))}
                  className="py-3 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                   <MessageCircle className="w-4 h-4" />
                </button>
             </div>
          </div>
        ))}
        
        {displayStaff.length === 0 && (
           <div className="col-span-full py-24 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[48px] opacity-30">
              <Briefcase className="w-10 h-10 mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhum colaborador encontrado</p>
           </div>
        )}
      </div>
    </div>
  );
};

export default StaffView;
