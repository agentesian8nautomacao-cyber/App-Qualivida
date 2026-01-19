
import React from 'react';
import { X, Search, ChevronDown, AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, Plus, Check, Minus, Edit2, MessageCircle, Bell, Settings2, Clock, Save, Briefcase, User, Phone, Mail } from 'lucide-react';
import { Resident, PackageItem, Staff } from '../../types';

// --- MODAL NOVA RESERVA ---
export const NewReservationModal = ({
  isOpen, onClose, data, setData, areasStatus, searchQuery, setSearchQuery, 
  showSuggestions, setShowSuggestions, filteredResidents, hasConflict, onConfirm
}: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-zinc-900/50 text-white rounded-[40px] shadow-2xl p-10 border border-white/5 animate-in zoom-in duration-300">
         <header className="flex justify-between items-center mb-10">
            <div>
               <h4 className="text-3xl font-black uppercase tracking-tight text-white">Nova Reserva</h4>
               <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Agendamento de Espaço</p>
            </div>
            <button onClick={onClose} className="p-4 bg-white/5 rounded-3xl hover:bg-white/10 transition-colors border border-white/5"><X className="w-5 h-5"/></button>
         </header>
         
         <div className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">Área Comum</label>
               <div className="relative">
                  <select 
                    value={data.area}
                    onChange={(e) => setData({...data, area: e.target.value})}
                    className="w-full p-5 bg-white/5 rounded-2xl outline-none font-bold text-sm border-none focus:ring-1 focus:ring-white/30 appearance-none text-white transition-all shadow-inner"
                  >
                     {areasStatus.map((area: any) => (
                        <option key={area.id} value={area.name} className="bg-zinc-900 text-white">{area.name}</option>
                     ))}
                  </select>
                  <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">Morador</label>
                  <div className="relative group">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                     <input 
                       type="text" 
                       placeholder="Buscar..."
                       value={searchQuery || data.resident}
                       onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setData({...data, resident: e.target.value});
                          setShowSuggestions(true);
                       }}
                       onFocus={() => setShowSuggestions(true)}
                       className="w-full pl-12 pr-4 p-5 bg-white/5 rounded-2xl outline-none font-bold text-sm border-none focus:ring-1 focus:ring-white/30 text-white placeholder:text-zinc-600 transition-all shadow-inner"
                       autoComplete="off"
                     />
                  </div>
                  {showSuggestions && searchQuery && filteredResidents.length > 0 && (
                     <div className="absolute top-full left-0 w-full mt-2 bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                        {filteredResidents.map((r: Resident) => (
                           <div 
                             key={r.id}
                             onClick={() => {
                                setData({ ...data, resident: r.name, unit: r.unit });
                                setSearchQuery(r.name);
                                setShowSuggestions(false);
                             }}
                             className="p-4 hover:bg-white/10 cursor-pointer flex justify-between items-center group transition-colors border-b border-white/5 last:border-0"
                           >
                              <span className="text-xs font-bold uppercase text-white group-hover:text-blue-400">{r.name}</span>
                              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-white">UN {r.unit}</span>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">Unidade</label>
                  <div className="relative">
                     <div className="absolute inset-y-0 left-0 w-1 bg-white/10 rounded-l-2xl"></div>
                     <input 
                       type="text" 
                       readOnly
                       value={data.unit}
                       className="w-full p-5 bg-black/20 rounded-2xl outline-none font-black text-sm border border-transparent text-white/50 cursor-not-allowed text-center tracking-widest"
                       placeholder="---"
                     />
                  </div>
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">Data</label>
               <input 
                 type="date"
                 value={data.date}
                 onChange={(e) => setData({...data, date: e.target.value})}
                 className="w-full p-5 bg-white/5 rounded-2xl outline-none font-bold text-sm border-none focus:ring-1 focus:ring-white/30 text-white uppercase tracking-widest shadow-inner cursor-pointer"
               />
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ml-2 transition-colors ${hasConflict ? 'text-red-500' : 'text-zinc-500'}`}>Início</label>
                  <input 
                    type="time"
                    value={data.startTime}
                    onChange={(e) => setData({...data, startTime: e.target.value})}
                    className={`w-full p-5 bg-white/5 rounded-2xl outline-none font-bold text-sm border border-transparent focus:ring-1 focus:ring-white/30 text-white shadow-inner transition-all ${hasConflict ? 'border-red-500/50 bg-red-500/10' : ''}`}
                  />
               </div>
               <div className="space-y-2">
                  <label className={`text-[10px] font-bold uppercase tracking-widest ml-2 transition-colors ${hasConflict ? 'text-red-500' : 'text-zinc-500'}`}>Fim</label>
                  <input 
                    type="time"
                    value={data.endTime}
                    onChange={(e) => setData({...data, endTime: e.target.value})}
                    className={`w-full p-5 bg-white/5 rounded-2xl outline-none font-bold text-sm border border-transparent focus:ring-1 focus:ring-white/30 text-white shadow-inner transition-all ${hasConflict ? 'border-red-500/50 bg-red-500/10' : ''}`}
                  />
               </div>
            </div>

            {hasConflict && (
               <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-xl animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-wide">Horário Indisponível (Conflito)</span>
               </div>
            )}

            <button 
              onClick={onConfirm}
              disabled={!data.resident || !data.date || hasConflict}
              className="w-full py-6 bg-white text-black rounded-[24px] font-black uppercase text-[11px] tracking-[0.2em] hover:bg-zinc-200 hover:scale-[1.02] active:scale-95 transition-all mt-6 shadow-xl disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
               {hasConflict ? 'Verifique o Horário' : 'Confirmar Agendamento'}
            </button>
         </div>
      </div>
    </div>
  );
};

// --- MODAL NOVO VISITANTE ---
export const NewVisitorModal = ({
  isOpen, onClose, step, setStep, data, setData, searchResident, setSearchResident,
  filteredResidents, accessTypes, handleRemoveAccessType, isAddingAccessType, setIsAddingAccessType,
  newAccessTypeInput, setNewAccessTypeInput, handleAddAccessType, onConfirm
}: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white text-black rounded-[48px] shadow-2xl p-8 md:p-12 animate-in zoom-in duration-500">
         <header className="flex justify-between items-start mb-8">
            <div>
               <h4 className="text-3xl font-black uppercase tracking-tighter">Novo Acesso</h4>
               <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.3em]">Passo 0{step} de 03</p>
            </div>
            <button onClick={onClose} className="p-4 bg-zinc-50 rounded-3xl hover:bg-zinc-100 transition-all"><X className="w-6 h-6"/></button>
         </header>

         {step === 1 && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="relative">
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Vincular Morador</label>
                 <div className="relative">
                   <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 opacity-30" />
                   <input 
                     autoFocus type="text" placeholder="Buscar por Nome ou Unidade..." 
                     value={searchResident}
                     onChange={e => { setSearchResident(e.target.value); setData({...data, unit: '', residentName: ''}); }}
                     className="w-full pl-14 pr-6 py-6 bg-zinc-50 rounded-[32px] font-bold text-lg outline-none border-2 border-transparent focus:border-black/5 placeholder:opacity-20"
                   />
                 </div>
              </div>
              <div className="max-h-[40vh] overflow-y-auto custom-scrollbar space-y-2">
                 {filteredResidents.length > 0 ? (
                    filteredResidents.map((r: Resident) => (
                       <button 
                         key={r.id} 
                         onClick={() => { setData({ ...data, unit: r.unit, residentName: r.name }); setSearchResident(r.name); }}
                         className={`w-full p-4 rounded-2xl flex items-center justify-between transition-all ${data.unit === r.unit ? 'bg-black text-white shadow-xl' : 'bg-zinc-50 hover:bg-zinc-100'}`}
                       >
                          <div className="text-left">
                             <h6 className="font-black text-sm uppercase">{r.name}</h6>
                             <p className={`text-[10px] font-bold uppercase tracking-widest ${data.unit === r.unit ? 'opacity-60' : 'opacity-40'}`}>Unidade {r.unit}</p>
                          </div>
                          {data.unit === r.unit && <CheckCircle2 className="w-5 h-5" />}
                       </button>
                    ))
                 ) : (
                    searchResident && <p className="text-center text-xs opacity-40 py-4 font-black uppercase">Nenhum morador encontrado</p>
                 )}
              </div>
              <button 
                onClick={() => setStep(2)} disabled={!data.unit}
                className="w-full py-6 bg-black text-white rounded-[32px] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próximo <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
           </div>
         )}

         {step === 2 && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="p-4 bg-zinc-50 rounded-2xl flex items-center justify-between mb-4 border border-black/5">
                 <div>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Vinculado a</p>
                    <h6 className="text-sm font-black uppercase">{data.residentName} <span className="opacity-40 ml-1">({data.unit})</span></h6>
                 </div>
                 <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Nome do Visitante</label>
                 <input 
                   autoFocus type="text" placeholder="Nome Completo" 
                   value={data.name}
                   onChange={e => setData({ ...data, name: e.target.value })}
                   className="w-full p-5 bg-zinc-50 rounded-[24px] font-bold text-lg outline-none border-2 border-transparent focus:border-black/5 placeholder:opacity-20"
                 />
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Documento (Opcional)</label>
                 <input 
                   type="text" placeholder="RG ou CPF" 
                   value={data.doc}
                   onChange={e => setData({ ...data, doc: e.target.value })}
                   className="w-full p-5 bg-zinc-50 rounded-[24px] font-bold text-lg outline-none border-2 border-transparent focus:border-black/5 placeholder:opacity-20"
                 />
              </div>
              <div className="flex gap-4 mt-4">
                 <button onClick={() => setStep(1)} className="p-6 bg-zinc-50 rounded-[32px] hover:bg-zinc-100"><ChevronLeft className="w-6 h-6"/></button>
                 <button onClick={() => setStep(3)} disabled={!data.name} className="flex-1 py-6 bg-black text-white rounded-[32px] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">Próximo</button>
              </div>
           </div>
         )}

         {step === 3 && (
           <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div>
                 <div className="flex justify-between items-center mb-2 px-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Tipo de Acesso</label>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {accessTypes.map((type: string) => (
                       <div key={type} className="relative group">
                          <button 
                            onClick={() => setData({ ...data, type })}
                            className={`py-3 px-5 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all ${data.type === type ? 'bg-black text-white shadow-lg scale-105' : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'}`}
                          >
                             {type}
                          </button>
                          {accessTypes.length > 1 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRemoveAccessType(type); }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-md hover:scale-110"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                       </div>
                    ))}
                    {isAddingAccessType ? (
                       <div className="flex items-center bg-zinc-50 rounded-[18px] border border-black/10 overflow-hidden animate-in fade-in zoom-in duration-200">
                          <input 
                            autoFocus type="text" value={newAccessTypeInput}
                            onChange={e => setNewAccessTypeInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddAccessType()}
                            placeholder="Novo Tipo..."
                            className="w-24 px-3 py-2 bg-transparent text-[10px] font-bold outline-none uppercase"
                          />
                          <button onClick={handleAddAccessType} className="p-2 hover:bg-black hover:text-white transition-colors"><Check className="w-3 h-3"/></button>
                       </div>
                    ) : (
                       <button onClick={() => setIsAddingAccessType(true)} className="py-3 px-4 rounded-[18px] border border-dashed border-zinc-200 text-zinc-300 hover:text-black hover:border-black/20 transition-all flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                    )}
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Veículo</label>
                    <input type="text" placeholder="Modelo/Cor" value={data.vehicle} onChange={e => setData({ ...data, vehicle: e.target.value })} className="w-full p-4 bg-zinc-50 rounded-[24px] font-bold text-sm outline-none border-transparent focus:border-black/5" />
                 </div>
                 <div>
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2 mb-2 block">Placa</label>
                    <input type="text" placeholder="ABC-1234" value={data.plate} onChange={e => setData({ ...data, plate: e.target.value.toUpperCase() })} className="w-full p-4 bg-zinc-50 rounded-[24px] font-bold text-sm outline-none border-transparent focus:border-black/5 uppercase" />
                 </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setStep(2)} className="p-6 bg-zinc-50 rounded-[32px] hover:bg-zinc-100"><ChevronLeft className="w-6 h-6"/></button>
                 <button onClick={onConfirm} className="flex-1 py-6 bg-green-600 text-white rounded-[32px] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> Liberar Acesso</button>
              </div>
           </div>
         )}
      </div>
    </div>
  );
};

