-- Verificar consistência entre auth.users e tabelas do Qualivida
-- Executar no SQL Editor do Supabase

-- 1. Usuários em auth.users (email válido, provider email)
SELECT 
  'auth.users' as origem,
  id,
  email,
  raw_user_meta_data->>'provider' as provider,
  created_at
FROM auth.users
WHERE email IS NOT NULL AND email != ''
ORDER BY created_at DESC;

-- 2. Moradores sem auth_user_id (precisam ser vinculados)
SELECT 'residents sem auth_user_id' as alerta, id, name, unit, email
FROM residents
WHERE auth_user_id IS NULL
  AND email IS NOT NULL AND email != ''
ORDER BY name;

-- 3. Users sem auth_user_id
SELECT 'users sem auth_user_id' as alerta, id, username, email, role
FROM users
WHERE auth_user_id IS NULL AND auth_id IS NULL
  AND email IS NOT NULL AND email != ''
ORDER BY username;

-- 4. Staff sem auth_user_id
SELECT 'staff sem auth_user_id' as alerta, id, name, email, role
FROM staff
WHERE auth_user_id IS NULL
  AND email IS NOT NULL AND email != ''
ORDER BY name;

-- 5. Emails em residents que NÃO estão em auth.users
SELECT r.id, r.name, r.unit, r.email
FROM residents r
WHERE r.email IS NOT NULL AND r.email != ''
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u 
    WHERE lower(u.email) = lower(r.email)
  )
ORDER BY r.name;
