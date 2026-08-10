-- ============================================
-- TESTE: Criar notificação manualmente
-- ============================================
-- Execute este script para testar se a inserção funciona
-- ============================================

-- 1. Primeiro, pegue um ID de morador válido
SELECT id, name, unit 
FROM residents 
LIMIT 5;

-- 2. Substitua 'MORADOR_ID_AQUI' pelo ID real de um morador acima
--    e execute a inserção:
/*
INSERT INTO notifications (morador_id, title, message, type, read)
VALUES (
  'MORADOR_ID_AQUI'::uuid,  -- Substitua pelo ID real
  '📦 Nova encomenda na portaria',
  'Uma encomenda foi recebida e está disponível para retirada.',
  'package',
  false
)
RETURNING *;
*/

-- 3. Verificar se foi criada
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;

-- 4. Verificar políticas RLS ativas
SELECT 
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'INSERT' THEN 'INSERT'
        WHEN cmd = 'SELECT' THEN 'SELECT'
        WHEN cmd = 'UPDATE' THEN 'UPDATE'
        ELSE cmd
    END as operation,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;
