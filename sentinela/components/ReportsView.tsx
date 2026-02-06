
import React, { useState } from 'react';
import { BarChart3, TrendingUp, AlertCircle, CheckCircle2, BrainCircuit, ArrowUpRight, PieChart as PieIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const ReportsView: React.FC = () => {
  const [period, setPeriod] = useState('7d');

  const getMacroData = () => {
     // Mock dynamic data change
     if (period === '7d') return [{ name: 'Proteínas', value: 30, color: '#3B82F6' }, { name: 'Carbos', value: 50, color: '#F97316' }, { name: 'Gorduras', value: 20, color: '#EAB308' }];
     if (period === '30d') return [{ name: 'Proteínas', value: 25, color: '#3B82F6' }, { name: 'Carbos', value: 55, color: '#F97316' }, { name: 'Gorduras', value: 20, color: '#EAB308' }];
     return [{ name: 'Proteínas', value: 35, color: '#3B82F6' }, { name: 'Carbos', value: 45, color: '#F97316' }, { name: 'Gorduras', value: 20, color: '#EAB308' }];
  };

  const macroData = getMacroData();

  return (
    <div className="p-6 pb-28 min-h-screen max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom duration-500">
      <div className="flex justify-between items-center mb-4">
        <div><h2 className="text-3xl font-serif font-bold text-[#1A4D2E] flex items-center gap-2"><BrainCircuit className="text-[#4F6F52]" /> Relatório IA</h2><p className="text-[#4F6F52]">Análise de desempenho.</p></div>
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-[#1A4D2E]/10">
            {['7d', '30d', '90d'].map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p ? 'bg-[#1A4D2E] text-white' : 'text-[#4F6F52] hover:bg-[#F5F1E8]'}`}>{p}</button>
            ))}
        </div>
      </div>

      <div className="bg-[#1A4D2E] text-[#F5F1E8] p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-center">
           <div><div className="text-[#F5F1E8]/70 font-medium text-sm uppercase tracking-wider mb-1">Score Nutricional</div><div className="text-6xl font-serif">8.5</div><div className="text-[#F5F1E8]/80 text-sm mt-2 flex items-center gap-1"><TrendingUp size={14} /> +1.2 pts vs período anterior</div></div>
           <div className="h-24 w-24 rounded-full border-4 border-[#F5F1E8]/20 flex items-center justify-center"><span className="text-3xl">A</span></div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#1A4D2E]/5">
         <h3 className="font-serif text-xl text-[#1A4D2E] mb-4 flex items-center gap-2"><PieIcon size={20} className="text-[#4F6F52]" /> Distribuição de Macros</h3>
         <div className="flex items-center justify-center h-56">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={macroData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {macroData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />)}
                    </Pie>
                    <Tooltip />
                </PieChart>
             </ResponsiveContainer>
             <div className="absolute text-center pointer-events-none"><div className="text-3xl font-serif text-[#1A4D2E]">100%</div><div className="text-xs font-bold text-[#4F6F52] uppercase">Diário</div></div>
         </div>
         <div className="flex justify-center gap-6 mt-2">
             {macroData.map(d => <div key={d.name} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></div><span className="text-xs font-bold text-[#4F6F52]">{d.name} {d.value}%</span></div>)}
         </div>
      </div>

      <button onClick={() => window.print()} className="w-full py-4 mt-4 bg-white border border-[#1A4D2E] text-[#1A4D2E] rounded-[2rem] font-medium hover:bg-[#1A4D2E] hover:text-white transition-all flex items-center justify-center gap-2">
         Ver Relatório Completo PDF <ArrowUpRight size={18} />
      </button>
    </div>
  );
};
export default ReportsView;
