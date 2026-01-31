-- ============================================
-- SINCRONIZAR SENHA DO MORADOR APÓS RESET VIA AUTH
-- ============================================
-- O frontend envia o HASH já calculado (mesmo algoritmo do login morador).
-- Assim o hash em residents é idêntico ao que o perfil usa — evita diferença
-- entre PostgreSQL digest() e JavaScript crypto.subtle.
-- Execute no Supabase: SQL Editor → New query → Run.
-- ============================================

-- Necessário ao mudar o nome do parâmetro (new_password → new_hash)
DROP FUNCTION IF EXISTS public.sync_resident_password_after_reset(text);

CREATE OR REPLACE FUNCTION public.sync_resident_password_after_reset(new_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT LOWER(TRIM(email)) INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL OR user_email = '' OR new_hash IS NULL OR new_hash = '' THEN
    RETURN;
  END IF;
  UPDATE residents
  SET password_hash = new_hash
  WHERE LOWER(TRIM(email)) = user_email AND email IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.sync_resident_password_after_reset(text) IS
  'Atualiza residents.password_hash com o hash enviado pelo frontend (mesmo do login morador).';

GRANT EXECUTE ON FUNCTION public.sync_resident_password_after_reset(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_resident_password_after_reset(text) TO service_role;
