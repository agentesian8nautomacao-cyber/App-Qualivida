-- ============================================
-- VERIFICAÇÃO COMPLETA: Migração de Autenticação
-- ============================================

-- 1. Verificar se a coluna password_hash existe
SELECT 
    'COLUNA password_hash' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'residents' 
              AND column_name = 'password_hash'
        ) THEN '✓ EXISTE' 
        ELSE '✗ FALTANDO' 
    END as status,
    '' as detalhes;

-- 2. Verificar função verify_resident_credentials
SELECT 
    'FUNÇÃO verify_resident_credentials' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_name = 'verify_resident_credentials'
        ) THEN '✓ EXISTE' 
        ELSE '✗ FALTANDO' 
    END as status,
    '' as detalhes;

-- 3. Verificar função update_resident_password
SELECT 
    'FUNÇÃO update_resident_password' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_name = 'update_resident_password'
        ) THEN '✓ EXISTE' 
        ELSE '✗ FALTANDO' 
    END as status,
    '' as detalhes;

-- 4. Verificar índice idx_residents_unit_upper
SELECT 
    'ÍNDICE idx_residents_unit_upper' as item,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'idx_residents_unit_upper'
        ) THEN '✓ EXISTE' 
        ELSE '✗ FALTANDO' 
    END as status,
    '' as detalhes;

-- ============================================
-- RESUMO FINAL
-- ============================================
SELECT 
    COUNT(*) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'residents' AND column_name = 'password_hash'
        )
        AND EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public' AND routine_name = 'verify_resident_credentials'
        )
        AND EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public' AND routine_name = 'update_resident_password'
        )
        AND EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'idx_residents_unit_upper'
        )
    ) as itens_completos,
    4 as total_itens,
    CASE 
        WHEN (
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'residents' AND column_name = 'password_hash')
            AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'verify_resident_credentials')
            AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'update_resident_password')
            AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_residents_unit_upper')
        ) THEN '✓ MIGRAÇÃO COMPLETA!'
        ELSE '⚠ EXECUTE: supabase_migration_residents_auth_safe.sql'
    END as resultado;