-- ============================================
-- SCRIPT DE VERIFICAÇÃO - Verificar Instalação
-- ============================================
-- Execute este script para verificar se tudo foi criado corretamente
-- 
-- ⚠️ IMPORTANTE: 
-- 1. Execute PRIMEIRO: supabase_schema_complete.sql
-- 2. Execute DEPOIS: supabase_functions_complete.sql
-- 3. Execute ESTE script para verificar
-- ============================================

-- Verificar se os arquivos foram executados na ordem correta
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'packages') 
        THEN '✓ Schema executado (tabelas criadas)'
        ELSE '✗ ERRO: Execute supabase_schema_complete.sql primeiro!'
    END as verificacao_inicial;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'calculate_package_permanence') 
        THEN '✓ Funções executadas (calculate_package_permanence existe)'
        ELSE '✗ AVISO: Execute supabase_functions_complete.sql para criar as funções!'
    END as verificacao_funcoes;

-- 1. Verificar se todas as tabelas foram criadas
SELECT 
    'Tabelas criadas:' as verificacao,
    COUNT(*) as total
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'users', 'residents', 'packages', 'package_items', 'visitors', 
    'occurrences', 'reservations', 'areas', 'notices', 'notice_reads',
    'chat_messages', 'notes', 'staff', 'boletos', 'crm_units', 
    'crm_issues', 'app_config'
);

-- 2. Listar todas as tabelas criadas
SELECT 
    table_name as "Tabela",
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = t.table_name
        ) THEN '✓'
        ELSE '✗'
    END as "Status"
FROM (
    SELECT unnest(ARRAY[
        'users', 'residents', 'packages', 'package_items', 'visitors', 
        'occurrences', 'reservations', 'areas', 'notices', 'notice_reads',
        'chat_messages', 'notes', 'staff', 'boletos', 'crm_units', 
        'crm_issues', 'app_config'
    ]) as table_name
) t
ORDER BY table_name;

-- 3. Verificar funções criadas
SELECT 
    'Funções criadas:' as verificacao,
    COUNT(*) as total
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_name IN (
    'update_updated_at_column',
    'check_reservation_conflict',
    'calculate_package_permanence',
    'calculate_visitor_permanence',
    'check_boleto_status',
    'update_expired_boletos',
    'get_dashboard_stats',
    'find_resident_by_qr',
    'get_packages_by_resident',
    'get_boletos_by_resident'
);

-- 4. Verificar views criadas
SELECT 
    'Views criadas:' as verificacao,
    COUNT(*) as total
FROM information_schema.views 
WHERE table_schema = 'public'
AND table_name IN (
    'v_pending_packages',
    'v_active_visitors',
    'v_open_occurrences',
    'v_today_reservations',
    'v_pending_boletos'
);

-- 5. Verificar triggers criados
SELECT 
    'Triggers criados:' as verificacao,
    COUNT(*) as total
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
AND trigger_name LIKE '%updated_at%' OR trigger_name LIKE '%cache%' OR trigger_name LIKE '%boleto%';

-- 6. Verificar dados iniciais (seed)
SELECT 
    'Usuários padrão:' as verificacao,
    COUNT(*) as total
FROM users
WHERE username IN ('portaria', 'admin', 'desenvolvedor');

SELECT 
    'Áreas comuns:' as verificacao,
    COUNT(*) as total
FROM areas;

SELECT 
    'Configuração do app:' as verificacao,
    COUNT(*) as total
FROM app_config;

-- 7. Verificar RLS (Row Level Security)
SELECT 
    tablename as "Tabela",
    CASE 
        WHEN rowsecurity THEN '✓ Habilitado'
        ELSE '✗ Desabilitado'
    END as "RLS Status"
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN (
    'users', 'residents', 'packages', 'visitors', 
    'occurrences', 'reservations', 'notices', 'notes', 'boletos'
)
ORDER BY tablename;

