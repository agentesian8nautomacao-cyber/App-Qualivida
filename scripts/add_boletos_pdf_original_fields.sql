-- ============================================
-- ADICIONAR CAMPOS PARA PDF ORIGINAL (REGRA DE OURO)
-- ============================================
-- Adiciona campos necessários para armazenar o PDF original imutável:
-- - pdf_original_path: Caminho do PDF original no storage (/boletos/original/uuid.pdf)
-- - checksum_pdf: Hash SHA-256 do PDF original para garantia de integridade
-- ============================================

-- Adicionar coluna pdf_original_path se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'boletos'
                   AND table_schema = 'public'
                   AND column_name = 'pdf_original_path') THEN
        ALTER TABLE public.boletos
        ADD COLUMN pdf_original_path TEXT;

        COMMENT ON COLUMN public.boletos.pdf_original_path IS 'Caminho do PDF original imutável no storage (ex: /boletos/original/uuid.pdf)';
    END IF;
END $$;

-- Adicionar coluna checksum_pdf se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'boletos'
                   AND table_schema = 'public'
                   AND column_name = 'checksum_pdf') THEN
        ALTER TABLE public.boletos
        ADD COLUMN checksum_pdf VARCHAR(128);

        COMMENT ON COLUMN public.boletos.checksum_pdf IS 'Hash SHA-256 do PDF original para verificação de integridade';
    END IF;
END $$;

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_boletos_pdf_original_path ON public.boletos(pdf_original_path);
CREATE INDEX IF NOT EXISTS idx_boletos_checksum_pdf ON public.boletos(checksum_pdf);

-- Atualizar comentários da tabela
COMMENT ON TABLE public.boletos IS 'Boletos condominiais por unidade/mês com PDF original imutável.';
COMMENT ON COLUMN public.boletos.pdf_original_path IS 'Caminho do PDF original imutável no storage - REGRA DE OURO: documento nunca alterado';
COMMENT ON COLUMN public.boletos.checksum_pdf IS 'Hash SHA-256 do PDF original para garantia de integridade no download';