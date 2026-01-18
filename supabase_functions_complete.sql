-- ============================================
-- FUNÇÕES COMPLETAS - APP QUALIVIDA
-- ============================================
-- Funções úteis para validações e operações comuns
-- 
-- ⚠️ IMPORTANTE: 
-- 1. Execute PRIMEIRO: supabase_schema_complete.sql
-- 2. Execute DEPOIS: este arquivo (supabase_functions_complete.sql)
-- 
-- As views e funções aqui dependem das tabelas criadas no schema!
-- ============================================

-- Garantir que estamos usando o schema public
SET search_path TO public, pg_catalog;

-- ============================================
-- FUNÇÃO: Verificar conflito de horário em reservas
-- ============================================
CREATE OR REPLACE FUNCTION check_reservation_conflict(
    p_area_id UUID,
    p_date DATE,
    p_start_time TIME,
    p_end_time TIME,
    p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    conflict_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM reservations
    WHERE area_id = p_area_id
      AND date = p_date
      AND status NOT IN ('canceled', 'completed')
      AND (id != p_exclude_id OR p_exclude_id IS NULL)
      AND (
          (start_time < p_end_time AND end_time > p_start_time)
      );
    
    RETURN conflict_count = 0;
END;
$$;

-- ============================================
-- FUNÇÃO: Calcular permanência de encomenda
-- ============================================
CREATE OR REPLACE FUNCTION calculate_package_permanence(p_received_at TIMESTAMP WITH TIME ZONE)
RETURNS TEXT 
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    diff_interval INTERVAL;
    total_minutes INTEGER;
    hours INTEGER;
    days INTEGER;
    remaining_hours INTEGER;
    remaining_minutes INTEGER;
BEGIN
    diff_interval := NOW() - p_received_at;
    total_minutes := EXTRACT(EPOCH FROM diff_interval)::INTEGER / 60;
    
    IF total_minutes < 60 THEN
        RETURN total_minutes || ' min';
    END IF;
    
    hours := total_minutes / 60;
    remaining_minutes := total_minutes % 60;
    
    IF hours < 24 THEN
        RETURN hours || 'h ' || remaining_minutes || 'min';
    END IF;
    
    days := hours / 24;
    remaining_hours := hours % 24;
    
    RETURN days || 'd ' || remaining_hours || 'h';
END;
$$;

-- ============================================
-- FUNÇÃO: Calcular permanência de visitante
-- ============================================
CREATE OR REPLACE FUNCTION calculate_visitor_permanence(
    p_entry_time TIMESTAMP WITH TIME ZONE,
    p_exit_time TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TEXT 
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    end_time TIMESTAMP WITH TIME ZONE;
    diff_interval INTERVAL;
    total_minutes INTEGER;
    hours INTEGER;
    days INTEGER;
    remaining_hours INTEGER;
    remaining_minutes INTEGER;
BEGIN
    end_time := COALESCE(p_exit_time, NOW());
    diff_interval := end_time - p_entry_time;
    total_minutes := EXTRACT(EPOCH FROM diff_interval)::INTEGER / 60;
    
    IF total_minutes < 60 THEN
        RETURN total_minutes || ' min';
    END IF;
    
    hours := total_minutes / 60;
    remaining_minutes := total_minutes % 60;
    
    IF hours < 24 THEN
        RETURN hours || 'h ' || remaining_minutes || 'min';
    END IF;
    
    days := hours / 24;
    remaining_hours := hours % 24;
    
    RETURN days || 'd ' || remaining_hours || 'h';
END;
$$;

-- ============================================
-- FUNÇÃO: Verificar se boleto está vencido
-- ============================================
CREATE OR REPLACE FUNCTION check_boleto_status(p_due_date DATE, p_status VARCHAR)
RETURNS VARCHAR
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF p_status = 'Pago' THEN
        RETURN 'Pago';
    END IF;
    
    IF p_due_date < CURRENT_DATE THEN
        RETURN 'Vencido';
    END IF;
    
    RETURN 'Pendente';
END;
$$;

-- ============================================
-- FUNÇÃO: Atualizar status de boletos vencidos
-- ============================================
CREATE OR REPLACE FUNCTION update_expired_boletos()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE boletos
    SET status = 'Vencido',
        updated_at = NOW()
    WHERE status = 'Pendente'
      AND due_date < CURRENT_DATE;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- ============================================
-- FUNÇÃO: Obter estatísticas do dashboard
-- ============================================
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
    pending_packages INTEGER,
    active_visitors INTEGER,
    open_occurrences INTEGER,
    upcoming_reservations INTEGER,
    active_notes INTEGER,
    new_notices INTEGER,
    pending_boletos INTEGER,
    expired_boletos INTEGER
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM packages WHERE status = 'Pendente') as pending_packages,
        (SELECT COUNT(*)::INTEGER FROM visitors WHERE status = 'active') as active_visitors,
        (SELECT COUNT(*)::INTEGER FROM occurrences WHERE status = 'Aberto') as open_occurrences,
        (SELECT COUNT(*)::INTEGER FROM reservations 
         WHERE date = CURRENT_DATE 
         AND status IN ('scheduled', 'active')) as upcoming_reservations,
        (SELECT COUNT(*)::INTEGER FROM notes WHERE completed = false) as active_notes,
        (SELECT COUNT(*)::INTEGER FROM notices 
         WHERE date >= NOW() - INTERVAL '24 hours') as new_notices,
        (SELECT COUNT(*)::INTEGER FROM boletos WHERE status = 'Pendente') as pending_boletos,
        (SELECT COUNT(*)::INTEGER FROM boletos WHERE status = 'Vencido') as expired_boletos;
END;
$$;

-- ============================================
-- FUNÇÃO: Buscar morador por QR code
-- ============================================
CREATE OR REPLACE FUNCTION find_resident_by_qr(qr_data TEXT)
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
AS $$
DECLARE
    parsed_data JSONB;
BEGIN
    -- Tentar parsear como JSON
    BEGIN
        parsed_data := qr_data::JSONB;
        
        -- Buscar por unidade ou ID
        IF parsed_data ? 'unit' THEN
            RETURN QUERY
            SELECT r.id, r.name, r.unit, r.email, r.phone, r.whatsapp
            FROM residents r
            WHERE r.unit = parsed_data->>'unit';
        ELSIF parsed_data ? 'id' THEN
            RETURN QUERY
            SELECT r.id, r.name, r.unit, r.email, r.phone, r.whatsapp
            FROM residents r
            WHERE r.id::text = parsed_data->>'id';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Se não for JSON, buscar por unidade direta ou nome
        RETURN QUERY
        SELECT r.id, r.name, r.unit, r.email, r.phone, r.whatsapp
        FROM residents r
        WHERE r.unit = qr_data
           OR r.name ILIKE '%' || qr_data || '%';
    END;
END;
$$;

-- ============================================
-- VIEW: Visão consolidada de encomendas pendentes
-- ============================================
-- Nota: Esta view requer que a tabela packages exista
-- Certifique-se de executar supabase_schema_complete.sql primeiro
DROP VIEW IF EXISTS v_pending_packages CASCADE;
CREATE OR REPLACE VIEW v_pending_packages AS
SELECT 
    p.id,
    p.recipient_name,
    p.unit,
    p.type,
    p.received_at,
    p.display_time,
    p.deadline_minutes,
    p.resident_phone,
    p.qr_code_data,
    p.image_url,
    calculate_package_permanence(p.received_at) as permanence,
    COUNT(pi.id) as item_count
FROM packages p
LEFT JOIN package_items pi ON pi.package_id = p.id
WHERE p.status = 'Pendente'
GROUP BY p.id, p.recipient_name, p.unit, p.type, p.received_at, 
         p.display_time, p.deadline_minutes, p.resident_phone,
         p.qr_code_data, p.image_url
ORDER BY p.received_at ASC;

-- ============================================
-- VIEW: Visão consolidada de visitantes ativos
-- ============================================
DROP VIEW IF EXISTS v_active_visitors CASCADE;
CREATE OR REPLACE VIEW v_active_visitors AS
SELECT 
    v.id,
    v.resident_name,
    v.unit,
    v.visitor_count,
    v.visitor_names,
    v.type,
    v.entry_time,
    calculate_visitor_permanence(v.entry_time) as permanence,
    r.phone as resident_phone,
    r.whatsapp as resident_whatsapp
FROM visitors v
LEFT JOIN residents r ON r.id = v.resident_id
WHERE v.status = 'active'
ORDER BY v.entry_time ASC;

-- ============================================
-- VIEW: Visão consolidada de ocorrências abertas
-- ============================================
DROP VIEW IF EXISTS v_open_occurrences CASCADE;
CREATE OR REPLACE VIEW v_open_occurrences AS
SELECT 
    o.id,
    o.resident_name,
    o.unit,
    o.description,
    o.status,
    o.date,
    o.reported_by,
    r.phone as resident_phone,
    r.email as resident_email
FROM occurrences o
LEFT JOIN residents r ON r.id = o.resident_id
WHERE o.status IN ('Aberto', 'Em Andamento')
ORDER BY o.date DESC;

-- ============================================
-- VIEW: Visão consolidada de reservas do dia
-- ============================================
DROP VIEW IF EXISTS v_today_reservations CASCADE;
CREATE OR REPLACE VIEW v_today_reservations AS
SELECT 
    r.id,
    r.resident_name,
    r.unit,
    a.name as area_name,
    a.capacity,
    r.date,
    r.start_time,
    r.end_time,
    r.status,
    CONCAT(TO_CHAR(r.start_time, 'HH24:MI'), ' - ', TO_CHAR(r.end_time, 'HH24:MI')) as time_range
FROM reservations r
JOIN areas a ON a.id = r.area_id
WHERE r.date = CURRENT_DATE
ORDER BY r.start_time ASC;

-- ============================================
-- VIEW: Visão consolidada de boletos pendentes e vencidos
-- ============================================
DROP VIEW IF EXISTS v_pending_boletos CASCADE;
CREATE OR REPLACE VIEW v_pending_boletos AS
SELECT 
    b.id,
    b.resident_name,
    b.unit,
    b.reference_month,
    b.due_date,
    b.amount,
    b.status,
    b.barcode,
    b.pdf_url,
    b.description,
    CASE 
        WHEN b.due_date < CURRENT_DATE AND b.status = 'Pendente' THEN true
        ELSE false
    END as is_expired,
    CURRENT_DATE - b.due_date as days_past_due
FROM boletos b
WHERE b.status IN ('Pendente', 'Vencido')
ORDER BY b.due_date ASC;

-- ============================================
-- TRIGGER: Atualizar status de boletos vencidos automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION auto_update_boleto_status()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    -- Verificar se o boleto está vencido ao inserir ou atualizar
    IF NEW.status = 'Pendente' AND NEW.due_date < CURRENT_DATE THEN
        NEW.status := 'Vencido';
    END IF;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_update_boleto_status ON boletos;
CREATE TRIGGER trigger_auto_update_boleto_status
    BEFORE INSERT OR UPDATE OF due_date, status ON boletos
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_boleto_status();

-- ============================================
-- FUNÇÃO: Obter pacotes por morador
-- ============================================
CREATE OR REPLACE FUNCTION get_packages_by_resident(p_resident_id UUID)
RETURNS TABLE (
    id UUID,
    recipient_name VARCHAR,
    unit VARCHAR,
    type VARCHAR,
    received_at TIMESTAMP WITH TIME ZONE,
    display_time VARCHAR,
    status VARCHAR,
    deadline_minutes INTEGER,
    permanence TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.recipient_name,
        p.unit,
        p.type,
        p.received_at,
        p.display_time,
        p.status,
        p.deadline_minutes,
        calculate_package_permanence(p.received_at) as permanence
    FROM packages p
    WHERE p.recipient_id = p_resident_id
    ORDER BY p.received_at DESC;
END;
$$;

-- ============================================
-- FUNÇÃO: Obter boletos por morador
-- ============================================
CREATE OR REPLACE FUNCTION get_boletos_by_resident(p_resident_id UUID)
RETURNS TABLE (
    id UUID,
    resident_name VARCHAR,
    unit VARCHAR,
    reference_month VARCHAR,
    due_date DATE,
    amount DECIMAL,
    status VARCHAR,
    barcode VARCHAR,
    pdf_url TEXT,
    is_expired BOOLEAN
)
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.resident_name,
        b.unit,
        b.reference_month,
        b.due_date,
        b.amount,
        b.status,
        b.barcode,
        b.pdf_url,
        (b.due_date < CURRENT_DATE AND b.status = 'Pendente') as is_expired
    FROM boletos b
    WHERE b.resident_id = p_resident_id
    ORDER BY b.reference_month DESC;
END;
$$;

-- ============================================
-- FIM DAS FUNÇÕES
-- ============================================