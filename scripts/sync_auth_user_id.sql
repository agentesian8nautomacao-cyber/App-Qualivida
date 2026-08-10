-- sync_auth_user_id.sql
-- Vincula auth_user_id quando o e-mail já existe em auth.users.
--
-- PRÉ-REQUISITO: O usuário deve existir em auth.users.
-- Para adicionar: Supabase Dashboard → Authentication → Users → Add user
--   - Email: cesarporteiro@gmail.com (ou o e-mail do staff/resident)
--   - Password: defina senha inicial (o porteiro pode trocar via "Esqueci minha senha")

-- Staff: vincular por email
UPDATE staff s
SET auth_user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(s.email)
  AND s.auth_user_id IS NULL
  AND s.email IS NOT NULL AND s.email != '';

-- Residents: vincular por email
UPDATE residents r
SET auth_user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(r.email)
  AND r.auth_user_id IS NULL
  AND r.email IS NOT NULL AND r.email != '';

-- Users: vincular por email (usa auth_user_id; auth_id é legado)
UPDATE users us
SET auth_user_id = u.id
FROM auth.users u
WHERE lower(u.email) = lower(us.email)
  AND us.auth_user_id IS NULL
  AND us.email IS NOT NULL AND us.email != '';

-- Conferir: staff com auth_user_id vinculado
SELECT 'staff' as tabela, name, email, auth_user_id FROM staff WHERE auth_user_id IS NOT NULL ORDER BY name;
