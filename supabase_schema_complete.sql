-- ============================================
-- SCHEMA COMPLETO DO BANCO DE DADOS - APP QUALIVIDA
-- ============================================
-- Este arquivo contém TODAS as tabelas necessárias
-- para o funcionamento completo do sistema de gestão condominial
-- Versão: 2.0 - Completo
-- ============================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- Necessário para constraint de exclusão em reservations

-- ============================================
-- TABELA: users (Usuários do Sistema)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('PORTEIRO', 'SINDICO')),
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- ============================================
-- TABELA: residents (Moradores)
-- ============================================
CREATE TABLE IF NOT EXISTS residents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    whatsapp VARCHAR(20),
    extra_data JSONB, -- Campos adicionais do arquivo de importação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_unit_name UNIQUE(unit, name)
);

CREATE INDEX idx_residents_unit ON residents(unit);
CREATE INDEX idx_residents_name ON residents(name);
CREATE INDEX idx_residents_email ON residents(email);

-- ============================================
-- TABELA: areas (Áreas Comuns)
-- ============================================
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    rules TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_areas_active ON areas(is_active);

-- ============================================
-- TABELA: reservations (Reservas)
-- ============================================
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
    resident_name VARCHAR(255) NOT NULL, -- Cache do nome
    unit VARCHAR(50) NOT NULL, -- Cache da unidade
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'canceled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reservations_area ON reservations(area_id);
CREATE INDEX idx_reservations_date ON reservations(date);
CREATE INDEX idx_reservations_resident ON reservations(resident_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_date_area ON reservations(date, area_id);

-- ============================================
-- TABELA: packages (Encomendas)
-- ============================================
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    recipient_name VARCHAR(255) NOT NULL, -- Cache do nome
    unit VARCHAR(50) NOT NULL, -- Cache da unidade
    type VARCHAR(100) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    display_time VARCHAR(10), -- Hora formatada para exibição
    status VARCHAR(20) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Entregue')),
    deadline_minutes INTEGER DEFAULT 45,
    resident_phone VARCHAR(20),
    delivered_at TIMESTAMP WITH TIME ZONE,
    delivered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    qr_code_data TEXT, -- Dados do QR code escaneado
    image_url TEXT, -- URL da imagem capturada pela câmera
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_packages_recipient ON packages(recipient_id);
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_received_at ON packages(received_at);
CREATE INDEX idx_packages_unit ON packages(unit);
CREATE INDEX idx_packages_type ON packages(type);

-- ============================================
-- TABELA: package_items (Itens das Encomendas)
-- ============================================
CREATE TABLE IF NOT EXISTS package_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_package_items_package ON package_items(package_id);

-- ============================================
-- TABELA: visitors (Visitantes)
-- ============================================
CREATE TABLE IF NOT EXISTS visitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    resident_name VARCHAR(255) NOT NULL, -- Cache do nome
    unit VARCHAR(50) NOT NULL, -- Cache da unidade
    visitor_count INTEGER DEFAULT 1,
    visitor_names TEXT, -- Nomes dos visitantes
    type VARCHAR(50) NOT NULL DEFAULT 'Visita', -- Visita, Prestador, Delivery
    doc VARCHAR(100), -- Documento do visitante
    vehicle VARCHAR(100), -- Tipo de veículo
    plate VARCHAR(20), -- Placa do veículo
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    exit_time TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    registered_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_visitors_resident ON visitors(resident_id);
CREATE INDEX idx_visitors_status ON visitors(status);
CREATE INDEX idx_visitors_entry_time ON visitors(entry_time);
CREATE INDEX idx_visitors_unit ON visitors(unit);
CREATE INDEX idx_visitors_type ON visitors(type);

-- ============================================
-- TABELA: occurrences (Ocorrências)
-- ============================================
CREATE TABLE IF NOT EXISTS occurrences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    resident_name VARCHAR(255) NOT NULL, -- Cache do nome
    unit VARCHAR(50) NOT NULL, -- Cache da unidade
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Em Andamento', 'Resolvido')),
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    reported_by VARCHAR(255) NOT NULL, -- Nome ou cargo de quem reportou
    reported_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_occurrences_resident ON occurrences(resident_id);
CREATE INDEX idx_occurrences_status ON occurrences(status);
CREATE INDEX idx_occurrences_date ON occurrences(date);
CREATE INDEX idx_occurrences_unit ON occurrences(unit);

-- ============================================
-- TABELA: notices (Avisos)
-- ============================================
CREATE TABLE IF NOT EXISTS notices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(255) NOT NULL,
    author_role VARCHAR(20) NOT NULL CHECK (author_role IN ('SINDICO', 'PORTEIRO', 'MORADOR')),
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    category VARCHAR(50) CHECK (category IN ('Urgente', 'Manutenção', 'Social', 'Institucional')),
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('high', 'normal')),
    pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notices_date ON notices(date);
