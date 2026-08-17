/**
 * Permission resolution — reuses roles/role_permissions catalog semantics.
 * NO SINDICO/PORTEIRO bypass. Fail-closed.
 */

import { filterKnownPermissionKeys } from './catalog';

export type PermissionResolver = {
  /** Resolve permission keys for a roles.name (e.g. porteiro, sindico). */
  getKeysForRoleName(roleName: string): Promise<string[]>;
};

export function createMemoryPermissionResolver(
  roleToKeys: Record<string, string[]>
): PermissionResolver {
  return {
    async getKeysForRoleName(roleName: string) {
      const keys = roleToKeys[roleName.trim().toLowerCase()] || [];
      return filterKnownPermissionKeys(keys);
    }
  };
}

/** Live READ from roles / role_permissions / permissions. No writes. No bypass. */
export function createSupabasePermissionResolver(
  env: NodeJS.ProcessEnv = process.env
): PermissionResolver {
  return {
    async getKeysForRoleName(roleName: string) {
      const name = roleName.trim().toLowerCase();
      if (!name) return [];
      const client = await getAdminClient(env);
      if (!client) return [];

      const { data: roleRow, error: roleError } = await client
        .from('roles')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      if (roleError || !roleRow?.id) return [];

      const { data: links, error: linkError } = await client
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', roleRow.id);
      if (linkError || !links?.length) return [];

      const { data: perms, error: permError } = await client
        .from('permissions')
        .select('key')
        .in(
          'id',
          links.map((l: { permission_id: string }) => l.permission_id)
        );
      if (permError || !perms?.length) return [];
      return filterKnownPermissionKeys(perms.map((p: { key: string }) => p.key));
    }
  };
}

async function getAdminClient(env: NodeJS.ProcessEnv) {
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  if (!serviceKey || !supabaseUrl) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export function resolveDefaultPermissionResolver(
  override?: PermissionResolver | null,
  env: NodeJS.ProcessEnv = process.env
): PermissionResolver {
  if (override) return override;
  return createSupabasePermissionResolver(env);
}
