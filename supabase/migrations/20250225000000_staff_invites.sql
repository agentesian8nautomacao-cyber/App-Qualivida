-- Convites para cadastro de Portaria e ADM (link único por e-mail, token na URL).
-- Apenas administradores criam convites; o convidado usa o link para definir senha e ativar a conta.

CREATE TABLE IF NOT EXISTS public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('PORTEIRO', 'SINDICO')),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_staff_invites_token ON public.staff_invites (token);
CREATE INDEX IF NOT EXISTS idx_staff_invites_email ON public.staff_invites (email);
CREATE INDEX IF NOT EXISTS idx_staff_invites_expires ON public.staff_invites (expires_at) WHERE used_at IS NULL;

COMMENT ON TABLE public.staff_invites IS 'Convites para Portaria/ADM: link com token único; aceite cria usuário em auth.users + staff + users.';

-- RLS: apenas usuários autenticados com role admin podem inserir/ler convites (lista).
-- Leitura por token será feita via API serverless (service_role) para não expor a tabela.
ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

-- Remover policies se existirem (permite reexecutar a migração).
DROP POLICY IF EXISTS "staff_invites_insert_admin" ON public.staff_invites;
DROP POLICY IF EXISTS "staff_invites_select_admin" ON public.staff_invites;

-- Quem pode inserir: usuário logado cujo role em public.users seja SINDICO/ADMIN (feito via policy com auth.uid).
CREATE POLICY "staff_invites_insert_admin"
  ON public.staff_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active = true
        AND u.role IN ('SINDICO', 'ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA')
    )
  );

-- Admins podem ver lista de convites (para auditoria).
CREATE POLICY "staff_invites_select_admin"
  ON public.staff_invites FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_user_id = auth.uid()
        AND u.is_active = true
        AND u.role IN ('SINDICO', 'ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA')
    )
  );

-- Ninguém atualiza/deleta via client (accept será feito pela API com service_role).
-- Se quiser que admin possa revogar: adicionar policy UPDATE/DELETE para admin.
