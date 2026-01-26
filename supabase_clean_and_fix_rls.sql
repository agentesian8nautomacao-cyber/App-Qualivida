-- ============================================
-- LIMPEZA E CORREÇÃO: Políticas RLS para notifications
-- ============================================
-- Este script remove TODAS as políticas de INSERT e recria uma única política permissiva
-- ============================================

-- 1. Verificar políticas existentes ANTES
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'INSERT';

-- 2. Remover TODAS as políticas de INSERT (pode haver duplicatas)
DO $$
DECLARE
    r RECORD;
    policies_removed INTEGER := 0;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND cmd = 'INSERT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', r.policyname);
        policies_removed := policies_removed + 1;
        RAISE NOTICE 'Política removida: %', r.policyname;
    END LOOP;
    
    IF policies_removed = 0 THEN
        RAISE NOTICE 'Nenhuma política de INSERT encontrada para remover.';
    ELSE
        RAISE NOTICE 'Total de políticas removidas: %', policies_removed;
    END IF;
END $$;

-- 3. Recriar UMA ÚNICA política de INSERT permissiva
CREATE POLICY "Porteiros e Síndicos podem criar notificações" ON notifications
    FOR INSERT
    WITH CHECK (true);  -- Permite inserção sempre (desenvolvimento)

-- 4. Verificar políticas existentes DEPOIS
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'INSERT';

-- 5. Teste: Tentar inserir uma notificação de teste
DO $$
DECLARE
    test_morador_id UUID;
    test_notification_id UUID;
BEGIN
    -- Pegar o primeiro morador disponível
    SELECT id INTO test_morador_id FROM residents LIMIT 1;
    
    IF test_morador_id IS NOT NULL THEN
        -- Tentar inserir notificação de teste
        INSERT INTO notifications (morador_id, title, message, type, read)
        VALUES (
            test_morador_id,
            '🧪 Teste de Notificação',
            'Esta é uma notificação de teste para verificar se a inserção funciona.',
            'package',
            false
        )
        RETURNING id INTO test_notification_id;
        
        RAISE NOTICE '✅ SUCESSO! Notificação de teste criada com ID: %', test_notification_id;
        
        -- Limpar notificação de teste
        DELETE FROM notifications WHERE id = test_notification_id;
        RAISE NOTICE 'Notificação de teste removida.';
    ELSE
        RAISE NOTICE '⚠️ Nenhum morador encontrado para teste.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERRO ao inserir notificação de teste: %', SQLERRM;
END $$;

-- 6. Verificar notificações existentes
SELECT COUNT(*) as total_notifications FROM notifications;
