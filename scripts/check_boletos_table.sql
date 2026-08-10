-- ============================================
-- VERIFICAR E CORRIGIR TABELA BOLETOS
-- ============================================
-- Execute este script se estiver tendo problemas com a tabela boletos
-- ============================================

-- 1. Verificar se a tabela existe e sua estrutura
SELECT
    table_name,
    table_schema
FROM information_schema.tables
WHERE table_name = 'boletos' AND table_schema = 'public';

-- 2. Verificar colunas existentes
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'boletos' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Verificar se a coluna boleto_type existe
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'boletos'
  AND table_schema = 'public'
  AND column_name = 'boleto_type';

-- 4. Adicionar coluna boleto_type se não existir (executar apenas se necessário)
-- ALTER TABLE public.boletos
-- ADD COLUMN IF NOT EXISTS boleto_type TEXT NOT NULL DEFAULT 'condominio'
-- CHECK (boleto_type IN ('condominio', 'agua', 'luz'));

-- 5. Verificar índices existentes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'boletos' AND schemaname = 'public';

-- 6. Verificar triggers existentes
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'boletos' AND trigger_schema = 'public';

-- 7. Verificar políticas RLS
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'boletos' AND schemaname = 'public';