
import React, { useState } from 'react';
import { ChefHat, Sparkles, Plus, X, Clock, Flame, Utensils, Package, Trash2, ArrowRight } from 'lucide-react';
import { generateRecipeAI } from '../services/geminiService';
import { Recipe, UserProfile, PantryItem } from '../types';

interface SmartMealProps {
    userProfile?: UserProfile | null;
    onUpdateProfile?: (profile: UserProfile) => void;
}

const SmartMeal: React.FC<SmartMealProps> = ({ userProfile, onUpdateProfile }) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'pantry'>('generate');
  
  // Generator State
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);
  const [usePantry, setUsePantry] = useState(true);

  // Pantry State
  const [pantryInput, setPantryInput] = useState('');

  // Handlers
  const handleAddIngredient = () => {
    if (currentInput.trim()) {
      setIngredients([...ingredients, currentInput.trim()]);
      setCurrentInput('');
    }
  };

  const handleGenerate = async () => {
    if (ingredients.length === 0 && (!userProfile?.pantryItems || userProfile.pantryItems.length === 0)) {
        alert("Adicione ingredientes ou cadastre itens na sua despensa.");
        return;
    }
    
    setIsGenerating(true);
    try {
      const pantryList = usePantry && userProfile?.pantryItems ? userProfile.pantryItems.map(i => i.name) : [];
      const recipe = await generateRecipeAI(ingredients, pantryList);
      setGeneratedRecipe(recipe);
    } catch (e) {
      alert("Erro ao gerar receita.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddPantryItem = () => {
      if (pantryInput.trim() && userProfile && onUpdateProfile) {
          const newItem: PantryItem = {
              id: Date.now().toString(),
              name: pantryInput.trim()
          };
          const updatedItems = userProfile.pantryItems ? [...userProfile.pantryItems, newItem] : [newItem];
          onUpdateProfile({ ...userProfile, pantryItems: updatedItems });
          setPantryInput('');
      }
  };

  const handleRemovePantryItem = (id: string) => {
      if (userProfile && onUpdateProfile && userProfile.pantryItems) {
          const updatedItems = userProfile.pantryItems.filter(i => i.id !== id);
          onUpdateProfile({ ...userProfile, pantryItems: updatedItems });
      }
  };

  return (
    <div className="p-6 pb-28 min-h-screen animate-in slide-in-from-bottom duration-500 max-w-2xl mx-auto">
      
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-serif font-bold text-[#1A4D2E] flex items-center gap-2">
            <ChefHat className="text-[#4F6F52]" /> Chef Inteligente
        </h2>
        <p className="text-[#4F6F52] mt-2">Crie receitas com o que você tem em casa.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-[#1A4D2E]/5 mb-6">
          <button 
            onClick={() => setActiveTab('generate')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'generate' ? 'bg-[#1A4D2E] text-white shadow-md' : 'text-[#4F6F52] hover:bg-[#F5F1E8]'}`}
          >
              <span className="flex items-center justify-center gap-2"><Sparkles size={16}/> Gerador</span>
          </button>
          <button 
            onClick={() => setActiveTab('pantry')}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'pantry' ? 'bg-[#1A4D2E] text-white shadow-md' : 'text-[#4F6F52] hover:bg-[#F5F1E8]'}`}
          >
              <span className="flex items-center justify-center gap-2"><Package size={16}/> Minha Despensa</span>
          </button>
      </div>

      {/* GENERATOR TAB */}
      {activeTab === 'generate' && (
        <div className="animate-in fade-in slide-in-from-left duration-300">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-[#1A4D2E]/5 mb-6">
                <label className="text-xs font-bold text-[#4F6F52] uppercase mb-2 block">Ingredientes Principais</label>
                <div className="flex gap-2 mb-4">
                <input 
                    type="text" 
                    value={currentInput} 
                    onChange={(e) => setCurrentInput(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleAddIngredient()} 
                    placeholder="Ex: Frango, Batata..." 
                    className="flex-1 bg-[#F5F1E8] rounded-xl px-4 py-3 outline-none text-[#1A4D2E]" 
                />
                <button onClick={handleAddIngredient} className="bg-[#1A4D2E] text-[#F5F1E8] p-3 rounded-xl hover:bg-[#4F6F52] transition-colors"><Plus size={24} /></button>
                </div>
                
                {ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {ingredients.map((ing, idx) => (
                            <span key={idx} className="bg-[#E8F5E9] text-[#1A4D2E] px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 animate-in zoom-in">
                                {ing}
                                <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))}><X size={14} /></button>
                            </span>
                        ))}
                    </div>
                )}

                {/* Integration Checkbox */}
                {userProfile?.pantryItems && userProfile.pantryItems.length > 0 && (
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                         <div 
                            onClick={() => setUsePantry(!usePantry)}
                            className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${usePantry ? 'bg-[#1A4D2E]' : 'bg-gray-300'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${usePantry ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-sm font-medium text-[#4F6F52]">Combinar com itens da minha despensa</span>
                    </div>
                )}
            </div>

            <button 
                onClick={handleGenerate} 
                disabled={isGenerating} 
                className={`w-full py-4 rounded-[2rem] font-serif text-xl flex items-center justify-center gap-2 transition-all shadow-lg ${isGenerating ? 'bg-[#4F6F52] cursor-wait' : 'bg-[#1A4D2E] hover:bg-[#143d24] text-[#F5F1E8]'}`}
            >
                {isGenerating ? <Sparkles className="animate-spin" /> : <><Sparkles size={20} /> Criar Receita</>}
            </button>

            {generatedRecipe && (
                <div className="mt-8 bg-white rounded-[2.5rem] overflow-hidden shadow-xl animate-in slide-in-from-bottom duration-700">
                <div className="h-48 overflow-hidden relative">
                    <img src={generatedRecipe.image} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6"><h3 className="text-white font-serif text-2xl">{generatedRecipe.title}</h3></div>
                </div>
                <div className="p-6">
                    <div className="flex justify-between mb-6 border-b border-gray-100 pb-4">
                        <div className="flex items-center gap-2 text-[#4F6F52]"><Clock size={18} /> <span>{generatedRecipe.time}</span></div>
                        <div className="flex items-center gap-2 text-[#4F6F52]"><Flame size={18} /> <span>{generatedRecipe.calories} kcal</span></div>
                        <div className="flex items-center gap-2 text-[#4F6F52]"><Utensils size={18} /> <span>Fácil</span></div>
                    </div>
                    <p className="text-[#1A4D2E] mb-6 leading-relaxed">{generatedRecipe.description}</p>
                    <h4 className="font-serif text-xl text-[#1A4D2E] mb-4">Modo de Preparo</h4>
                    <ul className="space-y-3">{generatedRecipe.steps.map((step, idx) => <li key={idx} className="flex gap-3 text-[#4F6F52]"><span className="w-6 h-6 rounded-full bg-[#1A4D2E]/10 text-[#1A4D2E] flex items-center justify-center text-xs font-bold flex-shrink-0">{idx + 1}</span><span className="flex-1">{step}</span></li>)}</ul>
                </div>
                </div>
            )}
        </div>
      )}

      {/* PANTRY TAB */}
      {activeTab === 'pantry' && (
          <div className="animate-in fade-in slide-in-from-right duration-300">
               <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-[#1A4D2E]/5">
                   <h3 className="font-serif text-xl text-[#1A4D2E] mb-4">Cadastrar Produtos</h3>
                   <div className="flex gap-2 mb-6">
                        <input 
                            type="text" 
                            value={pantryInput} 
                            onChange={(e) => setPantryInput(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleAddPantryItem()} 
                            placeholder="Ex: Arroz Integral, Azeite..." 
                            className="flex-1 bg-[#F5F1E8] rounded-xl px-4 py-3 outline-none text-[#1A4D2E]" 
                        />
                        <button onClick={handleAddPantryItem} className="bg-[#1A4D2E] text-[#F5F1E8] px-5 rounded-xl hover:bg-[#4F6F52] transition-colors font-bold text-sm">Adicionar</button>
                    </div>

                    <div className="space-y-3">
                        {userProfile?.pantryItems && userProfile.pantryItems.length > 0 ? (
                            userProfile.pantryItems.map((item) => (
                                <div key={item.id} className="flex justify-between items-center p-4 bg-[#F5F1E8] rounded-2xl">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-white rounded-full text-[#1A4D2E]"><Package size={16} /></div>
                                        <span className="font-medium text-[#1A4D2E]">{item.name}</span>
                                    </div>
                                    <button onClick={() => handleRemovePantryItem(item.id)} className="text-red-400 hover:text-red-600 p-2">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-10 opacity-50">
                                <Package size={48} className="mx-auto mb-2 text-[#4F6F52]"/>
                                <p className="text-sm">Sua despensa está vazia.</p>
                            </div>
                        )}
                    </div>

                    {userProfile?.pantryItems && userProfile.pantryItems.length > 0 && (
                        <div className="mt-6 p-4 bg-blue-50 rounded-2xl flex items-start gap-3">
                             <Sparkles className="text-blue-500 flex-shrink-0 mt-1" size={18} />
                             <p className="text-xs text-blue-800 leading-relaxed">
                                 Ótimo! O <strong>Gerador de Receitas</strong> e o seu <strong>Plano Alimentar</strong> agora levarão esses itens em conta para evitar desperdícios.
                             </p>
                        </div>
                    )}
               </div>
          </div>
      )}

    </div>
  );
};
export default SmartMeal;
