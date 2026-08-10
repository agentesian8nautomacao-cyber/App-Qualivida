-- ============================================
-- CRIAR TABELA public.boletos (se não existir)
-- ============================================
-- O app usa esta tabela na tela Boletos (síndico/morador).
-- Execute no Supabase: SQL Editor → New query → Run.
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.boletos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
    resident_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    reference_month VARCHAR(20) NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'Pendente'
        CHECK (status IN ('Pendente', 'Pago', 'Vencido')),
    barcode VARCHAR(255),
    pdf_url TEXT,
    paid_date DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boletos_resident ON public.boletos(resident_id);
CREATE INDEX IF NOT EXISTS idx_boletos_unit ON public.boletos(unit);
CREATE INDEX IF NOT EXISTS idx_boletos_due_date ON public.boletos(due_date);
CREATE INDEX IF NOT EXISTS idx_boletos_status ON public.boletos(status);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_boletos_updated_at ON public.boletos;
CREATE TRIGGER update_boletos_updated_at
    BEFORE UPDATE ON public.boletos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: marcar como Vencido quando due_date < hoje e status = Pendente
CREATE OR REPLACE FUNCTION auto_update_boleto_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF NEW.status = 'Pendente' AND NEW.due_date < CURRENT_DATE THEN
        NEW.status := 'Vencido';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_update_boleto_status ON public.boletos;
CREATE TRIGGER trigger_auto_update_boleto_status
    BEFORE INSERT OR UPDATE OF due_date, status ON public.boletos
    FOR EACH ROW EXECUTE FUNCTION auto_update_boleto_status();

-- RLS
ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read boletos" ON public.boletos;
CREATE POLICY "Allow read boletos" ON public.boletos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert boletos" ON public.boletos;
CREATE POLICY "Allow insert boletos" ON public.boletos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow update boletos" ON public.boletos;
CREATE POLICY "Allow update boletos" ON public.boletos FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow delete boletos" ON public.boletos;
CREATE POLICY "Allow delete boletos" ON public.boletos FOR DELETE USING (true);

COMMENT ON TABLE public.boletos IS 'Boletos condominiais por unidade/mês.';