CREATE INDEX idx_notices_pinned ON notices(pinned);
CREATE INDEX idx_notices_category ON notices(category);
CREATE INDEX idx_notices_author_role ON notices(author_role);
CREATE INDEX idx_notices_priority ON notices(priority);

-- ============================================
-- TABELA: notice_reads (Leitura de Avisos por Moradores)
-- ============================================
CREATE TABLE IF NOT EXISTS notice_reads (
    notice_id UUID NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
    resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (notice_id, resident_id)
);

CREATE INDEX idx_notice_reads_notice ON notice_reads(notice_id);
CREATE INDEX idx_notice_reads_resident ON notice_reads(resident_id);

-- ============================================
-- TABELA: chat_messages (Mensagens do Chat)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    text TEXT NOT NULL,
    sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('SINDICO', 'PORTEIRO', 'MORADOR')),
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    sender_name VARCHAR(255), -- Cache do nome do remetente
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX idx_chat_messages_read ON chat_messages(read);
CREATE INDEX idx_chat_messages_sender_role ON chat_messages(sender_role);

-- ============================================
-- TABELA: notes (Notas)
-- ============================================
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed BOOLEAN DEFAULT false,
    scheduled TIMESTAMP WITH TIME ZONE,
    category VARCHAR(100),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notes_completed ON notes(completed);
CREATE INDEX idx_notes_category ON notes(category);
CREATE INDEX idx_notes_scheduled ON notes(scheduled);
CREATE INDEX idx_notes_date ON notes(date);
CREATE INDEX idx_notes_created_by ON notes(created_by);

-- ============================================
-- TABELA: staff (Funcionários)
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Férias', 'Licença')),
    shift VARCHAR(20) NOT NULL DEFAULT 'Comercial' CHECK (shift IN ('Manhã', 'Tarde', 'Noite', 'Madrugada', 'Comercial')),
    phone VARCHAR(20),
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_staff_status ON staff(status);
CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_shift ON staff(shift);

-- ============================================
-- TABELA: boletos (Boletos)
-- ============================================
CREATE TABLE IF NOT EXISTS boletos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    resident_name VARCHAR(255) NOT NULL, -- Cache do nome
    unit VARCHAR(50) NOT NULL, -- Cache da unidade
    reference_month VARCHAR(7) NOT NULL, -- Ex: "01/2025"
    due_date DATE NOT NULL, -- Data de vencimento
    amount DECIMAL(10, 2) NOT NULL, -- Valor em reais
    status VARCHAR(20) NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Pago', 'Vencido')),
    barcode VARCHAR(100), -- Código de barras do boleto
    pdf_url TEXT, -- URL para download do PDF
    paid_date DATE, -- Data de pagamento
    description TEXT, -- Descrição adicional
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_unit_month UNIQUE(unit, reference_month)
);

CREATE INDEX idx_boletos_resident ON boletos(resident_id);
CREATE INDEX idx_boletos_unit ON boletos(unit);
CREATE INDEX idx_boletos_status ON boletos(status);
CREATE INDEX idx_boletos_due_date ON boletos(due_date);
CREATE INDEX idx_boletos_reference_month ON boletos(reference_month);

