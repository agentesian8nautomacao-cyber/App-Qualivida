-- ============================================
-- MIGRAÇÃO: Integração com Supabase Auth (auth.users)
-- ============================================
-- Adiciona auth_id em public.users para vincular ao Supabase Auth.
-- Usuários com auth_id usam Auth para login e recuperação de senha (e-mail enviado pelo Supabase).
-- ============================================

-- 1) Adicionar coluna auth_id (referência a auth.users)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2) Índice para buscar perfil por auth_id
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- 3) Comentário
COMMENT ON COLUMN public.users.auth_id IS 'ID do usuário em auth.users; quando preenchido, login e recuperação de senha usam Supabase Auth.';

-- ============================================
-- PRÓXIMOS PASSOS (manual ou via script)
-- ============================================
-- Para cada usuário em public.users que deve usar Auth:
-- 1. Criar o usuário em auth.users (via Dashboard ou Admin API):
--    - Email: usar o email da linha (obrigatório para Auth)
--    - Senha: definir temporária ou enviar "Recuperar senha" após criar
-- 2. Atualizar public.users:
--    UPDATE public.users SET auth_id = '<auth_user_id>' WHERE id = '<user_id>';
--
-- Ou use a Edge Function "create-auth-user" para novos usuários (porteiros).
-- Usuários sem auth_id continuam usando login por password_hash (legado).
