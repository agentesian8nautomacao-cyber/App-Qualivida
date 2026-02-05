
import React from 'react';
import { Heart, Droplets, Sun, Smile, Meh, Frown, Bell } from 'lucide-react';
import { WellnessState } from '../types';

interface WellnessPlanProps {
    state: WellnessState;
    onUpdate: (s: WellnessState) => void;
}

const WellnessPlan: React.FC<WellnessPlanProps> = ({ state, onUpdate }) => {
  const toggleHabit = (id: number) => {
    onUpdate({
        ...state,
        habits: state.habits.map(h => h.id === id ? {...h, completed: !h.completed} : h)
    });
  };

  return (
    <div className="p-6 pb-28 min-h-screen max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom duration-500 relative">
       
       <div className="mb-6"><h2 className="text-3xl font-serif font-bold text-[#1A4D2E] flex items-center gap-2"><Heart className="text-[#4F6F52]" /> Bem-Estar</h2><p className="text-[#4F6F52]">Equilíbrio mente, corpo e espírito.</p></div>

      {/* Mood Tracker */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm text-center">
         <h3 className="font-serif text-xl text-[#1A4D2E] mb-4">Como você se sente hoje?</h3>
         <div className="flex justify-center gap-6">
            {[{ icon: Smile, val: 'good', label: 'Bem', color: 'text-green-500', bg: 'bg-green-100' }, { icon: Meh, val: 'neutral', label: 'Normal', color: 'text-yellow-500', bg: 'bg-yellow-100' }, { icon: Frown, val: 'bad', label: 'Mal', color: 'text-red-500', bg: 'bg-red-100' }].map((m) => {
               const Icon = m.icon;
               const isSelected = state.mood === m.val;
               return (
                  <button key={m.val} onClick={() => onUpdate({...state, mood: m.val as any})} className={`flex flex-col items-center gap-2 transition-all ${isSelected ? 'scale-110' : 'opacity-50 hover:opacity-100'}`}>
                     <div className={`w-16 h-16 rounded-full flex items-center justify-center ${isSelected ? m.bg : 'bg-gray-100'} transition-colors`}><Icon size={32} className={isSelected ? m.color : 'text-gray-400'} /></div><span className="text-sm font-medium text-[#1A4D2E]">{m.label}</span>
                  </button>
               );
            })}
         </div>
      </div>

      {/* Hydration Counter */}
      <div className="bg-blue-50 p-6 rounded-[2.5rem] shadow-sm flex items-center justify-between">
         <div><h3 className="font-serif text-xl text-[#1A4D2E] flex items-center gap-2 mb-1"><Droplets className="text-blue-500" /> Hidratação</h3><p className="text-blue-800/60 text-sm">Meta: 8 copos</p></div>
         <div className="flex items-center gap-4">
            <button onClick={() => onUpdate({...state, waterGlasses: Math.max(0, state.waterGlasses - 1)})} className="w-10 h-10 bg-white rounded-full text-blue-500 shadow-sm flex items-center justify-center font-bold text-xl">-</button>
            <span className="text-3xl font-serif text-blue-900">{state.waterGlasses}</span>
            <button onClick={() => onUpdate({...state, waterGlasses: state.waterGlasses + 1})} className="w-10 h-10 bg-blue-500 rounded-full text-white shadow-lg flex items-center justify-center font-bold text-xl">+</button>
         </div>
      </div>

      {/* Habits & Focus Section with Bell Icon */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm">
         <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif text-xl text-[#1A4D2E] flex items-center gap-2">
                <Sun className="text-orange-400" size={20} /> Foco & Hábitos
            </h3>
            {/* Simple icon to indicate habits */}
            <div className="p-2 bg-[#F5F1E8] rounded-full text-[#1A4D2E] shadow-sm">
                <Sun size={20} />
            </div>
         </div>
         
         <div className="space-y-3">
            {state.habits.map((habit) => (
               <div key={habit.id} onClick={() => toggleHabit(habit.id)} className={`flex items-center p-4 rounded-2xl cursor-pointer transition-all ${habit.completed ? 'bg-[#1A4D2E]/10' : 'bg-[#F5F1E8]'}`}>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-colors ${habit.completed ? 'bg-[#1A4D2E] border-[#1A4D2E]' : 'border-gray-300 bg-white'}`}>{habit.completed && <div className="w-2 h-2 bg-white rounded-full"></div>}</div>
                  <span className={`font-medium text-lg ${habit.completed ? 'text-[#1A4D2E] line-through opacity-70' : 'text-[#4F6F52]'}`}>{habit.text}</span>
               </div>
            ))}
         </div>
      </div>

    </div>
  );
};
export default WellnessPlan;
