-- ============================================
-- MIGRAÇÃO SEGURA: Adicionar autenticação para moradores
-- ============================================
-- Este script verifica antes de criar/modificar
-- Pode ser executado múltiplas vezes sem erros
-- ============================================

-- ============================================
-- 1. ADICIONAR COLUNA password_hash
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'residents' 
          AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE residents 
        ADD COLUMN password_hash VARCHAR(255);
        
        RAISE NOTICE 'Coluna password_hash criada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna password_hash já existe';
    END IF;
END $$;

-- ============================================
-- 2. CRIAR ÍNDICE (se não existir)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_residents_unit_upper ON residents(UPPER(unit));

-- ============================================
-- 3. FUNÇÃO: Verificar credenciais de morador
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
-- 4. FUNÇÃO: Atualizar senha do morador
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
-- 5. ADICIONAR COMENTÁRIOS
-- ============================================
COMMENT ON COLUMN residents.password_hash IS 'Hash da senha do morador para autenticação';
COMMENT ON FUNCTION verify_resident_credentials IS 'Verifica credenciais de morador (unit + password_hash)';
COMMENT ON FUNCTION update_resident_password IS 'Atualiza senha do morador';

-- ============================================
-- VERIFICAÇÃO FINAL
-- ============================================
DO $$
DECLARE
    col_exists BOOLEAN;
    func1_exists BOOLEAN;
    func2_exists BOOLEAN;
    idx_exists BOOLEAN;
BEGIN
    -- Verificar coluna
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'residents' 
          AND column_name = 'password_hash'
    ) INTO col_exists;
    
    -- Verificar funções
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name = 'verify_resident_credentials'
    ) INTO func1_exists;
    
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_name = 'update_resident_password'
    ) INTO func2_exists;
    
    -- Verificar índice
    SELECT EXISTS (
        SELECT 1 
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_residents_unit_upper'
    ) INTO idx_exists;
    
    -- Resultado
    RAISE NOTICE '========================================';
    RAISE NOTICE 'STATUS DA MIGRAÇÃO:';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Coluna password_hash: %', CASE WHEN col_exists THEN '✓ Existe' ELSE '✗ Faltando' END;
    RAISE NOTICE 'Função verify_resident_credentials: %', CASE WHEN func1_exists THEN '✓ Existe' ELSE '✗ Faltando' END;
    RAISE NOTICE 'Função update_resident_password: %', CASE WHEN func2_exists THEN '✓ Existe' ELSE '✗ Faltando' END;
    RAISE NOTICE 'Índice idx_residents_unit_upper: %', CASE WHEN idx_exists THEN '✓ Existe' ELSE '✗ Faltando' END;
    RAISE NOTICE '========================================';
    
    IF col_exists AND func1_exists AND func2_exists AND idx_exists THEN
        RAISE NOTICE '✓ MIGRAÇÃO COMPLETA!';
    ELSE
        RAISE NOTICE '⚠ Alguns itens estão faltando. Execute o script novamente.';
    END IF;
END $$;

-- ============================================
-- FIM DA MIGRAÇÃO
-- ============================================