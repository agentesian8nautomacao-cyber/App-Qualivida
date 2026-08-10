-- ============================================
-- VERIFICAR STATUS DOS PDFs DOS BOLETOS
-- ============================================
-- Script para verificar quantos boletos têm PDF original,
-- quantos têm pdf_url antigo, e quantos não têm nenhum
-- ============================================

-- Verificar estrutura da tabela boletos
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'boletos'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Contar boletos por status de PDF
SELECT
    COUNT(*) as total_boletos,
    COUNT(pdf_original_path) as com_pdf_original,
    COUNT(pdf_url) as com_pdf_url_antigo,
    COUNT(CASE WHEN pdf_original_path IS NULL AND pdf_url IS NULL THEN 1 END) as sem_pdf,
    COUNT(CASE WHEN pdf_original_path IS NOT NULL AND pdf_url IS NOT NULL THEN 1 END) as com_ambos
FROM public.boletos;

-- Listar alguns exemplos de boletos com diferentes status
SELECT
    id,
    unit,
    reference_month,
    resident_name,
    CASE
        WHEN pdf_original_path IS NOT NULL THEN 'PDF_ORIGINAL'
        WHEN pdf_url IS NOT NULL THEN 'PDF_URL_ANTIGO'
        ELSE 'SEM_PDF'
    END as pdf_status,
    pdf_original_path,
    pdf_url,
    created_at
FROM public.boletos
ORDER BY created_at DESC
LIMIT 10;

-- Verificar se existem PDFs no storage antigo (se aplicável)
-- SELECT * FROM storage.objects WHERE bucket_id = 'boletos' AND name NOT LIKE 'original/%' LIMIT 5;