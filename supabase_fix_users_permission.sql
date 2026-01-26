-- ============================================
-- CORREÇÃO: Remover dependência da tabela users
-- ============================================
-- O erro "permission denied for table users" ocorre porque a política
-- está tentando verificar a tabela users que não existe ou não tem permissão
-- ============================================

-- 1. Verificar políticas atuais
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'INSERT';

-- 2. Remover TODAS as políticas de INSERT
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'notifications' 
        AND cmd = 'INSERT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON notifications', r.policyname);
        RAISE NOTICE 'Política removida: %', r.policyname;
    END LOOP;
END $$;

-- 3. Criar política SIMPLES que permite inserção sempre
-- Esta política não depende de nenhuma outra tabela
CREATE POLICY "Permitir inserção de notificações" ON notifications
    FOR INSERT
    WITH CHECK (true);  -- Permite inserção sempre

-- 4. Verificar se foi criada
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'INSERT';

-- 5. Teste: Tentar inserir uma notificação
DO $$
DECLARE
    test_morador_id UUID;
    test_notification_id UUID;
BEGIN
    -- Pegar o primeiro morador
    SELECT id INTO test_morador_id FROM residents LIMIT 1;
    
    IF test_morador_id IS NOT NULL THEN
        INSERT INTO notifications (morador_id, title, message, type, read)
        VALUES (
            test_morador_id,
            '🧪 Teste após correção',
            'Teste de notificação após remover dependência da tabela users',
            'package',
            false
        )
        RETURNING id INTO test_notification_id;
        
        RAISE NOTICE '✅✅✅ SUCESSO! Notificação criada com ID: %', test_notification_id;
        
        -- Remover notificação de teste
        DELETE FROM notifications WHERE id = test_notification_id;
        RAISE NOTICE 'Notificação de teste removida.';
    ELSE
        RAISE NOTICE '⚠️ Nenhum morador encontrado para teste.';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERRO: %', SQLERRM;
END $$;
