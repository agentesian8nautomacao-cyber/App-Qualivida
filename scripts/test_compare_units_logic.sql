-- ============================================
-- TESTAR LÓGICA DE COMPARAÇÃO DE UNIDADES
-- ============================================
-- Simular a lógica compareUnits usada no frontend
-- ============================================

-- Função auxiliar para simular compareUnits
CREATE OR REPLACE FUNCTION test_compare_units(unit1 TEXT, unit2 TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    norm1 TEXT;
    norm2 TEXT;
BEGIN
    -- Normalizar unidades (remover espaços, padronizar formato)
    norm1 := regexp_replace(trim(upper(unit1)), '[^0-9A-Z]', '', 'g');
    norm2 := regexp_replace(trim(upper(unit2)), '[^0-9A-Z]', '', 'g');

    -- Comparações possíveis
    RETURN norm1 = norm2
        OR norm1 = regexp_replace(norm2, '^0+', '')  -- 03005 -> 3005
        OR norm2 = regexp_replace(norm1, '^0+', '')  -- 3005 -> 03005
        OR regexp_replace(norm1, '[^0-9]', '', 'g') = regexp_replace(norm2, '[^0-9]', '', 'g'); -- apenas números
END;
$$ LANGUAGE plpgsql;

-- Testar diferentes formatos de unidade
SELECT
    '03/005' as unit_test,
    unit,
    test_compare_units('03/005', unit) as matches
FROM (VALUES
    ('03/005'),
    ('3/5'),
    ('03005'),
    ('03 / 005'),
    ('03-005'),
    ('08/302'),
    ('80302'),
    ('08 / 302')
) AS test_units(unit);

-- Verificar quais boletos seriam visíveis para morador da unidade '03/005'
SELECT
    b.id,
    b.unit,
    b.resident_name,
    b.reference_month,
    test_compare_units('03/005', b.unit) as visible_for_03_005
FROM public.boletos b
ORDER BY b.created_at DESC
LIMIT 10;

-- Limpar função auxiliar
DROP FUNCTION IF EXISTS test_compare_units(TEXT, TEXT);