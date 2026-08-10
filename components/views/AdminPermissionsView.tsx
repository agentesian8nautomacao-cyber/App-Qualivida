import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ShieldCheck, Loader2, AlertCircle, ChevronLeft, Check } from 'lucide-react';
import {
  getRolesPermissionsMatrix,
  togglePermission,
  type Role,
  type Permission,
  type RolePermission
} from '../../services/permissionsService';
import { useToast } from '../../contexts/ToastContext';

interface AdminPermissionsViewProps {
  onBack?: () => void;
}

export default function AdminPermissionsView({ onBack }: AdminPermissionsViewProps) {
  const toast = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  /** Páginas fixas baseadas nas rotas reais do sidebar. */
  const PAGES = useMemo(
    () =>
      [
        {
          id: 'dashboard',
          label: 'Dashboard',
          actions: ['view']
        },
        {
          id: 'residents',
          label: 'Moradores',
          actions: ['view', 'create', 'update', 'delete']
        },
        {
          id: 'staff',
          label: 'Funcionários',
          actions: ['view', 'create', 'update', 'delete']
        },
        {
          id: 'visitors',
          label: 'Visitantes',
          actions: ['view', 'create', 'update', 'delete']
        },
        {
          id: 'occurrences',
          label: 'Ocorrências',
          actions: ['view', 'create', 'update', 'delete', 'resolve']
        },
        {
          id: 'reservations',
          label: 'Reservas',
          actions: ['view', 'create', 'update', 'delete']
        },
        {
          id: 'packages',
          label: 'Encomendas',
          actions: ['view', 'create', 'update', 'delete']
        },
        {
          id: 'notices',
          label: 'Mural de Avisos',
          actions: ['view', 'create', 'update', 'delete']
        },
        {
          id: 'boletos',
          label: 'Financeiro',
          actions: ['view', 'create', 'update', 'delete', 'download']
        },
        {
          id: 'sentinela',
          label: 'Sentinela AI',
          actions: ['view']
        },
        {
          id: 'settings',
          label: 'Configurações',
          actions: ['view', 'update']
        }
      ] as {
        id: string;
        label: string;
        actions: string[];
      }[],
    []
  );

  const ACTION_LABEL: Record<string, string> = {
    view: 'Acessar página',
    create: 'Criar',
    update: 'Editar',
    delete: 'Excluir',
    download: 'Download',
    resolve: 'Resolver'
  };

  const permissionsByKey = useMemo(() => {
    const map: Record<string, Permission> = {};
    permissions.forEach((perm) => {
      if (perm.key) {
        map[perm.key] = perm;
      }
    });
    return map;
  }, [permissions]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRolesPermissionsMatrix();
      setRoles(data.roles);
      setPermissions(data.permissions);
      setRolePermissions(data.rolePermissions);
    } catch (e: any) {
      setError(e?.message || 'Falha ao carregar permissões.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasPermission = (roleId: string, permissionId: string) =>
    rolePermissions.some((rp) => rp.role_id === roleId && rp.permission_id === permissionId);

  const handleToggle = async (roleId: string, permissionId: string) => {
    const key = `${roleId}-${permissionId}`;
    if (toggling) return;
    const granted = hasPermission(roleId, permissionId);
    setToggling(key);
    try {
      const { error: err } = await togglePermission(roleId, permissionId, granted);
      if (err) {
        toast.error(err);
        return;
      }
      if (granted) {
        setRolePermissions((prev) => prev.filter((rp) => !(rp.role_id === roleId && rp.permission_id === permissionId)));
        toast.success('Permissão removida.');
      } else {
        setRolePermissions((prev) => [...prev, { role_id: roleId, permission_id: permissionId }]);
        toast.success('Permissão concedida.');
      }
    } finally {
      setToggling(null);
    }
  };

  const roleLabel: Record<string, string> = {
    morador: 'Morador',
    porteiro: 'Porteiro',
    cabo_turma: 'Cabo de Turma',
    administradora: 'Administradora',
    sindico: 'Síndico'
  };

  const selectedPage = useMemo(
    () => PAGES.find((p) => p.id === selectedPageId) || null,
    [PAGES, selectedPageId]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--text-primary)]" />
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--text-secondary)]">Carregando permissões...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-center text-[var(--text-primary)] font-bold">{error}</p>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--glass-bg)] font-bold uppercase text-sm"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 min-w-0 px-1 sm:px-0">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--border-color)]/40 transition-colors"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5 text-[var(--text-primary)]" />
            </button>
          )}
          <ShieldCheck className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--text-primary)] shrink-0" />
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-contrast-high leading-tight uppercase">
              Permissões
            </h2>
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-contrast-low mt-0.5">
              Controle de acesso por página e ação. Desmarque para bloquear para o perfil.
            </p>
          </div>
        </div>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-[var(--text-secondary)]">
            Páginas do sistema
          </h3>
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-secondary)]">
            Clique em uma página para configurar
          </p>
        </div>

        <div
          className="rounded-2xl border overflow-hidden min-w-0"
          style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--glass-bg)' }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left border-collapse">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                    Página
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] text-right">
                    Configurar
                  </th>
                </tr>
              </thead>
              <tbody>
                {PAGES.filter((page) =>
                  ['dashboard', 'residents', 'staff', 'visitors', 'occurrences', 'reservations', 'packages', 'notices', 'boletos', 'sentinela'].includes(
                    page.id
                  )
                ).map((page) => (
                  <tr
                    key={page.id}
                    className="border-b last:border-b-0 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    style={{ borderColor: 'var(--border-color)' }}
                    onClick={() => setSelectedPageId(page.id)}
                  >
                    <td className="px-4 py-3 text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                      {page.label}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center px-3 py-1.5 rounded-full border text-[9px] font-black uppercase tracking-widest"
                        style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}
                      >
                        Configurar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[10px] md:text-[11px] font-medium uppercase tracking-widest text-[var(--text-secondary)]">
          <span className="font-bold text-[var(--text-primary)]">Regra:</span> se{' '}
          <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px]">.view</code> estiver desmarcado,
          a página desaparece do menu e a rota é bloqueada. As ações internas dependem de{' '}
          <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px]">.create</code>,{' '}
          <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px]">.update</code> e{' '}
          <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px]">.delete</code>.
        </p>
      </section>

      {selectedPage && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedPageId(null)}
          />
          <div
            className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border shadow-2xl overflow-hidden"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}
          >
            <div className="px-4 sm:px-5 py-4 border-b shrink-0" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-widest text-[var(--text-primary)] truncate">
                    Configurar permissões — {selectedPage.label}
                  </h3>
                  <p className="text-[11px] sm:text-xs font-medium text-[var(--text-secondary)] mt-1">
                    Defina quais perfis podem acessar a página e quais ações podem executar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPageId(null)}
                  className="px-3 py-1.5 rounded-xl border text-[11px] font-bold uppercase tracking-widest hover:bg-[var(--border-color)]/40 shrink-0"
                  style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  Fechar
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto px-4 sm:px-5 py-4 space-y-4 custom-scrollbar">
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] leading-relaxed">
                <span className="font-semibold text-[var(--text-primary)]">.view</span> controla o acesso à página
                (menu e rota). As demais colunas controlam os botões e ações internas da tela selecionada.
              </p>

              <div className="space-y-2">
                <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  Permissões por perfil
                </h4>
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--glass-bg)' }}
                >
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                        <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                          Perfil
                        </th>
                        {selectedPage.actions.map((actionKey) => (
                          <th
                            key={actionKey}
                            className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] text-center whitespace-nowrap"
                          >
                            {ACTION_LABEL[actionKey] || actionKey}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map((role) => {
                        return (
                          <tr
                            key={role.id}
                            className="border-b last:border-b-0"
                            style={{ borderColor: 'var(--border-color)' }}
                          >
                            <td className="px-4 py-2 text-xs sm:text-sm font-medium text-[var(--text-primary)]">
                              {roleLabel[role.name] || role.name}
                            </td>
                            {selectedPage.actions.map((actionKey) => {
                              const permissionKey = `${selectedPage.id}.${actionKey}`;
                              const perm = permissionsByKey[permissionKey];
                              if (!perm) {
                                return (
                                  <td
                                    key={actionKey}
                                    className="px-3 py-2 text-center text-[10px] opacity-40"
                                  >
                                    —
                                  </td>
                                );
                              }
                              const checked = hasPermission(role.id, perm.id);
                              const toggleKey = `${role.id}-${perm.id}`;
                              const isToggling = toggling === toggleKey;
                              return (
                                <td key={actionKey} className="px-3 py-2 text-center">
                                  <label className="inline-flex items-center justify-center cursor-pointer">
                                    <span className="relative inline-flex shrink-0">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={!!toggling}
                                        onChange={() => handleToggle(role.id, perm.id)}
                                        className="peer w-5 h-5 rounded border-2 border-[var(--border-color)] bg-[var(--bg-color)] cursor-pointer disabled:opacity-50 appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--text-primary)] focus-visible:ring-offset-[var(--bg-color)]"
                                      />
                                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 peer-checked:opacity-100 text-[var(--text-primary)]">
                                        <Check className="w-3 h-3" strokeWidth={3} />
                                      </span>
                                    </span>
                                    {isToggling && (
                                      <Loader2 className="w-4 h-4 ml-1 animate-spin text-[var(--text-secondary)]" />
                                    )}
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 border-t shrink-0 flex justify-end" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-color)' }}>
              <button
                type="button"
                onClick={() => setSelectedPageId(null)}
                className="px-4 py-2 rounded-xl border font-bold uppercase tracking-widest text-sm"
                style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)', backgroundColor: 'var(--glass-bg)' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
