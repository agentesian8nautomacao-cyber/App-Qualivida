-- ============================================
-- VERIFICAÇÃO FINAL COMPLETA
-- ============================================

-- Verificar TODOS os componentes necessários
SELECT 
    'COLUNA password_hash' as componente,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'residents' 
              AND column_name = 'password_hash'
        ) 
        THEN '✓ EXISTE'
        ELSE '✗ FALTANDO - Execute: supabase_migration_residents_auth_safe.sql'
    END as status
UNION ALL
SELECT 
    'FUNÇÃO verify_resident_credentials' as componente,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_name = 'verify_resident_credentials'
        )
        THEN '✓ EXISTE'
        ELSE '✗ FALTANDO'
    END as status
UNION ALL
SELECT 
    'FUNÇÃO update_resident_password' as componente,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_name = 'update_resident_password'
        )
        THEN '✓ EXISTE'
        ELSE '✗ FALTANDO'
    END as status
UNION ALL
SELECT 
    'ÍNDICE idx_residents_unit_upper' as componente,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = 'idx_residents_unit_upper'
        )
        THEN '✓ EXISTE'
        ELSE '✗ FALTANDO'
    END as status;

-- ============================================
-- RESULTADO FINAL
-- ============================================
SELECT 
    CASE 
        WHEN (
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'residents' AND column_name = 'password_hash')
            AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'verify_resident_credentials')
            AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'update_resident_password')
            AND EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_residents_unit_upper')
        )
        THEN '✅ MIGRAÇÃO COMPLETA! Sistema pronto para autenticação de moradores.'
        ELSE '⚠️ FALTA: Execute supabase_migration_residents_auth_safe.sql para completar'
    END as resultado;