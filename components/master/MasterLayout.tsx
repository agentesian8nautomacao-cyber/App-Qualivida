import React from 'react';
import { Building2, LayoutDashboard, LogOut, Shield } from 'lucide-react';
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
  const nav = [
    { id: 'dashboard' as const, label: 'Dashboard', path: '/master', icon: LayoutDashboard },
    { id: 'organizations' as const, label: 'Organizações', path: '/master/organizations', icon: Building2 }
  ];

  return (
    <div className="min-h-screen bg-[#06101f] text-slate-100 flex">
      <aside className="w-64 shrink-0 border-r border-white/10 bg-[#0b1930] flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
            Platform Admin
          </p>
          <h1 className="mt-1 text-lg font-black tracking-tight">{BRANDING.name}</h1>
          <p className="text-xs text-slate-400 mt-1">Painel Master</p>
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
                    ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/30'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
            <Shield className="w-3.5 h-3.5" />
            <span className="truncate">{email || 'Sessão Master'}</span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-8">{children}</main>
    </div>
  );
}
