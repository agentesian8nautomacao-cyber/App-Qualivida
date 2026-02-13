-- ============================================
-- CONSULTAS PARA SQL EDITOR DO SUPABASE
-- ============================================
-- Execute estas consultas individualmente no SQL Editor do Supabase
-- Acesse: https://supabase.com/dashboard/project/[seu-projeto]/sql/new
-- ============================================

-- ============================================
-- 1. DIAGNÓSTICO GERAL: BOLETOS SEM PDF
-- ============================================

-- Query 1.1: Contagem geral de boletos sem PDF
SELECT
    'BOLETOS SEM PDF - NECESSITAM CORREÇÃO' as status,
    COUNT(*) as total_boletos_sem_pdf,
    COUNT(CASE WHEN status = 'Pago' THEN 1 END) as pagos_sem_pdf,
    COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pendentes_sem_pdf,
    COUNT(CASE WHEN status = 'Vencido' THEN 1 END) as vencidos_sem_pdf
FROM public.boletos
WHERE pdf_original_path IS NULL AND pdf_url IS NULL;

-- Query 1.2: Lista detalhada dos boletos sem PDF (TOP 20)
SELECT
    id,
    unit,
    resident_name,
    reference_month,
    due_date,
    amount,
    status,
    created_at,
    CASE
        WHEN status = 'Pago' THEN '🔴 CRÍTICO - Morador pagou mas não consegue baixar'
        WHEN status = 'Vencido' THEN '🟠 IMPORTANTE - Morador precisa baixar para pagar'
        WHEN status = 'Pendente' THEN '🟡 NORMAL - Ainda pode ser corrigido'
        ELSE '⚪ DESCONHECIDO'
    END as prioridade_correcao
FROM public.boletos
WHERE pdf_original_path IS NULL AND pdf_url IS NULL
ORDER BY
    CASE status
        WHEN 'Pago' THEN 1
        WHEN 'Vencido' THEN 2
        WHEN 'Pendente' THEN 3
        ELSE 4
    END,
    due_date DESC
LIMIT 20;

-- Query 1.3: Estatísticas por unidade
SELECT
    unit,
    COUNT(*) as boletos_sem_pdf,
    COUNT(CASE WHEN status = 'Pago' THEN 1 END) as pagos_sem_pdf,
    COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pendentes_sem_pdf,
    COUNT(CASE WHEN status = 'Vencido' THEN 1 END) as vencidos_sem_pdf,
    STRING_AGG(DISTINCT reference_month, ', ') as meses_afetados
FROM public.boletos
WHERE pdf_original_path IS NULL AND pdf_url IS NULL
GROUP BY unit
ORDER BY boletos_sem_pdf DESC, unit
LIMIT 20;

-- ============================================
-- 2. VALIDAÇÃO PÓS-IMPORTAÇÃO
-- ============================================

-- Query 2.1: Validação geral de importações do dia
WITH validacao_importacao AS (
    SELECT
        COUNT(*) as total_boletos_importados,
        COUNT(CASE WHEN pdf_original_path IS NOT NULL THEN 1 END) as com_pdf_original,
        COUNT(CASE WHEN pdf_url IS NOT NULL THEN 1 END) as com_pdf_legado,
        COUNT(CASE WHEN pdf_original_path IS NULL AND pdf_url IS NULL THEN 1 END) as sem_pdf
    FROM public.boletos
    WHERE created_at >= CURRENT_DATE
)
SELECT
    'VALIDAÇÃO PÓS-IMPORTAÇÃO' as status,
    total_boletos_importados,
    com_pdf_original + com_pdf_legado as total_com_pdf,
    sem_pdf,
    CASE
        WHEN sem_pdf = 0 THEN '✅ SUCESSO: Todos os boletos têm PDF'
        WHEN sem_pdf > 0 AND sem_pdf < total_boletos_importados THEN '⚠️ PARCIAL: Alguns boletos sem PDF'
        ELSE '❌ FALHA: Nenhum boleto tem PDF'
    END as resultado_validacao,
    ROUND(
        (com_pdf_original + com_pdf_legado)::decimal /
        NULLIF(total_boletos_importados, 0)::decimal * 100, 1
    ) as percentual_sucesso
