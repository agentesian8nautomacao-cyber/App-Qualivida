import { useAuth } from '../contexts/AuthContext';

/**
 * Retorna se o usuário atual tem a permissão indicada (por key).
 * Síndico (admin principal) sempre tem todas as permissões.
 * Uso: if (!hasPermission("staff.view")) return <AccessDenied />;
 * Ou: {hasPermission("staff.create") && <Button>Adicionar Funcionário</Button>}
 */
export function useHasPermission(permissionKey: string): boolean {
  const { userPermissions, isAdminPrincipal } = useAuth();
  if (isAdminPrincipal) return true;
  return userPermissions.includes(permissionKey);
}
