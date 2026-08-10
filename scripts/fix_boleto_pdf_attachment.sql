-- ============================================
-- CORREÇÃO: ANEXAR PDF AO BOLETO EXISTENTE
-- ============================================
-- Script para anexar PDF ao boleto que foi importado sem PDF
-- ============================================

-- 1. Verificar boleto problemático
SELECT
    'BOLETO SEM PDF' as status,
    id,
    unit,
    resident_name,
    reference_month,
    pdf_original_path,
    pdf_url,
    created_at
FROM public.boletos
WHERE id = '7abfbe92-01a1-4006-82a4-349e5b37d6f4';

-- 2. SIMULAÇÃO: Se você tiver o PDF físico do boleto, pode anexá-lo via interface
-- Como administrador, vá para Financeiro > Boletos e clique no botão laranja "Anexar PDF"
-- ao lado do boleto da unidade 03/005

-- 3. Alternativa: Se souber o caminho do PDF no storage, pode atualizar manualmente
-- IMPORTANTE: Só execute se souber o caminho correto do arquivo!

-- UPDATE public.boletos
-- SET pdf_original_path = 'original/SEU_UUID_AQUI.pdf',
--     checksum_pdf = 'SEU_HASH_SHA256_AQUI'
-- WHERE id = '7abfbe92-01a1-4006-82a4-349e5b37d6f4';

-- 4. Verificar se o PDF existe no storage (substitua pelo UUID correto)
-- SELECT name, updated_at, metadata
-- FROM storage.objects
-- WHERE bucket_id = 'boletos'
--   AND name LIKE 'original/%'
-- ORDER BY updated_at DESC;

-- 5. Após anexar o PDF, verificar correção
SELECT
    'APÓS CORREÇÃO' as status,
    id,
    unit,
    resident_name,
    reference_month,
    CASE
        WHEN pdf_original_path IS NOT NULL THEN 'PDF_ORIGINAL_DISPONIVEL'
        WHEN pdf_url IS NOT NULL THEN 'PDF_URL_DISPONIVEL'
        ELSE 'SEM_PDF'
    END as status_pdf,
    pdf_original_path,
    pdf_url,
    updated_at
FROM public.boletos
WHERE id = '7abfbe92-01a1-4006-82a4-349e5b37d6f4';

-- 6. Teste final: verificar se download está disponível
SELECT
    'TESTE DOWNLOAD' as status,
    id,
    unit,
    resident_name,
    CASE WHEN pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL THEN 'DOWNLOAD_DISPONIVEL' ELSE 'DOWNLOAD_INDISPONIVEL' END as status_download
FROM public.boletos
WHERE unit = '03/005';