-- ============================================
-- TABELA: crm_units (Unidades do CRM)
-- ============================================
CREATE TABLE IF NOT EXISTS crm_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unit VARCHAR(50) NOT NULL UNIQUE,
    floor VARCHAR(50),
    resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
    resident_name VARCHAR(255) NOT NULL, -- Cache do nome
    status VARCHAR(20) NOT NULL DEFAULT 'calm' CHECK (status IN ('calm', 'warning', 'critical')),
    tags TEXT[], -- Array de tags: #Pet, #Idoso, #Festeiro
    last_incident TIMESTAMP WITH TIME ZONE,
    nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_crm_units_unit ON crm_units(unit);
CREATE INDEX idx_crm_units_status ON crm_units(status);
CREATE INDEX idx_crm_units_resident ON crm_units(resident_id);
CREATE INDEX idx_crm_units_tags ON crm_units USING GIN(tags);

-- ============================================
-- TABELA: crm_issues (Problemas do CRM)
-- ============================================
CREATE TABLE IF NOT EXISTS crm_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    involved_units TEXT[] NOT NULL, -- Array de unidades envolvidas
    severity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    status VARCHAR(20) NOT NULL DEFAULT 'analysis' CHECK (status IN ('analysis', 'mediation', 'legal', 'resolved')),
    description TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_crm_issues_status ON crm_issues(status);
CREATE INDEX idx_crm_issues_severity ON crm_issues(severity);
CREATE INDEX idx_crm_issues_updated_at ON crm_issues(updated_at);
CREATE INDEX idx_crm_issues_involved_units ON crm_issues USING GIN(involved_units);

-- ============================================
-- TABELA: app_config (Configurações do App)
-- ============================================
CREATE TABLE IF NOT EXISTS app_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    condominium_name VARCHAR(255) NOT NULL DEFAULT 'Qualivida',
    whatsapp_template_package_received TEXT,
    whatsapp_template_package_reminder TEXT,
    whatsapp_template_visitor_arrival TEXT,
    ai_name VARCHAR(100) DEFAULT 'Sentinela',
    ai_voice_gender VARCHAR(20) DEFAULT 'male' CHECK (ai_voice_gender IN ('male', 'female')),
    ai_voice_style VARCHAR(20) DEFAULT 'serious' CHECK (ai_voice_style IN ('serious', 'animated')),
    ai_external_instructions TEXT,
    theme VARCHAR(20) DEFAULT 'default' CHECK (theme IN ('default', 'alternative')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir configuração padrão
INSERT INTO app_config (id, condominium_name) 
VALUES (uuid_generate_v4(), 'Qualivida')
ON CONFLICT DO NOTHING;

-- ============================================
-- FUNÇÕES E TRIGGERS
-- ============================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_residents_updated_at BEFORE UPDATE ON residents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON areas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_visitors_updated_at BEFORE UPDATE ON visitors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_occurrences_updated_at BEFORE UPDATE ON occurrences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notices_updated_at BEFORE UPDATE ON notices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at BEFORE UPDATE ON chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_boletos_updated_at BEFORE UPDATE ON boletos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_units_updated_at BEFORE UPDATE ON crm_units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crm_issues_updated_at BEFORE UPDATE ON crm_issues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_config_updated_at BEFORE UPDATE ON app_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGERS PARA ATUALIZAR CACHE DE NOMES
-- ============================================

-- Trigger: Atualizar cache de nome do morador em packages
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

-- Trigger: Atualizar cache de nome do morador em visitors
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

-- Trigger: Atualizar cache de nome do morador em occurrences
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

-- Trigger: Atualizar cache de nome do morador em reservations
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

-- Trigger: Atualizar cache de nome do morador em boletos
CREATE OR REPLACE FUNCTION update_boleto_resident_cache()
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

DROP TRIGGER IF EXISTS trigger_update_boleto_resident_cache ON boletos;
CREATE TRIGGER trigger_update_boleto_resident_cache
    BEFORE INSERT OR UPDATE OF resident_id ON boletos
    FOR EACH ROW
    EXECUTE FUNCTION update_boleto_resident_cache();

-- Trigger: Atualizar cache de nome do morador em crm_units
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
-- DADOS INICIAIS (SEED)
-- ============================================

-- Inserir usuários padrão (senhas devem ser hasheadas na aplicação)
-- IMPORTANTE: Altere as senhas antes de colocar em produção!
INSERT INTO users (username, password_hash, role, name, email) VALUES
    ('portaria', '$2a$10$placeholder_hash_here', 'PORTEIRO', 'Porteiro', NULL),
    ('admin', '$2a$10$placeholder_hash_here', 'SINDICO', 'Síndico', NULL),
    ('desenvolvedor', '$2a$10$placeholder_hash_here', 'SINDICO', 'Desenvolvedor', 'dev@qualivida.com')
ON CONFLICT (username) DO NOTHING;

-- Inserir áreas comuns padrão
INSERT INTO areas (name, capacity, rules) VALUES
    ('SALÃO DE FESTAS CRYSTAL', 80, 'Fechar às 23h • Proibido som externo'),
    ('ESPAÇO GOURMET', 30, 'Limpeza inclusa na taxa'),
    ('CHURRASQUEIRA ROOFTOP', 20, 'Máximo 20 pessoas'),
    ('ACADEMIA', 15, 'Apenas moradores')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================
-- IMPORTANTE: Configure as políticas RLS conforme necessário
-- para segurança dos dados no Supabase antes de colocar em produção

-- Habilitar RLS em todas as tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE boletos ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajuste conforme sua necessidade de segurança)
-- NOTA: As políticas abaixo permitem tudo para usuários autenticados
-- Você deve ajustar essas políticas conforme suas necessidades de segurança

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON residents;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON packages;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON visitors;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON occurrences;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON notices;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON notes;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON boletos;

