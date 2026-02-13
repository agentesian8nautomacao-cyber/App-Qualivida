-- ============================================
-- CORREÇÃO: BOLETOS SEM PDF DISPONÍVEL
-- ============================================
-- Script para identificar e corrigir boletos importados sem PDF
-- ============================================

-- 1. IDENTIFICAR BOLETOS SEM PDF
SELECT
    'BOLETOS SEM PDF - NECESSITAM CORREÇÃO' as status,
    COUNT(*) as total_boletos_sem_pdf,
    COUNT(CASE WHEN status = 'Pago' THEN 1 END) as pagos_sem_pdf,
    COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pendentes_sem_pdf,
    COUNT(CASE WHEN status = 'Vencido' THEN 1 END) as vencidos_sem_pdf
FROM public.boletos
WHERE pdf_original_path IS NULL AND pdf_url IS NULL;

-- 2. LISTAGEM DETALHADA DOS BOLETOS SEM PDF
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
    due_date DESC;

-- 3. ESTATÍSTICAS POR UNIDADE
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
ORDER BY boletos_sem_pdf DESC, unit;

-- 4. IMPACTO NOS MORADORES
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

-- ============================================
-- INSTRUÇÕES PARA CORREÇÃO MANUAL
-- ============================================

-- PASSO 1: Para cada boleto sem PDF, localizar o arquivo PDF físico
-- - Procurar na pasta de boletos/arquivos
-- - Ou solicitar do contador/administrador
-- - Nome sugerido: {unidade}_{mes_ano}.pdf (ex: 101A_01_2025.pdf)

-- PASSO 2: Usar interface de administrador para anexar PDF
-- 1. Logar como administrador (síndico ou porteiro)
-- 2. Ir para: Financeiro > Boletos
-- 3. Localizar o boleto específico
-- 4. Clicar no botão laranja "Anexar PDF" (ícone de upload)
-- 5. Selecionar o arquivo PDF correspondente

-- PASSO 3: Verificar correção
SELECT
    id,
    unit,
    resident_name,
    reference_month,
    CASE
        WHEN pdf_original_path IS NOT NULL THEN '✅ PDF ANEXADO'
        WHEN pdf_url IS NOT NULL THEN '⚠️ PDF LEGADO'
        ELSE '❌ AINDA SEM PDF'
    END as status_correcao
FROM public.boletos
WHERE id = 'ID_DO_BOLETO_CORRIGIDO';

-- ============================================
-- SCRIPTS DE CORREÇÃO EM MASSA (se souber caminhos dos PDFs)
-- ============================================

-- EXEMPLO: Para boletos específicos com caminhos conhecidos
-- IMPORTANTE: Só usar se souber exatamente os caminhos dos arquivos no storage

/*
-- Atualizar múltiplos boletos de uma vez (exemplo)
UPDATE public.boletos
SET pdf_original_path = CASE
    WHEN unit = '101A' AND reference_month = '01/2025' THEN 'original/101A_01_2025.pdf'
    WHEN unit = '205B' AND reference_month = '02/2025' THEN 'original/205B_02_2025.pdf'
    -- adicionar mais casos conforme necessário
    ELSE pdf_original_path
END
WHERE (unit, reference_month) IN (
    ('101A', '01/2025'),
    ('205B', '02/2025')
    -- adicionar mais tuplas conforme necessário
);
*/

-- ============================================
-- PREVENÇÃO PARA FUTURAS IMPORTAÇÕES
-- ============================================

-- 1. Sempre incluir PDFs na importação
-- 2. Usar o novo formato CSV: unidade,mes,vencimento,valor,pdf_filename
-- 3. Verificar se PDFs foram associados antes de finalizar importação
-- 4. Manter backup dos arquivos PDF organizados por unidade/data

-- ============================================
-- MONITORAMENTO CONTÍNUO
-- ============================================

-- Query para dashboard de monitoramento
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

-- ============================================
-- INSTRUÇÕES DE EXECUÇÃO DOS SCRIPTS SQL
-- ============================================
--
-- Para executar estes scripts, use o comando no terminal:
--
-- 1. Para correção de boletos existentes:
--    psql -h localhost -U postgres -d gestao_qualivida -f scripts/correcao_boletos_sem_pdf.sql
--
-- 2. Para validação pós-importação:
--    psql -h localhost -U postgres -d gestao_qualivida -f scripts/validacao_importacao_boletos_com_pdf.sql
--
-- Substitua:
--   • localhost pelo endereço do seu servidor PostgreSQL
--   • postgres pelo nome do usuário do banco
--   • gestao_qualivida pelo nome do banco de dados
--
-- ============================================