-- ============================================
-- RELATÓRIO FINAL: IMPORTAÇÃO DE 216 BOLETOS
-- ============================================
-- Análise completa dos resultados da importação
-- ============================================

-- 1. RESUMO EXECUTIVO
WITH import_stats AS (
    SELECT
        COUNT(*) as total_boletos,
        COUNT(DISTINCT unit) as unidades_unicas,
        COUNT(pdf_original_path) as boletos_com_pdf_original,
        COUNT(pdf_url) as boletos_com_pdf_antigo,
        COUNT(CASE WHEN pdf_original_path IS NULL AND pdf_url IS NULL THEN 1 END) as boletos_sem_pdf,
        COUNT(CASE WHEN resident_id IS NOT NULL THEN 1 END) as boletos_com_morador,
        ROUND(AVG(amount), 2) as valor_medio,
        MIN(created_at) as data_inicio_importacao,
        MAX(created_at) as data_fim_importacao
    FROM public.boletos
    WHERE created_at >= CURRENT_DATE -- Ajuste se necessário
),
morador_stats AS (
    SELECT
        COUNT(*) as total_moradores,
        COUNT(DISTINCT unit) as unidades_moradores
    FROM public.residents
)
SELECT
    'RESUMO EXECUTIVO' as secao,
    i.total_boletos as boletos_importados,
    i.unidades_unicas as unidades_afetadas,
    m.total_moradores as moradores_cadastrados,
    i.boletos_com_pdf_original as boletos_com_pdf,
    i.boletos_sem_pdf as boletos_sem_pdf,
    ROUND(i.boletos_com_pdf_original::decimal / i.total_boletos::decimal * 100, 1) as percentual_sucesso,
    i.valor_medio as valor_medio_rs,
    i.data_inicio_importacao,
    i.data_fim_importacao
FROM import_stats i, morador_stats m;

-- 2. DISTRIBUIÇÃO POR TIPO DE BOLETO
SELECT
    'DISTRIBUIÇÃO POR TIPO' as secao,
    boleto_type,
    COUNT(*) as quantidade,
    ROUND(AVG(amount), 2) as valor_medio,
    ROUND(SUM(amount), 2) as valor_total,
    ROUND(COUNT(*)::decimal / SUM(COUNT(*)) OVER() * 100, 1) as percentual
FROM public.boletos
WHERE created_at >= CURRENT_DATE
GROUP BY boleto_type
ORDER BY quantidade DESC;

-- 3. STATUS DE ASSOCIAÇÃO COM MORADORES
SELECT
    'ASSOCIAÇÃO MORADORES' as secao,
    CASE
        WHEN r.id IS NOT NULL THEN 'ASSOCIADO_CORRETAMENTE'
        ELSE 'MORADOR_NÃO_ENCONTRADO'
    END as status_associacao,
    COUNT(*) as quantidade,
    ROUND(COUNT(*)::decimal / SUM(COUNT(*)) OVER() * 100, 1) as percentual
FROM public.boletos b
LEFT JOIN public.residents r ON b.unit = r.unit
WHERE b.created_at >= CURRENT_DATE
GROUP BY CASE WHEN r.id IS NOT NULL THEN 'ASSOCIADO_CORRETAMENTE' ELSE 'MORADOR_NÃO_ENCONTRADO' END;

-- 4. UNIDADES MAIS ATIVAS
SELECT
    'UNIDADES MAIS ATIVAS' as secao,
    b.unit,
    r.name as morador,
    COUNT(*) as boletos_na_unidade,
    SUM(b.amount) as valor_total,
    STRING_AGG(DISTINCT b.boleto_type, ', ') as tipos_boletos
FROM public.boletos b
JOIN public.residents r ON b.unit = r.unit
WHERE b.created_at >= CURRENT_DATE
GROUP BY b.unit, r.name
ORDER BY boletos_na_unidade DESC
LIMIT 10;

-- 5. ANÁLISE DE QUALIDADE DA EXTRAÇÃO
SELECT
    'QUALIDADE EXTRAÇÃO' as secao,
    CASE
        WHEN pdf_original_path IS NOT NULL AND resident_id IS NOT NULL THEN 'EXTRAÇÃO_COMPLETA'
        WHEN pdf_original_path IS NOT NULL AND resident_id IS NULL THEN 'PDF_OK_MORADOR_FALTA'
        WHEN pdf_original_path IS NULL AND resident_id IS NOT NULL THEN 'MORADOR_OK_PDF_FALTA'
        ELSE 'EXTRAÇÃO_INCOMPLETA'
    END as qualidade_extracao,
    COUNT(*) as quantidade,
    ROUND(COUNT(*)::decimal / SUM(COUNT(*)) OVER() * 100, 1) as percentual
FROM public.boletos
WHERE created_at >= CURRENT_DATE
GROUP BY CASE
    WHEN pdf_original_path IS NOT NULL AND resident_id IS NOT NULL THEN 'EXTRAÇÃO_COMPLETA'
    WHEN pdf_original_path IS NOT NULL AND resident_id IS NULL THEN 'PDF_OK_MORADOR_FALTA'
    WHEN pdf_original_path IS NULL AND resident_id IS NOT NULL THEN 'MORADOR_OK_PDF_FALTA'
    ELSE 'EXTRAÇÃO_INCOMPLETA'
