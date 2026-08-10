-- ============================================
-- CRIAR TABELA public.users (se não existir)
-- ============================================
-- Execute este script no Supabase: SQL Editor → New query → Cole e Run.
-- A tabela users é usada para login (porteiro/síndico) e recuperação de senha.
-- ============================================

-- Extensão para UUID (geralmente já existe no projeto)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Criar tabela public.users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PORTEIRO', 'SINDICO')),
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coluna auth_id: vincula ao Supabase Auth (login e "Esqueci minha senha")
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);
COMMENT ON COLUMN public.users.auth_id IS 'ID em auth.users; quando preenchido, login e recuperação usam Supabase Auth.';

-- Função e trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all data" ON public.users;
CREATE POLICY "Users can view all data" ON public.users
    FOR SELECT USING (true);

COMMENT ON TABLE public.users IS 'Usuários do sistema (Porteiro e Síndico).';

-- ============================================
-- Verificação: listar tabelas do schema public
-- ============================================
-- Depois de rodar, em Table Editor você deve ver "users" em public.
-- Para inserir um usuário de teste (senha em texto; use só em dev):
--
-- INSERT INTO public.users (username, password_hash, role, name, email, is_active)
-- VALUES (
--     'portaria',
--     'plain:123456',   -- ou use crypt('sua_senha', gen_salt('bf')) se tiver pgcrypto
--     'PORTEIRO',
--     'Porteiro',
--     'portaria@exemplo.com',
--     true
-- )
-- ON CONFLICT (username) DO NOTHING;
