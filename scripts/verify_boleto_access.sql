-- ============================================
-- VERIFICAR ACESSO AO BOLETO DA UNIDADE 03/005
-- ============================================
-- Script completo para diagnosticar por que o morador
-- da unidade 03/005 não consegue ver seu boleto
-- ============================================

-- 1. RESUMO GERAL
SELECT
    'RESUMO GERAL' as secao,
    COUNT(*) as total_boletos,
    COUNT(DISTINCT unit) as unidades_boletos,
    COUNT(pdf_original_path) as com_pdf_original,
    COUNT(pdf_url) as com_pdf_url_antigo
FROM public.boletos;

-- 2. VERIFICAR MORADOR DA UNIDADE 03/005
SELECT
    'MORADOR 03/005' as secao,
    id,
    name,
    unit,
    email
FROM public.residents
WHERE unit = '03/005' OR unit = '3/5' OR unit = '03005';

-- 3. VERIFICAR BOLETOS DA UNIDADE 03/005
SELECT
    'BOLETOS 03/005' as secao,
    id,
    unit,
    resident_name,
    reference_month,
    amount,
    status,
    CASE
        WHEN pdf_original_path IS NOT NULL THEN 'PDF_ORIGINAL'
        WHEN pdf_url IS NOT NULL THEN 'PDF_URL_ANTIGO'
        ELSE 'SEM_PDF'
    END as tipo_pdf,
    created_at
FROM public.boletos
WHERE unit = '03/005' OR unit = '3/5' OR unit = '03005'
ORDER BY created_at DESC;

-- 4. SIMULAR FILTRO DO FRONTEND (MoradorDashboardView)
-- Este é o filtro exato usado no frontend
SELECT
    'FILTRO FRONTEND' as secao,
    b.id,
    b.unit,
    b.resident_name,
    b.reference_month,
    b.pdf_original_path,
    b.pdf_url,
    CASE WHEN b.pdf_original_path IS NOT NULL OR b.pdf_url IS NOT NULL THEN 'DOWNLOAD_DISPONIVEL' ELSE 'SEM_DOWNLOAD' END as status_download
FROM public.boletos b
WHERE b.unit = '03/005'  -- Filtro exato usado no MoradorDashboardView
ORDER BY b.created_at DESC;

-- 5. VERIFICAR SE HÁ PROBLEMAS DE ASSOCIAÇÃO
SELECT
    'ASSOCIAÇÃO PROBLEMA' as secao,
    b.id,
    b.unit as boleto_unit,
    b.resident_name,
    r.id as resident_id,
    r.name as resident_name_db,
    r.unit as resident_unit_db,
    CASE
        WHEN b.unit = r.unit THEN 'ASSOCIADO_CORRETAMENTE'
        WHEN r.id IS NULL THEN 'MORADOR_NAO_ENCONTRADO'
        ELSE 'UNIDADE_DIVERGENTE'
    END as status_associacao
FROM public.boletos b
LEFT JOIN public.residents r ON b.unit = r.unit
ORDER BY b.created_at DESC
LIMIT 5;

-- 6. DIAGNÓSTICO FINAL
WITH diagnostico AS (
    SELECT
        (SELECT COUNT(*) FROM public.boletos WHERE unit = '03/005') as boletos_03_005,
        (SELECT COUNT(*) FROM public.residents WHERE unit = '03/005') as moradores_03_005,
        (SELECT COUNT(*) FROM public.boletos b WHERE b.unit = '03/005' AND (b.pdf_original_path IS NOT NULL OR b.pdf_url IS NOT NULL)) as boletos_com_download
)
SELECT
    'DIAGNÓSTICO FINAL' as secao,
    boletos_03_005,
    moradores_03_005,
    boletos_com_download,
    CASE
        WHEN moradores_03_005 = 0 THEN 'ERRO: Morador da unidade 03/005 não encontrado'
        WHEN boletos_03_005 = 0 THEN 'ERRO: Nenhum boleto encontrado para unidade 03/005'
        WHEN boletos_com_download = 0 THEN 'ERRO: Boletos existem mas nenhum tem PDF para download'
        ELSE 'SUCESSO: Sistema configurado corretamente'
    END as diagnostico
FROM diagnostico;