-- ============================================
-- ATUALIZAR SENHAS DOS USUÁRIOS PADRÃO
-- ============================================
-- Script para atualizar senhas dos usuários padrão com hashes SHA-256
-- Execute este script no Supabase SQL Editor
-- ============================================

-- NOTA: Este script usa hashes SHA-256 gerados externamente
-- As senhas padrão são:
-- - portaria: 123456
-- - admin: admin123
-- - desenvolvedor: dev

-- Hash SHA-256 de "123456" = 8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92
-- Hash SHA-256 de "admin123" = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
-- Hash SHA-256 de "dev" = ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f

-- Atualizar senha do PORTEIRO
UPDATE users
SET 
    password_hash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
    updated_at = NOW()
WHERE username = 'portaria';

-- Atualizar senha do SINDICO (admin)
UPDATE users
SET 
    password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    updated_at = NOW()
WHERE username = 'admin';

-- Atualizar senha do DESENVOLVEDOR
UPDATE users
SET 
    password_hash = 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
    updated_at = NOW()
WHERE username = 'desenvolvedor';

-- Verificar atualizações
SELECT 
    username,
    role,
    name,
    is_active,
    CASE 
        WHEN password_hash = '$2a$10$placeholder_hash_here' THEN '⚠️ Senha placeholder (não configurada)'
        WHEN password_hash = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' THEN '✅ Senha: 123456'
        WHEN password_hash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9' THEN '✅ Senha: admin123'
        WHEN password_hash = 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f' THEN '✅ Senha: dev'
        ELSE '✅ Senha configurada'
    END as password_status,
    updated_at
FROM users
ORDER BY username;
