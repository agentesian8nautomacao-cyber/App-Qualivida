
import React, { useState } from 'react';
import { DailyPlan, LogItem, MealItem } from '../types';
import { Plus, ChevronDown, ChevronUp, Calendar as CalendarIcon, Search, X, Loader2 } from 'lucide-react';
import { searchFoodAI } from '../services/geminiService';

interface DiaryViewProps {
  plan: DailyPlan;
  dailyLog: LogItem[];
  onAddFood: (item: MealItem, type: string) => void;
}

const DiaryView: React.FC<DiaryViewProps> = ({ plan, dailyLog, onAddFood }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [expandedSection, setExpandedSection] = useState<string | null>('Breakfast');
  
  // Add Food Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetMealType, setTargetMealType] = useState<string>('Breakfast');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MealItem[]>([]);
  const [loading, setLoading] = useState(false);

  const days = Array.from({length: 7}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + (i - 3));
      return d;
  });

  const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();

  const filteredLog = dailyLog.filter(item => isSameDay(new Date(item.timestamp), selectedDate));

  const sections = [
    { id: 'Breakfast', label: 'Café da Manhã', targetKcal: 400 },
    { id: 'Lunch', label: 'Almoço', targetKcal: 700 },
    { id: 'Snack', label: 'Lanche', targetKcal: 300 },
    { id: 'Dinner', label: 'Jantar', targetKcal: 600 },
  ];

  const handleOpenAdd = (type: string) => {
      setTargetMealType(type);
      setResults([]);
      setQuery('');
      setIsModalOpen(true);
  };

  const handleSearch = async () => {
      if(!query) return;
      setLoading(true);
      const res = await searchFoodAI(query);
      setResults(res);
      setLoading(false);
  };

  const handleAdd = (item: MealItem) => {
      onAddFood(item, targetMealType);
      setIsModalOpen(false);
  };

  const renderIcon = (item: MealItem) => {
      if (item.image && item.image.startsWith('data:')) {
          return <img src={item.image} className="w-12 h-12 rounded-xl object-cover" />;
      }
      return (
          <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-2xl border border-[#1A4D2E]/10">
              {item.emoji || "🍽️"}
          </div>
      );
  };

  return (
    <div className="pb-28 min-h-screen bg-[#F5F1E8] text-[#1A4D2E] animate-in fade-in duration-500">
      
      {/* Add Food Modal */}
      {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-center items-center px-4" onClick={() => setIsModalOpen(false)}>
              <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between mb-4">
                      <h3 className="font-serif text-xl">Adicionar ao {sections.find(s => s.id === targetMealType)?.label}</h3>
                      <button onClick={() => setIsModalOpen(false)}><X /></button>
                  </div>
                  <div className="flex gap-2 mb-4">
                      <input autoFocus value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="flex-1 bg-[#F5F1E8] p-3 rounded-xl outline-none" placeholder="Buscar alimento..." />
                      <button onClick={handleSearch} className="bg-[#1A4D2E] text-white p-3 rounded-xl">{loading ? <Loader2 className="animate-spin"/> : <Search />}</button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                      {results.map((item, idx) => (
                          <button key={idx} onClick={() => handleAdd(item)} className="w-full p-3 hover:bg-[#F5F1E8] rounded-xl text-left flex justify-between items-center">
                              <span className="flex items-center gap-2 text-xl">
                                  <span>{item.emoji}</span>
                                  <span className="text-base font-bold text-[#1A4D2E]">{item.name}</span>
                              </span>
                              <span className="text-xs font-bold text-[#4F6F52]">{item.calories} kcal</span>
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Header & Calendar */}
      <div className="bg-white pt-6 pb-4 rounded-b-[2.5rem] shadow-sm mb-6">
        <div className="px-6 flex justify-between items-center mb-6">
           <h2 className="font-serif text-2xl">Meu Diário</h2>
           <div className="flex items-center gap-2 text-sm font-bold text-[#4F6F52]">
              <CalendarIcon size={16} /> {selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
           </div>
        </div>
        <div className="flex justify-between px-4 pb-2 overflow-x-auto no-scrollbar">
            {days.map((d, i) => (
                <button key={i} onClick={() => setSelectedDate(d)} className={`flex flex-col items-center justify-center min-w-[50px] h-[70px] rounded-2xl transition-all ${isSameDay(d, selectedDate) ? 'bg-[#1A4D2E] text-[#F5F1E8] shadow-lg scale-110' : 'text-[#4F6F52] hover:bg-[#F5F1E8]'}`}>
                    <span className="text-xs font-medium uppercase">{d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0,3)}</span>
                    <span className="text-xl font-serif font-bold">{d.getDate()}</span>
                </button>
            ))}
        </div>
      </div>

      <div className="px-4 space-y-4">
         {sections.map((section) => {
            const items = filteredLog.filter(i => i.type === section.id);
            const currentKcal = items.reduce((a, b) => a + b.calories, 0);
            const isExpanded = expandedSection === section.id;

            return (
                <div key={section.id} className="bg-white rounded-[2rem] shadow-sm border border-[#1A4D2E]/5 overflow-hidden">
                    <div onClick={() => setExpandedSection(isExpanded ? null : section.id)} className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors">
                        <div>
                            <h3 className="font-serif text-xl text-[#1A4D2E]">{section.label}</h3>
                            <div className="text-sm text-[#4F6F52] font-medium mt-1">{currentKcal} <span className="opacity-60">/ {section.targetKcal} kcal</span></div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={(e) => { e.stopPropagation(); handleOpenAdd(section.id); }} className="w-10 h-10 bg-blue-500 rounded-full text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"><Plus size={24} /></button>
                            {isExpanded ? <ChevronUp size={20} className="text-[#4F6F52]"/> : <ChevronDown size={20} className="text-[#4F6F52]"/>}
                        </div>
                    </div>
                    {isExpanded && (
                        <div className="px-5 pb-5 animate-in slide-in-from-top duration-300 space-y-3">
                            {items.length > 0 ? items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-[#F5F1E8] rounded-2xl">
                                    {renderIcon(item)}
                                    <div className="flex-1"><div className="font-bold text-[#1A4D2E] text-sm">{item.name}</div><div className="text-xs text-[#4F6F52]">{item.calories} kcal</div></div>
                                </div>
                            )) : <div className="text-center py-4 text-sm text-gray-400 italic">Nenhum registro.</div>}
                        </div>
                    )}
                </div>
            );
         })}
      </div>
    </div>
  );
};
export default DiaryView;
