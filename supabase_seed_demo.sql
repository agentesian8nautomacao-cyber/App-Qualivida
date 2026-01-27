-- ============================================
-- SEED DEMO - Dados iniciais para demonstração
-- ============================================
-- Execute no Supabase SQL Editor após rodar o schema e migrations.
-- Ajuste os UUIDs se já existirem registros (ex.: residents, areas).
-- ============================================

-- Moradores demo (evite conflito de PK se já existir; ajuste IDs se necessário)
INSERT INTO residents (id, name, unit, email, phone, whatsapp)
VALUES
  ('a0000001-0000-4000-8000-000000000001', 'Maria Silva', '101', 'maria.silva@demo.com', '11999990001', '5511999990001'),
  ('a0000001-0000-4000-8000-000000000002', 'João Santos', '102', 'joao.santos@demo.com', '11999990002', '5511999990002'),
  ('a0000001-0000-4000-8000-000000000003', 'Ana Oliveira', '201', 'ana.oliveira@demo.com', '11999990003', '5511999990003'),
  ('a0000001-0000-4000-8000-000000000004', 'Pedro Costa', '202', 'pedro.costa@demo.com', '11999990004', '5511999990004')
ON CONFLICT (id) DO NOTHING;

-- Áreas comuns
INSERT INTO areas (id, name, capacity, rules, is_active)
VALUES
  ('b0000001-0000-4000-8000-000000000001', 'Churrasqueira', 20, 'Uso até 22h. Limpeza obrigatória.', true),
  ('b0000001-0000-4000-8000-000000000002', 'Salão de Festas', 50, 'Reserva com 48h de antecedência.', true)
ON CONFLICT (name) DO NOTHING;

-- Encomendas demo (ajuste resident_id se usar outros IDs)
INSERT INTO packages (recipient_id, recipient_name, unit, type, received_at, display_time, status, deadline_minutes)
VALUES
  ('a0000001-0000-4000-8000-000000000001', 'Maria Silva', '101', 'Amazon', NOW() - INTERVAL '2 hours', '14:30', 'Pendente', 45),
  ('a0000001-0000-4000-8000-000000000002', 'João Santos', '102', 'Mercado Livre', NOW() - INTERVAL '30 minutes', '15:00', 'Pendente', 45),
  ('a0000001-0000-4000-8000-000000000003', 'Ana Oliveira', '201', 'iFood', NOW() - INTERVAL '1 day', '12:00', 'Entregue', 45);

-- Reservas demo (ajuste area_id e resident_id conforme suas áreas/residents)
INSERT INTO reservations (area_id, resident_id, resident_name, unit, date, start_time, end_time, status)
SELECT
  'b0000001-0000-4000-8000-000000000001',
  'a0000001-0000-4000-8000-000000000001',
  'Maria Silva',
  '101',
  CURRENT_DATE + 1,
  '18:00',
  '22:00',
  'scheduled'
WHERE EXISTS (SELECT 1 FROM areas WHERE id = 'b0000001-0000-4000-8000-000000000001')
  AND EXISTS (SELECT 1 FROM residents WHERE id = 'a0000001-0000-4000-8000-000000000001');

-- Ocorrências demo
INSERT INTO occurrences (resident_name, unit, description, status, date, reported_by)
VALUES
  ('Sistema', 'N/A', 'Lâmpada queimada no corredor do 2º andar.', 'Aberto', NOW(), 'Porteiro'),
  ('João Santos', '102', 'Vazamento no banheiro do 102.', 'Aberto', NOW(), 'Morador');

-- Notas operacionais demo
INSERT INTO notes (content, date, completed, category)
VALUES
  ('Conferir estoque de chaves sobressalentes.', NOW(), false, 'Manutenção'),
  ('Lembrete: Assembléia dia 15.', NOW(), false, 'Geral');
