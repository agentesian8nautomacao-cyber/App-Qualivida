-- Contornar RLS em role_permissions: funções RPC SECURITY DEFINER que só admins podem chamar.
-- O app chama essas funções em vez de INSERT/DELETE direto; a checagem de admin é feita dentro da função.

CREATE OR REPLACE FUNCTION public.rpc_grant_role_permission(p_role_id uuid, p_permission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.auth_id = auth.uid())
        AND UPPER(TRIM(COALESCE(u.role, ''))) IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR')
    )
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
        AND UPPER(TRIM(COALESCE(s.role, ''))) IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR')
    )
  ) THEN
    RAISE EXCEPTION 'Apenas Síndico ou Administradora podem alterar permissões.';
  END IF;
  INSERT INTO public.role_permissions (role_id, permission_id)
  VALUES (p_role_id, p_permission_id)
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_revoke_role_permission(p_role_id uuid, p_permission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.auth_id = auth.uid())
        AND UPPER(TRIM(COALESCE(u.role, ''))) IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR')
    )
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
        AND UPPER(TRIM(COALESCE(s.role, ''))) IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR')
    )
  ) THEN
    RAISE EXCEPTION 'Apenas Síndico ou Administradora podem alterar permissões.';
  END IF;
  DELETE FROM public.role_permissions
  WHERE role_id = p_role_id AND permission_id = p_permission_id;
END;
$$;

-- Expor as funções para o cliente (role authenticated)
GRANT EXECUTE ON FUNCTION public.rpc_grant_role_permission(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_revoke_role_permission(uuid, uuid) TO authenticated;
