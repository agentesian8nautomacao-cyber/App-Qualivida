-- ============================================
-- Adicionar coluna boleto_type (Condomínio, Água, Luz)
-- ============================================
-- Execute no Supabase: SQL Editor → New query → Run.
-- Permite diferenciar taxas de condomínio, boletos de água e de luz na mesma tela.
-- ============================================

ALTER TABLE public.boletos
ADD COLUMN IF NOT EXISTS boleto_type TEXT NOT NULL DEFAULT 'condominio'
CHECK (boleto_type IN ('condominio', 'agua', 'luz'));

COMMENT ON COLUMN public.boletos.boleto_type IS 'Tipo do boleto: condominio (taxa), agua ou luz.';

CREATE INDEX IF NOT EXISTS idx_boletos_boleto_type ON public.boletos(boleto_type);
