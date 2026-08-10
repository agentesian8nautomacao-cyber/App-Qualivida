-- Ajuste: reconhecer admin mesmo com role gravado com acento (ex: Síndico -> SÍNDICO).
-- 400 / "Apenas Síndico ou Administradora podem alterar permissões" vinha do UPPER('Síndico') = 'SÍNDICO' <> 'SINDICO'.

CREATE OR REPLACE FUNCTION public.rpc_grant_role_permission(p_role_id uuid, p_permission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := false;
  r text;
BEGIN
  -- users: auth_user_id ou auth_id e role de admin (normalizar Í->I para "Síndico")
  FOR r IN
    SELECT REPLACE(REPLACE(UPPER(TRIM(COALESCE(u.role, ''))), 'Í', 'I'), 'Ó', 'O')
    FROM public.users u
    WHERE (u.auth_user_id = auth.uid() OR u.auth_id = auth.uid())
    LIMIT 1
  LOOP
    is_admin := r IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR');
    EXIT WHEN is_admin;
  END LOOP;

  IF NOT is_admin THEN
    FOR r IN
      SELECT REPLACE(REPLACE(UPPER(TRIM(COALESCE(s.role, ''))), 'Í', 'I'), 'Ó', 'O')
      FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
      LIMIT 1
    LOOP
      is_admin := r IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR');
      EXIT WHEN is_admin;
    END LOOP;
  END IF;

  IF NOT is_admin THEN
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
DECLARE
  is_admin boolean := false;
  r text;
BEGIN
  FOR r IN
    SELECT REPLACE(REPLACE(UPPER(TRIM(COALESCE(u.role, ''))), 'Í', 'I'), 'Ó', 'O')
    FROM public.users u
    WHERE (u.auth_user_id = auth.uid() OR u.auth_id = auth.uid())
    LIMIT 1
  LOOP
    is_admin := r IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR');
    EXIT WHEN is_admin;
  END LOOP;

  IF NOT is_admin THEN
    FOR r IN
      SELECT REPLACE(REPLACE(UPPER(TRIM(COALESCE(s.role, ''))), 'Í', 'I'), 'Ó', 'O')
      FROM public.staff s
      WHERE s.auth_user_id = auth.uid()
      LIMIT 1
    LOOP
      is_admin := r IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR');
      EXIT WHEN is_admin;
    END LOOP;
  END IF;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Apenas Síndico ou Administradora podem alterar permissões.';
  END IF;

  DELETE FROM public.role_permissions
  WHERE role_id = p_role_id AND permission_id = p_permission_id;
END;
$$;
