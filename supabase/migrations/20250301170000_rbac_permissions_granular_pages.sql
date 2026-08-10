-- Granularização das permissões por página/ação (pagina.acao)
-- Mantém as permissões legadas, mas passa a controlar acesso real via:
-- dashboard.view, residents.view/create/update/delete, etc.

-- Inserir permissões granulares por página
INSERT INTO public.permissions (key, label)
VALUES
  -- Dashboard
  ('dashboard.view', 'Dashboard — acessar página'),

  -- Moradores
  ('residents.view', 'Moradores — acessar página'),
  ('residents.create', 'Moradores — criar'),
  ('residents.update', 'Moradores — editar'),
  ('residents.delete', 'Moradores — excluir'),

  -- Funcionários
  ('staff.view', 'Funcionários — acessar página'),
  ('staff.create', 'Funcionários — criar'),
  ('staff.update', 'Funcionários — editar'),
  ('staff.delete', 'Funcionários — excluir'),

  -- Visitantes
  ('visitors.view', 'Visitantes — acessar página'),
  ('visitors.create', 'Visitantes — registrar'),
  ('visitors.update', 'Visitantes — editar'),
  ('visitors.delete', 'Visitantes — excluir'),

  -- Ocorrências
  ('occurrences.view', 'Ocorrências — acessar página'),
  ('occurrences.create', 'Ocorrências — criar'),
  ('occurrences.update', 'Ocorrências — editar / resolver'),
  ('occurrences.delete', 'Ocorrências — excluir'),
  ('occurrences.resolve', 'Ocorrências — marcar como resolvida'),

  -- Reservas
  ('reservations.view', 'Reservas — acessar página'),
  ('reservations.create', 'Reservas — criar'),
  ('reservations.update', 'Reservas — editar'),
  ('reservations.delete', 'Reservas — excluir'),

  -- Encomendas
  ('packages.view', 'Encomendas — acessar página'),
  ('packages.create', 'Encomendas — registrar'),
  ('packages.update', 'Encomendas — editar'),
  ('packages.delete', 'Encomendas — excluir'),

  -- Mural de Avisos
  ('notices.view', 'Mural de Avisos — acessar página'),
  ('notices.create', 'Mural de Avisos — criar aviso'),
  ('notices.update', 'Mural de Avisos — editar aviso'),
  ('notices.delete', 'Mural de Avisos — excluir aviso'),

  -- Financeiro / Boletos
  ('boletos.view', 'Financeiro — acessar página'),
  ('boletos.create', 'Financeiro — criar boletos'),
  ('boletos.update', 'Financeiro — editar boletos'),
  ('boletos.delete', 'Financeiro — excluir boletos'),
  ('boletos.download', 'Financeiro — baixar boleto PDF'),

  -- Sentinela AI
  ('sentinela.view', 'Sentinela AI — acessar página'),

  -- Configurações
  ('settings.view', 'Configurações — acessar página'),
  ('settings.update', 'Configurações — alterar configurações')
ON CONFLICT (key) DO NOTHING;

-- Garantir que todos os perfis tenham, por padrão, todas as novas permissões
-- (padrão: todos têm tudo; admin desmarca para bloquear).
CREATE OR REPLACE FUNCTION public.seed_new_granular_permissions()
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
  WHERE p.key IN (
    'dashboard.view',

    'residents.view', 'residents.create', 'residents.update', 'residents.delete',
    'staff.view', 'staff.create', 'staff.update', 'staff.delete',
    'visitors.view', 'visitors.create', 'visitors.update', 'visitors.delete',

    'occurrences.view', 'occurrences.create', 'occurrences.update', 'occurrences.delete', 'occurrences.resolve',

    'reservations.view', 'reservations.create', 'reservations.update', 'reservations.delete',

    'packages.view', 'packages.create', 'packages.update', 'packages.delete',

    'notices.view', 'notices.create', 'notices.update', 'notices.delete',

    'boletos.view', 'boletos.create', 'boletos.update', 'boletos.delete', 'boletos.download',

    'sentinela.view',

    'settings.view', 'settings.update'
  )
  ON CONFLICT (role_id, permission_id) DO NOTHING;
END;
$$;

SELECT public.seed_new_granular_permissions();
DROP FUNCTION IF EXISTS public.seed_new_granular_permissions();

