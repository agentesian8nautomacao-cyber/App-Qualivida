
import React, { useState, useRef } from 'react';
import { ChevronRight, Building2, ShieldCheck, Activity, User, Briefcase } from 'lucide-react';
import { UserRole } from '../types';

interface LandingPageProps {
  onGetStarted: (role: UserRole) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.Doorman);
  const trackRef = useRef<HTMLDivElement>(null);

  // --- SLIDER LOGIC ---
  const handlePointerDown = (e: React.PointerEvent) => {
      setIsDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isDragging || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clientX = e.clientX;
      let newPos = clientX - rect.left - 8; // 8px padding
      const trackWidth = rect.width;
      const knobWidth = 70; // Width of the square knob
      const maxPos = trackWidth - knobWidth - 16;
      
      if (newPos < 0) newPos = 0;
      if (newPos > maxPos) newPos = maxPos;
      setSliderPosition(newPos);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      setIsDragging(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      if (!trackRef.current) return;
      
      const rect = trackRef.current.getBoundingClientRect();
      const knobWidth = 70;
      const maxPos = rect.width - knobWidth - 16;
      
      // Threshold to trigger unlock (85%)
      if (sliderPosition > maxPos * 0.85) {
          setSliderPosition(maxPos);
          if (navigator.vibrate) navigator.vibrate(50);
          
          // Trigger Transition with selected role
          setTimeout(() => {
              onGetStarted(selectedRole);
          }, 300);
      } else {
          // Snap back
          setSliderPosition(0);
      }
  };

  const textOpacity = Math.max(0, 1 - (sliderPosition / 150));
  const isManager = selectedRole === UserRole.Manager;

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans relative overflow-hidden flex flex-col">
        
        {/* --- DARK ARCHITECTURAL BACKGROUND --- */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]"></div>
            
            <svg 
                className="w-full h-full opacity-[0.05]" 
                viewBox="0 0 1440 900" 
                xmlns="http://www.w3.org/2000/svg" 
                preserveAspectRatio="none"
            >
                <g stroke="white" strokeWidth="1" fill="none">
                    {/* Architectural Lines */}
                    <path d="M0 800 L1440 200" />
                    <path d="M0 600 L1440 400" />
                    <rect x="200" y="200" width="200" height="400" strokeDasharray="10 10" />
                    <rect x="1000" y="300" width="300" height="500" strokeDasharray="10 10" />
                    <circle cx="720" cy="450" r="150" strokeDasharray="5 5" />
                </g>
            </svg>
        </div>

        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 flex flex-col relative z-30 h-full">
            
            {/* Header / Logo */}
            <div className="pt-8 px-6 flex justify-center items-center">
                 <div className="flex items-center gap-2 opacity-80">
                     <Building2 size={20} className="text-white" />
                     <span className="font-serif text-2xl font-bold tracking-wider">Portaria.ai</span>
                 </div>
            </div>

            {/* HERO CARD - OPTICALLY CENTERED */}
            <div className="flex-1 flex flex-col justify-center items-center px-6 -mt-10">
                
                <div className="max-w-md w-full animate-in zoom-in duration-1000 relative">
                    {/* Dark Glass Card */}
                        <div className="bg-black/60 backdrop-blur-xl p-8 md:p-10 rounded-[3rem] border border-white/10 shadow-2xl relative overflow-hidden">
                            
                            {/* Inner Glow (Dynamic based on Role) */}
                            <div className={`absolute -top-20 -left-20 w-40 h-40 rounded-full blur-3xl pointer-events-none transition-colors duration-500 ${isManager ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}></div>

                            <div className="relative z-10 text-center">
                                <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight mb-4 text-white leading-[1.1]">
                                    {isManager ? 'Gestão' : 'Controle'} <br/>
                                    <span className={`italic font-serif transition-colors duration-500 ${isManager ? 'text-amber-500' : 'text-emerald-500'}`}>
                                        {isManager ? 'Administrativa.' : 'de Acesso.'}
                                    </span>
                                </h1>
                                <p className="text-zinc-500 font-medium text-sm md:text-base leading-relaxed mb-8 max-w-xs mx-auto">
                                    Selecione seu perfil de acesso para configurar o ambiente.
                                </p>

                                {/* ROLE SELECTOR */}
                                <div className="grid grid-cols-2 gap-4 mb-2">
                                    <button 
                                        onClick={() => setSelectedRole(UserRole.Doorman)}
                                        className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 group ${
                                            selectedRole === UserRole.Doorman 
                                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                                            : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                                        }`}
                                    >
                                        <User size={24} className={selectedRole === UserRole.Doorman ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                                        <span className="text-xs font-bold uppercase tracking-wider">Portaria</span>
                                    </button>

                                    <button 
                                        onClick={() => setSelectedRole(UserRole.Manager)}
                                        className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-2 group ${
                                            selectedRole === UserRole.Manager 
                                            ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.1)]' 
                                            : 'bg-zinc-900/50 border-white/5 text-zinc-500 hover:bg-zinc-800'
                                        }`}
                                    >
                                        <Briefcase size={24} className={selectedRole === UserRole.Manager ? 'scale-110' : 'group-hover:scale-110 transition-transform'} />
                                        <span className="text-xs font-bold uppercase tracking-wider">Síndico</span>
                                    </button>
                                </div>

                            </div>
                    </div>
                </div>
            </div>

            {/* --- SLIDER INTERACTION (PREMIUM DARK) --- */}
            <div className="w-full pb-16 px-6 z-50 animate-in slide-in-from-bottom duration-700 delay-300">
                <div 
                    ref={trackRef}
                    className="relative bg-[#18181B] rounded-[2.5rem] h-20 shadow-2xl border border-white/5 max-w-sm mx-auto overflow-hidden touch-none"
                >
                        {/* Background Text */}
                        <div 
                        className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300"
                        style={{ opacity: textOpacity, paddingLeft: '60px' }}
                        >
                            <span className="text-white/40 font-medium text-xs tracking-[0.3em] uppercase animate-pulse">
                                {isManager ? 'Acessar Gestão' : 'Iniciar Turno'}
                            </span>
                            <div className="absolute right-6 opacity-30">
                                <ChevronRight size={18} className="text-white" />
                            </div>
                        </div>

                        {/* Draggable Knob - WHITE GLOWING BUTTON */}
                        <div 
                        className={`absolute top-2 left-2 h-16 w-20 rounded-[2rem] flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] cursor-grab active:cursor-grabbing z-20 group transition-colors duration-300 ${isManager ? 'bg-amber-500 text-black' : 'bg-white text-black'}`}
                        style={{ transform: `translateX(${sliderPosition}px)`, transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        >
                            <div className="group-active:scale-110 transition-transform">
                                <ChevronRight size={24} strokeWidth={3} />
                            </div>
                        </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default LandingPage;
