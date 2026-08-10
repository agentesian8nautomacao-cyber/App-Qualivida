-- ============================================
-- FUNÇÕES AUXILIARES - APP QUALIVIDA
-- ============================================
-- Funções úteis para validações e operações comuns
-- IMPORTANTE: Execute este arquivo APÓS executar supabase_schema.sql
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
-- FUNÇÃO: Obter estatísticas do dashboard
-- ============================================
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
    pending_packages INTEGER,
    active_visitors INTEGER,
    open_occurrences INTEGER,
    upcoming_reservations INTEGER,
    active_notes INTEGER,
    new_notices INTEGER
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
         WHERE date >= NOW() - INTERVAL '24 hours') as new_notices;
END;
$$;

-- ============================================
-- TRIGGER: Atualizar cache de nome do morador em packages
-- ============================================
CREATE OR REPLACE FUNCTION update_package_recipient_cache()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.recipient_id IS NOT NULL THEN
        SELECT name, unit INTO NEW.recipient_name, NEW.unit
        FROM residents
        WHERE id = NEW.recipient_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_package_recipient_cache ON packages;
CREATE TRIGGER trigger_update_package_recipient_cache
    BEFORE INSERT OR UPDATE OF recipient_id ON packages
    FOR EACH ROW
    EXECUTE FUNCTION update_package_recipient_cache();

-- ============================================
-- TRIGGER: Atualizar cache de nome do morador em visitors
-- ============================================
CREATE OR REPLACE FUNCTION update_visitor_resident_cache()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.resident_id IS NOT NULL THEN
        SELECT name, unit INTO NEW.resident_name, NEW.unit
        FROM residents
        WHERE id = NEW.resident_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_visitor_resident_cache ON visitors;
CREATE TRIGGER trigger_update_visitor_resident_cache
    BEFORE INSERT OR UPDATE OF resident_id ON visitors
    FOR EACH ROW
    EXECUTE FUNCTION update_visitor_resident_cache();

-- ============================================
-- TRIGGER: Atualizar cache de nome do morador em occurrences
-- ============================================
CREATE OR REPLACE FUNCTION update_occurrence_resident_cache()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.resident_id IS NOT NULL THEN
        SELECT name, unit INTO NEW.resident_name, NEW.unit
        FROM residents
        WHERE id = NEW.resident_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_occurrence_resident_cache ON occurrences;
CREATE TRIGGER trigger_update_occurrence_resident_cache
    BEFORE INSERT OR UPDATE OF resident_id ON occurrences
    FOR EACH ROW
    EXECUTE FUNCTION update_occurrence_resident_cache();

-- ============================================
-- TRIGGER: Atualizar cache de nome do morador em reservations
-- ============================================
CREATE OR REPLACE FUNCTION update_reservation_resident_cache()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.resident_id IS NOT NULL THEN
        SELECT name, unit INTO NEW.resident_name, NEW.unit
        FROM residents
        WHERE id = NEW.resident_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_reservation_resident_cache ON reservations;
CREATE TRIGGER trigger_update_reservation_resident_cache
    BEFORE INSERT OR UPDATE OF resident_id ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_reservation_resident_cache();

-- ============================================
-- TRIGGER: Atualizar cache de nome do morador em crm_units
-- ============================================
CREATE OR REPLACE FUNCTION update_crm_unit_resident_cache()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.resident_id IS NOT NULL THEN
        SELECT name INTO NEW.resident_name
        FROM residents
        WHERE id = NEW.resident_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_crm_unit_resident_cache ON crm_units;
CREATE TRIGGER trigger_update_crm_unit_resident_cache
    BEFORE INSERT OR UPDATE OF resident_id ON crm_units
    FOR EACH ROW
    EXECUTE FUNCTION update_crm_unit_resident_cache();

-- ============================================
-- VIEW: Visão consolidada de encomendas pendentes
-- ============================================
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
    calculate_package_permanence(p.received_at) as permanence,
    COUNT(pi.id) as item_count
FROM packages p
LEFT JOIN package_items pi ON pi.package_id = p.id
WHERE p.status = 'Pendente'
GROUP BY p.id, p.recipient_name, p.unit, p.type, p.received_at, 
         p.display_time, p.deadline_minutes, p.resident_phone
ORDER BY p.received_at ASC;

-- ============================================
-- VIEW: Visão consolidada de visitantes ativos
-- ============================================
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

