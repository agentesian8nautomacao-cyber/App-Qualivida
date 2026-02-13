    -- ============================================
    -- VALIDAÇÃO: IMPORTAÇÃO DE BOLETOS COM PDF
    -- ============================================
    -- Scripts para validar que boletos importados têm PDF disponível
    -- ============================================

    -- VALIDAÇÃO APÓS IMPORTAÇÃO
    WITH validacao_importacao AS (
        SELECT
            COUNT(*) as total_boletos_importados,
            COUNT(CASE WHEN pdf_original_path IS NOT NULL THEN 1 END) as com_pdf_original,
            COUNT(CASE WHEN pdf_url IS NOT NULL THEN 1 END) as com_pdf_legado,
            COUNT(CASE WHEN pdf_original_path IS NULL AND pdf_url IS NULL THEN 1 END) as sem_pdf
        FROM public.boletos
        WHERE created_at >= CURRENT_DATE -- Boletos de hoje
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

    -- DETALHES DOS BOLETOS SEM PDF (se houver)
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

    -- VALIDAÇÃO DE INTEGRIDADE DOS PDFs
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

    -- RELATÓRIO FINAL DE IMPORTAÇÃO
    WITH relatorio_final AS (
        SELECT
            (SELECT COUNT(*) FROM public.boletos WHERE created_at >= CURRENT_DATE) as boletos_importados,
            (SELECT COUNT(*) FROM public.boletos WHERE created_at >= CURRENT_DATE AND (pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL)) as boletos_com_download,
            (SELECT COUNT(*) FROM public.boletos WHERE created_at >= CURRENT_DATE AND pdf_original_path IS NOT NULL) as boletos_pdf_original,
            (SELECT COUNT(*) FROM public.boletos WHERE created_at >= CURRENT_DATE AND pdf_url IS NOT NULL) as boletos_pdf_legado,
            (SELECT COUNT(*) FROM public.boletos WHERE created_at >= CURRENT_DATE AND pdf_original_path IS NULL AND pdf_url IS NULL) as boletos_sem_pdf,
            (SELECT COUNT(DISTINCT unit) FROM public.boletos WHERE created_at >= CURRENT_DATE) as unidades_afetadas
    )
    SELECT
        'RELATÓRIO FINAL DE IMPORTAÇÃO' as titulo,
        boletos_importados,
        boletos_com_download,
        boletos_sem_pdf,
        unidades_afetadas,
        ROUND(boletos_com_download::decimal / NULLIF(boletos_importados, 0)::decimal * 100, 1) as taxa_sucesso_percentual,
        CASE
            WHEN boletos_sem_pdf = 0 THEN '✅ IMPORTAÇÃO BEM-SUCEDIDA: Todos os boletos têm PDF disponível'
            WHEN boletos_com_download >= boletos_importados * 0.8 THEN '⚠️ IMPORTAÇÃO ACEITÁVEL: Maioria dos boletos tem PDF'
            ELSE '❌ IMPORTAÇÃO PROBLEMÁTICA: Muitos boletos sem PDF - corrigir urgente'
        END as avaliacao_final
    FROM relatorio_final;

    -- INSTRUÇÕES PARA CORREÇÃO (se necessário)
    SELECT
        'INSTRUÇÕES PARA CORREÇÃO' as guia,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM public.boletos
                WHERE created_at >= CURRENT_DATE
                AND pdf_original_path IS NULL
                AND pdf_url IS NULL
            ) THEN
                '1. Identificar boletos sem PDF na listagem acima\n' ||
                '2. Localizar arquivos PDF correspondentes\n' ||
                '3. Usar interface admin: Financeiro > Boletos > botão "Anexar PDF"\n' ||
                '4. Verificar download funcionando para moradores'
            ELSE '✅ Nenhuma ação necessária - todos os boletos têm PDF'
        END as instrucoes_correcao;

    -- LOG DE IMPORTAÇÃO PARA HISTÓRICO
    INSERT INTO public.system_logs (action, details, created_by)
    SELECT
        'BOLETOS_IMPORT_VALIDATION',
        json_build_object(
            'data_importacao', CURRENT_DATE,
            'boletos_importados', COUNT(*),
            'com_pdf', COUNT(CASE WHEN pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL THEN 1 END),
            'sem_pdf', COUNT(CASE WHEN pdf_original_path IS NULL AND pdf_url IS NULL THEN 1 END),
            'taxa_sucesso', ROUND(
                COUNT(CASE WHEN pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL THEN 1 END)::decimal /
                NULLIF(COUNT(*), 0)::decimal * 100, 1
            )
        ),
        'SYSTEM_VALIDATION'
    FROM public.boletos
    WHERE created_at >= CURRENT_DATE;

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