-- Convites para cadastro de Moradores (link único por e-mail).
-- Aceite cria usuário em auth.users + residents.

CREATE TABLE IF NOT EXISTS public.resident_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_resident_invites_token ON public.resident_invites (token);
CREATE INDEX IF NOT EXISTS idx_resident_invites_email ON public.resident_invites (email);
CREATE INDEX IF NOT EXISTS idx_resident_invites_expires ON public.resident_invites (expires_at) WHERE used_at IS NULL;

COMMENT ON TABLE public.resident_invites IS 'Convites para Moradores: link com token único; aceite cria usuário em auth.users + residents.';

ALTER TABLE public.resident_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resident_invites_insert_admin" ON public.resident_invites;
DROP POLICY IF EXISTS "resident_invites_select_admin" ON public.resident_invites;

CREATE POLICY "resident_invites_insert_admin"
  ON public.resident_invites FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_for_staff_invites());

CREATE POLICY "resident_invites_select_admin"
  ON public.resident_invites FOR SELECT
  TO authenticated
  USING (public.is_admin_for_staff_invites());
