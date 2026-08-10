-- ============================================
-- SCRIPT DE VERIFICAÇÃO - Verificar se as tabelas foram criadas
-- ============================================
-- Execute este script para verificar se todas as tabelas foram criadas corretamente
-- ============================================

-- Listar todas as tabelas no schema public
SELECT 
    table_name,
    table_schema
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar tabelas específicas do app
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN '✓'
        ELSE '✗'
    END as users,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'residents') THEN '✓'
        ELSE '✗'
    END as residents,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'packages') THEN '✓'
        ELSE '✗'
    END as packages,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'visitors') THEN '✓'
        ELSE '✗'
    END as visitors,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'occurrences') THEN '✓'
        ELSE '✗'
    END as occurrences,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN '✓'
        ELSE '✗'
    END as reservations,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'areas') THEN '✓'
        ELSE '✗'
    END as areas,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notices') THEN '✓'
        ELSE '✗'
    END as notices,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notes') THEN '✓'
        ELSE '✗'
    END as notes,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff') THEN '✓'
        ELSE '✗'
    END as staff;

-- Contar total de tabelas criadas
SELECT COUNT(*) as total_tabelas
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_name IN (
    'users', 'residents', 'packages', 'package_items', 'visitors', 
    'occurrences', 'reservations', 'areas', 'notices', 'notice_reads',
    'chat_messages', 'notes', 'staff', 'crm_units', 'crm_issues', 'app_config'
);

