-- ============================================
-- VERIFICAÇÃO: INTERFACE DE ADMINISTRADOR
-- ============================================
-- Confirmar que o botão "Anexar PDF" estará disponível
-- ============================================

-- 1. Verificar se o boleto aparece na interface de admin
SELECT
    'INTERFACE ADMIN' as verificacao,
    id,
    unit,
    resident_name,
    reference_month,
    CASE
        WHEN pdf_original_path IS NOT NULL THEN 'BOTÃO DOWNLOAD (PDF JÁ ANEXADO)'
        WHEN pdf_url IS NOT NULL THEN 'BOTÃO DOWNLOAD (PDF LEGADO)'
        ELSE 'BOTÃO ANEXAR PDF (LARANJA - PRECISA CORREÇÃO)'
    END as interface_admin,
    CASE
        WHEN pdf_original_path IS NULL AND pdf_url IS NULL THEN '✅ CORREÇÃO NECESSÁRIA'
        ELSE '✅ JÁ CORRIGIDO'
    END as status_correcao
FROM public.boletos
WHERE unit = '03/005';

-- 2. Após anexar PDF via interface, verificar mudança
-- SELECT * FROM public.boletos WHERE unit = '03/005';

-- 3. Teste final completo
WITH teste_completo AS (
    SELECT
        (SELECT COUNT(*) FROM public.boletos WHERE unit = '03/005') as boletos_admin,
        (SELECT COUNT(*) FROM public.boletos WHERE unit = '03/005' AND (pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL)) as boletos_com_download,
        (SELECT COUNT(*) FROM public.residents WHERE unit = '03/005') as moradores
)
SELECT
    'TESTE COMPLETO' as verificacao,
    boletos_admin as boletos_visiveis_admin,
    boletos_com_download as boletos_com_download_admin,
    moradores as moradores_cadastrados,
    CASE
        WHEN boletos_admin > 0 AND boletos_com_download = 0 AND moradores > 0 THEN '🔧 AGUARDANDO CORREÇÃO: Use botão "Anexar PDF"'
        WHEN boletos_admin > 0 AND boletos_com_download > 0 AND moradores > 0 THEN '✅ SUCESSO TOTAL: Sistema funcionando'
        ELSE '❓ STATUS DESCONHECIDO'
    END as orientacao_final
FROM teste_completo;