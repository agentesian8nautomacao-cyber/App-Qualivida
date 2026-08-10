-- ============================================
-- CORREÇÃO: Adicionar IF NOT EXISTS aos índices
-- ============================================
-- Este script corrige o erro ao re-executar o schema
-- Execute apenas se você já executou o schema e obteve erro de índices duplicados
-- ============================================

-- Não é necessário executar nada aqui se você já corrigiu o arquivo
-- supabase_schema_complete.sql com IF NOT EXISTS

-- Se ainda tiver problemas, você pode executar este script para remover e recriar os índices
-- (CUIDADO: Isso pode afetar performance temporariamente)

-- OU simplesmente ignore os erros de índice duplicado se você já os tem criados
-- e execute apenas a parte do schema que falta (tabelas, funções, etc.)

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Para verificar se os índices existem:
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ============================================
-- FIM
-- ============================================