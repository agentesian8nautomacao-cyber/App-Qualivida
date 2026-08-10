
import React, { useState, useEffect } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface ScreenSaverProps {
  onExit: () => void;
  theme: 'dark' | 'light';
}

const ScreenSaver: React.FC<ScreenSaverProps> = ({ onExit, theme }) => {
  const { config } = useAppConfig();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  return (
    <div 
      onClick={onExit}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-1000`}
      style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-primary)' }}
    >
      {/* Background aurora adaptável ao tema */}
      <div className="absolute inset-0 z-[-1] opacity-40">
        <div className="aurora-bg"></div>
        <div className="dot-grid !opacity-10"></div>
      </div>
      
      <div className="text-center space-y-16 animate-in fade-in zoom-in duration-1000">
        <h1 className="shimmer-text reveal-teaser text-5xl md:text-7xl font-black mb-8">
          {config.condominiumName.toUpperCase()}
        </h1>
        
        <div className="space-y-6 opacity-0 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500 fill-mode-forwards">
          <div className="text-[10rem] md:text-[16rem] font-black tracking-tighter leading-none drop-shadow-2xl">
            {formatTime(time).split(':')[0]}:{formatTime(time).split(':')[1]}
          </div>
          <div className="text-lg md:text-2xl font-bold uppercase tracking-[0.6em] opacity-60">
            {formatDate(time)}
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 text-[11px] font-black uppercase tracking-[0.5em] opacity-30 animate-pulse">
        Toque para retornar
      </div>
    </div>
  );
};

export default ScreenSaver;
