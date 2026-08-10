-- ============================================
-- ADICIONAR COLUNA boleto_type DE FORMA SEGURA
-- ============================================
-- Script seguro para adicionar a coluna boleto_type
-- sem recriar a tabela inteira
-- ============================================

-- Verificar se a coluna já existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'boletos'
          AND table_schema = 'public'
          AND column_name = 'boleto_type'
    ) THEN
        -- Adicionar coluna se não existir
        ALTER TABLE public.boletos
        ADD COLUMN boleto_type TEXT NOT NULL DEFAULT 'condominio'
        CHECK (boleto_type IN ('condominio', 'agua', 'luz'));

        -- Adicionar comentário
        COMMENT ON COLUMN public.boletos.boleto_type IS 'Tipo do boleto: condominio (taxa), agua ou luz.';

        -- Criar índice
        CREATE INDEX IF NOT EXISTS idx_boletos_boleto_type ON public.boletos(boleto_type);

        RAISE NOTICE 'Coluna boleto_type adicionada com sucesso à tabela boletos';
    ELSE
        RAISE NOTICE 'Coluna boleto_type já existe na tabela boletos';
    END IF;
END $$;

-- Verificar resultado
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'boletos'
  AND table_schema = 'public'
  AND column_name = 'boleto_type';