FROM validacao_importacao;

-- Query 2.2: Boletos importados hoje sem PDF
SELECT
    'BOLETOS IMPORTADOS SEM PDF - CORREÇÃO NECESSÁRIA' as alerta,
    id,
    unit,
    resident_name,
    reference_month,
    amount,
    status,
    created_at
FROM public.boletos
WHERE created_at >= CURRENT_DATE
  AND pdf_original_path IS NULL
  AND pdf_url IS NULL
ORDER BY created_at DESC;

-- Query 2.3: Verificação de integridade dos PDFs
WITH checksum_validacao AS (
    SELECT
        id,
        unit,
        resident_name,
        reference_month,
        CASE
            WHEN pdf_original_path IS NOT NULL AND checksum_pdf IS NOT NULL THEN '✅ PDF Original com Checksum'
            WHEN pdf_original_path IS NOT NULL AND checksum_pdf IS NULL THEN '⚠️ PDF Original sem Checksum'
            WHEN pdf_url IS NOT NULL THEN '⚪ PDF Legado (sem validação)'
            ELSE '❌ Sem PDF'
        END as status_integridade
    FROM public.boletos
    WHERE created_at >= CURRENT_DATE
)
SELECT
    status_integridade,
    COUNT(*) as quantidade
FROM checksum_validacao
GROUP BY status_integridade
ORDER BY quantidade DESC;

-- ============================================
-- 3. MONITORAMENTO GERAL
-- ============================================

-- Query 3.1: Dashboard completo de monitoramento
SELECT
    'MONITORAMENTO PDF BOLETOS' as dashboard,
    (SELECT COUNT(*) FROM public.boletos) as total_boletos,
    (SELECT COUNT(*) FROM public.boletos WHERE pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL) as boletos_com_pdf,
    (SELECT COUNT(*) FROM public.boletos WHERE pdf_original_path IS NULL AND pdf_url IS NULL) as boletos_sem_pdf,
    ROUND(
        (SELECT COUNT(*) FROM public.boletos WHERE pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL)::decimal /
        NULLIF((SELECT COUNT(*) FROM public.boletos), 0)::decimal * 100, 1
    ) as percentual_cobertura_pdf,
    (SELECT COUNT(*) FROM public.residents) as total_moradores,
    (SELECT COUNT(DISTINCT unit) FROM public.boletos WHERE pdf_original_path IS NULL AND pdf_url IS NULL) as unidades_afetadas
FROM (SELECT 1) as dummy;

-- Query 3.2: Impacto nos moradores afetados
WITH moradores_afetados AS (
    SELECT DISTINCT
        resident_name,
        unit,
        COUNT(*) as boletos_sem_pdf,
        COUNT(CASE WHEN status = 'Pago' THEN 1 END) as boletos_pagos_sem_pdf,
        MIN(due_date) as data_mais_antiga,
        MAX(due_date) as data_mais_recente
    FROM public.boletos
    WHERE pdf_original_path IS NULL AND pdf_url IS NULL
    GROUP BY resident_name, unit
)
SELECT
    'MORADORES AFETADOS' as categoria,
    COUNT(*) as total_moradores,
    SUM(boletos_sem_pdf) as total_boletos_faltando,
    SUM(boletos_pagos_sem_pdf) as boletos_pagos_faltando
FROM moradores_afetados;

-- Query 3.3: Quebra mensal dos boletos sem PDF
SELECT
    DATE_TRUNC('month', due_date) as mes,
    COUNT(*) as boletos_sem_pdf_mes,
    COUNT(CASE WHEN status = 'Pago' THEN 1 END) as pagos_sem_pdf,
    COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pendentes_sem_pdf,
    COUNT(CASE WHEN status = 'Vencido' THEN 1 END) as vencidos_sem_pdf,
    SUM(amount) as valor_total_sem_pdf
FROM public.boletos
WHERE pdf_original_path IS NULL AND pdf_url IS NULL
GROUP BY DATE_TRUNC('month', due_date)
ORDER BY mes DESC
LIMIT 12;

