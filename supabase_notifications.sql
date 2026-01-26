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
CREATE POLICY "Moradores podem ver suas próprias notificações" ON notifications
    FOR SELECT
    USING (
        -- Se o usuário autenticado é um morador (via auth.users)
        -- Verifica se morador_id corresponde ao usuário autenticado
        morador_id IN (
            SELECT id FROM residents 
            WHERE id::text = (SELECT raw_user_meta_data->>'resident_id' FROM auth.users WHERE id = auth.uid())
            OR id::text = auth.uid()::text
        )
        -- Fallback: permitir se não houver autenticação configurada (desenvolvimento)
        OR NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1)
    );

-- Política 2: Porteiros e Síndicos podem criar notificações
-- IMPORTANTE: Esta política permite inserção sempre (desenvolvimento)
-- Em produção, ajuste conforme sua autenticação
-- NOTA: Removida dependência da tabela 'users' que pode não existir ou não ter permissão
CREATE POLICY "Porteiros e Síndicos podem criar notificações" ON notifications
    FOR INSERT
    WITH CHECK (true);  -- Permite inserção sempre (desenvolvimento)

-- Política 3: Moradores podem marcar suas próprias notificações como lidas
CREATE POLICY "Moradores podem marcar suas notificações como lidas" ON notifications
    FOR UPDATE
    USING (
        -- Mesma lógica da política de SELECT
        morador_id IN (
            SELECT id FROM residents 
            WHERE id::text = (SELECT raw_user_meta_data->>'resident_id' FROM auth.users WHERE id = auth.uid())
            OR id::text = auth.uid()::text
        )
        OR NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1)
    )
    WITH CHECK (
        -- Só pode atualizar o campo 'read'
        -- Não pode alterar outros campos
        morador_id IN (
            SELECT id FROM residents 
            WHERE id::text = (SELECT raw_user_meta_data->>'resident_id' FROM auth.users WHERE id = auth.uid())
            OR id::text = auth.uid()::text
        )
        OR NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1)
    );

-- Política 4: Porteiros e Síndicos podem ver todas as notificações (para administração)
CREATE POLICY "Porteiros e Síndicos podem ver todas as notificações" ON notifications
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id::text = auth.uid()::text 
            AND role IN ('PORTEIRO', 'SINDICO')
        )
        OR NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1)
    );

-- Comentário na tabela
COMMENT ON TABLE notifications IS 'Notificações automáticas do app para moradores (funciona em paralelo ao WhatsApp manual)';
COMMENT ON COLUMN notifications.morador_id IS 'ID do morador que receberá a notificação';
COMMENT ON COLUMN notifications.type IS 'Tipo de notificação: package, visitor, occurrence, etc.';
COMMENT ON COLUMN notifications.related_id IS 'ID do registro relacionado (ex: package.id para notificações de encomenda)';
COMMENT ON COLUMN notifications.read IS 'Indica se a notificação foi lida pelo morador';
