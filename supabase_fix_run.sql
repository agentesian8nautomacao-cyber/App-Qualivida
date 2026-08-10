-- ============================================
-- CORREÇÃO PARA BANCO JÁ EXISTENTE
-- ============================================
-- Execute no SQL Editor do Supabase se você obteve:
--   • "relation idx_residents_unit already exists"
--   • "column resident_id does not exist" (em notice_reads)
-- ============================================

-- 1. Recriar notice_reads com resident_id (alinhado ao app)
--    ATENÇÃO: Remove dados de "quem leu qual aviso". Execute só se precisar.
DROP TABLE IF EXISTS notice_reads CASCADE;
CREATE TABLE notice_reads (
    notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (notice_id, resident_id)
);
CREATE INDEX IF NOT EXISTS idx_notice_reads_notice ON notice_reads(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_reads_resident ON notice_reads(resident_id);

-- 2. Índices: usar IF NOT EXISTS evita "already exists".
--    O supabase_schema.sql já foi ajustado. Se você rodou uma versão antiga,
--    recrie apenas os que falharam, por exemplo:
-- CREATE INDEX IF NOT EXISTS idx_residents_unit ON residents(unit);
-- CREATE INDEX IF NOT EXISTS idx_residents_name ON residents(name);
-- (adiante os demais conforme o erro)

-- 3. Atualizar nomes das áreas (Salão de festas, Área gourmet)
UPDATE areas SET name = 'Salão de festas' WHERE name = 'SALÃO DE FESTAS CRYSTAL';
UPDATE areas SET name = 'Área gourmet' WHERE name = 'ESPAÇO GOURMET';
