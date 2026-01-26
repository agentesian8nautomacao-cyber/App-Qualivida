-- ============================================
-- TESTE SIMPLES: Verificar se inserção funciona
-- ============================================
-- Execute este script para testar se consegue inserir notificações
-- ============================================

-- 1. Verificar se há moradores
SELECT id, name, unit FROM residents LIMIT 3;

-- 2. Inserir notificação de teste (substitua 'ID_DO_MORADOR' pelo ID real do passo 1)
--    OU execute o bloco abaixo que pega automaticamente o primeiro morador:

DO $$
DECLARE
    test_morador_id UUID;
    test_notification_id UUID;
BEGIN
    -- Pegar o primeiro morador
    SELECT id INTO test_morador_id FROM residents LIMIT 1;
    
    IF test_morador_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum morador encontrado na tabela residents';
    END IF;
    
    RAISE NOTICE 'Morador selecionado para teste: %', test_morador_id;
    
    -- Tentar inserir notificação
    BEGIN
        INSERT INTO notifications (morador_id, title, message, type, read)
        VALUES (
            test_morador_id,
            '🧪 Teste de Notificação',
            'Esta é uma notificação de teste criada em ' || NOW()::text,
            'package',
            false
        )
        RETURNING id INTO test_notification_id;
        
        RAISE NOTICE '✅✅✅ SUCESSO! Notificação criada com ID: %', test_notification_id;
        
        -- NÃO REMOVER - deixar para verificação
        RAISE NOTICE 'Notificação mantida na tabela para verificação.';
        
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION '❌ ERRO ao inserir: % (Código: %)', SQLERRM, SQLSTATE;
    END;
END $$;

-- 3. Verificar se a notificação foi criada
SELECT 
    id,
    morador_id,
    title,
    message,
    type,
    read,
    created_at
FROM notifications 
ORDER BY created_at DESC 
LIMIT 5;

-- 4. Contar total de notificações
SELECT COUNT(*) as total_notifications FROM notifications;
