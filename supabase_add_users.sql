-- ============================================
-- ADICIONAR USUÁRIOS PADRÃO
-- ============================================
-- Script para adicionar usuários ao sistema
-- ============================================

-- Habilitar extensão pgcrypto para hash de senhas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- USUÁRIO: Desenvolvedor
-- ============================================
-- Usuário: desenvolvedor
-- Senha: dev
-- Role: SINDICO (acesso completo)
-- ============================================

-- Inserir ou atualizar usuário Desenvolvedor
INSERT INTO users (username, password_hash, role, name, email, is_active)
VALUES (
    'desenvolvedor',
    crypt('dev', gen_salt('bf')), -- bcrypt hash da senha "dev"
    'SINDICO',
    'Desenvolvedor',
    'dev@qualivida.com',
    true
)
ON CONFLICT (username) 
DO UPDATE SET
    password_hash = crypt('dev', gen_salt('bf')),
    role = 'SINDICO',
    name = 'Desenvolvedor',
    email = 'dev@qualivida.com',
    is_active = true,
    updated_at = NOW();

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Verificar se o usuário foi criado
SELECT 
    id,
    username,
    name,
    role,
    email,
    is_active,
    created_at
FROM users
WHERE username = 'desenvolvedor';

-- Listar todos os usuários
SELECT 
    username,
    name,
    role,
    is_active,
    created_at
FROM users
ORDER BY created_at;

