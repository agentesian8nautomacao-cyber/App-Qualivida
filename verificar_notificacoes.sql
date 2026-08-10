-- ============================================
-- VERIFICAÇÃO: Notificações criadas
-- ============================================
-- Execute este script para verificar se as notificações estão sendo criadas
-- ============================================

-- 1. Verificar notificações recentes (últimas 10)
SELECT 
    id,
    morador_id,
    title,
    message,
    type,
    read,
    related_id,
    created_at
FROM notifications 
ORDER BY created_at DESC 
LIMIT 10;

-- 2. Contar notificações por morador
SELECT 
    morador_id,
    COUNT(*) as total_notificacoes,
    COUNT(*) FILTER (WHERE read = false) as nao_lidas,
    MAX(created_at) as ultima_notificacao
FROM notifications
GROUP BY morador_id
ORDER BY ultima_notificacao DESC;

-- 3. Verificar notificações não lidas
SELECT 
    n.id,
    n.morador_id,
    r.name as morador_nome,
    r.unit as morador_unidade,
    n.title,
    n.message,
    n.type,
    n.created_at
FROM notifications n
LEFT JOIN residents r ON r.id = n.morador_id
WHERE n.read = false
ORDER BY n.created_at DESC;

-- 4. Verificar se Realtime está habilitado na tabela
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'notifications';

-- 5. Verificar políticas RLS (devem permitir SELECT para moradores)
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'SELECT';
