-- ============================================
-- ADICIONAR CAMPO received_by_name NA TABELA packages
-- ============================================
-- Este script adiciona o campo received_by_name para identificar
-- qual porteiro recebeu a encomenda, permitindo que o morador saiba
-- quem recebeu sua encomenda através das notificações.

-- Adicionar coluna received_by_name se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'packages' 
        AND column_name = 'received_by_name'
    ) THEN
        ALTER TABLE packages 
        ADD COLUMN received_by_name VARCHAR(255) NULL;
        
        COMMENT ON COLUMN packages.received_by_name IS 'Nome do porteiro que recebeu a encomenda';
        
        RAISE NOTICE 'Coluna received_by_name adicionada com sucesso na tabela packages';
    ELSE
        RAISE NOTICE 'Coluna received_by_name já existe na tabela packages';
    END IF;
END $$;

-- Criar índice para melhorar performance em consultas
CREATE INDEX IF NOT EXISTS idx_packages_received_by_name ON packages(received_by_name);
