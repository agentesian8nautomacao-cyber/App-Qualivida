-- ============================================
-- VERIFICAÇÃO FINAL DO SISTEMA DE BOLETOS
-- ============================================
-- Execute este script para confirmar que tudo está funcionando
-- ============================================

-- 1. Verificar estrutura completa da tabela
SELECT
    '✅ Tabela boletos existe' as status,
    COUNT(*) as total_registros
FROM information_schema.tables t
LEFT JOIN public.boletos b ON true
WHERE t.table_name = 'boletos' AND t.table_schema = 'public'
GROUP BY t.table_name;

-- 2. Verificar colunas obrigatórias
SELECT
    column_name,
    CASE
        WHEN column_name IN ('id', 'resident_name', 'unit', 'reference_month', 'due_date', 'amount', 'status', 'boleto_type')
             AND is_nullable = 'NO' THEN '✅ Obrigatória OK'
        WHEN column_name IN ('resident_id', 'barcode', 'pdf_url', 'paid_date', 'description', 'created_at', 'updated_at')
             AND is_nullable = 'YES' THEN '✅ Opcional OK'
        ELSE '❌ Configuração incorreta'
    END as status_coluna
FROM information_schema.columns
WHERE table_name = 'boletos' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Verificar tipos de boleto suportados
SELECT
    '✅ Sistema suporta tipos:' as info,
    string_agg(DISTINCT boleto_type, ', ') as tipos_boletos
FROM public.boletos
WHERE boleto_type IS NOT NULL;

-- 4. Verificar se RLS está funcionando
SELECT
    CASE WHEN relrowsecurity THEN '✅ RLS habilitado - Segurança OK'
         ELSE '❌ RLS desabilitado - RISCO DE SEGURANÇA'
    END as rls_status
FROM pg_class
WHERE relname = 'boletos';

-- 5. Verificar triggers ativos
SELECT
    trigger_name as trigger,
    '✅ Ativo' as status
FROM information_schema.triggers
WHERE event_object_table = 'boletos' AND trigger_schema = 'public';

-- 6. Teste de inserção (opcional - descomente se quiser testar)
-- INSERT INTO public.boletos (
--     resident_name, unit, reference_month, due_date, amount, status, boleto_type
-- ) VALUES (
--     'Teste Sistema', '999A', '01/2026', '2026-01-15', 100.00, 'Pendente', 'condominio'
-- );

-- SELECT '✅ Teste de inserção realizado' as teste_insercao;

-- 7. Verificar estatísticas
SELECT
    COUNT(*) as total_boletos,
    COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pendentes,
    COUNT(CASE WHEN status = 'Pago' THEN 1 END) as pagos,
    COUNT(CASE WHEN status = 'Vencido' THEN 1 END) as vencidos,
    COUNT(DISTINCT unit) as unidades_ativas,
    COALESCE(SUM(amount), 0) as valor_total
FROM public.boletos;

-- 8. Status final
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM public.boletos) THEN '✅ Sistema operacional com dados'
        ELSE '⚠️ Sistema operacional mas sem boletos cadastrados'
    END as status_final,
    NOW() as verificado_em;