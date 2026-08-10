-- ============================================
-- VERIFICAÇÃO: Tabela notifications
-- ============================================
-- Execute este script para verificar se a tabela existe
-- ============================================

-- 1. Verificar se a tabela existe
SELECT 
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'notifications';

-- 2. Verificar colunas da tabela
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
ORDER BY ordinal_position;

-- 3. Verificar políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'notifications';

-- 4. Verificar se RLS está habilitado
SELECT 
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'notifications';

-- 5. Contar notificações existentes
SELECT COUNT(*) as total_notifications FROM notifications;