-- Políticas para users (apenas administradores podem ver/modificar)
-- NOTA: Esta política pode não funcionar sem autenticação configurada. Ajuste conforme necessário.
CREATE POLICY "Users can view all" ON users FOR SELECT 
    USING (true);

CREATE POLICY "Users can insert all" ON users FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Users can update all" ON users FOR UPDATE 
    USING (true);

CREATE POLICY "Users can delete all" ON users FOR DELETE 
    USING (true);

-- Políticas básicas para outras tabelas (permitir tudo temporariamente)
-- IMPORTANTE: Revise e ajuste essas políticas antes de produção
CREATE POLICY "Enable all operations for authenticated users" ON residents 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users" ON packages 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users" ON visitors 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users" ON occurrences 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users" ON notices 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users" ON notes 
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all operations for authenticated users" ON boletos 
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- COMENTÁRIOS NAS TABELAS
-- ============================================
COMMENT ON TABLE users IS 'Usuários do sistema (Porteiro e Síndico)';
COMMENT ON TABLE residents IS 'Moradores do condomínio';
COMMENT ON TABLE areas IS 'Áreas comuns disponíveis para reserva';
COMMENT ON TABLE reservations IS 'Reservas de áreas comuns';
COMMENT ON TABLE packages IS 'Encomendas recebidas na portaria';
COMMENT ON TABLE package_items IS 'Itens detalhados das encomendas';
COMMENT ON TABLE visitors IS 'Registro de visitantes';
COMMENT ON TABLE occurrences IS 'Ocorrências e problemas reportados';
COMMENT ON TABLE notices IS 'Avisos e comunicados';
COMMENT ON TABLE notice_reads IS 'Registro de leitura de avisos por moradores';
COMMENT ON TABLE chat_messages IS 'Mensagens do chat interno';
COMMENT ON TABLE notes IS 'Notas operacionais do porteiro';
COMMENT ON TABLE staff IS 'Funcionários do condomínio';
COMMENT ON TABLE boletos IS 'Boletos de condomínio';
COMMENT ON TABLE crm_units IS 'Unidades do sistema CRM';
COMMENT ON TABLE crm_issues IS 'Problemas e conflitos do CRM';
COMMENT ON TABLE app_config IS 'Configurações gerais do aplicativo';

-- ============================================
-- FIM DO SCHEMA
-- ============================================