-- ============================================
-- 4. CONSULTAS PARA CORREÇÃO MANUAL
-- ============================================

-- Query 4.1: Buscar boleto específico por ID
SELECT
    id,
    unit,
    resident_name,
    reference_month,
    amount,
    status,
    pdf_original_path,
    pdf_url,
    checksum_pdf,
    CASE
        WHEN pdf_original_path IS NOT NULL THEN '✅ TEM PDF ORIGINAL'
        WHEN pdf_url IS NOT NULL THEN '⚠️ TEM PDF LEGADO'
        ELSE '❌ SEM PDF - NECESSITA CORREÇÃO'
    END as status_pdf
FROM public.boletos
WHERE id = 'COLE_SEU_ID_AQUI';

-- Query 4.2: Buscar boletos de uma unidade específica
SELECT
    id,
    resident_name,
    reference_month,
    due_date,
    amount,
    status,
    CASE
        WHEN pdf_original_path IS NOT NULL THEN '✅ COM PDF'
        ELSE '❌ SEM PDF'
    END as status_pdf
FROM public.boletos
WHERE unit = 'DIGITE_UNIDADE_AQUI'  -- Ex: '03/005'
ORDER BY due_date DESC;

-- Query 4.3: Buscar boletos por referência
SELECT
    id,
    unit,
    resident_name,
    reference_month,
    amount,
    status,
    CASE
        WHEN pdf_original_path IS NOT NULL THEN '✅ COM PDF'
        ELSE '❌ SEM PDF'
    END as status_pdf
FROM public.boletos
WHERE reference_month = 'DIGITE_MES_AQUI'  -- Ex: '12/2025'
ORDER BY unit;

-- ============================================
-- 5. RELATÓRIOS DE SUCESSO
-- ============================================

-- Query 5.1: Relatório final de correção
WITH relatorio_correcao AS (
    SELECT
        (SELECT COUNT(*) FROM public.boletos WHERE pdf_original_path IS NULL AND pdf_url IS NULL) as boletos_ainda_sem_pdf,
        (SELECT COUNT(*) FROM public.boletos WHERE pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL) as boletos_com_pdf,
        (SELECT COUNT(*) FROM public.boletos) as total_boletos
)
SELECT
    'RELATÓRIO FINAL DE CORREÇÃO' as titulo,
    total_boletos,
    boletos_com_pdf,
    boletos_ainda_sem_pdf,
    ROUND(boletos_com_pdf::decimal / NULLIF(total_boletos, 0)::decimal * 100, 1) as cobertura_atual,
    CASE
        WHEN boletos_ainda_sem_pdf = 0 THEN '🎉 SUCESSO TOTAL: 100% dos boletos têm PDF!'
        WHEN boletos_com_pdf::decimal / total_boletos >= 0.95 THEN '✅ EXCELENTE: Cobertura superior a 95%'
        WHEN boletos_com_pdf::decimal / total_boletos >= 0.80 THEN '⚠️ BOM: Cobertura superior a 80%'
        ELSE '❌ PREOCUPANTE: Cobertura abaixo de 80%'
    END as avaliacao_final
FROM relatorio_correcao;

-- ============================================
-- INSTRUÇÕES DE USO NO SUPABASE
-- ============================================
/*
COMO USAR ESTE ARQUIVO:

1. ACESSE O SUPABASE:
   • Vá para: https://supabase.com/dashboard
   • Selecione seu projeto

2. ABRA O SQL EDITOR:
   • Clique em "SQL Editor" no menu lateral
   • Clique em "New Query"

3. COPIE E COLE AS QUERIES:
   • Copie uma query de cada vez
   • Execute individualmente
   • Analise os resultados

4. PARA CORREÇÃO MANUAL:
   • Use as queries da seção 4
   • Identifique boletos sem PDF
   • Corrija via interface web da aplicação

5. MONITORE O PROGRESSO:
   • Execute as queries da seção 5
   • Acompanhe a cobertura de PDFs

DICAS:
• Sempre execute as queries na ordem sugerida
• Anote os IDs dos boletos que precisam correção
• Use a interface web para anexar PDFs
• Execute validações periódicas
*/