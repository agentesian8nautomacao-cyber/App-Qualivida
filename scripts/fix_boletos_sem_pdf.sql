-- ============================================
-- CORREÇÃO PARA BOLETOS SEM PDF
-- ============================================
-- Script para identificar e corrigir boletos que foram
-- importados sem PDF anexado
-- ============================================

-- 1. Identificar boletos sem PDF
SELECT
    id,
    unit,
    reference_month,
    resident_name,
    status,
    created_at,
    'SEM_PDF' as status_pdf
FROM public.boletos
WHERE (pdf_url IS NULL OR pdf_url = '')
  AND (pdf_original_path IS NULL OR pdf_original_path = '');

-- 2. Para corrigir boletos sem PDF, você tem duas opções:
-- Opção A: Reimportar o boleto com PDF anexado (recomendado)
-- Opção B: Atualizar manualmente o pdf_original_path (se o PDF já existe no storage)

-- EXEMPLO: Se você sabe que o PDF existe no storage com o nome do ID do boleto
-- Substitua 'SEU_BOLETO_ID_AQUI' pelo ID real do boleto
-- UPDATE public.boletos
-- SET pdf_original_path = CONCAT('original/', id, '.pdf')
-- WHERE id = 'SEU_BOLETO_ID_AQUI'
--   AND pdf_original_path IS NULL;

-- 3. Verificar se os PDFs existem no storage
-- SELECT name, updated_at, metadata
-- FROM storage.objects
-- WHERE bucket_id = 'boletos'
--   AND name LIKE 'original/%'
-- ORDER BY updated_at DESC;

-- 4. Limpeza: remover boletos sem PDF se não forem necessários
-- ATENÇÃO: Execute apenas se tiver certeza!
-- DELETE FROM public.boletos
-- WHERE (pdf_url IS NULL OR pdf_url = '')
--   AND (pdf_original_path IS NULL OR pdf_original_path = '')
--   AND status = 'Pendente'; -- Apenas boletos pendentes para evitar perda de dados