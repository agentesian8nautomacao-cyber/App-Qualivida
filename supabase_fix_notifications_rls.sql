-- ============================================
-- CORREÇÃO: Políticas RLS para notifications
-- ============================================
-- Execute este script se as notificações não estão sendo criadas
-- ============================================

-- Remover TODAS as políticas de INSERT existentes (pode haver duplicatas)
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

-- Recriar política de INSERT mais permissiva (para desenvolvimento)
-- Esta política permite inserção SEMPRE
CREATE POLICY "Porteiros e Síndicos podem criar notificações" ON notifications
    FOR INSERT
    WITH CHECK (true);  -- Permite inserção sempre

-- Verificar se a política foi criada
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'INSERT';

-- Teste: Tentar inserir uma notificação de teste
-- (Substitua 'MORADOR_ID_AQUI' por um ID real de morador)
/*
DO $$
DECLARE
    test_morador_id UUID;
BEGIN
    -- Pegar o primeiro morador disponível
    SELECT id INTO test_morador_id FROM residents LIMIT 1;
    
    IF test_morador_id IS NOT NULL THEN
        INSERT INTO notifications (morador_id, title, message, type, read)
        VALUES (
            test_morador_id,
            '🧪 Teste de Notificação',
            'Esta é uma notificação de teste para verificar se a inserção funciona.',
            'package',
            false
        );
        
        RAISE NOTICE 'Notificação de teste criada com sucesso!';
    ELSE
        RAISE NOTICE 'Nenhum morador encontrado para teste.';
    END IF;
END $$;
*/

-- Verificar notificações criadas
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;
