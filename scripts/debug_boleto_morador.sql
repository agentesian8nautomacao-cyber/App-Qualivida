-- ============================================
-- DEBUG: VERIFICAR ASSOCIAÇÃO BOLETO-MORADOR
-- ============================================
-- Script para verificar se o boleto está associado corretamente
-- ao morador da unidade 03/005
-- ============================================

-- 1. Verificar se existe morador na unidade 03/005
SELECT
    id,
    name,
    unit,
    email
FROM public.residents
WHERE unit LIKE '%03%' OR unit LIKE '%005%'
ORDER BY unit;

-- 2. Verificar boletos existentes e sua associação
SELECT
    b.id,
    b.unit,
    b.resident_name,
    b.reference_month,
    b.status,
    b.pdf_original_path,
    b.pdf_url,
    r.id as resident_id,
    r.name as resident_name_from_db,
    r.unit as resident_unit_from_db
FROM public.boletos b
LEFT JOIN public.residents r ON b.unit = r.unit
ORDER BY b.created_at DESC
LIMIT 10;

-- 3. Verificar especificamente o boleto problemático
SELECT
    b.*,
    r.id as resident_found_id,
    r.name as resident_found_name,
    r.unit as resident_found_unit
FROM public.boletos b
LEFT JOIN public.residents r ON b.unit = r.unit
WHERE b.id = 'b8cbab09-b3f2-4955-a90f-9b2a425226b0';

-- 4. Verificar se a unidade 03/005 existe exatamente como está no boleto
SELECT
    id,
    name,
    unit
FROM public.residents
WHERE unit = '03/005' OR unit = '03/005' OR unit = '3/5' OR unit = '03005';

-- 5. Verificar formato das unidades no banco
SELECT DISTINCT unit
FROM public.residents
WHERE unit LIKE '%03%' OR unit LIKE '%005%' OR unit LIKE '%3%' OR unit LIKE '%5%'
ORDER BY unit;