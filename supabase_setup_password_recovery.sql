-- ============================================
-- SUPABASE: Configuração para recuperação de senha
-- ============================================
-- Execute este script no Supabase (SQL Editor) para alinhar o banco
-- com a lógica do app: recuperação de senha apenas via Supabase Auth.
-- Stack: Vercel (app) + Git + Supabase (banco + Auth + e-mail).
-- ============================================

-- ---------------------------------------------------------------------------
-- 1) Integração com Supabase Auth (auth.users)
-- ---------------------------------------------------------------------------
-- Coluna auth_id em public.users: quando preenchida, login e recuperação
-- usam Supabase Auth (e-mail enviado pelo próprio Supabase).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

COMMENT ON COLUMN public.users.auth_id IS 'ID do usuário em auth.users; quando preenchido, login e recuperação de senha usam Supabase Auth.';

-- ---------------------------------------------------------------------------
-- 2) Tabela de tokens legados (fluxo antigo por link ?token=...)
-- ---------------------------------------------------------------------------
-- O app envia o link de recuperação apenas via Supabase Auth.
-- Esta tabela serve para links antigos ainda válidos (token no link).

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON public.password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON public.password_reset_tokens(used);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_unique_active
ON public.password_reset_tokens(user_id, token)
WHERE used = false;

CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.password_reset_tokens
    WHERE expires_at < NOW() OR used = true;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert password reset tokens" ON public.password_reset_tokens;
CREATE POLICY "Allow insert password reset tokens" ON public.password_reset_tokens
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read password reset tokens by token" ON public.password_reset_tokens;
CREATE POLICY "Allow read password reset tokens by token" ON public.password_reset_tokens
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow update password reset tokens" ON public.password_reset_tokens;
CREATE POLICY "Allow update password reset tokens" ON public.password_reset_tokens
    FOR UPDATE USING (true) WITH CHECK (true);

COMMENT ON TABLE public.password_reset_tokens IS 'Tokens de recuperação (legado). Envio do link é feito apenas pelo Supabase Auth.';

-- ---------------------------------------------------------------------------
-- 3) Garantir que usuários tenham política de leitura (getEmailForReset / login)
-- ---------------------------------------------------------------------------
-- O app (anon) precisa de SELECT em public.users para buscar e-mail por
-- username no "Esqueci minha senha" e para login.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all data" ON public.users;
CREATE POLICY "Users can view all data" ON public.users
    FOR SELECT USING (true);

-- ---------------------------------------------------------------------------
-- Próximos passos (manual no Dashboard)
-- ---------------------------------------------------------------------------
-- 1. Authentication → Email: configurar envio de e-mail (templates / SMTP).
-- 2. Para cada usuário em public.users que deve usar "Esqueci minha senha":
--    - Criar em Authentication → Users (mesmo e-mail).
--    - Atualizar: UPDATE public.users SET auth_id = '<uuid_do_auth>' WHERE email = '...';
