import { supabase } from './supabase';

export interface Role {
  id: string;
  name: string;
  created_at?: string;
}

export interface Permission {
  id: string;
  key: string;
  label: string;
  created_at?: string;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
}

/** Mapeia UserRole do app para o name da tabela roles (lowercase). */
export function appRoleToRoleName(role: string): string {
  const r = (role || '').toUpperCase();
  if (r === 'MORADOR') return 'morador';
  if (r === 'PORTEIRO') return 'porteiro';
  if (r === 'CABO_TURMA') return 'cabo_turma';
  if (r === 'ADMINISTRADORA' || r === 'ADMIN' || r === 'ADMINISTRADOR') return 'administradora';
  if (r === 'SINDICO') return 'sindico';
  return 'morador';
}

/**
 * Busca todas as permissões (keys) associadas a um perfil pelo nome do role.
 * Usado no login para popular userPermissions no contexto.
 */
export async function getPermissionsByRoleName(roleName: string): Promise<string[]> {
  const { data: roleRow, error: roleError } = await supabase
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .maybeSingle();

  if (roleError || !roleRow?.id) return [];

  const { data: links, error: linkError } = await supabase
    .from('role_permissions')
    .select('permission_id')
    .eq('role_id', roleRow.id);

  if (linkError || !links?.length) return [];

  const { data: perms, error: permError } = await supabase
    .from('permissions')
    .select('key')
    .in('id', links.map((l) => l.permission_id));

  if (permError || !perms?.length) return [];
  return perms.map((p) => p.key);
}

/**
 * Busca roles, permissions e role_permissions para montar a matriz na página Admin Permissões.
 */
export async function getRolesPermissionsMatrix(): Promise<{
  roles: Role[];
  permissions: Permission[];
  rolePermissions: RolePermission[];
}> {
  const [rolesRes, permissionsRes, rpRes] = await Promise.all([
    supabase.from('roles').select('id, name, created_at').order('name'),
    supabase.from('permissions').select('id, key, label, created_at').order('key'),
    supabase.from('role_permissions').select('role_id, permission_id')
  ]);

  const roles = (rolesRes.data || []) as Role[];
  const permissions = (permissionsRes.data || []) as Permission[];
  const rolePermissions = (rpRes.data || []) as RolePermission[];

  return { roles, permissions, rolePermissions };
}

/**
 * Concede permissão via RPC (contorna RLS; a função no banco valida se o usuário é admin).
 */
export async function grantPermission(roleId: string, permissionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('rpc_grant_role_permission', {
    p_role_id: roleId,
    p_permission_id: permissionId
  });
  return { error: error?.message || null };
}

/**
 * Revoga permissão via RPC (contorna RLS; a função no banco valida se o usuário é admin).
 */
export async function revokePermission(roleId: string, permissionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('rpc_revoke_role_permission', {
    p_role_id: roleId,
    p_permission_id: permissionId
  });
  return { error: error?.message || null };
}

/**
 * Alterna permissão: se existir, revoga; senão, concede.
 */
export async function togglePermission(
  roleId: string,
  permissionId: string,
  currentGranted: boolean
): Promise<{ error: string | null }> {
  if (currentGranted) return revokePermission(roleId, permissionId);
  return grantPermission(roleId, permissionId);
}
