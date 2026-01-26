-- ============================================
-- ADICIONAR COLUNA password_hash NA TABELA residents
-- ============================================
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Adicionar coluna password_hash se não existir
ALTER TABLE residents 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Verificar se foi criada
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'residents'
  AND column_name = 'password_hash';

-- Mensagem de sucesso
DO $$
BEGIN
    RAISE NOTICE '✓ Coluna password_hash adicionada com sucesso!';
END $$;
