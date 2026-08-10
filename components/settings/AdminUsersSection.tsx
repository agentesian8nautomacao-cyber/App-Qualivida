import React from 'react';
import { Shield, Users, UserPlus } from 'lucide-react';

interface AdminUsersSectionProps {
  onOpenAdminUserModal?: () => void;
}

const AdminUsersSection: React.FC<AdminUsersSectionProps> = ({ onOpenAdminUserModal }) => {
  return (
    <div className="premium-glass rounded-2xl p-4 sm:p-6 border border-[var(--border-color)] min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 mb-4 min-w-0">
        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0">
          <Shield className="w-5 h-5 text-blue-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base sm:text-lg font-black uppercase tracking-tight">Usuários Administrativos</h3>
          <p className="text-xs opacity-60">Gerencie administradores e seus acessos</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-[var(--glass-bg)] rounded-xl border border-[var(--border-color)]">
          <div className="flex items-start gap-3 min-w-0">
            <Users className="w-4 h-4 opacity-60 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold">Administradores Ativos</p>
              <p className="text-xs opacity-60">Porteiros, Síndicos, Administradoras e Cabos de Turma com acesso ao sistema</p>
            </div>
          </div>
          <button
            onClick={onOpenAdminUserModal}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 transition-colors shrink-0"
          >
            <UserPlus className="w-3 h-3" />
            Novo Administrador
          </button>
        </div>

        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Acesso Restrito</p>
              <p className="text-xs text-amber-700 mt-1">
                Apenas usuários com função "Síndico" ou "Administrador" podem criar novos usuários administrativos.
                Use "Administradora" para perfis responsáveis por financeiro, balancete e boletos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsersSection;