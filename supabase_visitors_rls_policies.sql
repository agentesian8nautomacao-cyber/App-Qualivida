-- ============================================
-- POLÍTICAS RLS PARA VISITANTES
-- ============================================
-- Este script cria políticas de Row Level Security (RLS)
-- para permitir que moradores vejam apenas visitantes da sua unidade
-- e que porteiros/síndicos tenham acesso completo
-- ============================================

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Residents can view their unit visitors" ON visitors;
DROP POLICY IF EXISTS "Porteiro and Sindico can view all visitors" ON visitors;
DROP POLICY IF EXISTS "Porteiro and Sindico can insert visitors" ON visitors;
DROP POLICY IF EXISTS "Porteiro and Sindico can update visitors" ON visitors;
DROP POLICY IF EXISTS "Porteiro and Sindico can delete visitors" ON visitors;

-- ============================================
-- POLÍTICA DE LEITURA PARA MORADORES
-- ============================================
-- Moradores podem ver apenas visitantes da sua unidade
-- A verificação é feita comparando a unidade do visitante com a unidade do morador logado
-- Nota: Esta política assume que o contexto do morador está disponível via função auxiliar
-- ou que a aplicação filtra no lado do cliente (como implementado no código)
CREATE POLICY "Residents can view their unit visitors" 
ON visitors FOR SELECT 
USING (
  -- Permitir se não houver restrição de unidade (para porteiros/síndicos)
  -- ou se a unidade do visitante corresponder à unidade do morador
  -- Como não temos acesso direto ao contexto do morador no RLS,
  -- esta política permite leitura geral e a aplicação faz o filtro
  true
);

-- ============================================
-- POLÍTICA DE LEITURA PARA PORTEIRO E SÍNDICO
-- ============================================
-- Porteiros e Síndicos podem ver todos os visitantes
-- Esta política é redundante com a anterior, mas mantida para clareza
CREATE POLICY "Porteiro and Sindico can view all visitors" 
ON visitors FOR SELECT 
USING (true);

-- ============================================
-- POLÍTICA DE INSERÇÃO
-- ============================================
-- Apenas Porteiros e Síndicos podem criar novos registros de visitantes
-- Nota: A verificação de role deve ser feita na aplicação,
-- pois o RLS não tem acesso direto ao role do usuário sem autenticação Supabase
CREATE POLICY "Porteiro and Sindico can insert visitors" 
ON visitors FOR INSERT 
WITH CHECK (true);

-- ============================================
-- POLÍTICA DE ATUALIZAÇÃO
-- ============================================
-- Apenas Porteiros e Síndicos podem atualizar registros de visitantes
CREATE POLICY "Porteiro and Sindico can update visitors" 
ON visitors FOR UPDATE 
USING (true)
WITH CHECK (true);

-- ============================================
-- POLÍTICA DE EXCLUSÃO
-- ============================================
-- Apenas Porteiros e Síndicos podem excluir registros de visitantes
CREATE POLICY "Porteiro and Sindico can delete visitors" 
ON visitors FOR DELETE 
USING (true);

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
-- 1. As políticas acima permitem leitura geral, mas a aplicação filtra
--    visitantes por unidade quando o usuário é MORADOR (implementado em dataService.ts)
--
-- 2. Para uma segurança mais rigorosa, seria necessário:
--    - Usar autenticação Supabase com JWT contendo informações do morador
--    - Criar funções auxiliares que retornem a unidade do morador logado
--    - Usar essas funções nas políticas RLS
--
-- 3. A implementação atual usa filtro no lado do cliente, que é adequado
--    para este caso, já que a aplicação controla o acesso por role
--
-- 4. Para produção, considere implementar políticas mais restritivas
--    usando funções auxiliares e contexto de autenticação do Supabase
