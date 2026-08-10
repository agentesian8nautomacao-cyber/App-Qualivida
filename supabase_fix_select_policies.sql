-- ============================================
-- CORREÇÃO: Políticas RLS de SELECT para notifications
-- ============================================
-- As políticas atuais dependem de auth.users e users que podem não existir
-- Vamos criar políticas mais simples que funcionam sem autenticação complexa
-- ============================================

-- 1. Verificar políticas atuais
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'SELECT';

-- 2. Remover TODAS as políticas de SELECT e UPDATE existentes
DROP POLICY IF EXISTS "Moradores podem ver suas próprias notificações" ON notifications;
DROP POLICY IF EXISTS "Porteiros e Síndicos podem ver todas as notificações" ON notifications;
DROP POLICY IF EXISTS "Moradores podem marcar suas notificações como lidas" ON notifications;

-- 3. Criar política SIMPLES que permite SELECT sempre
-- Em produção, ajuste conforme sua autenticação
-- NOTA: Esta política permite que qualquer pessoa veja notificações
-- Para produção, você precisará implementar autenticação adequada
CREATE POLICY "Permitir leitura de notificações" ON notifications
    FOR SELECT
    USING (true);  -- Permite leitura sempre (desenvolvimento)

-- 4. Criar política SIMPLES que permite UPDATE sempre
-- Em produção, ajuste conforme sua autenticação
CREATE POLICY "Permitir atualização de notificações" ON notifications
    FOR UPDATE
    USING (true)  -- Permite atualização sempre (desenvolvimento)
    WITH CHECK (true);

-- 4. Verificar se foi criada
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'SELECT';

-- 5. Teste: Tentar buscar notificações
SELECT 
    id,
    morador_id,
    title,
    message,
    type,
    read,
    created_at
FROM notifications 
WHERE morador_id = 'e52fae67-7c14-4226-a5f4-822053f252ca'  -- Substitua pelo ID real do morador
ORDER BY created_at DESC 
LIMIT 5;