END;

-- 6. PROBLEMAS IDENTIFICADOS
WITH problemas AS (
    SELECT
        b.id,
        b.unit,
        b.resident_name,
        CASE
            WHEN r.id IS NULL THEN 'MORADOR_NÃO_ENCONTRADO'
            WHEN b.pdf_original_path IS NULL AND b.pdf_url IS NULL THEN 'PDF_NÃO_ANEXADO'
            WHEN b.unit != r.unit THEN 'UNIDADE_DIVERGENTE'
            ELSE NULL
        END as problema
    FROM public.boletos b
    LEFT JOIN public.residents r ON b.unit = r.unit
    WHERE b.created_at >= CURRENT_DATE
)
SELECT
    'PROBLEMAS IDENTIFICADOS' as secao,
    problema,
    COUNT(*) as quantidade,
    STRING_AGG('ID: ' || id || ' - ' || unit || ' (' || resident_name || ')', '; ') as exemplos
FROM problemas
WHERE problema IS NOT NULL
GROUP BY problema;

-- 7. PERFORMANCE DA IMPORTAÇÃO
SELECT
    'PERFORMANCE IMPORTAÇÃO' as secao,
    DATE_TRUNC('hour', created_at) as hora_importacao,
    COUNT(*) as boletos_por_hora,
    ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at))), 2) as tempo_processamento_medio_segundos
FROM public.boletos
WHERE created_at >= CURRENT_DATE
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hora_importacao;

-- 8. VALIDAÇÃO DE INTEGRIDADE
SELECT
    'VALIDAÇÃO INTEGRIDADE' as secao,
    COUNT(*) as boletos_com_hash,
    COUNT(CASE WHEN LENGTH(checksum_pdf) = 64 THEN 1 END) as hashes_sha256_validos,
    CASE
        WHEN COUNT(*) = COUNT(CASE WHEN LENGTH(checksum_pdf) = 64 THEN 1 END) THEN '✅ INTEGRIDADE OK'
        ELSE '❌ PROBLEMAS DE INTEGRIDADE'
    END as status_integridade
FROM public.boletos
WHERE created_at >= CURRENT_DATE AND checksum_pdf IS NOT NULL;

-- 9. RECOMENDAÇÕES FINAIS
WITH metricas_finais AS (
    SELECT
        COUNT(*) as total_importado,
        COUNT(pdf_original_path) as com_pdf,
        COUNT(CASE WHEN resident_id IS NOT NULL THEN 1 END) as com_morador,
        ROUND(AVG(amount), 2) as valor_medio
    FROM public.boletos
    WHERE created_at >= CURRENT_DATE
)
SELECT
    'RECOMENDAÇÕES FINAIS' as secao,
    CASE
        WHEN com_pdf = total_importado AND com_morador = total_importado THEN
            '✅ IMPORTAÇÃO 100% BEM-SUCEDIDA - SISTEMA FUNCIONANDO PERFEITAMENTE'
        WHEN com_pdf >= total_importado * 0.95 THEN
            '⚠️ IMPORTAÇÃO QUASE PERFEITA - PEQUENOS AJUSTES NECESSÁRIOS'
        WHEN com_pdf >= total_importado * 0.80 THEN
            '🔧 IMPORTAÇÃO RAZOÁVEL - CORREÇÕES MANUAIS RECOMENDADAS'
        ELSE
            '❌ IMPORTAÇÃO COM PROBLEMAS - REVISÃO NECESSÁRIA'
    END as avaliacao_geral,
    'Valor médio dos boletos: R$ ' || valor_medio as observacao_valor,
    CASE
        WHEN com_pdf < total_importado THEN (total_importado - com_pdf) || ' boletos precisam de PDF anexado'
        ELSE 'Todos os boletos têm PDF anexado'
    END as observacao_pdf,
    CASE
        WHEN com_morador < total_importado THEN (total_importado - com_morador) || ' boletos não foram associados a moradores'
        ELSE 'Todos os boletos estão associados a moradores'
    END as observacao_moradores
FROM metricas_finais;

-- 10. LOG DE AUDITORIA
INSERT INTO public.boletos_audit (operation, details, performed_at)
VALUES (
    'IMPORTAÇÃO_LOTE_216_BOLETOS',
    json_build_object(
        'total_boletos', (SELECT COUNT(*) FROM public.boletos WHERE created_at >= CURRENT_DATE),
        'com_pdf', (SELECT COUNT(pdf_original_path) FROM public.boletos WHERE created_at >= CURRENT_DATE),
        'com_morador', (SELECT COUNT(CASE WHEN resident_id IS NOT NULL THEN 1 END) FROM public.boletos WHERE created_at >= CURRENT_DATE),
        'data_importacao', CURRENT_TIMESTAMP
    ),
    CURRENT_TIMESTAMP
);