// --- MODAL NOVA NOTA ---
export const NewNoteModal = ({
  isOpen, onClose, editingId, categories, newCategory, setNewCategory, 
  isManaging, setIsManaging, removeCategory, isAdding, setIsAdding, 
  newCatName, setNewCatName, addCategory, content, setContent, 
  isScheduleOpen, setIsScheduleOpen, scheduled, setScheduled, allNotes, setAllNotes, onSave
}: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white text-black rounded-[48px] shadow-2xl p-6 md:p-8 animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[90vh]">
         <header className="flex justify-between items-start mb-6">
            <div>
               <h4 className="text-2xl font-black uppercase tracking-tight">{editingId ? 'Editar Nota' : 'Rascunho Rápido'}</h4>
               <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">Fluxo de produtividade</p>
            </div>
            <div className="flex gap-2">
               <button onClick={() => setIsManaging(!isManaging)} className={`p-3 rounded-2xl transition-all ${isManaging ? 'bg-black text-white' : 'bg-zinc-100 hover:bg-zinc-200'}`}><Settings2 className="w-5 h-5"/></button>
               <button onClick={onClose} className="p-3 bg-zinc-100 rounded-2xl hover:bg-zinc-200 transition-all shadow-sm"><X className="w-5 h-5"/></button>
            </div>
         </header>

         <div className="flex gap-2 items-center overflow-x-auto pb-4 no-scrollbar">
            {categories.map((cat: any) => (
              <div key={cat.name} className="relative flex-shrink-0 group">
                <button
                  onClick={() => !isManaging && setNewCategory(cat.name)}
                  className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${newCategory === cat.name ? 'bg-black text-white border-black shadow-lg scale-105' : `${cat.color} text-black border-transparent opacity-60`} ${isManaging ? 'pr-10' : ''}`}
                >
                  {cat.name}
                </button>
                {isManaging && cat.name !== 'Geral' && (
                  <button onClick={() => removeCategory(cat.name)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-red-500 text-white rounded-full hover:scale-110 transition-all"><X className="w-3 h-3" /></button>
                )}
              </div>
            ))}
            {isAdding ? (
               <div className="flex items-center bg-zinc-50 rounded-2xl border border-black/10 overflow-hidden min-w-[150px] animate-in slide-in-from-left-2">
                  <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Nome..." autoFocus className="flex-1 bg-transparent px-3 py-2 text-[10px] font-bold outline-none" />
                  <button onClick={addCategory} className="p-2 bg-black text-white"><Check className="w-3 h-3"/></button>
                  <button onClick={() => setIsAdding(false)} className="p-2 bg-zinc-200"><X className="w-3 h-3"/></button>
               </div>
            ) : (
              <button onClick={() => setIsAdding(true)} className="flex-shrink-0 w-10 h-10 rounded-2xl bg-zinc-50 border border-dashed border-zinc-300 flex items-center justify-center hover:bg-zinc-100 transition-all"><Plus className="w-4 h-4 opacity-40" /></button>
            )}
         </div>

         <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6">
            <textarea placeholder="O que você precisa anotar agora?" value={content} onChange={e => setContent(e.target.value)} autoFocus className="w-full h-40 p-6 bg-zinc-50 rounded-[32px] font-bold text-lg outline-none border-2 border-transparent focus:border-black/5 resize-none shadow-inner leading-relaxed placeholder:opacity-20" />
            <div>
              <button onClick={() => setIsScheduleOpen(!isScheduleOpen)} className={`flex items-center gap-3 px-6 py-3 rounded-2xl border transition-all ${isScheduleOpen ? 'bg-black text-white border-black' : 'bg-white border-zinc-100 text-zinc-400'}`}>
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{scheduled ? `Agendado: ${scheduled}` : 'Programar Lembrete'}</span>
              </button>
              {isScheduleOpen && (
                <div className="mt-3 p-4 bg-zinc-50 rounded-[24px] border border-black/5 animate-in slide-in-from-top-2">
                   <input type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} className="w-full p-4 bg-white rounded-xl font-bold outline-none border border-black/5" />
                </div>
              )}
            </div>
            {!editingId && allNotes.length > 0 && (
              <div className="pt-4 border-t border-zinc-100">
                <h6 className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-4">Últimos Lembretes</h6>
                <div className="space-y-2">
                   {allNotes.slice(0, 3).map((note: any) => (
                     <div key={note.id} className="p-4 bg-zinc-50 rounded-2xl flex items-center justify-between group hover:bg-zinc-100 transition-all">
                        <div className="flex-1 min-w-0 pr-4">
                           <p className="text-xs font-bold truncate opacity-70">{note.content}</p>
                           <span className="text-[9px] font-black uppercase opacity-30 tracking-tighter">{note.category}</span>
                        </div>
                        <button onClick={() => setAllNotes(allNotes.map((n: any) => n.id === note.id ? {...n, completed: !n.completed} : n))} className={`p-2 rounded-xl transition-all ${note.completed ? 'bg-green-500 text-white' : 'bg-white text-zinc-200 border border-zinc-100 group-hover:text-zinc-400'}`}><Check className="w-4 h-4" /></button>
                     </div>
                   ))}
                </div>
              </div>
            )}
         </div>
         <div className="pt-6">
            <button onClick={onSave} className="w-full py-5 bg-black text-white rounded-[24px] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"><Save className="w-4 h-4" /> {editingId ? 'Atualizar Registro' : 'Salvar Nota Rápida'}</button>
         </div>
      </div>
    </div>
  );
};

// --- MODAL NOVO PACOTE (WIZARD) ---
export const NewPackageModal = ({
  isOpen, onClose, step, setStep, searchResident, setSearchResident, selectedResident, setSelectedResident,
  filteredResidents, packageType, setPackageType, packageCategories, isAddingPkgCategory, setIsAddingPkgCategory,
  newPkgCatName, setNewPkgCatName, handleAddPkgCategory, numItems, packageItems, handleAddItemRow,
  handleRemoveItemRow, updateItem, packageMessage, setPackageMessage, onConfirm
}: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-2 sm:p-4 overflow-auto">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-full sm:max-w-2xl max-h-[95vh] bg-white text-black rounded-[32px] sm:rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-500 my-auto">
         <div className={`transition-all duration-700 ease-in-out flex ${step === 2 ? '-translate-x-1/3' : step === 3 ? '-translate-x-2/3' : 'translate-x-0'}`} style={{ width: '300%' }}>
            
            {/* STEP 1: RESIDENT */}
            <div className="w-1/3 flex-shrink-0 p-4 sm:p-6 md:p-8 lg:p-14 max-h-[95vh] overflow-y-auto custom-scrollbar">
               <header className="flex justify-between items-start mb-6 sm:mb-8 md:mb-12 gap-2">
                  <div className="min-w-0 flex-1"><h4 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tighter">Quem recebe?</h4><p className="text-[9px] sm:text-[10px] font-bold opacity-30 uppercase tracking-[0.3em] mt-1">Passo 01: Identificação</p></div>
                  <button onClick={onClose} className="p-2 sm:p-3 md:p-4 bg-zinc-50 rounded-2xl sm:rounded-3xl hover:bg-zinc-100 transition-all flex-shrink-0"><X className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"/></button>
               </header>
               <div className="space-y-6 sm:space-y-8 md:space-y-12">
                  <div className="relative group">
                     <Search className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 opacity-20 group-focus-within:opacity-100 transition-opacity" />
                     <input type="text" placeholder="Buscar por nome ou unidade..." value={searchResident} onChange={e => { setSearchResident(e.target.value); setSelectedResident(null); }} className="w-full pl-10 sm:pl-12 md:pl-16 pr-4 sm:pr-6 py-3 sm:py-4 md:py-6 bg-zinc-50 rounded-[24px] sm:rounded-[32px] font-black text-sm sm:text-lg md:text-xl outline-none border-2 border-transparent focus:border-black/5 placeholder:opacity-20 shadow-inner" />
                  </div>
                  {!selectedResident && filteredResidents.length > 0 && (
                     <div className="bg-zinc-50 rounded-[32px] border border-black/5 p-4 space-y-2 animate-in slide-in-from-top-4">
                        {filteredResidents.map((r: Resident) => (
                          <button key={r.id} onClick={() => { setSelectedResident(r); setSearchResident(r.name); }} className="w-full p-6 bg-white rounded-[24px] flex items-center justify-between hover:scale-[1.02] active:scale-95 transition-all shadow-sm border border-transparent hover:border-black/5 group">
                             <div className="text-left"><h6 className="font-black text-lg uppercase tracking-tight">{r.name}</h6><p className="text-[10px] opacity-40 font-black uppercase tracking-widest">Unidade {r.unit}</p></div>
                             <div className="p-3 bg-zinc-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"><Plus className="w-4 h-4" /></div>
                          </button>
                        ))}
                     </div>
                  )}
                  {selectedResident && (
                     <div className="p-6 sm:p-8 md:p-10 bg-black text-white rounded-[32px] sm:rounded-[40px] md:rounded-[48px] flex flex-col items-center text-center animate-in zoom-in duration-500 shadow-2xl relative overflow-hidden">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-[24px] sm:rounded-[32px] bg-white/10 flex items-center justify-center mb-4 sm:mb-6 shadow-inner text-2xl sm:text-3xl font-black">{selectedResident.name.charAt(0)}</div>
                        <h5 className="text-lg sm:text-xl md:text-2xl font-black uppercase leading-tight break-words">{selectedResident.name}</h5>
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] opacity-40 mt-2">Unidade {selectedResident.unit}</p>
                     </div>
                  )}
                  <button disabled={!selectedResident} onClick={() => setStep(2)} className={`w-full py-4 sm:py-5 md:py-7 rounded-[24px] sm:rounded-[32px] font-black uppercase text-[10px] sm:text-[11px] md:text-[12px] tracking-widest transition-all flex items-center justify-center gap-2 sm:gap-3 shadow-2xl ${selectedResident ? 'bg-black text-white hover:scale-[1.02] active:scale-95' : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'}`}>Próximo: Inventário <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" /></button>
               </div>
            </div>

            {/* STEP 2: DETAILS */}
            <div className="w-1/3 flex-shrink-0 p-4 sm:p-6 md:p-8 lg:p-14 max-h-[95vh] overflow-y-auto custom-scrollbar">
               <header className="flex justify-between items-start mb-6 sm:mb-8 md:mb-12 gap-2">
                  <button onClick={() => setStep(1)} className="p-2 sm:p-3 md:p-4 bg-zinc-50 rounded-2xl sm:rounded-3xl hover:bg-zinc-100 transition-all flex-shrink-0"><ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"/></button>
                  <div className="text-right min-w-0 flex-1"><h4 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tighter">O que chegou?</h4><p className="text-[9px] sm:text-[10px] font-bold opacity-30 uppercase tracking-[0.3em] mt-1">Passo 02: Detalhamento</p></div>
               </header>
               <div className="space-y-6 sm:space-y-8 md:space-y-12">
                  <div className="flex flex-wrap gap-2">
                     {packageCategories.map((cat: string) => (
                       <button key={cat} onClick={() => setPackageType(cat)} className={`px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 rounded-[20px] sm:rounded-[24px] text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest transition-all ${packageType === cat ? 'bg-black text-white shadow-xl scale-105' : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100'}`}>{cat}</button>
                     ))}
                     <button onClick={() => setIsAddingPkgCategory(!isAddingPkgCategory)} className="px-4 sm:px-6 py-2 sm:py-3 md:py-4 rounded-[20px] sm:rounded-[24px] border border-dashed border-zinc-200 text-zinc-300 hover:bg-zinc-50 transition-all"><Plus className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                  </div>
                  {isAddingPkgCategory && (
                     <div className="flex items-center bg-zinc-50 rounded-[24px] p-2 border border-black/10 animate-in slide-in-from-top-2">
                        <input type="text" value={newPkgCatName} onChange={e => setNewPkgCatName(e.target.value)} placeholder="Nova Categoria..." className="flex-1 bg-transparent px-4 font-black uppercase text-[10px] outline-none" />
                        <button onClick={handleAddPkgCategory} className="p-3 bg-black text-white rounded-xl"><Check className="w-4 h-4"/></button>
                     </div>
                  )}
                  <div className="space-y-6">
                     <div className="flex justify-between items-center px-2">
                        <label className="text-[10px] font-black uppercase tracking-widest opacity-40">Inventário</label>
                        <div className="flex items-center bg-zinc-50 rounded-2xl p-1 shadow-inner">
                           <button onClick={() => { if(numItems > 1) handleRemoveItemRow(packageItems[packageItems.length-1].id); }} className="p-2.5 bg-white text-black rounded-xl shadow-sm hover:scale-105 transition-all"><Minus className="w-4 h-4"/></button>
                           <span className="w-10 text-center font-black text-lg">{numItems}</span>
                           <button onClick={handleAddItemRow} className="p-2.5 bg-white text-black rounded-xl shadow-sm hover:scale-105 transition-all"><Plus className="w-4 h-4"/></button>
                        </div>
                     </div>
                     <div className="space-y-4">
                        {packageItems.map((item: PackageItem, idx: number) => (
                          <div key={item.id} className="p-8 bg-zinc-50 rounded-[40px] border border-transparent hover:border-black/5 transition-all space-y-5 animate-in slide-in-from-bottom-2 shadow-sm">
                             <input type="text" placeholder="Nome do Produto..." value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} className="w-full p-5 bg-white rounded-[24px] font-black text-sm outline-none border border-transparent focus:border-black/5 shadow-inner" />
                             <textarea placeholder="Observações..." value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} className="w-full p-5 bg-white rounded-[24px] font-medium text-xs outline-none border border-transparent focus:border-black/5 shadow-inner resize-none h-24" />
                          </div>
                        ))}
                     </div>
                  </div>
                  <button onClick={() => setStep(3)} className="w-full py-4 sm:py-5 md:py-7 bg-black text-white rounded-[24px] sm:rounded-[32px] font-black uppercase text-[10px] sm:text-[11px] md:text-[12px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 sm:gap-3">Próximo: Notificação <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" /></button>
               </div>
            </div>

            {/* STEP 3: NOTIFY */}
            <div className="w-1/3 flex-shrink-0 p-4 sm:p-6 md:p-8 lg:p-14 flex flex-col justify-between max-h-[95vh] min-h-0">
               <div className="overflow-y-auto custom-scrollbar flex-1">
                  <header className="flex justify-between items-start mb-6 sm:mb-8 md:mb-12 gap-2">
                     <button onClick={() => setStep(2)} className="p-2 sm:p-3 md:p-4 bg-zinc-50 rounded-2xl sm:rounded-3xl hover:bg-zinc-100 transition-all flex-shrink-0"><ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6"/></button>
                     <div className="text-right flex items-center gap-4 sm:gap-6">
                        <button onClick={() => onConfirm(false)} className="text-sm sm:text-base md:text-lg font-black uppercase tracking-tight hover:text-blue-500 transition-colors active:scale-95">Salvar</button>
                     </div>
                  </header>
                  <div className="space-y-6 sm:space-y-8 md:space-y-10">
                     <div className="relative p-4 sm:p-6 md:p-10 bg-zinc-50 rounded-[32px] sm:rounded-[40px] md:rounded-[48px] border border-black/5 shadow-inner overflow-hidden">
                        <div className="absolute top-3 sm:top-4 md:top-6 left-4 sm:left-6 md:left-10 flex items-center gap-2"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /><span className="text-[8px] sm:text-[9px] font-black text-green-600 uppercase tracking-wider sm:tracking-widest">WhatsApp Business</span></div>
                        <textarea value={packageMessage} onChange={e => setPackageMessage(e.target.value)} className="w-full h-48 sm:h-56 md:h-64 mt-6 sm:mt-8 bg-transparent font-bold text-sm sm:text-lg md:text-xl leading-relaxed outline-none resize-none placeholder:opacity-10 border-none" />
                        <div className="mt-4 sm:mt-6 flex justify-end"><div className="p-2 sm:p-3 bg-white rounded-xl sm:rounded-2xl border border-black/5 flex items-center gap-2 opacity-40"><Edit2 className="w-3 h-3" /><span className="text-[7px] sm:text-[8px] font-black uppercase">Editor Ativo</span></div></div>
                     </div>
                     <div className="p-4 sm:p-6 md:p-8 bg-zinc-900 text-white/40 rounded-[32px] sm:rounded-[40px] flex items-start sm:items-center gap-4 sm:gap-6"><Bell className="w-6 h-6 sm:w-8 sm:h-8 opacity-20 flex-shrink-0 mt-1 sm:mt-0" /><p className="text-[10px] sm:text-[11px] font-bold leading-relaxed">O registro será salvo permanentemente. O morador será alertado.</p></div>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6 sm:mt-8 md:mt-12 flex-shrink-0">
                  <button onClick={() => onConfirm(false)} className="py-4 sm:py-5 md:py-7 bg-zinc-100 text-black rounded-[24px] sm:rounded-[32px] font-black uppercase text-[9px] sm:text-[10px] md:text-[11px] tracking-widest hover:bg-zinc-200 transition-all active:scale-95">Salvar</button>
                  <button onClick={() => onConfirm(true)} className="py-4 sm:py-5 md:py-7 bg-green-600 text-white rounded-[24px] sm:rounded-[32px] font-black uppercase text-[9px] sm:text-[10px] md:text-[11px] tracking-widest flex items-center justify-center gap-2 sm:gap-4 shadow-2xl hover:scale-[1.02] active:scale-95 transition-all"><MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Notificar</span><span className="sm:hidden">Notif.</span></button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

// --- MODAL STAFF (FUNCIONÁRIOS) ---
export const StaffFormModal = ({ isOpen, onClose, data, setData, onSave }: { isOpen: boolean, onClose: () => void, data: Partial<Staff>, setData: (d: Partial<Staff>) => void, onSave: () => void }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white text-black rounded-[48px] shadow-2xl p-8 md:p-12 animate-in zoom-in duration-300">
         <header className="flex justify-between items-center mb-10">
            <div>
               <h4 className="text-3xl font-black uppercase tracking-tight">{data.id ? 'Editar Cadastro' : 'Novo Colaborador'}</h4>
               <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">Gestão de Recursos Humanos</p>
            </div>
            <button onClick={onClose} className="p-3 bg-zinc-100 rounded-2xl hover:bg-zinc-200 transition-all"><X className="w-5 h-5"/></button>
         </header>
         
         <div className="space-y-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Nome Completo</label>
               <div className="relative">
                 <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                 <input 
                    type="text" 
                    value={data.name || ''} 
                    onChange={e => setData({...data, name: e.target.value})} 
                    className="w-full pl-12 pr-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10" 
                    placeholder="Nome do Funcionário" 
                 />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Cargo</label>
                  <div className="relative">
                     <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                     <select 
                        value={data.role || ''} 
                        onChange={e => setData({...data, role: e.target.value})}
                        className="w-full pl-12 pr-8 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10 appearance-none"
                     >
                        <option value="">Selecione...</option>
                        <option value="Porteiro">Porteiro</option>
                        <option value="Zelador">Zelador</option>
                        <option value="Faxineira">Faxineira</option>
                        <option value="Segurança">Segurança</option>
                        <option value="Manutenção">Manutenção</option>
                        <option value="Jardineiro">Jardineiro</option>
                     </select>
                     <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Turno</label>
                  <select 
                     value={data.shift || ''} 
                     onChange={e => setData({...data, shift: e.target.value as any})}
                     className="w-full px-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10 appearance-none"
                  >
                     <option value="Comercial">Comercial</option>
                     <option value="Manhã">Manhã</option>
                     <option value="Tarde">Tarde</option>
                     <option value="Noite">Noite</option>
                     <option value="Madrugada">Madrugada</option>
                  </select>
               </div>
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Status Operacional</label>
               <div className="flex gap-2">
                  {['Ativo', 'Férias', 'Licença'].map(status => (
                     <button 
                        key={status}
                        onClick={() => setData({...data, status: status as any})}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${data.status === status ? (status === 'Ativo' ? 'bg-green-500 text-white border-green-500' : status === 'Férias' ? 'bg-amber-500 text-white border-amber-500' : 'bg-red-500 text-white border-red-500') : 'bg-zinc-50 border-transparent text-zinc-400 hover:bg-zinc-100'}`}
                     >
                        {status}
                     </button>
                  ))}
               </div>
            </div>

            <div className="pt-4 border-t border-zinc-100 space-y-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Telefone</label>
                  <div className="relative">
                     <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                     <input type="text" value={data.phone || ''} onChange={e => setData({...data, phone: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10" placeholder="(11) 99999-9999" />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Email</label>
                  <div className="relative">
                     <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                     <input type="email" value={data.email || ''} onChange={e => setData({...data, email: e.target.value})} className="w-full pl-12 pr-4 py-4 bg-zinc-50 rounded-2xl font-bold text-sm outline-none border focus:border-black/10" placeholder="func@condominio.com" />
                  </div>
               </div>
            </div>

            <div className="pt-6">
               <button onClick={onSave} disabled={!data.name || !data.role} className="w-full py-5 bg-black text-white rounded-[24px] font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Save className="w-4 h-4" /> Salvar Colaborador
               </button>
            </div>
         </div>
      </div>
    </div>
  );
};
