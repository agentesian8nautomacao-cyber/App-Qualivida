-- Ajusta RLS de staff_invites: usar função SECURITY DEFINER para checar se o usuário é admin.
-- Assim a checagem não é bloqueada por RLS nas tabelas users/staff (subquery rodava como o
-- mesmo usuário e podia não enxergar as linhas).
-- Corrige 403 "new row violates row-level security policy" ao enviar convite.

-- Função que retorna true se o usuário atual (auth.uid()) é admin em users ou em staff.
-- SECURITY DEFINER = roda com privilégios do dono da função, bypassando RLS em users/staff.
CREATE OR REPLACE FUNCTION public.is_admin_for_staff_invites()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_user_id = auth.uid()
      AND u.is_active = true
      AND upper(trim(coalesce(u.role, ''))) IN ('SINDICO', 'ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA', 'ADM')
  )
  OR EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.auth_user_id = auth.uid()
      AND (
        upper(trim(coalesce(s.role, ''))) IN ('SÍNDICO', 'SINDICO', 'ADM', 'ADMIN', 'ADMINISTRADOR', 'ADMINISTRADORA')
        OR s.role ILIKE '%ndico%'
        OR s.role ILIKE '%dmin%'
      )
  );
$$;

COMMENT ON FUNCTION public.is_admin_for_staff_invites() IS 'Usado por RLS em staff_invites; retorna true se auth.uid() é admin em users ou staff.';

DROP POLICY IF EXISTS "staff_invites_insert_admin" ON public.staff_invites;
DROP POLICY IF EXISTS "staff_invites_select_admin" ON public.staff_invites;

CREATE POLICY "staff_invites_insert_admin"
  ON public.staff_invites FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_for_staff_invites());

CREATE POLICY "staff_invites_select_admin"
  ON public.staff_invites FOR SELECT
  TO authenticated
  USING (public.is_admin_for_staff_invites());
