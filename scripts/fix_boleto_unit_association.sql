-- ============================================
-- CORREÇÃO: ASSOCIAR BOLETOS ÀS UNIDADES CORRETAS
-- ============================================
-- Script para corrigir associações incorretas de boletos
-- ============================================

-- IMPORTANTE: Execute apenas se identificar problemas de associação

-- 1. Verificar associações problemáticas
SELECT
    'ANTES DA CORREÇÃO' as status,
    b.id,
    b.unit as boleto_unit,
    b.resident_name,
    r.id as resident_id,
    r.name as resident_name_db,
    r.unit as resident_unit_db
FROM public.boletos b
LEFT JOIN public.residents r ON b.unit = r.unit
WHERE r.id IS NULL OR b.unit != r.unit
ORDER BY b.created_at DESC;

-- 2. CORREÇÃO: Atualizar unidades que podem ter formato diferente
-- IMPORTANTE: Analise os resultados antes de executar!

-- Exemplo: Se boletos têm unidade '03005' mas morador tem '03/005'
-- UPDATE public.boletos
-- SET unit = '03/005'
-- WHERE unit = '03005' AND unit NOT LIKE '%/%';

-- Exemplo: Se boletos têm unidade '3/5' mas morador tem '03/005'
-- UPDATE public.boletos
-- SET unit = '03/005'
-- WHERE unit = '3/5';

-- 3. CORREÇÃO: Para boletos sem morador associado
-- IMPORTANTE: Só execute se souber a unidade correta!

-- UPDATE public.boletos
-- SET unit = '03/005'
-- WHERE id = 'ID_DO_BOLETO_PROBLEMATICO'
--   AND unit != '03/005';

-- 4. Verificar após correção
SELECT
    'APÓS CORREÇÃO' as status,
    b.id,
    b.unit as boleto_unit,
    b.resident_name,
    r.id as resident_id,
    r.name as resident_name_db,
    r.unit as resident_unit_db,
    CASE WHEN b.unit = r.unit THEN 'CORRIGIDO' ELSE 'AINDA_PROBLEMA' END as status_correcao
FROM public.boletos b
LEFT JOIN public.residents r ON b.unit = r.unit
ORDER BY b.created_at DESC
LIMIT 5;

-- 5. Verificar especificamente unidade 03/005
SELECT
    'VERIFICAÇÃO FINAL 03/005' as status,
    b.id,
    b.unit,
    b.resident_name,
    b.reference_month,
    b.pdf_original_path,
    b.pdf_url,
    r.name as morador_oficial
FROM public.boletos b
JOIN public.residents r ON b.unit = r.unit
WHERE b.unit = '03/005'
ORDER BY b.created_at DESC;