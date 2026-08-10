-- ============================================
-- VERIFICAÇÃO: Status da Migração de Autenticação
-- ============================================

-- Verificar se a coluna password_hash existe
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'residents'
  AND column_name = 'password_hash';

-- Verificar se as funções existem
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'verify_resident_credentials',
    'update_resident_password'
  );

-- Verificar índice idx_residents_unit_upper
SELECT 
    indexname,
    tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_residents_unit_upper';