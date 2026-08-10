-- ============================================
-- PLANEJAMENTO: IMPORTAÇÃO DE 216 BOLETOS
-- ============================================
-- Guia completo para importação em lote eficiente
-- ============================================

-- 1. PREPARAÇÃO DOS ARQUIVOS
-- Renomeie os PDFs seguindo estes padrões para extração automática:

-- PADRÃO RECOMENDADO: unidade_mes_ano.pdf
-- Exemplos:
-- • 101A_01_2025.pdf (Unidade 101A, Janeiro 2025)
-- • 03005_12_2025_condominio.pdf (Unidade 03/005, Dezembro 2025, Condomínio)
-- • 205_02_2025_agua_R$45,50.pdf (Unidade 205, Fevereiro 2025, Água, R$45,50)

-- OUTROS FORMATOS SUPORTADOS:
-- • 101A_jan2025.pdf
-- • unidade101A_01_2025.pdf
-- • apt101A_012025.pdf
-- • bl01_apt101A_01_2025.pdf

-- 2. VERIFICAÇÃO PRÉVIA
SELECT
    'VERIFICAÇÃO PRÉVIA' as status,
    COUNT(*) as moradores_cadastrados,
    COUNT(CASE WHEN unit LIKE '%/%' THEN 1 END) as unidades_padronizadas,
    COUNT(CASE WHEN unit NOT LIKE '%/%' THEN 1 END) as unidades_simples
FROM public.residents;

-- 3. ESTRATÉGIA DE IMPORTAÇÃO RECOMENDADA
-- Para 216 boletos, divida em lotes menores:

-- LOTE 1: Unidades 001-050 (50 boletos)
-- LOTE 2: Unidades 051-100 (50 boletos)
-- LOTE 3: Unidades 101-150 (50 boletos)
-- LOTE 4: Unidades 151-200 (50 boletos)
-- LOTE 5: Unidades 201-216 (16 boletos)

-- 4. MONITORAMENTO DURANTE IMPORTAÇÃO
-- Execute estas queries durante o processo:

-- Progresso em tempo real:
SELECT
    'PROGRESSO IMPORTAÇÃO' as monitoramento,
    COUNT(*) as boletos_totais_sistema,
    COUNT(CASE WHEN pdf_original_path IS NOT NULL THEN 1 END) as com_pdf_original,
    COUNT(CASE WHEN pdf_url IS NOT NULL THEN 1 END) as com_pdf_antigo,
    COUNT(CASE WHEN pdf_original_path IS NULL AND pdf_url IS NULL THEN 1 END) as sem_pdf
FROM public.boletos;

-- 5. VALIDAÇÃO PÓS-IMPORTAÇÃO
SELECT
    'VALIDAÇÃO FINAL' as status,
    COUNT(DISTINCT unit) as unidades_afetadas,
    COUNT(*) as boletos_importados,
    COUNT(pdf_original_path) as boletos_com_pdf,
    ROUND(
        COUNT(pdf_original_path)::decimal / COUNT(*)::decimal * 100, 1
    ) as percentual_sucesso
FROM public.boletos
WHERE created_at >= CURRENT_DATE; -- Boletos de hoje

-- 6. CORREÇÃO DE PROBLEMAS (se necessário)
-- Para boletos que não foram associados corretamente:

-- Identificar problemas:
SELECT
    'BOLETOS COM PROBLEMAS' as diagnostico,
    b.id,
    b.unit as unidade_boleto,
    b.resident_name,
    CASE
        WHEN r.id IS NULL THEN 'MORADOR_NÃO_ENCONTRADO'
        WHEN b.unit != r.unit THEN 'UNIDADE_DIVERGENTE'
        ELSE 'OK'
    END as status_associacao,
    b.pdf_original_path,
    b.created_at
FROM public.boletos b
LEFT JOIN public.residents r ON b.unit = r.unit
WHERE b.created_at >= CURRENT_DATE
  AND (r.id IS NULL OR b.unit != r.unit)
ORDER BY b.created_at DESC;

-- Correção manual (exemplo):
-- UPDATE public.boletos
-- SET unit = '03/005'
-- WHERE unit = '03005' AND id = 'ID_DO_BOLETO';

-- 7. PERFORMANCE ESPERADA
-- Com o sistema otimizado:
-- • Até 10 PDFs processados simultaneamente
-- • Extração automática de dados do nome do arquivo
-- • Fallback para extração do conteúdo do PDF
-- • Barra de progresso em tempo real
-- • Validação automática de integridade

-- 8. BACKUP RECOMENDADO
-- Antes de iniciar a importação em lote:
-- pg_dump -h localhost -U postgres -d database_name > backup_antes_importacao_216.sql

-- 9. ROLLBACK SE NECESSÁRIO
-- Em caso de problemas generalizados:
-- DELETE FROM public.boletos WHERE created_at >= '2025-02-13 00:00:00';
-- (Ajuste a data conforme necessário)

-- 10. SUPORTE PÓS-IMPORTAÇÃO
-- Scripts de diagnóstico disponíveis:
-- • debug_boleto_morador.sql
-- • verify_boleto_access.sql
-- • fix_boleto_unit_association.sql

COMMENT ON DATABASE CURRENT_DATABASE IS 'Importação de 216 boletos realizada em ' || CURRENT_TIMESTAMP;