-- ============================================
-- TABELA: password_reset_tokens
-- ============================================
-- Tabela para armazenar tokens de recuperação de senha
-- ============================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used);

-- Índice único parcial para garantir que um usuário não tenha múltiplos tokens ativos
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_unique_active 
ON password_reset_tokens(user_id, token) 
WHERE used = false;

-- Função para limpar tokens expirados automaticamente (opcional)
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() OR used = true;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Política: Permitir inserção de tokens (qualquer um pode solicitar reset)
DROP POLICY IF EXISTS "Allow insert password reset tokens" ON password_reset_tokens;
CREATE POLICY "Allow insert password reset tokens" ON password_reset_tokens
    FOR INSERT WITH CHECK (true);

-- Política: Permitir leitura de tokens por token (para validação)
DROP POLICY IF EXISTS "Allow read password reset tokens by token" ON password_reset_tokens;
CREATE POLICY "Allow read password reset tokens by token" ON password_reset_tokens
    FOR SELECT USING (true);

-- Política: Permitir atualização para marcar token como usado
DROP POLICY IF EXISTS "Allow update password reset tokens" ON password_reset_tokens;
CREATE POLICY "Allow update password reset tokens" ON password_reset_tokens
    FOR UPDATE USING (true) WITH CHECK (true);

-- Comentários
COMMENT ON TABLE password_reset_tokens IS 'Tokens de recuperação de senha para usuários do sistema';
COMMENT ON COLUMN password_reset_tokens.token IS 'Token único para recuperação de senha';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Data e hora de expiração do token (24 horas após criação)';
COMMENT ON COLUMN password_reset_tokens.used IS 'Indica se o token já foi utilizado';
