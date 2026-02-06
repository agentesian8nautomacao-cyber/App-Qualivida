
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DailyPlan, UserProfile, LogItem, MealItem, WellnessState, AppView } from '../types';
import { Search, Plus, ArrowRight, Heart, Utensils, Coffee, Sun, Moon, Apple, Check, Clock, Sparkles, Droplets, Flame, X, Loader2, Menu, Bell, Scan, ChevronRight, Smile, Meh, Frown, History, Share2, ChefHat, Palette, Type, Image as ImageIcon } from 'lucide-react';
import { searchFoodAI, generateImageBackground } from '../services/geminiService';

interface DashboardProps {
  plan: DailyPlan;
  user: UserProfile;
  dailyLog: LogItem[];
  wellness: WellnessState;
  setWellness: (state: WellnessState) => void;
  onAddFood: (food: MealItem, type: any) => void;
  onAnalyze: () => void;
  onChat: () => void;
  onNavigate: (view: AppView) => void;
  onMenuClick: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ plan, user, dailyLog, wellness, setWellness, onAddFood, onNavigate, onMenuClick, onAnalyze }) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [tipIndex, setTipIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  
  // Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MealItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Calendar Modal State
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Notification Modal State
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Item Details Modal State
  const [selectedItem, setSelectedItem] = useState<LogItem | null>(null);

  // Streak Customization State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streakCustomText, setStreakCustomText] = useState("Mais um dia, menos um dia");
  const [streakBgStyle, setStreakBgStyle] = useState<'gradient' | 'solid-white' | 'solid-black' | 'ai'>('gradient');
  const [aiBackgroundUrl, setAiBackgroundUrl] = useState<string | null>(null);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);

  const allPlanMeals = useMemo(() => plan.meals.flatMap(m => m.items.map(i => ({ ...i, type: m.type }))), [plan]);
  useEffect(() => {
    if (allPlanMeals.length === 0) return;
    const interval = setInterval(() => setTipIndex(p => (p + 1) % allPlanMeals.length), 5000);
    return () => clearInterval(interval);
  }, [allPlanMeals.length]);

  const showToast = (msg: string) => {
      setToast(msg);
      setTimeout(() => setToast(null), 3000);
  };

  const handleSearch = async () => {
      if (!searchQuery.trim()) return;
      setIsSearching(true);
      const results = await searchFoodAI(searchQuery);
      setSearchResults(results);
      setIsSearching(false);
  };

  const handleAddFromSearch = (item: MealItem) => {
      onAddFood(item, "Snack"); 
      setIsSearchOpen(false);
      showToast(`Adicionado: ${item.name}`);
  };

  // --- STREAK CANVAS LOGIC ---
  const drawCanvas = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high resolution
    const width = 1080;
    const height = 1920;
    canvas.width = width;
    canvas.height = height;

    // 1. Background
    if (streakBgStyle === 'gradient') {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#1A4D2E'); 
        gradient.addColorStop(1, '#0F2D1B');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Deco
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.arc(width, 0, 600, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, height, 500, 0, Math.PI * 2);
        ctx.fill();
    } else if (streakBgStyle === 'solid-white') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
    } else if (streakBgStyle === 'solid-black') {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
    } else if (streakBgStyle === 'ai' && aiBackgroundUrl) {
        const img = new Image();
        img.src = aiBackgroundUrl;
        await new Promise((resolve) => {
            img.onload = () => {
                // Draw image maintaining aspect ratio cover
                const scale = Math.max(width / img.width, height / img.height);
                const x = (width / 2) - (img.width / 2) * scale;
                const y = (height / 2) - (img.height / 2) * scale;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                // Add overlay for readability
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(0, 0, width, height);
                resolve(true);
            };
        });
    }

    const textColor = streakBgStyle === 'solid-white' ? '#1A4D2E' : '#F5F1E8';
    const subTextColor = streakBgStyle === 'solid-white' ? '#4F6F52' : '#A0C4A9';
    const accentColor = '#F59E0B'; // Orange

    // 2. Chef Logo Header
    ctx.textAlign = 'center';
    
    // Draw Chef Hat Emoji (Simulating Logo)
    ctx.font = '120px serif';
    ctx.fillText('👨‍🍳', width / 2, 280); 
    
    ctx.font = 'bold 50px DM Serif Display, serif';
    ctx.fillStyle = textColor;
    ctx.fillText('Nutri.ai', width / 2, 360);

    // 3. Main Streak Number
    const streak = user.streak || 1;
    
    // Circle behind number (Subtle)
    if (streakBgStyle !== 'solid-white') {
        ctx.shadowColor = "rgba(249, 115, 22, 0.4)";
        ctx.shadowBlur = 60;
    }
    ctx.fillStyle = streakBgStyle === 'solid-white' ? 'rgba(26, 77, 46, 0.05)' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(width / 2, 800, 280, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Flame Icon
    ctx.font = '180px serif';
    ctx.fillText('🔥', width / 2, 700);

    // Number
    ctx.fillStyle = textColor;
    ctx.font = 'bold 240px Inter, sans-serif';
    ctx.fillText(streak.toString(), width / 2, 940);

    ctx.font = 'bold 40px Inter, sans-serif';
    ctx.fillStyle = accentColor; 
    ctx.fillText('DIAS CONSECUTIVOS', width / 2, 1030);

    // 4. Motivational Text (Customizable)
    ctx.fillStyle = subTextColor;
    ctx.font = '40px Inter, sans-serif';
    const staticText = "Mantendo o foco e a disciplina.";
    ctx.fillText(staticText, width / 2, 1250);
    
    // Custom Quote
    ctx.fillStyle = textColor;
    ctx.font = 'italic 50px DM Serif Display, serif';
    // Wrap text if too long
    const words = streakCustomText.split(' ');
    let line = '';
    let y = 1450;
    const maxWidth = 800;
    const lineHeight = 70;

    for(let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, width / 2, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, width / 2, y);

    // 5. Footer
    ctx.fillStyle = subTextColor;
    ctx.font = '30px Inter, sans-serif';
    ctx.globalAlpha = 0.6;
    ctx.fillText('nutri.ai app', width / 2, 1820);
    ctx.globalAlpha = 1;
  };

  // Redraw when dependencies change
  useEffect(() => {
      if (isCalendarOpen) {
          // Small delay to ensure modal rendered
          setTimeout(drawCanvas, 100);
      }
  }, [isCalendarOpen, streakCustomText, streakBgStyle, aiBackgroundUrl]);


  const handleGenerateAIBackground = async () => {
      setIsGeneratingBg(true);
      const prompt = "healthy food aesthetic wallpaper pattern, abstract, clean, vibrant colors, 4k";
      const url = await generateImageBackground(prompt);
      if (url) {
          setAiBackgroundUrl(url);
          setStreakBgStyle('ai');
      } else {
          showToast("Erro ao gerar imagem IA");
      }
      setIsGeneratingBg(false);
  };

  const handleShareClick = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
          const dataUrl = canvas.toDataURL('image/png');
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], 'minha-ofensiva.png', { type: 'image/png' });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  title: 'Minha Ofensiva no Nutri.ai',
                  text: `Já são ${user.streak || 1} dias focados na minha saúde! 🚀 #nutriai`,
                  files: [file]
              });
          } else {
              const link = document.createElement('a');
              link.href = dataUrl;
              link.download = `streak-${user.streak || 1}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              showToast("Imagem baixada!");
          }
      } catch (e) {
          console.error("Error sharing", e);
      }
  };

  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return "Bom dia";
      if (hour < 18) return "Boa tarde";
      return "Boa noite";
  };

  const getMoodDetails = (mood: string | null) => {
    switch(mood) {
      case 'good': return { icon: Smile, label: 'Bem', color: 'text-[#1A4D2E]', bg: 'bg-[#E8F5E9]' };
      case 'neutral': return { icon: Meh, label: 'Normal', color: 'text-yellow-600', bg: 'bg-yellow-50' };
      case 'bad': return { icon: Frown, label: 'Mal', color: 'text-red-500', bg: 'bg-red-50' };
      default: return { icon: Heart, label: '-', color: 'text-gray-400', bg: 'bg-gray-100' };
    }
  };

  const totalConsumed = dailyLog.reduce((acc, i) => acc + i.calories, 0);
  const totalProtein = dailyLog.reduce((acc, i) => acc + i.macros.protein, 0);
  const totalCarbs = dailyLog.reduce((acc, i) => acc + i.macros.carbs, 0);
  const totalFats = dailyLog.reduce((acc, i) => acc + i.macros.fats, 0);

  const displayedItems = activeCategory === 'all' ? [...dailyLog].reverse() : [...dailyLog].reverse().filter(i => i.type === activeCategory);
  
  const currentTip = allPlanMeals[tipIndex];
  
  // Progress Circle Calculation
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progressPercent = Math.min(1, totalConsumed / plan.totalCalories);
  const strokeDashoffset = circumference - progressPercent * circumference;

  const moodData = getMoodDetails(wellness.mood);
  const MoodIcon = moodData.icon;

  const hasNotifications = wellness.notifications.water || wellness.notifications.sleep || wellness.notifications.meals;

  // Calendar Logic for Modal
  const getCalendarDays = () => {
      const today = new Date();
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const startDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay(); // 0 = Sun
      const days = [];
      
      // Empty slots for start
      for(let i=0; i<startDay; i++) days.push(null);
      
      // Days
      for(let i=1; i<=daysInMonth; i++) {
          days.push(i);
      }
      return days;
  };
  const calendarDays = getCalendarDays();
  const currentDay = new Date().getDate();
  const streakStartDay = Math.max(1, currentDay - (user.streak || 1) + 1);

  // Render Icon logic
  const renderItemIcon = (item: MealItem, size = "md") => {
      const sizeClasses = size === "lg" ? "w-20 h-20 text-4xl" : size === "xl" ? "w-32 h-32 text-6xl" : "w-12 h-12 text-xl";
      
      if (item.image && item.image.startsWith('data:')) {
           return <img src={item.image} className={`${sizeClasses} rounded-full object-cover border border-[#F5F1E8] shadow-sm`} />;
      }
      return (
          <div className={`${sizeClasses} rounded-full bg-[#F5F1E8] border border-[#1A4D2E]/10 flex items-center justify-center shadow-sm`}>
              {item.emoji || "🍽️"}
          </div>
      );
  };

  return (
    <div className="pb-28 animate-in fade-in duration-500 min-h-screen bg-[#F5F1E8] text-[#1A4D2E]">
      
      {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-[#1A4D2E] text-white px-6 py-3 rounded-full shadow-xl z-[60] flex items-center gap-2 animate-in slide-in-from-top">
              <Check size={18} /> {toast}
          </div>
      )}

      {/* Streak Editor Modal (Formerly Calendar Modal) */}
      {isCalendarOpen && (
          <div className="fixed inset-0 bg-[#1A4D2E]/90 backdrop-blur-md z-[70] flex items-center justify-center p-6" onClick={() => setIsCalendarOpen(false)}>
              <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 relative overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                  
                  {/* Header */}
                  <div className="p-4 flex justify-between items-center bg-gray-50 border-b border-gray-100">
                     <h3 className="font-serif text-xl text-[#1A4D2E] flex items-center gap-2">
                        <Flame className="text-orange-500" fill="currentColor"/> Estúdio de Conquista
                     </h3>
                     <button onClick={() => setIsCalendarOpen(false)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300"><X size={18}/></button>
                  </div>

                  {/* Scrollable Content */}
                  <div className="overflow-y-auto p-4 space-y-6 flex-1">
                      
                      {/* Canvas Preview */}
                      <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden shadow-lg border-4 border-gray-100 bg-gray-200">
                           <canvas ref={canvasRef} className="w-full h-full object-contain" />
                           {/* Loading Overlay */}
                           {isGeneratingBg && (
                               <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                                   <Loader2 className="animate-spin mb-2" size={32} />
                                   <span className="text-xs font-bold uppercase tracking-wider">Criando Arte IA...</span>
                               </div>
                           )}
                      </div>

                      {/* Controls */}
                      <div className="space-y-4">
                          
                          {/* Text Edit */}
                          <div>
                              <label className="text-xs font-bold text-[#4F6F52] uppercase mb-1 flex items-center gap-1"><Type size={14}/> Frase Personalizada</label>
                              <input 
                                  value={streakCustomText}
                                  onChange={(e) => setStreakCustomText(e.target.value)}
                                  className="w-full bg-[#F5F1E8] p-3 rounded-xl text-[#1A4D2E] outline-none border border-transparent focus:border-[#1A4D2E]"
                              />
                          </div>

                          {/* Background Options */}
                          <div>
                              <label className="text-xs font-bold text-[#4F6F52] uppercase mb-2 flex items-center gap-1"><Palette size={14}/> Estilo do Fundo</label>
                              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                  <button onClick={() => setStreakBgStyle('gradient')} className={`w-12 h-12 rounded-full bg-gradient-to-b from-[#1A4D2E] to-[#0F2D1B] border-2 ${streakBgStyle === 'gradient' ? 'border-orange-500 scale-110' : 'border-transparent'}`}></button>
                                  <button onClick={() => setStreakBgStyle('solid-white')} className={`w-12 h-12 rounded-full bg-white border-2 ${streakBgStyle === 'solid-white' ? 'border-orange-500 scale-110' : 'border-gray-200'}`}></button>
                                  <button onClick={() => setStreakBgStyle('solid-black')} className={`w-12 h-12 rounded-full bg-black border-2 ${streakBgStyle === 'solid-black' ? 'border-orange-500 scale-110' : 'border-transparent'}`}></button>
                                  
                                  {/* AI Generator Button */}
                                  <button 
                                    onClick={handleGenerateAIBackground}
                                    className={`px-4 h-12 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold text-xs flex items-center gap-1 border-2 ${streakBgStyle === 'ai' ? 'border-orange-500' : 'border-transparent'} whitespace-nowrap`}
                                  >
                                      <Sparkles size={14} /> Fundo IA
                                  </button>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1">
                                  *Use "Fundo IA" para gerar texturas únicas com Nano Banana.
                              </p>
                          </div>
                      </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-4 bg-white border-t border-gray-100 flex gap-3">
                       <button 
                         onClick={handleShareClick}
                         className="flex-1 py-4 bg-[#1A4D2E] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#143d24] transition-all shadow-lg active:scale-95"
                       >
                           <Share2 size={18} /> Compartilhar Story
                       </button>
                  </div>
              </div>
          </div>
      )}

      {/* Notifications Modal */}
      {isNotificationsOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[70] flex items-center justify-center p-4" onClick={() => setIsNotificationsOpen(false)}>
              <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-serif text-2xl text-[#1A4D2E] flex items-center gap-2">
                          <Bell size={24} className="text-[#1A4D2E]" /> Notificações
                      </h3>
                      <button onClick={() => setIsNotificationsOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20}/></button>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto no-scrollbar space-y-6">
                      
                      {/* Section: Active Reminders */}
                      <div>
                          <h4 className="text-xs font-bold uppercase text-[#4F6F52] mb-3 tracking-wider flex items-center gap-1"><Clock size={12}/> Lembretes Ativos</h4>
                          <div className="space-y-3">
                              {wellness.notifications.water && (
                                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-500 shadow-sm"><Droplets size={20} /></div>
                                      <div>
                                          <p className="font-bold text-[#1A4D2E]">Beber Água</p>
                                          <p className="text-xs text-blue-600/80">Meta: Beba 1 copo agora.</p>
                                      </div>
                                  </div>
                              )}
                              {wellness.notifications.sleep && (
                                  <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-500 shadow-sm"><Moon size={20} /></div>
                                      <div>
                                          <p className="font-bold text-[#1A4D2E]">Higiene do Sono</p>
                                          <p className="text-xs text-indigo-600/80">Prepare-se para dormir às 22h.</p>
                                      </div>
                                  </div>
                              )}
                              {wellness.notifications.meals && (
                                  <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-orange-500 shadow-sm"><Utensils size={20} /></div>
                                      <div>
                                          <p className="font-bold text-[#1A4D2E]">Próxima Refeição</p>
                                          <p className="text-xs text-orange-600/80">Não pule o seu lanche da tarde.</p>
                                      </div>
                                  </div>
                              )}
                              
                              {!hasNotifications && (
                                  <div className="text-center py-4 bg-gray-50 rounded-2xl">
                                      <p className="text-xs text-gray-400">Nenhum lembrete ativado.</p>
                                      <button onClick={() => { setIsNotificationsOpen(false); onNavigate('wellness'); }} className="text-[#1A4D2E] text-xs font-bold underline mt-1">Configurar</button>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* Section: Recent Logs */}
                      <div>
                          <h4 className="text-xs font-bold uppercase text-[#4F6F52] mb-3 tracking-wider flex items-center gap-1"><History size={12}/> Registros Recentes</h4>
                          <div className="space-y-2">
                              {dailyLog.length > 0 ? dailyLog.slice(-4).reverse().map((log, i) => (
                                  <div key={i} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0">
                                      <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 flex items-center justify-center text-xl bg-gray-100 rounded-full">{log.emoji || "🍽️"}</div>
                                          <div>
                                              <p className="text-sm font-bold text-[#1A4D2E] line-clamp-1">{log.name}</p>
                                              <p className="text-[10px] text-[#4F6F52]">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {log.calories} kcal</p>
                                          </div>
                                      </div>
                                      <span className="text-[10px] font-bold bg-[#F5F1E8] text-[#1A4D2E] px-2 py-1 rounded-full">{log.type === 'Breakfast' ? 'Café' : log.type === 'Lunch' ? 'Almoço' : log.type === 'Dinner' ? 'Jantar' : 'Lanche'}</span>
                                  </div>
                              )) : (
                                  <p className="text-xs text-gray-400 text-center py-2">Nenhum registro hoje.</p>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Header */}
      <div className="px-6 pt-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
             <button 
                onClick={onMenuClick}
                className="p-3 bg-white rounded-full text-[#1A4D2E] shadow-sm border border-[#1A4D2E]/10 hover:bg-[#1A4D2E] hover:text-white transition-colors"
            >
                <Menu size={20} />
            </button>
            <div className="flex flex-col">
                <span className="text-sm font-medium text-[#4F6F52] flex items-center gap-1">
                    {getGreeting()},
                </span>
                <h1 className="font-serif text-3xl text-[#1A4D2E] leading-tight">{user.name.split(' ')[0]}</h1>
            </div>
        </div>
        
        <div className="flex gap-2 items-center">
            {/* Streak Fire Button */}
            <button 
                onClick={() => setIsCalendarOpen(true)}
                className="p-3 bg-white rounded-full text-orange-500 shadow-sm border border-[#1A4D2E]/10 hover:bg-orange-50 transition-colors relative group"
            >
                <Flame size={20} fill="currentColor" className="animate-pulse" />
            </button>

            {/* Notification Bell */}
            <button 
                onClick={() => setIsNotificationsOpen(true)}
                className="p-3 bg-white rounded-full text-[#1A4D2E] shadow-sm border border-[#1A4D2E]/10 hover:bg-[#1A4D2E] hover:text-white transition-colors relative"
            >
                <Bell size={20} />
                {/* Notification Dot */}
                {hasNotifications && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></div>
                )}
            </button>

            <button onClick={() => onNavigate('profile')} className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md cursor-pointer hover:opacity-90 ml-1">
                <img src={user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb"} alt="Profile" className="w-full h-full object-cover" />
            </button>
        </div>
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
          <div className="fixed inset-0 bg-[#1A4D2E]/50 z-50 backdrop-blur-sm flex justify-center items-start pt-20 px-4" onClick={() => setIsSearchOpen(false)}>
              <div className="bg-white w-full max-w-md rounded-[2rem] p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-serif text-xl">Buscar Alimento</h3>
                      <button onClick={() => setIsSearchOpen(false)}><X /></button>
                  </div>
                  <div className="flex gap-2 mb-4">
                      <input 
                        autoFocus
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        className="flex-1 bg-[#F5F1E8] rounded-xl px-4 py-3 outline-none"
                        placeholder="Ex: Banana, Arroz com feijão..."
                      />
                      <button onClick={handleSearch} className="bg-[#1A4D2E] text-white p-3 rounded-xl">
                          {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
                      </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                      {searchResults.map((item, idx) => (
                          <button key={idx} onClick={() => handleAddFromSearch(item)} className="w-full flex justify-between items-center p-3 hover:bg-[#F5F1E8] rounded-xl text-left">
                              <div>
                                  <div className="font-bold">{item.name} {item.emoji}</div>
                                  <div className="text-xs text-gray-500">{item.calories} kcal</div>
                              </div>
                              <Plus size={18} className="text-[#1A4D2E]" />
                          </button>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* Item Detail Modal */}
      {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={() => setSelectedItem(null)}>
              <div className="bg-white rounded-[2.5rem] p-6 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-end"><button onClick={() => setSelectedItem(null)}><X /></button></div>
                  <div className="text-center">
                      <div className="mx-auto mb-4">{renderItemIcon(selectedItem, "xl")}</div>
                      <h3 className="font-serif text-2xl text-[#1A4D2E] mb-1">{selectedItem.name}</h3>
                      <div className="text-[#4F6F52] font-medium mb-6">{selectedItem.calories} kcal</div>
                      
                      <div className="grid grid-cols-3 gap-3 mb-6">
                          {Object.entries(selectedItem.macros).map(([key, val]) => (
                              <div key={key} className="bg-[#F5F1E8] p-3 rounded-2xl">
                                  <div className="text-xs uppercase font-bold text-[#4F6F52]">{key}</div>
                                  <div className="text-xl font-serif">{val}g</div>
                              </div>
                          ))}
                      </div>
                      <p className="text-sm text-gray-500 mb-6">{selectedItem.description}</p>
                  </div>
              </div>
          </div>
      )}

      {/* HERO SUMMARY CARD */}
      <div className="px-4 mt-6">
        <div className="bg-[#1A4D2E] p-6 rounded-[2.5rem] shadow-xl relative overflow-hidden text-[#F5F1E8]">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#4F6F52] rounded-full blur-3xl opacity-30 -mr-10 -mt-10 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#86EFAC] rounded-full blur-3xl opacity-10 -ml-10 -mb-10 pointer-events-none"></div>

            <div className="relative z-10 flex items-center justify-between gap-6">
                {/* Left: Circular Progress */}
                <div className="relative flex-shrink-0">
                    <div className="w-32 h-32 relative flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="50%" cy="50%" r={radius}
                                stroke="currentColor" strokeWidth="8"
                                fill="transparent" className="text-[#F5F1E8]/10"
                            />
                            <circle
                                cx="50%" cy="50%" r={radius}
                                stroke="currentColor" strokeWidth="8"
                                fill="transparent" strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className="text-[#F5F1E8] transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-3xl font-serif font-bold">{Math.max(0, plan.totalCalories - totalConsumed)}</span>
                            <span className="text-[10px] uppercase tracking-wider opacity-70">Restantes</span>
                        </div>
                    </div>
                </div>

                {/* Right: Macros */}
                <div className="flex-1 space-y-4">
                    {[
                        { label: 'Proteína', current: totalProtein, target: plan.targetMacros.protein, color: 'bg-blue-400' },
                        { label: 'Carbos', current: totalCarbs, target: plan.targetMacros.carbs, color: 'bg-orange-400' },
                        { label: 'Gordura', current: totalFats, target: plan.targetMacros.fats, color: 'bg-yellow-400' },
                    ].map((macro) => (
                        <div key={macro.label}>
                            <div className="flex justify-between text-xs font-medium mb-1.5 opacity-90">
                                <span>{macro.label}</span>
                                <span>{macro.current}/{macro.target}g</span>
                            </div>
                            <div className="h-2 w-full bg-[#F5F1E8]/10 rounded-full overflow-hidden backdrop-blur-sm">
                                <div 
                                    className={`h-full rounded-full ${macro.color} shadow-sm`} 
                                    style={{ width: `${Math.min(100, (macro.current / macro.target) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>

      {/* QUICK STATUS CARDS (Mood & Water) */}
      <div className="grid grid-cols-2 gap-3 px-4 mt-4">
          
          {/* Mood Card */}
          <div 
             onClick={() => onNavigate('wellness')}
             className="bg-white p-5 rounded-[2rem] shadow-sm border border-[#1A4D2E]/5 relative cursor-pointer hover:shadow-md transition-shadow"
          >
             <div className="flex justify-between items-start mb-6">
                <span className="text-xs font-bold text-[#4F6F52] leading-tight uppercase tracking-wide">Seu<br/>Humor</span>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${moodData.bg}`}>
                    <MoodIcon size={20} className={moodData.color} />
                </div>
             </div>
             <div>
                <p className="font-serif text-2xl text-[#1A4D2E]">{moodData.label}</p>
                <p className="text-[10px] text-[#4F6F52] opacity-60 mt-1">
                    {wellness.mood ? 'Registrado hoje' : 'Toque p/ registrar'}
                </p>
             </div>
          </div>

          {/* Water Card */}
          <div 
            onClick={() => setWellness({...wellness, waterGlasses: wellness.waterGlasses + 1})}
            className="bg-white p-5 rounded-[2rem] shadow-sm border border-[#1A4D2E]/5 relative cursor-pointer hover:shadow-md transition-shadow group"
          >
             <div className="flex justify-between items-start mb-6">
                <span className="text-xs font-bold text-[#4F6F52] leading-tight uppercase tracking-wide">Água<br/>Hoje</span>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 group-active:bg-blue-100 transition-colors">
                    <Droplets size={20} className="text-blue-500 fill-blue-500" />
                </div>
             </div>
             <div>
                <p className="font-serif text-2xl text-[#1A4D2E] flex items-baseline gap-1">
                    {wellness.waterGlasses} <span className="text-sm font-sans text-[#4F6F52]">copos</span>
                </p>
                <p className="text-[10px] text-[#4F6F52] opacity-60 mt-1">Meta: 8 copos</p>
             </div>
          </div>
      </div>

      {/* QUICK ACTIONS BAR */}
      <div className="px-4 mt-4">
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
              <button 
                onClick={onAnalyze}
                className="flex items-center gap-2 bg-[#1A4D2E]/5 text-[#1A4D2E] px-5 py-3 rounded-2xl font-bold text-xs whitespace-nowrap shadow-sm border border-[#1A4D2E]/10 active:scale-95 transition-transform"
              >
                  <Scan size={16} />
                  Scanear Prato
              </button>
              <button 
                onClick={() => setIsSearchOpen(true)}
                className="flex items-center gap-2 bg-orange-50 text-orange-700 px-5 py-3 rounded-2xl font-bold text-xs whitespace-nowrap shadow-sm border border-orange-100 active:scale-95 transition-transform"
              >
                  <Search size={16} />
                  Buscar
              </button>
          </div>
      </div>

      {/* Chef Tip */}
      {currentTip && (
        <div className="px-4 mt-4">
            <div className="relative bg-white border border-[#1A4D2E]/5 rounded-[2.5rem] p-5 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => { onAddFood(currentTip, currentTip.type); showToast("Adicionado!"); }}>
                <div className="relative z-10 flex gap-4">
                    <div className="flex-1">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#1A4D2E]/10 rounded-full text-[10px] font-bold text-[#1A4D2E] uppercase mb-2">
                            <Sparkles size={10} /> Sugestão
                        </span>
                        <h2 className="font-serif text-xl text-[#1A4D2E] leading-tight mb-1 line-clamp-1">{currentTip.name}</h2>
                        <p className="text-xs text-[#4F6F52] mb-3 line-clamp-1">{currentTip.description}</p>
                        <div className="flex items-center gap-2 text-xs font-bold text-[#1A4D2E] opacity-60">
                            <Plus size={14} /> Adicionar Rápido
                        </div>
                    </div>
                    <div className="w-20 h-20 rounded-2xl bg-[#F5F1E8] flex items-center justify-center text-4xl shadow-sm">
                        {currentTip.emoji || "🥗"}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Diary List */}
      <div className="px-6 mt-8">
         <div className="flex justify-between items-end mb-4">
            <h3 className="font-serif text-2xl text-[#1A4D2E]">Consumo Hoje</h3>
            <button onClick={() => onNavigate('diary')} className="text-xs font-bold text-[#4F6F52] flex items-center gap-1 hover:text-[#1A4D2E]">Ver tudo <ChevronRight size={14}/></button>
         </div>
         <div className="grid grid-cols-2 gap-4">
             {displayedItems.map((item, idx) => (
                <div key={idx} onClick={() => setSelectedItem(item)} className="bg-white p-4 rounded-[2rem] shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center relative border border-[#1A4D2E]/5 cursor-pointer">
                    <div className="absolute top-3 right-3 text-[#4F6F52]/40"><Check size={16} /></div>
                    <div className="mb-3 -mt-2">
                        {renderItemIcon(item, "lg")}
                    </div>
                    <div className="text-[10px] font-bold text-[#4F6F52] uppercase bg-[#F5F1E8] px-2 py-0.5 rounded-full mb-2">{item.type}</div>
                    <h4 className="font-serif text-md leading-tight text-[#1A4D2E] mb-1 line-clamp-1 w-full">{item.name}</h4>
                    <div className="text-xs font-medium text-[#4F6F52] opacity-70">{item.calories} kcal</div>
                </div>
             ))}
         </div>
         {displayedItems.length === 0 && (
             <div className="text-center py-10 bg-white rounded-[2rem] border border-dashed border-[#1A4D2E]/20">
                 <p className="text-[#4F6F52] mb-2">Seu diário está vazio.</p>
                 <button onClick={() => setIsSearchOpen(true)} className="text-[#1A4D2E] font-bold text-sm underline">Começar a registrar</button>
             </div>
         )}
      </div>
    </div>
  );
};
export default Dashboard;
