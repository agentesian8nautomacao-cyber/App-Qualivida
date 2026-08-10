-- ============================================
-- MIGRAÇÃO: Adicionar autenticação para moradores
-- ============================================
-- Este script adiciona o campo password_hash na tabela residents
-- e cria funções auxiliares para autenticação
-- ============================================

-- Adicionar coluna password_hash na tabela residents
ALTER TABLE residents 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Criar índice para buscas por unidade (já deve existir, mas garantindo)
CREATE INDEX IF NOT EXISTS idx_residents_unit_upper ON residents(UPPER(unit));

-- ============================================
-- FUNÇÃO: Verificar credenciais de morador
-- ============================================
CREATE OR REPLACE FUNCTION verify_resident_credentials(
    p_unit VARCHAR,
    p_password_hash VARCHAR
)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    unit VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    whatsapp VARCHAR
)
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.name,
        r.unit,
        COALESCE(r.email, '') as email,
        COALESCE(r.phone, '') as phone,
        COALESCE(r.whatsapp, '') as whatsapp
    FROM residents r
    WHERE UPPER(r.unit) = UPPER(p_unit)
      AND r.password_hash = p_password_hash
      AND r.password_hash IS NOT NULL;
END;
$$;

-- ============================================
-- FUNÇÃO: Atualizar senha do morador
-- ============================================
CREATE OR REPLACE FUNCTION update_resident_password(
    p_resident_id UUID,
    p_new_password_hash VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
    UPDATE residents
    SET password_hash = p_new_password_hash,
        updated_at = NOW()
    WHERE id = p_resident_id;
    
    RETURN FOUND;
END;
$$;

-- ============================================
-- COMENTÁRIOS
-- ============================================
COMMENT ON COLUMN residents.password_hash IS 'Hash da senha do morador para autenticação';
COMMENT ON FUNCTION verify_resident_credentials IS 'Verifica credenciais de morador (unit + password_hash)';
COMMENT ON FUNCTION update_resident_password IS 'Atualiza senha do morador';

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================