import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { UserRole } from '../types';
import { getPermissionsByRoleName, appRoleToRoleName } from '../services/permissionsService';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  /** Lista de permission keys do perfil atual (vazio para não autenticado). Síndico pode ter "all" implícito. */
  userPermissions: string[];
  /** Define usuário e carrega permissões do perfil (chamar após login). */
  setUser: (user: AuthUser | null) => void;
  /** Recarrega permissões do role atual (útil após alterar matriz de permissões). */
  refreshPermissions: () => Promise<void>;
  /** Admin principal (síndico) tem todas as permissões sem consultar banco. */
  isAdminPrincipal: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALL_PERMISSION_KEYS = [
  // Dashboard
  'dashboard.view',

  // Ocorrências
  'occurrences.view',
  'occurrences.create',
  'occurrences.update',
  'occurrences.delete',

  // Reservas
  'reservations.view',
  'reservations.create',
  'reservations.update',
  'reservations.delete',

  // Moradores
  'residents.view',
  'residents.create',
  'residents.update',
  'residents.delete',

  // Funcionários (staff)
  'staff.view',
  'staff.create',
  'staff.update',
  'staff.delete',

  // Encomendas (packages)
  'packages.view',
  'packages.create',
  'packages.update',
  'packages.delete',

  // Visitantes
  'visitors.view',
  'visitors.create',
  'visitors.update',
  'visitors.delete',

  // Mural de avisos (notices)
  'notices.view',
  'notices.create',
  'notices.update',
  'notices.delete',

  // Boletos
  'boletos.view',
  'boletos.create',
  'boletos.update',
  'boletos.delete',
  'boletos.download',

  // Sentinela
  'sentinela.view',

  // Configurações
  'settings.view',
  'settings.update'
];

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  const role: UserRole | null = user ? (user.role as UserRole) : null;
  const isAdminPrincipal = role === 'SINDICO';

  const refreshPermissions = useCallback(async () => {
    if (!user?.role) {
      setUserPermissions([]);
      return;
    }
    if (user.role.toUpperCase() === 'SINDICO') {
      setUserPermissions(ALL_PERMISSION_KEYS);
      return;
    }
    const roleName = appRoleToRoleName(user.role);
    const keys = await getPermissionsByRoleName(roleName);
    setUserPermissions(keys);
  }, [user?.role]);

  const setUser = useCallback(
    async (nextUser: AuthUser | null) => {
      setUserState(nextUser);
      if (!nextUser) {
        setUserPermissions([]);
        return;
      }
      if (nextUser.role.toUpperCase() === 'SINDICO') {
        setUserPermissions(ALL_PERMISSION_KEYS);
        return;
      }
      const roleName = appRoleToRoleName(nextUser.role);
      const keys = await getPermissionsByRoleName(roleName);
      setUserPermissions(keys);
    },
    []
  );

  const value: AuthContextType = {
    user,
    role,
    userPermissions,
    setUser,
    refreshPermissions,
    isAdminPrincipal
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

