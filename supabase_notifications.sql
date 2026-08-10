-- ============================================
-- TABELA: notifications (Notificações do App)
-- ============================================
-- Tabela para notificações automáticas no app
-- Funciona em paralelo ao sistema de WhatsApp manual
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    morador_id UUID REFERENCES residents(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'package', -- 'package', 'visitor', 'occurrence', etc.
    related_id UUID, -- ID do registro relacionado (ex: package.id)
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_morador_id ON notifications(morador_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_related_id ON notifications(related_id);

-- Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Moradores podem ver suas próprias notificações" ON notifications;
DROP POLICY IF EXISTS "Porteiros e Síndicos podem criar notificações" ON notifications;
DROP POLICY IF EXISTS "Moradores podem marcar suas notificações como lidas" ON notifications;
DROP POLICY IF EXISTS "Porteiros e Síndicos podem ver todas as notificações" ON notifications;

-- Política 1: Moradores só podem ver suas próprias notificações
-- NOTA: Simplificada para não depender de auth.users ou users
-- Em produção, ajuste conforme sua autenticação
CREATE POLICY "Moradores podem ver suas próprias notificações" ON notifications
    FOR SELECT
    USING (true);  -- Permite leitura sempre (desenvolvimento)
    -- Em produção, implemente verificação adequada baseada em autenticação

-- Política 2: Porteiros e Síndicos podem criar notificações
-- IMPORTANTE: Esta política permite inserção sempre (desenvolvimento)
-- Em produção, ajuste conforme sua autenticação
-- NOTA: Removida dependência da tabela 'users' que pode não existir ou não ter permissão
CREATE POLICY "Porteiros e Síndicos podem criar notificações" ON notifications
    FOR INSERT
    WITH CHECK (true);  -- Permite inserção sempre (desenvolvimento)

-- Política 3: Moradores podem marcar suas próprias notificações como lidas
-- NOTA: Simplificada para não depender de auth.users
-- Em produção, ajuste conforme sua autenticação
CREATE POLICY "Moradores podem marcar suas notificações como lidas" ON notifications
    FOR UPDATE
    USING (true)  -- Permite atualização sempre (desenvolvimento)
    WITH CHECK (true);

-- Política 4: Moradores podem excluir suas próprias notificações (obrigatório para o botão "Excluir" funcionar)
DROP POLICY IF EXISTS "Moradores podem excluir suas notificações" ON notifications;
CREATE POLICY "Moradores podem excluir suas notificações" ON notifications
    FOR DELETE
    USING (true);  -- Permite exclusão (em produção restrinja por morador_id se usar auth)

-- Política 5: Porteiros e Síndicos podem ver todas as notificações (para administração)
-- NOTA: Simplificada para não depender de users
-- Em produção, ajuste conforme sua autenticação
-- Esta política é redundante se a política 1 permite tudo, mas mantida para clareza
-- CREATE POLICY "Porteiros e Síndicos podem ver todas as notificações" ON notifications
--     FOR SELECT
--     USING (true);  -- Já coberto pela política 1

-- Comentário na tabela
COMMENT ON TABLE notifications IS 'Notificações automáticas do app para moradores (funciona em paralelo ao WhatsApp manual)';
COMMENT ON COLUMN notifications.morador_id IS 'ID do morador que receberá a notificação';
COMMENT ON COLUMN notifications.type IS 'Tipo de notificação: package, visitor, occurrence, etc.';
COMMENT ON COLUMN notifications.related_id IS 'ID do registro relacionado (ex: package.id para notificações de encomenda)';
COMMENT ON COLUMN notifications.read IS 'Indica se a notificação foi lida pelo morador';
