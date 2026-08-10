-- ============================================
-- DIAGNÓSTICO DA TABELA BOLETOS
-- ============================================
-- Execute este script para verificar o status da tabela boletos
-- ============================================

-- 1. Verificar se tabela existe
SELECT 'Tabela boletos existe' as status
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'boletos' AND table_schema = 'public'
);

-- 2. Contar registros na tabela
SELECT COUNT(*) as total_boletos FROM public.boletos;

-- 3. Verificar estrutura das colunas
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE WHEN column_name = 'boleto_type' THEN '✅ IMPORTANTE' ELSE '' END as nota
FROM information_schema.columns
WHERE table_name = 'boletos' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Verificar se coluna boleto_type existe
SELECT
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'boletos' AND table_schema = 'public' AND column_name = 'boleto_type'
    ) THEN '✅ Coluna boleto_type existe'
    ELSE '❌ Coluna boleto_type NÃO existe - precisa adicionar'
    END as status_boleto_type;

-- 5. Verificar índices
SELECT
    indexname as nome_indice,
    indexdef as definicao
FROM pg_indexes
WHERE tablename = 'boletos' AND schemaname = 'public';

-- 6. Verificar triggers
SELECT
    trigger_name as nome_trigger,
    event_manipulation as evento,
    action_statement as acao
FROM information_schema.triggers
WHERE event_object_table = 'boletos' AND trigger_schema = 'public';

-- 7. Verificar RLS
SELECT
    CASE WHEN relrowsecurity THEN '✅ RLS habilitado' ELSE '❌ RLS desabilitado' END as rls_status
FROM pg_class
WHERE relname = 'boletos' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 8. Mostrar algumas linhas de exemplo (se existirem)
SELECT
    id,
    resident_name,
    unit,
    reference_month,
    status,
    boleto_type
FROM public.boletos
ORDER BY created_at DESC
LIMIT 5;