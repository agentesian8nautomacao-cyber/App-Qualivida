-- ============================================
-- SINCRONIZAR SENHA DO MORADOR APÓS RESET VIA AUTH
-- ============================================
-- Após o morador redefinir a senha pelo link do Supabase Auth,
-- esta função atualiza residents.password_hash para o mesmo hash (SHA-256)
-- assim o login como morador (unit + senha) continua funcionando.
-- Execute no Supabase: SQL Editor → New query → Run.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.sync_resident_password_after_reset(new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN
    RETURN;
  END IF;
  UPDATE residents
  SET password_hash = encode(digest(new_password, 'sha256'), 'hex')
  WHERE email = user_email;
END;
$$;

COMMENT ON FUNCTION public.sync_resident_password_after_reset(text) IS
  'Atualiza residents.password_hash após o usuário redefinir senha pelo link do Auth (mesmo hash SHA-256 do login morador).';

GRANT EXECUTE ON FUNCTION public.sync_resident_password_after_reset(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_resident_password_after_reset(text) TO service_role;
