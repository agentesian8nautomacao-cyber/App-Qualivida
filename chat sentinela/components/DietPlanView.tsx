
import React, { useState, useRef } from 'react';
import { DailyPlan, UserProfile } from '../types';
import { Sparkles, Clock, Info, CheckCircle2, ShoppingBasket, BrainCircuit, Droplets, ArrowRightLeft, Edit2, Save, Package, RefreshCw, Upload, FileText, Paperclip, X, Circle } from 'lucide-react';

interface DietPlanViewProps {
  plan: DailyPlan;
  userProfile?: UserProfile | null;
  onRegenerate?: (instructions: string, attachment?: { data: string, mimeType: string }, usePantry?: boolean) => Promise<void>;
}

const DietPlanView: React.FC<DietPlanViewProps> = ({ plan, userProfile, onRegenerate }) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'strategy' | 'shopping' | 'tips'>('menu');
  const [isEditing, setIsEditing] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Options State
  const [usePantry, setUsePantry] = useState(true);
  const [selectedFile, setSelectedFile] = useState<{ name: string, data: string, mimeType: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const translateMealType = (type: string) => {
    const map: Record<string, string> = {
        "Breakfast": "Café da Manhã",
        "Lunch": "Almoço",
        "Dinner": "Jantar",
        "Snack": "Lanche"
    };
    return map[type] || type;
  };

  const handleRegenerateClick = async () => {
      if (onRegenerate) {
          setIsRegenerating(true);
          const attachment = selectedFile ? { data: selectedFile.data, mimeType: selectedFile.mimeType } : undefined;
          await onRegenerate(customInstructions, attachment, usePantry);
          setIsRegenerating(false);
          setIsEditing(false);
          setCustomInstructions(''); 
          setSelectedFile(null);
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
              const base64String = event.target?.result as string;
              const base64Data = base64String.split(',')[1];
              setSelectedFile({
                  name: file.name,
                  data: base64Data,
                  mimeType: file.type
              });
          };
          reader.readAsDataURL(file);
      }
  };

  const TabButton = ({ id, label, icon: Icon }: any) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-4 flex flex-col items-center gap-2 transition-all border-b-4 ${
        activeTab === id 
        ? 'border-[#1A4D2E] text-[#1A4D2E]' 
        : 'border-transparent text-gray-400 hover:text-[#1A4D2E]/70'
      }`}
    >
      <Icon size={24} />
      <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
    </button>
  );

  return (
    <div className="pb-28 min-h-screen bg-[#F5F1E8] animate-in slide-in-from-bottom duration-500 relative">
      
      {/* Edit Overlay / Modal */}
      {isEditing && (
          <div className="fixed inset-0 z-50 bg-[#1A4D2E]/95 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar">
                  <button onClick={() => setIsEditing(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                  
                  <h3 className="font-serif text-2xl text-[#1A4D2E] mb-2 flex items-center gap-2">
                      <Edit2 size={24}/> Personalizar Plano
                  </h3>
                  <p className="text-[#4F6F52] text-sm mb-6">
                      Descreva como você quer seu plano ou faça upload de um PDF existente para digitalizá-lo.
                  </p>
                  
                  <div className="space-y-4">
                      {/* Text & File Input Area */}
                      <div className="relative">
                          <label className="text-xs font-bold text-[#1A4D2E] uppercase mb-2 block">Instruções</label>
                          <textarea 
                              value={customInstructions}
                              onChange={(e) => setCustomInstructions(e.target.value)}
                              placeholder={selectedFile ? "Adicione observações sobre o arquivo enviado..." : "Ex: Quero um café da manhã com mais ovos, jantar low carb..."}
                              className="w-full h-32 bg-[#F5F1E8] rounded-2xl p-4 text-[#1A4D2E] outline-none border border-[#1A4D2E]/10 resize-none mb-2"
                          />
                          
                          {/* File Upload Button Area */}
                          <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-2 bg-[#F5F1E8] text-[#1A4D2E] px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#1A4D2E] hover:text-white transition-colors border border-[#1A4D2E]/10"
                                    >
                                        <Paperclip size={14} /> {selectedFile ? "Trocar Arquivo" : "Anexar PDF/Foto"}
                                    </button>
                                </div>
                          </div>
                          <input 
                              type="file" 
                              ref={fileInputRef} 
                              onChange={handleFileChange} 
                              accept=".pdf,image/*"
                              className="hidden" 
                          />
                      </div>

                      {/* Selected File Display */}
                      {selectedFile && (
                            <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center justify-between animate-in fade-in">
                                <div className="flex items-center gap-2 text-blue-700">
                                    <FileText size={18} />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold">Arquivo Selecionado</span>
                                        <span className="text-xs max-w-[150px] truncate">{selectedFile.name}</span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedFile(null)} className="p-1 bg-white rounded-full text-blue-300 hover:text-red-500"><X size={14}/></button>
                            </div>
                      )}

                      {/* Pantry Toggle Section */}
                      {userProfile?.pantryItems && userProfile.pantryItems.length > 0 && (
                          <div className={`p-4 rounded-2xl border transition-colors ${usePantry ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100 opacity-80'}`}>
                              <div className="flex justify-between items-center mb-3">
                                  <div className="flex items-center gap-2 text-[#1A4D2E] font-bold text-xs uppercase">
                                      <Package size={14}/> Dispensa Conectada
                                  </div>
                                  <button 
                                    onClick={() => setUsePantry(!usePantry)}
                                    className={`w-10 h-6 rounded-full p-1 transition-colors ${usePantry ? 'bg-[#1A4D2E]' : 'bg-gray-300'}`}
                                  >
                                      <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${usePantry ? 'translate-x-4' : 'translate-x-0'}`} />
                                  </button>
                              </div>
                              
                              {usePantry ? (
                                  <div className="flex flex-wrap gap-2">
                                      {userProfile.pantryItems.slice(0, 5).map(item => (
                                          <span key={item.id} className="bg-white text-orange-800 px-2 py-1 rounded-lg text-[10px] font-medium shadow-sm border border-orange-100">
                                              {item.name}
                                          </span>
                                      ))}
                                      {userProfile.pantryItems.length > 5 && <span className="text-[10px] text-orange-600 px-1">+{userProfile.pantryItems.length - 5} mais</span>}
                                  </div>
                              ) : (
                                  <p className="text-[10px] text-gray-400 italic">Os itens da sua despensa não serão priorizados.</p>
                              )}
                          </div>
                      )}
                  </div>

                  <button 
                    onClick={handleRegenerateClick}
                    disabled={isRegenerating}
                    className="w-full py-4 bg-[#1A4D2E] text-white rounded-2xl mt-6 font-serif text-lg flex items-center justify-center gap-2 hover:bg-[#143d24] transition-colors disabled:opacity-50"
                  >
                      {isRegenerating ? <RefreshCw className="animate-spin" /> : selectedFile ? <Upload size={20} /> : <Sparkles size={20} />}
                      {isRegenerating ? "Processando..." : selectedFile ? "Digitalizar Plano" : "Gerar Novo Plano"}
                  </button>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="p-6 pb-0 flex justify-between items-start">
        <div>
            <div className="inline-block px-3 py-1 bg-[#1A4D2E]/10 rounded-full text-[#1A4D2E] text-xs font-bold uppercase tracking-wider mb-3">
            Plano de Classe Mundial
            </div>
            <h2 className="text-4xl font-serif text-[#1A4D2E] mb-2">Seu Plano</h2>
        </div>
        <button 
            onClick={() => setIsEditing(true)}
            className="p-3 bg-white border border-[#1A4D2E]/10 text-[#1A4D2E] rounded-full shadow-sm hover:bg-[#1A4D2E] hover:text-white transition-all flex items-center gap-2"
        >
            <Edit2 size={18} />
            <span className="text-xs font-bold hidden sm:inline">Personalizar</span>
        </button>
      </div>

      {/* Macro Summary Banner */}
      <div className="p-6 pt-4">
        <div className="bg-[#1A4D2E] text-[#F5F1E8] rounded-[2.5rem] p-6 shadow-xl relative overflow-hidden">
            <div className="relative z-10">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <div className="text-[#F5F1E8]/70 text-sm font-medium uppercase">Meta Diária</div>
                    <div className="text-5xl font-serif">{plan.totalCalories} <span className="text-lg">kcal</span></div>
                </div>
                <div className="text-right">
                     <div className="text-[#F5F1E8]/70 text-sm font-medium uppercase mb-1"><Droplets size={14} className="inline mr-1"/> Hidratação</div>
                     <div className="text-2xl font-serif">{plan.hydrationTarget ? (plan.hydrationTarget / 1000).toFixed(1) : '2.5'}L</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/10 p-3 rounded-2xl text-center backdrop-blur-sm">
                    <div className="text-xs uppercase opacity-70 mb-1">Proteína</div>
                    <div className="text-xl font-serif">{plan.targetMacros.protein}g</div>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl text-center backdrop-blur-sm">
                    <div className="text-xs uppercase opacity-70 mb-1">Carbos</div>
                    <div className="text-xl font-serif">{plan.targetMacros.carbs}g</div>
                </div>
                <div className="bg-white/10 p-3 rounded-2xl text-center backdrop-blur-sm">
                    <div className="text-xs uppercase opacity-70 mb-1">Gorduras</div>
                    <div className="text-xl font-serif">{plan.targetMacros.fats}g</div>
                </div>
            </div>
            </div>
            {/* Decoration */}
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#4F6F52] rounded-full blur-3xl opacity-40"></div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4 sticky top-0 z-20 shadow-sm">
        <TabButton id="menu" label="Cardápio" icon={Clock} />
        <TabButton id="strategy" label="Estratégia" icon={BrainCircuit} />
        <TabButton id="shopping" label="Compras" icon={ShoppingBasket} />
        <TabButton id="tips" label="Dicas" icon={Sparkles} />
      </div>

      {/* Content Area */}
      <div className="p-6 space-y-6">
        
        {/* MENU TAB */}
        {activeTab === 'menu' && (
            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                {plan.meals.map((meal, index) => (
                <div key={index} className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#1A4D2E]/5">
                    <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-3">
                        <div className="w-10 h-10 rounded-full bg-[#F5F1E8] flex items-center justify-center text-[#1A4D2E]">
                            <Clock size={20} />
                        </div>
                        <h3 className="font-serif text-xl text-[#1A4D2E]">{translateMealType(meal.type)}</h3>
                    </div>

                    <div className="space-y-6">
                        {meal.items.map((item, idx) => (
                            <div key={idx} className="relative">
                                <div className="flex gap-4 items-start">
                                    <div className="mt-1 flex-shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-[#F5F1E8] border border-[#1A4D2E]/10 flex items-center justify-center text-xl">
                                            {item.emoji || "🍽️"}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-[#1A4D2E] text-lg leading-tight">{item.name}</h4>
                                            <span className="text-xs font-bold bg-[#F5F1E8] px-2 py-1 rounded-lg text-[#1A4D2E]">
                                                {item.calories} kcal
                                            </span>
                                        </div>
                                        <p className="text-sm text-[#4F6F52] mt-2 leading-relaxed">
                                            {item.description}
                                        </p>
                                        
                                        {/* Macros */}
                                        <div className="flex gap-3 mt-2 text-xs text-[#4F6F52]/60 font-medium">
                                            <span>P: {item.macros.protein}g</span>
                                            <span>C: {item.macros.carbs}g</span>
                                            <span>G: {item.macros.fats}g</span>
                                        </div>

                                        {/* Substitutions */}
                                        {item.substitutions && item.substitutions.length > 0 && (
                                            <div className="mt-3 bg-orange-50 p-3 rounded-xl border border-orange-100">
                                                <div className="flex items-center gap-2 text-xs font-bold text-orange-700 uppercase mb-1">
                                                    <ArrowRightLeft size={12} /> Opções de Troca
                                                </div>
                                                <ul className="list-disc list-inside text-xs text-orange-800/80">
                                                    {item.substitutions.map((sub, sIdx) => (
                                                        <li key={sIdx}>{sub}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                ))}
            </div>
        )}

        {/* STRATEGY TAB */}
        {activeTab === 'strategy' && (
            <div className="animate-in slide-in-from-right duration-300 space-y-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm">
                    <h3 className="font-serif text-2xl text-[#1A4D2E] mb-4">Análise Nutricional</h3>
                    <div className="prose prose-green text-[#4F6F52]">
                        <p className="leading-relaxed whitespace-pre-wrap">{plan.nutritionalAnalysis || "Gerando análise detalhada..."}</p>
                    </div>
                </div>
                
                {plan.notes && (
                    <div className="bg-[#FFF8E1] p-6 rounded-[2rem] border border-yellow-100 flex gap-4">
                    <Info className="text-yellow-600 flex-shrink-0" />
                    <p className="text-yellow-800 text-sm leading-relaxed italic">
                        "{plan.notes}"
                    </p>
                    </div>
                )}
            </div>
        )}

        {/* SHOPPING TAB */}
        {activeTab === 'shopping' && (
             <div className="animate-in slide-in-from-right duration-300">
                 <div className="bg-white p-6 rounded-[2rem] shadow-sm">
                    <h3 className="font-serif text-2xl text-[#1A4D2E] mb-6 flex items-center gap-2">
                        <ShoppingBasket /> Lista de Compras
                    </h3>
                    <ul className="space-y-3">
                        {plan.shoppingList && plan.shoppingList.length > 0 ? plan.shoppingList.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-3 p-3 bg-[#F5F1E8] rounded-xl">
                                <div className="w-5 h-5 rounded-full border-2 border-[#1A4D2E] opacity-50"></div>
                                <span className="text-[#1A4D2E] font-medium">{item}</span>
                            </li>
                        )) : (
                            <p className="text-gray-400 italic">Lista não gerada.</p>
                        )}
                    </ul>
                 </div>
             </div>
        )}

        {/* TIPS TAB */}
        {activeTab === 'tips' && (
            <div className="animate-in slide-in-from-right duration-300 space-y-4">
                <h3 className="font-serif text-2xl text-[#1A4D2E] px-2">Dicas Comportamentais</h3>
                {plan.behavioralTips && plan.behavioralTips.length > 0 ? plan.behavioralTips.map((tip, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-[2rem] shadow-sm border-l-4 border-[#1A4D2E]">
                        <p className="text-[#4F6F52] leading-relaxed font-medium">
                            {tip}
                        </p>
                    </div>
                )) : (
                    <p className="text-gray-400 italic px-4">Sem dicas disponíveis.</p>
                )}
            </div>
        )}

      </div>
    </div>
  );
};

export default DietPlanView;
