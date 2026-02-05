
import React, { useState, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar,
  ReferenceLine,
  ComposedChart,
  Line
} from 'recharts';
import { Calendar, TrendingUp, Activity, BrainCircuit, PieChart as PieIcon, ArrowUpRight, Scale, CheckCircle2, Target, ChevronDown } from 'lucide-react';

// --- MOCK DATA GENERATORS ---
// Simulating dynamic data based on time range
const generateData = (days: number) => {
    const data = [];
    let currentWeight = 72.0;
    const targetKcal = 1800;
    
    for (let i = 0; i < days; i++) {
        const day = i + 1;
        // Simulate slight weight loss with noise
        currentWeight -= (Math.random() * 0.1) - 0.02; 
        
        // Simulate calorie fluctuation around target
        const calorieNoise = Math.floor(Math.random() * 400) - 200;
        
        data.push({
            name: days === 7 ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'][i] : `Dia ${day}`,
            weight: Number(currentWeight.toFixed(1)),
            kcal: targetKcal + calorieNoise,
            target: targetKcal
        });
    }
    return data;
};

const ProgressView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'charts' | 'report'>('charts');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');

  // Derived Data based on TimeRange
  const data = useMemo(() => {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      return generateData(days);
  }, [timeRange]);

  // Metrics Calculations
  const startWeight = data[0].weight;
  const currentWeight = data[data.length - 1].weight;
  const weightDiff = startWeight - currentWeight;
  
  const avgCalories = Math.round(data.reduce((acc, curr) => acc + curr.kcal, 0) / data.length);
  const adherenceRate = Math.round((data.filter(d => Math.abs(d.kcal - d.target) < 200).length / data.length) * 100);

  // Macro Data (Simulated change based on range)
  const macroData = useMemo(() => {
     if (timeRange === '7d') return [{ name: 'Proteínas', value: 30, color: '#1A4D2E' }, { name: 'Carbos', value: 50, color: '#F59E0B' }, { name: 'Gorduras', value: 20, color: '#3B82F6' }];
     if (timeRange === '30d') return [{ name: 'Proteínas', value: 28, color: '#1A4D2E' }, { name: 'Carbos', value: 52, color: '#F59E0B' }, { name: 'Gorduras', value: 20, color: '#3B82F6' }];
     return [{ name: 'Proteínas', value: 32, color: '#1A4D2E' }, { name: 'Carbos', value: 45, color: '#F59E0B' }, { name: 'Gorduras', value: 23, color: '#3B82F6' }];
  }, [timeRange]);

  return (
    <div className="p-6 pb-28 max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom duration-500">
      
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 mb-2">
        <div className="flex justify-between items-center">
            <h2 className="text-3xl font-serif font-bold text-[#1A4D2E] flex items-center gap-2">
            <TrendingUp className="text-[#4F6F52]" /> Progresso
            </h2>
            
            {/* Functional Time Range Selector */}
            <div className="relative">
                <select 
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value as any)}
                    className="appearance-none bg-white text-[#1A4D2E] border border-[#1A4D2E]/10 shadow-sm rounded-xl py-2 pl-4 pr-8 text-sm font-bold cursor-pointer hover:bg-gray-50 focus:outline-none focus:border-[#1A4D2E]"
                >
                    <option value="7d">7 Dias</option>
                    <option value="30d">30 Dias</option>
                    <option value="90d">3 Meses</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#1A4D2E]">
                    <ChevronDown size={14} />
                </div>
            </div>
        </div>
        
        {/* Toggle Tabs */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-[#1A4D2E]/5">
            <button 
                onClick={() => setActiveTab('charts')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'charts' ? 'bg-[#1A4D2E] text-white shadow-md' : 'text-[#4F6F52] hover:bg-[#F5F1E8]'}`}
            >
                Métricas & Gráficos
            </button>
            <button 
                onClick={() => setActiveTab('report')}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'report' ? 'bg-[#1A4D2E] text-white shadow-md' : 'text-[#4F6F52] hover:bg-[#F5F1E8]'}`}
            >
                Análise IA
            </button>
        </div>
      </div>

      {/* --- CONTENT: CHARTS TAB --- */}
      {activeTab === 'charts' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left duration-300">
              
              {/* Key Metrics Cards (Nutrition Focused) */}
              <div className="grid grid-cols-2 gap-4">
                {/* Weight Loss Card */}
                <div className="bg-[#1A4D2E] text-[#F5F1E8] p-5 rounded-[2.5rem] shadow-lg relative overflow-hidden">
                  <div className="relative z-10">
                      <div className="flex items-center gap-2 opacity-80 mb-2">
                        <Scale size={18} />
                        <span className="text-xs font-bold uppercase tracking-wider">Peso Perdido</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-serif">{weightDiff > 0 ? weightDiff.toFixed(1) : '0.0'}</span>
                        <span className="text-lg font-serif">kg</span>
                      </div>
                      <div className="text-xs mt-2 opacity-70 bg-white/10 w-fit px-2 py-1 rounded-lg">
                          {startWeight}kg → {currentWeight}kg
                      </div>
                  </div>
                  {/* Decorative */}
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                </div>

                {/* Adherence Card */}
                <div className="bg-white text-[#1A4D2E] p-5 rounded-[2.5rem] shadow-md border border-[#1A4D2E]/5 flex flex-col justify-between">
                  <div>
                      <div className="flex items-center gap-2 opacity-60 mb-2 text-[#4F6F52]">
                        <Target size={18} />
                        <span className="text-xs font-bold uppercase tracking-wider">Aderência</span>
                      </div>
                      <div className="text-4xl font-serif">{adherenceRate}%</div>
                      <div className="text-xs mt-1 text-[#4F6F52]">dias na meta</div>
                  </div>
                  <div className="w-full bg-[#F5F1E8] h-2 rounded-full mt-3 overflow-hidden">
                      <div className="bg-[#1A4D2E] h-full rounded-full" style={{width: `${adherenceRate}%`}}></div>
                  </div>
                </div>
              </div>

              {/* Weight Chart */}
              <div className="bg-white rounded-[2.5rem] p-6 shadow-md border border-[#1A4D2E]/5">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[#1A4D2E] font-serif text-xl flex items-center gap-2">
                        <Scale size={20} className="text-[#4F6F52]"/> Evolução do Peso
                    </h3>
                    <span className="text-xs font-bold bg-[#F5F1E8] text-[#1A4D2E] px-2 py-1 rounded-lg">Meta: 68kg</span>
                </div>
                <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1A4D2E" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#1A4D2E" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#9CA3AF" 
                        tickLine={false} 
                        axisLine={false} 
                        tick={{fontSize: 10}}
                        interval={timeRange === '7d' ? 0 : timeRange === '30d' ? 4 : 14}
                    />
                    <YAxis 
                        stroke="#9CA3AF" 
                        tickLine={false} 
                        axisLine={false} 
                        domain={['dataMin - 1', 'dataMax + 1']} 
                        width={30}
                        tick={{fontSize: 10}}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#1A4D2E', borderRadius: '12px', color: '#fff', border: 'none', padding: '10px 15px' }}
                        itemStyle={{ color: '#fff' }}
                        cursor={{ stroke: '#1A4D2E', strokeWidth: 1, strokeDasharray: '4 4' }}
                        labelStyle={{ display: 'none' }}
                    />
                    <ReferenceLine y={68} label="Meta" stroke="#F59E0B" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="weight" stroke="#1A4D2E" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" />
                    </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>

              {/* Calories Chart (Bar + Target Line) */}
              <div className="bg-white rounded-[2.5rem] p-6 shadow-md border border-[#1A4D2E]/5">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-[#1A4D2E] font-serif text-xl flex items-center gap-2">
                        <Activity size={20} className="text-[#4F6F52]"/> Ingestão Calórica
                    </h3>
                    <div className="text-right">
                        <div className="text-xs text-[#4F6F52]">Média</div>
                        <div className="text-sm font-bold text-[#1A4D2E]">{avgCalories} kcal</div>
                    </div>
                </div>
                <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#9CA3AF" 
                        tickLine={false} 
                        axisLine={false} 
                        tick={{fontSize: 10}}
                        interval={timeRange === '7d' ? 0 : timeRange === '30d' ? 4 : 14}
                    />
                    <YAxis 
                        stroke="#9CA3AF" 
                        tickLine={false} 
                        axisLine={false} 
                        width={30}
                        tick={{fontSize: 10}}
                    />
                    <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', color: '#1A4D2E', border: '1px solid #eee', padding: '10px 15px' }}
                        cursor={{ fill: '#F5F1E8' }}
                    />
                    <Bar dataKey="kcal" fill="#4F6F52" radius={[4, 4, 0, 0]} barSize={timeRange === '90d' ? 4 : 12} />
                    <Line type="monotone" dataKey="target" stroke="#F59E0B" strokeWidth={2} dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
                </div>
              </div>
          </div>
      )}

      {/* --- CONTENT: REPORT TAB --- */}
      {activeTab === 'report' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right duration-300">
                
                {/* Score Card */}
                <div className="bg-[#1A4D2E] text-[#F5F1E8] p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-center">
                        <div>
                            <div className="text-[#F5F1E8]/70 font-medium text-sm uppercase tracking-wider mb-1">Score Nutricional</div>
                            <div className="text-6xl font-serif">8.5</div>
                            <div className="text-[#F5F1E8]/80 text-sm mt-2 flex items-center gap-1">
                                <TrendingUp size={14} className="text-green-400" /> Excelente consistência
                            </div>
                        </div>
                        <div className="h-24 w-24 rounded-full border-4 border-[#F5F1E8]/20 flex items-center justify-center bg-[#F5F1E8]/10 backdrop-blur-md">
                            <span className="text-3xl font-serif">A</span>
                        </div>
                    </div>
                </div>

                {/* Macro Distribution */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#1A4D2E]/5">
                    <h3 className="font-serif text-xl text-[#1A4D2E] mb-4 flex items-center gap-2">
                        <PieIcon size={20} className="text-[#4F6F52]" /> Distribuição de Macros
                    </h3>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                        <div className="h-48 w-48 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={macroData} 
                                        innerRadius={60} 
                                        outerRadius={80} 
                                        paddingAngle={5} 
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {macroData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                                <span className="text-2xl font-serif text-[#1A4D2E]">100%</span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-3 w-full md:w-auto">
                            {macroData.map(d => (
                                <div key={d.name} className="flex items-center justify-between gap-6 w-full">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></div>
                                        <span className="text-sm font-bold text-[#4F6F52]">{d.name}</span>
                                    </div>
                                    <span className="text-sm font-serif text-[#1A4D2E]">{d.value}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* AI Insights List */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-[#1A4D2E]/5">
                    <h3 className="font-serif text-xl text-[#1A4D2E] mb-4 flex items-center gap-2">
                        <BrainCircuit size={20} className="text-[#4F6F52]" /> Insights da Nutri.ai
                    </h3>
                    <ul className="space-y-4">
                        <li className="flex gap-4 p-4 bg-[#F5F1E8]/50 rounded-2xl">
                            <div className="mt-1 w-6 h-6 rounded-full bg-green-500/20 text-green-700 flex items-center justify-center flex-shrink-0">
                                <CheckCircle2 size={14} />
                            </div>
                            <div>
                                <h4 className="font-bold text-[#1A4D2E] text-sm mb-1">Proteína na Meta</h4>
                                <p className="text-xs text-[#4F6F52] leading-relaxed">
                                    Você manteve sua meta de proteína em {timeRange === '7d' ? '6 dos últimos 7 dias' : '85% do período'}. Isso é fundamental para a manutenção da massa magra enquanto perde peso.
                                </p>
                            </div>
                        </li>
                        <li className="flex gap-4 p-4 bg-[#F5F1E8]/50 rounded-2xl">
                            <div className="mt-1 w-6 h-6 rounded-full bg-orange-500/20 text-orange-700 flex items-center justify-center flex-shrink-0">
                                <Activity size={14} />
                            </div>
                            <div>
                                <h4 className="font-bold text-[#1A4D2E] text-sm mb-1">Déficit Calórico Consistente</h4>
                                <p className="text-xs text-[#4F6F52] leading-relaxed">
                                    Seu déficit médio de {Math.abs(avgCalories - 2000)}kcal está ideal para uma perda de peso sustentável sem causar fadiga excessiva.
                                </p>
                            </div>
                        </li>
                    </ul>
                </div>

                <button onClick={() => window.print()} className="w-full py-4 mt-4 bg-white border border-[#1A4D2E] text-[#1A4D2E] rounded-[2rem] font-medium hover:bg-[#1A4D2E] hover:text-white transition-all flex items-center justify-center gap-2">
                    Exportar Relatório PDF <ArrowUpRight size={18} />
                </button>
          </div>
      )}

    </div>
  );
};

export default ProgressView;
