-- RBAC: roles, permissions, role_permissions
-- Perfis e permissões por área do app; controle de acesso dinâmico.

-- Tabela de perfis (roles)
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabela de permissões (áreas/módulos do app)
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Relacionamento N:N entre perfis e permissões
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions (permission_id);

-- Inserir perfis
INSERT INTO public.roles (name) VALUES
  ('morador'),
  ('porteiro'),
  ('cabo_turma'),
  ('administradora'),
  ('sindico')
ON CONFLICT (name) DO NOTHING;

-- Inserir permissões (áreas do sistema)
INSERT INTO public.permissions (key, label) VALUES
  ('view_dashboard', 'Dashboard'),
  ('manage_residents', 'Moradores'),
  ('manage_staff', 'Funcionários'),
  ('manage_reservations', 'Reservas'),
  ('manage_packages', 'Encomendas'),
  ('manage_occurrences', 'Ocorrências'),
  ('manage_notices', 'Mural de Avisos'),
  ('manage_boletos', 'Boletos / Financeiro'),
  ('view_reports', 'Relatórios'),
  ('manage_settings', 'Configurações'),
  ('manage_visitors', 'Visitantes'),
  ('view_sentinela', 'Sentinela AI')
ON CONFLICT (key) DO NOTHING;

-- Seed em role_permissions via função SECURITY DEFINER (contorna RLS no Supabase)
CREATE OR REPLACE FUNCTION public.seed_role_permissions_rbac()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r_morador uuid; r_porteiro uuid; r_cabo uuid; r_adm uuid; r_sindico uuid;
  p_dash uuid; p_residents uuid; p_staff uuid; p_reserv uuid; p_pack uuid; p_occ uuid;
  p_notices uuid; p_boletos uuid; p_reports uuid; p_settings uuid; p_visitors uuid; p_sentinela uuid;
BEGIN
  SELECT id INTO r_morador FROM public.roles WHERE name = 'morador' LIMIT 1;
  SELECT id INTO r_porteiro FROM public.roles WHERE name = 'porteiro' LIMIT 1;
  SELECT id INTO r_cabo FROM public.roles WHERE name = 'cabo_turma' LIMIT 1;
  SELECT id INTO r_adm FROM public.roles WHERE name = 'administradora' LIMIT 1;
  SELECT id INTO r_sindico FROM public.roles WHERE name = 'sindico' LIMIT 1;

  SELECT id INTO p_dash FROM public.permissions WHERE key = 'view_dashboard' LIMIT 1;
  SELECT id INTO p_residents FROM public.permissions WHERE key = 'manage_residents' LIMIT 1;
  SELECT id INTO p_staff FROM public.permissions WHERE key = 'manage_staff' LIMIT 1;
  SELECT id INTO p_reserv FROM public.permissions WHERE key = 'manage_reservations' LIMIT 1;
  SELECT id INTO p_pack FROM public.permissions WHERE key = 'manage_packages' LIMIT 1;
  SELECT id INTO p_occ FROM public.permissions WHERE key = 'manage_occurrences' LIMIT 1;
  SELECT id INTO p_notices FROM public.permissions WHERE key = 'manage_notices' LIMIT 1;
  SELECT id INTO p_boletos FROM public.permissions WHERE key = 'manage_boletos' LIMIT 1;
  SELECT id INTO p_reports FROM public.permissions WHERE key = 'view_reports' LIMIT 1;
  SELECT id INTO p_settings FROM public.permissions WHERE key = 'manage_settings' LIMIT 1;
  SELECT id INTO p_visitors FROM public.permissions WHERE key = 'manage_visitors' LIMIT 1;
  SELECT id INTO p_sentinela FROM public.permissions WHERE key = 'view_sentinela' LIMIT 1;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r_morador, p FROM (VALUES (p_dash), (p_reserv), (p_occ), (p_notices), (p_boletos), (p_visitors), (p_settings)) AS t(p)
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r_porteiro, p FROM (VALUES (p_dash), (p_residents), (p_reserv), (p_pack), (p_occ), (p_notices), (p_visitors)) AS t(p)
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r_cabo, p FROM (VALUES (p_dash), (p_residents), (p_reserv), (p_pack), (p_occ), (p_notices), (p_boletos), (p_visitors), (p_sentinela)) AS t(p)
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r_adm, p FROM (VALUES (p_dash), (p_residents), (p_staff), (p_reserv), (p_pack), (p_occ), (p_notices), (p_boletos), (p_reports), (p_settings), (p_visitors), (p_sentinela)) AS t(p)
  ON CONFLICT (role_id, permission_id) DO NOTHING;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r_sindico, id FROM public.permissions
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END;
$$;

SELECT public.seed_role_permissions_rbac();
DROP FUNCTION IF EXISTS public.seed_role_permissions_rbac();

-- RLS: ativar e criar policies
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_authenticated" ON public.roles;
CREATE POLICY "roles_select_authenticated"
  ON public.roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "permissions_select_authenticated" ON public.permissions;
CREATE POLICY "permissions_select_authenticated"
  ON public.permissions FOR SELECT TO authenticated USING (true);

-- role_permissions: leitura para autenticados; escrita apenas para quem tem role sindico ou administradora (via users)
DROP POLICY IF EXISTS "role_permissions_select_authenticated" ON public.role_permissions;
CREATE POLICY "role_permissions_select_authenticated"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "role_permissions_insert_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_insert_admin"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.auth_id = auth.uid())
        AND u.is_active = true
        AND u.role IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR')
    )
  );

DROP POLICY IF EXISTS "role_permissions_delete_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_delete_admin"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE (u.auth_user_id = auth.uid() OR u.auth_id = auth.uid())
        AND u.is_active = true
        AND u.role IN ('SINDICO', 'ADMINISTRADORA', 'ADMIN', 'ADMINISTRADOR')
    )
  );

COMMENT ON TABLE public.roles IS 'Perfis RBAC: morador, porteiro, cabo_turma, administradora, sindico';
COMMENT ON TABLE public.permissions IS 'Áreas/módulos do app para controle de acesso';
COMMENT ON TABLE public.role_permissions IS 'Permissões atribuídas a cada perfil (N:N)';
