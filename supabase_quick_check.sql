-- ============================================
-- VERIFICAÇÃO RÁPIDA: O que falta?
-- ============================================

-- 1. Coluna password_hash existe?
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'residents' 
              AND column_name = 'password_hash'
        ) 
        THEN '✓ Coluna password_hash: EXISTE'
        ELSE '✗ Coluna password_hash: FALTANDO'
    END as status;

-- 2. Funções existem?
SELECT 
    routine_name,
    CASE 
        WHEN routine_name IS NOT NULL THEN '✓ EXISTE'
        ELSE '✗ FALTANDO'
    END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('verify_resident_credentials', 'update_resident_password')
ORDER BY routine_name;

-- 3. Se algo faltar, execute: supabase_migration_residents_auth_safe.sql