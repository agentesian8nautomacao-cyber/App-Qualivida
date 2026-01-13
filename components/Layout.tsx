
import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Calendar, 
  Users, 
  AlertCircle, 
  Bell, 
  ClipboardList, 
  BarChart3, 
  UserCircle,
  LogOut,
  BrainCircuit,
  Settings,
  ShieldCheck,
  MessageSquare,
  Menu,
  Sun,
  Moon,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FileText,
  Receipt
} from 'lucide-react';
import { UserRole } from '../types';
import { useAppConfig } from '../contexts/AppConfigContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  onLogout: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  activeTab, 
  setActiveTab, 
  role, 
  setRole, 
  onLogout,
  theme,
  toggleTheme,
  notificationCount = 0,
  onOpenNotifications
}) => {
  const { config } = useAppConfig();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
  }, [theme]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;
    
    const screenWidth = window.innerWidth;
    const triggerThreshold = 60; 

    if (!isMobileMenuOpen) {
      const startedInLeftHalf = touchStartXRef.current < screenWidth / 2;
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY) * 1.5;
      if (startedInLeftHalf && isHorizontalSwipe && deltaX > triggerThreshold) {
        setIsMobileMenuOpen(true);
      }
    } else {
      if (deltaX < -triggerThreshold && Math.abs(deltaX) > Math.abs(deltaY)) {
        setIsMobileMenuOpen(false);
      }
    }

    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  const handleSwitchRole = () => {
    // Moradores não podem alternar de role
    if (role === 'MORADOR') return;
    const nextRole = role === 'PORTEIRO' ? 'SINDICO' : 'PORTEIRO';
    setRole(nextRole);
    setActiveTab('dashboard');
  };

  const menuItems = [
    // Acesso para todos
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['MORADOR', 'PORTEIRO', 'SINDICO'] },
    { id: 'notices', label: 'Mural de Avisos', icon: Bell, roles: ['MORADOR', 'PORTEIRO', 'SINDICO'] },
    { id: 'boletos', label: 'Boletos', icon: Receipt, roles: ['MORADOR', 'PORTEIRO', 'SINDICO'] },
    { id: 'reservations', label: 'Reservas', icon: Calendar, roles: ['MORADOR', 'PORTEIRO', 'SINDICO'] },
    
    // Apenas Porteiro e Síndico
    { id: 'residents', label: 'Moradores', icon: Users, roles: ['PORTEIRO', 'SINDICO'] },
    { id: 'occurrences', label: 'Ocorrências', icon: AlertCircle, roles: ['PORTEIRO', 'SINDICO'] },
    
    // Apenas Porteiro
    { id: 'packages', label: 'Encomendas', icon: Package, roles: ['PORTEIRO'] },
    { id: 'visitors', label: 'Visitantes', icon: UserCircle, roles: ['PORTEIRO'] },
    { id: 'notes', label: 'Bloco de Notas', icon: MessageSquare, roles: ['PORTEIRO'] },
    
    // Apenas Síndico
    { id: 'staff', label: 'Funcionários', icon: ClipboardList, roles: ['SINDICO'] },
    { id: 'reports', label: 'Relatórios IA', icon: FileText, roles: ['SINDICO'] },
    
    // Porteiro e Síndico - ASSISTENTE IA EXCLUSIVO (Moradores NÃO têm acesso)
    { id: 'ai', label: 'Inteligência IA', icon: BrainCircuit, roles: ['PORTEIRO', 'SINDICO'] },
    { id: 'settings', label: 'Configurações', icon: Settings, roles: ['PORTEIRO', 'SINDICO'] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(role));

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={`p-8 flex items-center transition-all duration-500 ${isDesktopCollapsed ? 'px-4 justify-center' : 'justify-between'}`}>
        <div 
          className={`flex items-center gap-2 cursor-pointer active:scale-95 transition-transform ${isDesktopCollapsed ? 'flex-col' : ''}`}
          onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
        >
          <ShieldCheck className={`text-[var(--text-primary)] transition-all duration-500 ${isDesktopCollapsed ? 'w-10 h-10' : 'w-8 h-8'}`} />
          {!isDesktopCollapsed && (
            <div>
              <h1 className="text-2xl font-black tracking-tighter shimmer-text leading-none">{config.condominiumName.toUpperCase()}</h1>
              <p className="text-[10px] opacity-40 mt-1 uppercase tracking-[0.3em] font-black" style={{ color: 'var(--text-primary)' }}>Gestão</p>
            </div>
          )}
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(false)} 
          className="lg:hidden p-2 hover:bg-white/10 rounded-xl"
        >
          <X className="w-5 h-5 text-[var(--text-primary)]" />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-4 custom-scrollbar">
        {filteredMenu.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              setIsMobileMenuOpen(false);
            }}
            title={isDesktopCollapsed ? item.label : ''}
            className={`w-full flex items-center transition-all duration-300 rounded-xl group ${
              isDesktopCollapsed ? 'justify-center p-3' : 'px-4 py-3 gap-3'
            } ${
              activeTab === item.id 
              ? 'bg-[var(--text-primary)] text-[var(--bg-color)] shadow-xl' 
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-color)]'
            }`}
          >
            <item.icon className={`transition-all duration-300 ${isDesktopCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
            {!isDesktopCollapsed && <span className="text-sm font-bold truncate">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="hidden lg:flex px-4 py-4 justify-center">
        <button 
          onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
          className="p-3 w-full border border-[var(--border-color)] rounded-2xl bg-[var(--glass-bg)] hover:bg-[var(--border-color)] transition-all flex items-center justify-center group"
        >
          {isDesktopCollapsed ? <ChevronRight className="w-5 h-5 opacity-60 group-hover:opacity-100" /> : <ChevronLeft className="w-5 h-5 opacity-60 group-hover:opacity-100" />}
        </button>
      </div>

      <div className={`p-6 border-t transition-all duration-500 ${isDesktopCollapsed ? 'p-3' : ''}`} style={{ borderColor: 'var(--border-color)' }}>
        <div className={`flex items-center rounded-2xl border transition-all duration-500 overflow-hidden ${
          isDesktopCollapsed ? 'flex-col p-2 gap-2' : 'gap-3 p-3'
        }`} style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)' }}>
          <div className={`rounded-full bg-[var(--text-primary)] flex items-center justify-center text-[var(--bg-color)] font-bold flex-shrink-0 transition-all duration-500 ${
            isDesktopCollapsed ? 'w-8 h-8 text-xs' : 'w-10 h-10'
          }`}>
            {role[0]}
          </div>
          {!isDesktopCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black truncate uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {role === 'SINDICO' ? 'Admin' : role === 'MORADOR' ? 'Morador' : 'Portaria'}
              </p>
              {role !== 'MORADOR' && (
                <button 
                  onClick={handleSwitchRole}
                  className="text-[9px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center gap-1 mt-0.5 transition-all active:scale-95"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Alternar
                </button>
              )}
            </div>
          )}
          {isDesktopCollapsed && role !== 'MORADOR' && (
            <button onClick={handleSwitchRole} className="p-1 opacity-40 hover:opacity-100" title="Alternar Perfil">
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={onLogout}
            className={`opacity-50 hover:opacity-100 transition-colors rounded-xl ${isDesktopCollapsed ? 'p-1' : 'p-2'}`}
            style={{ color: 'var(--text-primary)' }}
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="flex h-screen overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="aurora-bg">
        <div className="dot-grid"></div>
      </div>

      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[40] lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 lg:static flex flex-col border-r flex-shrink-0 z-[50] transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${
          isMobileMenuOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0'
        } ${isDesktopCollapsed ? 'lg:w-24' : 'lg:w-72'}`} 
        style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--border-color)', backdropFilter: 'blur(30px)' }}
      >
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        <header className="sticky top-0 z-30 border-b px-6 md:px-10 py-5 flex justify-between items-center" style={{ backgroundColor: 'var(--header-bg)', borderColor: 'var(--border-color)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="lg:hidden p-3 hover:bg-[var(--border-color)] rounded-2xl transition-all active:scale-90"
              style={{ color: 'var(--text-primary)' }}
            >
              <Menu className="w-6 h-6" />
            </button>
            <h2 
              onClick={() => setActiveTab('dashboard')}
              className="text-lg md:text-xl font-black tracking-tighter uppercase shimmer-text cursor-pointer hover:opacity-70 transition-all active:scale-95"
            >
              {menuItems.find(m => m.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
             {role === 'PORTEIRO' && (
               <div className="flex items-center gap-2">
                 <button 
                    onClick={onOpenNotifications}
                    className="relative p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 flex items-center justify-center group"
                    style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                 >
                    <Bell className={`w-5 h-5 transition-opacity ${notificationCount > 0 ? 'animate-soft-pulse' : 'opacity-40'}`} />
                    {notificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--text-primary)] text-[var(--bg-color)] text-[10px] font-black rounded-full flex items-center justify-center shadow-2xl border-2 border-[var(--bg-color)]">
                        {notificationCount}
                      </span>
                    )}
                 </button>
               </div>
             )}
             <button 
              onClick={toggleTheme}
              className="p-3 rounded-2xl border transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
              style={{ backgroundColor: 'var(--glass-bg)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
             >
               {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 scroll-smooth custom-scrollbar">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
