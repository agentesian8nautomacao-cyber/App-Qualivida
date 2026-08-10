-- ============================================
-- ADICIONAR CAMPOS DE IDENTIFICAÇÃO PARA BOLETOS IMPORTADOS
-- ============================================
-- Adiciona campos necessários para identificar boletos importados:
-- - unidade_id: ID da unidade (referência para tabela de unidades)
-- - nosso_numero: Nosso número do boleto
-- ============================================

-- Adicionar coluna unidade_id se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'boletos'
                   AND column_name = 'unidade_id') THEN
        ALTER TABLE public.boletos
        ADD COLUMN unidade_id VARCHAR(100);

        COMMENT ON COLUMN public.boletos.unidade_id IS 'ID da unidade para boletos importados';
    END IF;
END $$;

-- Adicionar coluna nosso_numero se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'boletos'
                   AND column_name = 'nosso_numero') THEN
        ALTER TABLE public.boletos
        ADD COLUMN nosso_numero VARCHAR(50);

        COMMENT ON COLUMN public.boletos.nosso_numero IS 'Nosso número do boleto para identificação';
    END IF;
END $$;

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_boletos_unidade_id ON public.boletos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_boletos_nosso_numero ON public.boletos(nosso_numero);

-- Atualizar comentários da tabela
COMMENT ON TABLE public.boletos IS 'Boletos condominiais por unidade/mês com campos para identificação de importação.';
COMMENT ON COLUMN public.boletos.resident_id IS 'ID do morador (referência para tabela residents)';
COMMENT ON COLUMN public.boletos.unidade_id IS 'ID da unidade para boletos importados';
COMMENT ON COLUMN public.boletos.nosso_numero IS 'Nosso número do boleto para identificação única';