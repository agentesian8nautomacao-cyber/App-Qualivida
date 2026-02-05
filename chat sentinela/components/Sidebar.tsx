
import React from 'react';
import { 
  Home, 
  Sparkles, 
  UtensilsCrossed, 
  TrendingUp, 
  Heart, 
  Trophy, 
  BookOpen, 
  UserCircle, 
  ShieldCheck, 
  Settings, 
  X,
  ScrollText,
  Dumbbell
} from 'lucide-react';
import { AppView } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentView, onNavigate }) => {
  
  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'diet_plan', label: 'Meu Plano Alimentar', icon: ScrollText },
    { id: 'smart_meal', label: 'Refeição Inteligente', icon: UtensilsCrossed },
    { id: 'personal_chat', label: 'Personal Nutri', icon: Dumbbell },
    { id: 'progress', label: 'Progresso', icon: TrendingUp },
    { id: 'wellness', label: 'Plano de Bem-estar', icon: Heart },
    { id: 'challenges', label: 'Desafios', icon: Trophy },
    { id: 'library', label: 'Biblioteca', icon: BookOpen },
    { id: 'profile', label: 'Meu Perfil', icon: UserCircle },
    { id: 'security', label: 'Privacidade', icon: ShieldCheck },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-[#1A4D2E]/60 z-40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div 
        className={`fixed top-0 left-0 bottom-0 w-72 bg-[#1A4D2E] text-[#F5F1E8] z-50 transform transition-transform duration-300 ease-in-out flex flex-col rounded-r-[2.5rem] shadow-2xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-8 flex justify-between items-center">
          {/* Matched Logo Style to Landing Page */}
          <h2 className="text-3xl font-serif text-[#F5F1E8]">Nutri<span className="opacity-50">.ai</span></h2>
          <button onClick={onClose} className="text-[#F5F1E8]/60 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-2 no-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id as AppView);
                  onClose();
                }}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-[1.5rem] transition-all duration-200 group ${
                  isActive 
                    ? 'bg-[#F5F1E8] text-[#1A4D2E] shadow-lg' 
                    : 'text-[#F5F1E8]/60 hover:bg-[#4F6F52]/20 hover:text-[#F5F1E8]'
                }`}
              >
                <Icon 
                  size={20} 
                  className={`transition-colors ${isActive ? 'text-[#1A4D2E]' : 'text-[#F5F1E8]/60 group-hover:text-[#F5F1E8]'}`} 
                />
                <span className="font-medium text-sm tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6">
          <div className="bg-[#4F6F52] rounded-[2rem] p-5 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-full bg-[#F5F1E8] flex items-center justify-center text-[#1A4D2E] font-bold text-xs shadow-md">
              PRO
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#F5F1E8]">Plano Premium</div>
              <div className="text-[11px] text-[#F5F1E8]/70">Desbloqueie tudo</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
