-- Ajuste RLS: permitir alterar role_permissions quando o admin está em users OU em staff
-- (o app usa ambas as tabelas para login; 403 ao marcar permissão vinha da policy só checar users)

DROP POLICY IF EXISTS "role_permissions_insert_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_insert_admin"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.auth_id = auth.uid())
        AND (u.is_active = true OR u.is_active IS NULL)
        AND UPPER(TRIM(COALESCE(u.role, ''))) IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR')
    )
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
        AND UPPER(TRIM(COALESCE(s.role, ''))) IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR')
    )
  );

DROP POLICY IF EXISTS "role_permissions_delete_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_delete_admin"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.auth_id = auth.uid())
        AND (u.is_active = true OR u.is_active IS NULL)
        AND UPPER(TRIM(COALESCE(u.role, ''))) IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR')
    )
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
        AND UPPER(TRIM(COALESCE(s.role, ''))) IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR')
    )
  );