-- 8. Resumo final
SELECT 
    '=== RESUMO DA INSTALAÇÃO ===' as resumo,
    '' as espaco;

SELECT 
    'Total de tabelas:' as item,
    COUNT(*)::text as valor
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'users', 'residents', 'packages', 'package_items', 'visitors', 
    'occurrences', 'reservations', 'areas', 'notices', 'notice_reads',
    'chat_messages', 'notes', 'staff', 'boletos', 'crm_units', 
    'crm_issues', 'app_config'
)

UNION ALL

SELECT 
    'Total de funções:' as item,
    COUNT(*)::text as valor
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'

UNION ALL

SELECT 
    'Total de views:' as item,
    COUNT(*)::text as valor
FROM information_schema.views 
WHERE table_schema = 'public'

UNION ALL

SELECT 
    'Total de triggers:' as item,
    COUNT(*)::text as valor
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- 9. Verificar se as funções existem antes de testar
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'calculate_package_permanence'
    ) THEN
        RAISE NOTICE 'Função calculate_package_permanence existe';
    ELSE
        RAISE NOTICE 'AVISO: Função calculate_package_permanence NÃO existe. Execute supabase_functions_complete.sql primeiro!';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'check_boleto_status'
    ) THEN
        RAISE NOTICE 'Função check_boleto_status existe';
    ELSE
        RAISE NOTICE 'AVISO: Função check_boleto_status NÃO existe. Execute supabase_functions_complete.sql primeiro!';
    END IF;
END $$;

-- 9.1 Testar funções (apenas se existirem)
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name = 'calculate_package_permanence'
        ) THEN 'Função existe: calculate_package_permanence'
        ELSE 'ERRO: Função calculate_package_permanence não encontrada! Execute supabase_functions_complete.sql'
    END as status_funcao;

-- Tentar testar função apenas se ela existir
DO $$
DECLARE
    func_exists BOOLEAN;
    test_result TEXT;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'calculate_package_permanence'
    ) INTO func_exists;
    
    IF func_exists THEN
        SELECT calculate_package_permanence(NOW() - INTERVAL '2 hours') INTO test_result;
        RAISE NOTICE 'Teste: calculate_package_permanence retornou: %', test_result;
    ELSE
        RAISE NOTICE 'AVISO: Não foi possível testar calculate_package_permanence - função não existe';
    END IF;
END $$;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name = 'check_boleto_status'
        ) THEN 'Função existe: check_boleto_status'
        ELSE 'ERRO: Função check_boleto_status não encontrada! Execute supabase_functions_complete.sql'
    END as status_funcao;

-- 10. Verificar se as views podem ser consultadas (sem dados ainda)
-- Primeiro verificar se a view existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_schema = 'public' 
            AND table_name = 'v_pending_packages'
        ) THEN 'View v_pending_packages existe'
        ELSE 'ERRO: View v_pending_packages não encontrada! Execute supabase_functions_complete.sql'
    END as status_view;

-- Tentar consultar view apenas se existir
DO $$
DECLARE
    view_exists BOOLEAN;
    record_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'v_pending_packages'
    ) INTO view_exists;
    
    IF view_exists THEN
        SELECT COUNT(*) INTO record_count FROM v_pending_packages;
        RAISE NOTICE 'View v_pending_packages consultada com sucesso. Total de registros: %', record_count;
    ELSE
        RAISE NOTICE 'AVISO: Não foi possível consultar v_pending_packages - view não existe';
    END IF;
END $$;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.views 
            WHERE table_schema = 'public' 
            AND table_name = 'v_pending_boletos'
        ) THEN 'View v_pending_boletos existe'
        ELSE 'ERRO: View v_pending_boletos não encontrada! Execute supabase_functions_complete.sql'
    END as status_view;

-- ============================================
-- FIM DA VERIFICAÇÃO
-- ============================================
-- Se todos os itens acima retornaram resultados, a instalação foi bem-sucedida!
-- ============================================