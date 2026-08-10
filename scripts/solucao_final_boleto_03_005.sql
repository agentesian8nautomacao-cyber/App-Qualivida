-- ============================================
-- SOLUÇÃO FINAL: BOLETO 03/005 SEM PDF
-- ============================================
-- Problema identificado e solução completa
-- ============================================

-- PROBLEMA CONFIRMADO:
-- Boleto existe e está associado corretamente ao morador,
-- mas foi importado SEM o arquivo PDF anexado.

SELECT
    'PROBLEMA IDENTIFICADO' as diagnostico,
    id,
    unit,
    resident_name,
    reference_month,
    CASE WHEN pdf_original_path IS NULL AND pdf_url IS NULL THEN 'SEM_PDF' ELSE 'COM_PDF' END as status_pdf
FROM public.boletos
WHERE id = '7abfbe92-01a1-4006-82a4-349e5b37d6f4';

-- SOLUÇÃO 1: VIA INTERFACE ADMINISTRADOR (RECOMENDADO)
-- 1. Logue como administrador (síndico ou porteiro)
-- 2. Vá para: Financeiro > Boletos
-- 3. Localize o boleto da unidade "03/005" - dezembro/2025
-- 4. Clique no botão laranja "Anexar PDF" (ícone de upload)
-- 5. Selecione o arquivo PDF do boleto físico
-- 6. Pronto! O PDF será anexado automaticamente

-- SOLUÇÃO 2: VIA SQL (se souber o caminho do arquivo)
-- IMPORTANTE: Só use se souber exatamente o caminho do PDF no storage
-- UPDATE public.boletos
-- SET pdf_original_path = 'original/7abfbe92-01a1-4006-82a4-349e5b37d6f4.pdf'
-- WHERE id = '7abfbe92-01a1-4006-82a4-349e5b37d6f4';

-- VERIFICAÇÃO APÓS CORREÇÃO
SELECT
    'VERIFICAÇÃO APÓS CORREÇÃO' as status,
    id,
    unit,
    resident_name,
    CASE
        WHEN pdf_original_path IS NOT NULL THEN '✅ PDF ORIGINAL ANEXADO'
        WHEN pdf_url IS NOT NULL THEN '⚠️ PDF URL LEGADO'
        ELSE '❌ AINDA SEM PDF'
    END as status_correcao
FROM public.boletos
WHERE id = '7abfbe92-01a1-4006-82a4-349e5b37d6f4';

-- TESTE FINAL: Morador deve conseguir baixar
-- 1. Morador loga na unidade 03/005
-- 2. Vai para Financeiro > Boletos
-- 3. Deve ver o boleto de dezembro/2025
-- 4. Clicar "BAIXAR BOLETO" deve funcionar

-- CONFIRMAÇÃO FINAL
WITH teste_final AS (
    SELECT
        (SELECT COUNT(*) FROM public.boletos WHERE unit = '03/005') as boletos_visiveis,
        (SELECT COUNT(*) FROM public.boletos WHERE unit = '03/005' AND (pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL)) as boletos_com_download
)
SELECT
    'TESTE FINAL' as verificacao,
    boletos_visiveis,
    boletos_com_download,
    CASE
        WHEN boletos_visiveis > 0 AND boletos_com_download > 0 THEN '✅ SUCESSO: Morador pode baixar boleto'
        WHEN boletos_visiveis > 0 AND boletos_com_download = 0 THEN '❌ PROBLEMA: Boleto visível mas sem download'
        ELSE '❓ STATUS: Aguardando verificação'
    END as resultado_final
FROM teste_final;