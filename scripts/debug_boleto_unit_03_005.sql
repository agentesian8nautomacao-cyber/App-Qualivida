-- ============================================
-- DEBUG ESPECÍFICO: BOLETO DA UNIDADE 03/005
-- ============================================
-- Verificar se o boleto existe e está associado corretamente
-- ============================================

-- 1. Verificar moradores da unidade 03/005
SELECT
    id,
    name,
    unit,
    email
FROM public.residents
WHERE unit = '03/005' OR unit = '3/5' OR unit = '03005'
ORDER BY unit;

-- 2. Verificar todos os boletos (últimos 5)
SELECT
    id,
    unit,
    resident_name,
    reference_month,
    amount,
    status,
    pdf_original_path,
    pdf_url,
    created_at
FROM public.boletos
ORDER BY created_at DESC
LIMIT 5;

-- 3. Verificar especificamente boletos da unidade 03/005
SELECT
    b.id,
    b.unit,
    b.resident_name,
    b.reference_month,
    b.amount,
    b.status,
    b.pdf_original_path,
    b.pdf_url,
    r.id as resident_id,
    r.name as resident_name_from_db
FROM public.boletos b
LEFT JOIN public.residents r ON b.unit = r.unit
WHERE b.unit = '03/005' OR b.unit = '3/5' OR b.unit = '03005'
ORDER BY b.created_at DESC;

-- 4. Verificar se há boletos sem associação de morador
SELECT
    b.id,
    b.unit,
    b.resident_name,
    b.reference_month,
    b.pdf_original_path,
    b.pdf_url,
    CASE WHEN r.id IS NULL THEN 'SEM_MORADOR' ELSE 'COM_MORADOR' END as status_associacao
FROM public.boletos b
LEFT JOIN public.residents r ON b.unit = r.unit
ORDER BY b.created_at DESC
LIMIT 10;

-- 5. Testar função compareUnits (simular o filtro do frontend)
-- Para unidade '03/005', quais boletos seriam mostrados?
SELECT
    b.id,
    b.unit,
    b.resident_name,
    b.reference_month,
    b.pdf_original_path,
    b.pdf_url
FROM public.boletos b
WHERE b.unit = '03/005'
   OR b.unit LIKE '%03%'
   OR b.unit LIKE '%005%'
   OR b.unit = '3/5'
ORDER BY b.created_at DESC;