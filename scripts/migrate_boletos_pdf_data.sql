-- ============================================
-- MIGRAR DADOS DE PDF DOS BOLETOS ANTIGOS
-- ============================================
-- Script para migrar boletos que têm pdf_url antigo
-- para o novo formato com pdf_original_path
-- ============================================

-- IMPORTANTE: Este script deve ser executado APENAS UMA VEZ
-- e APENAS se houver boletos antigos com pdf_url que precisam ser migrados

-- 1. Verificar boletos que têm pdf_url mas não têm pdf_original_path
SELECT
    COUNT(*) as boletos_para_migrar
FROM public.boletos
WHERE pdf_url IS NOT NULL
  AND pdf_original_path IS NULL;

-- 2. Para boletos com pdf_url, gerar pdf_original_path baseado no ID
-- IMPORTANTE: Isso assume que os PDFs antigos estão no storage com nome = id.pdf
UPDATE public.boletos
SET pdf_original_path = CONCAT('original/', id, '.pdf'),
    checksum_pdf = NULL  -- Não temos checksum para PDFs antigos
WHERE pdf_url IS NOT NULL
  AND pdf_original_path IS NULL;

-- 3. Verificar resultado da migração
SELECT
    id,
    unit,
    reference_month,
    pdf_url,
    pdf_original_path,
    checksum_pdf,
    updated_at
FROM public.boletos
WHERE pdf_original_path IS NOT NULL
ORDER BY updated_at DESC
LIMIT 5;

-- 4. Contar novamente após migração
SELECT
    COUNT(*) as total_boletos,
    COUNT(pdf_original_path) as com_pdf_original,
    COUNT(pdf_url) as com_pdf_url_antigo,
    COUNT(CASE WHEN pdf_original_path IS NULL AND pdf_url IS NULL THEN 1 END) as sem_pdf,
    COUNT(CASE WHEN pdf_original_path IS NOT NULL AND pdf_url IS NOT NULL THEN 1 END) as com_ambos
FROM public.boletos;

-- NOTA: Os PDFs antigos no storage podem precisar ser movidos
-- da raiz do bucket 'boletos' para a pasta 'original/'
-- Isso pode ser feito via interface do Supabase Storage ou script adicional