-- Padrão: todos os perfis têm acesso a todo o sistema.
-- O admin bloqueia áreas desmarcando a caixinha (remove da role_permissions = perde acesso).

CREATE OR REPLACE FUNCTION public.seed_all_roles_all_permissions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r
  CROSS JOIN public.permissions p
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END;
$$;

SELECT public.seed_all_roles_all_permissions();
DROP FUNCTION IF EXISTS public.seed_all_roles_all_permissions();

COMMENT ON TABLE public.role_permissions IS 'Permissões por perfil. Padrão: todos têm tudo; admin desmarca para BLOQUEAR acesso à área.';
