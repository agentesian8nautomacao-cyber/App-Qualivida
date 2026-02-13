-- ============================================
-- EXEMPLO: Como executar os scripts de correção
-- ============================================
-- Este arquivo demonstra como usar os scripts SQL
-- NÃO execute este arquivo diretamente!
-- ============================================

-- INSTRUÇÃO: Execute este comando no TERMINAL (não no arquivo SQL):
-- psql -h localhost -U postgres -d gestao_qualivida -f scripts/correcao_boletos_sem_pdf.sql

-- INSTRUÇÃO: Execute este comando no TERMINAL (não no arquivo SQL):
-- psql -h localhost -U postgres -d gestao_qualivida -f scripts/validacao_importacao_boletos_com_pdf.sql

-- ============================================
-- CONSULTAS INDIVIDUAIS (se quiser executar manualmente)
-- ============================================

-- 1. Verificar boletos sem PDF
SELECT
    COUNT(*) as boletos_sem_pdf,
    COUNT(CASE WHEN status = 'Pago' THEN 1 END) as pagos_sem_pdf,
    COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pendentes_sem_pdf,
    COUNT(CASE WHEN status = 'Vencido' THEN 1 END) as vencidos_sem_pdf
FROM public.boletos
WHERE pdf_original_path IS NULL AND pdf_url IS NULL;

-- 2. Listar boletos que precisam de correção
SELECT
    id,
    unit,
    resident_name,
    reference_month,
    amount,
    status,
    CASE
        WHEN status = 'Pago' THEN '🔴 CRÍTICO - Corrigir urgente'
        WHEN status = 'Vencido' THEN '🟠 IMPORTANTE - Corrigir logo'
        WHEN status = 'Pendente' THEN '🟡 NORMAL - Corrigir quando possível'
    END as prioridade
FROM public.boletos
WHERE pdf_original_path IS NULL AND pdf_url IS NULL
ORDER BY
    CASE status
        WHEN 'Pago' THEN 1
        WHEN 'Vencido' THEN 2
        WHEN 'Pendente' THEN 3
    END
LIMIT 10;

-- 3. Verificar taxa de sucesso de importações recentes
SELECT
    COUNT(*) as boletos_importados_hoje,
    COUNT(CASE WHEN pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL THEN 1 END) as com_pdf,
    ROUND(
        COUNT(CASE WHEN pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL THEN 1 END)::decimal /
        NULLIF(COUNT(*), 0)::decimal * 100, 1
    ) as percentual_sucesso
FROM public.boletos
WHERE created_at >= CURRENT_DATE;

-- ============================================
-- RESUMO DA SOLUÇÃO IMPLEMENTADA
-- ============================================

/*
✅ CORREÇÃO COMPLETA IMPLEMENTADA:

1. MODAL DE IMPORTAÇÃO ATUALIZADO:
   - Suporta upload de CSV + PDFs simultaneamente
   - Associação automática por nome de arquivo
   - Template CSV com coluna pdf_filename

2. PROCESSAMENTO DE PDF MELHORADO:
   - Salvamento permanente no storage
   - Validação de integridade com checksum
   - Fallback para sistema legado

3. SCRIPTS DE DIAGNÓSTICO:
   - Identificação automática de problemas
   - Relatórios detalhados de cobertura
   - Instruções claras de correção

4. MONITORAMENTO CONTÍNUO:
   - Validação pós-importação automática
   - Logs de auditoria no sistema
   - Alertas para correções necessárias

RESULTADO: Moradores agora podem baixar PDFs de todos os boletos! 🎉
*/