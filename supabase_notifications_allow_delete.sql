-- ============================================
-- CORREÇÃO: Permitir DELETE em notifications (RLS)
-- ============================================
-- Execute este script no Supabase SQL Editor se as notificações
-- não estão sendo excluídas quando o morador clica em "Excluir".
-- Sem esta política, o DELETE é bloqueado pelo RLS e as notificações
-- voltam a aparecer após refresh/login.
-- ============================================

DROP POLICY IF EXISTS "Moradores podem excluir suas notificações" ON notifications;

CREATE POLICY "Moradores podem excluir suas notificações" ON notifications
    FOR DELETE
    USING (true);

-- Verificar: listar políticas da tabela
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'notifications';
