import React, { useEffect, useState } from 'react';
import { Building2, LayoutDashboard, LogOut, Moon, Shield, Sun } from 'lucide-react';
import { BRANDING } from '../../config/branding';

export type MasterPage = 'dashboard' | 'organizations' | 'organization-detail';

type Props = {
  page: MasterPage;
  email?: string | null;
  children: React.ReactNode;
  onNavigate: (path: string) => void;
  onLogout: () => void;
};

export default function MasterLayout({ page, email, children, onNavigate, onLogout }: Props) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.body.classList.contains('light-mode') ? 'light' : 'dark'
  );

  useEffect(() => {
    if (theme === 'light') document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
  }, [theme]);

  const nav = [
    { id: 'dashboard' as const, label: 'Visão geral', path: '/master', icon: LayoutDashboard },
    { id: 'organizations' as const, label: 'Organizações', path: '/master/organizations', icon: Building2 }
  ];

  return (
    <div className={`min-h-screen flex ${theme === 'light' ? 'light-mode bg-slate-100 text-slate-900' : 'bg-[#06101f] text-slate-100'}`}>
      <aside className={`hidden md:flex w-64 shrink-0 border-r flex-col ${theme === 'light' ? 'bg-white border-slate-200' : 'border-white/10 bg-[#0b1930]'}`}>
        <div className={`px-5 py-6 border-b ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-500">SentinelaAUT Master</p>
          <h1 className="mt-1 text-lg font-black tracking-tight">{BRANDING.name}</h1>
          <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
            Central de Administração da Plataforma
          </p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active =
              item.id === 'dashboard'
                ? page === 'dashboard'
                : page === 'organizations' || page === 'organization-detail';
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-200 border border-cyan-400/30'
                    : theme === 'light'
                      ? 'text-slate-500 hover:bg-slate-100 border border-transparent'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className={`p-4 border-t space-y-2 ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-2 text-xs opacity-70">
            <Shield className="w-3.5 h-3.5" />
            <span className="truncate">{email || 'Sessão Master'}</span>
          </div>
          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold"
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className={`md:hidden flex items-center justify-between px-4 py-3 border-b ${theme === 'light' ? 'bg-white border-slate-200' : 'bg-[#0b1930] border-white/10'}`}>
          <p className="text-sm font-black">Master</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => onNavigate('/master')} className="text-xs font-bold">
              Início
            </button>
            <button type="button" onClick={() => onNavigate('/master/organizations')} className="text-xs font-bold">
              Orgs
            </button>
            <button type="button" onClick={onLogout} className="text-xs font-bold">
              Sair
            </button>
          </div>
        </header>
        <main className="flex-1 min-w-0 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
