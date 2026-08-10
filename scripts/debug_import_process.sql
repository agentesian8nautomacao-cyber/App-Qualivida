-- ============================================
-- DEBUG: PROCESSO DE IMPORTAÇÃO DE BOLETOS
-- ============================================
-- Verificar se o processo de importação está funcionando corretamente
-- ============================================

-- 1. Verificar último boleto importado
SELECT
    'ÚLTIMO BOLETO IMPORTADO' as secao,
    id,
    unit,
    resident_name,
    reference_month,
    amount,
    status,
    pdf_original_path,
    pdf_url,
    created_at,
    updated_at
FROM public.boletos
ORDER BY created_at DESC
LIMIT 1;

-- 2. Verificar se o morador existe no momento da importação
SELECT
    'VERIFICAÇÃO MORADOR' as secao,
    r.id,
    r.name,
    r.unit,
    r.created_at as morador_criado_em,
    b.created_at as boleto_criado_em,
    CASE
        WHEN r.created_at < b.created_at THEN 'MORADOR_EXISTIA'
        ELSE 'MORADOR_CRIADO_DEPOIS'
    END as status_temporal
FROM public.boletos b
CROSS JOIN public.residents r
WHERE r.unit = '03/005'
  AND b.unit = '03/005'
ORDER BY b.created_at DESC
LIMIT 1;

-- 3. Simular o processo de importação
-- Verificar se conseguiríamos encontrar o morador durante importação
WITH import_simulation AS (
    SELECT
        '03/005' as unidade_importada,
        '12/2025' as referencia,
        1500.00 as valor
)
SELECT
    'SIMULAÇÃO IMPORTAÇÃO' as secao,
    i.unidade_importada,
    i.referencia,
    i.valor,
    r.id as morador_encontrado_id,
    r.name as morador_encontrado_nome,
    r.unit as morador_unit,
    CASE WHEN r.id IS NOT NULL THEN 'IMPORTAÇÃO POSSÍVEL' ELSE 'IMPORTAÇÃO IMPOSSÍVEL' END as status_importacao
FROM import_simulation i
LEFT JOIN public.residents r ON r.unit = i.unidade_importada;

-- 4. Verificar logs de importação (se existirem)
-- Nota: Se houver tabela de logs, adicionar aqui

-- 5. Verificar se há boletos órfãos (sem morador)
SELECT
    'BOLETOS ÓRFÃOS' as secao,
    COUNT(*) as total_orfaos,
    string_agg(b.unit, ', ') as unidades_orfas
FROM public.boletos b
LEFT JOIN public.residents r ON b.unit = r.unit
WHERE r.id IS NULL;

-- 6. Verificar padrões de nomes de unidade
SELECT
    'PADRÕES DE UNIDADE' as secao,
    unit,
    COUNT(*) as quantidade,
    string_agg(DISTINCT resident_name, '; ') as moradores
FROM public.boletos
GROUP BY unit
ORDER BY COUNT(*) DESC
LIMIT 10;

-- 7. DIAGNÓSTICO DO PROCESSO DE IMPORTAÇÃO
WITH diagnostico AS (
    SELECT
        (SELECT COUNT(*) FROM public.boletos WHERE unit = '03/005') as boletos_03_005,
        (SELECT COUNT(*) FROM public.residents WHERE unit = '03/005') as moradores_03_005,
        (SELECT COUNT(*) FROM public.boletos b LEFT JOIN public.residents r ON b.unit = r.unit WHERE b.unit = '03/005' AND r.id IS NULL) as boletos_orfaos_03_005
)
SELECT
    'DIAGNÓSTICO IMPORTAÇÃO' as secao,
    boletos_03_005,
    moradores_03_005,
    boletos_orfaos_03_005,
    CASE
        WHEN moradores_03_005 = 0 THEN 'ERRO: Nenhum morador encontrado para 03/005'
        WHEN boletos_orfaos_03_005 > 0 THEN 'ERRO: Boletos importados mas não associados ao morador'
        WHEN boletos_03_005 > 0 AND moradores_03_005 > 0 THEN 'SUCESSO: Importação funcionou corretamente'
        ELSE 'STATUS: Aguardando primeira importação'
    END as diagnostico_importacao
FROM diagnostico;