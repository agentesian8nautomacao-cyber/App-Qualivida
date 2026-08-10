-- Atualizar nomes das áreas reserváveis para: Salão de festas, Área gourmet
-- Execute no SQL Editor do Supabase se você já tem o banco populado.

UPDATE areas SET name = 'Salão de festas' WHERE name = 'SALÃO DE FESTAS CRYSTAL';
UPDATE areas SET name = 'Área gourmet' WHERE name = 'ESPAÇO GOURMET';
