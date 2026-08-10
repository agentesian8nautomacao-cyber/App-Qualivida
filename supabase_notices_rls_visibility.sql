-- ============================================
-- MURAL DE AVISOS: RLS e visibilidade para todos os perfis
-- ============================================
-- Garante que avisos criados por moradores sejam visíveis para
-- portaria e síndico. Ajusta author_role para incluir MORADOR.
-- ============================================

-- 1. Permitir author_role = 'MORADOR' na tabela notices
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'notices' AND constraint_name = 'notices_author_role_check'
  ) THEN
    ALTER TABLE notices DROP CONSTRAINT notices_author_role_check;
  END IF;
  ALTER TABLE notices ADD CONSTRAINT notices_author_role_check
    CHECK (author_role IN ('SINDICO', 'PORTEIRO', 'MORADOR'));
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- constraint já existe com valores corretos
END $$;

-- 2. Remover políticas RLS existentes em notices (evitar conflito)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'notices'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notices', r.policyname);
    RAISE NOTICE 'Política removida: %', r.policyname;
  END LOOP;
END $$;

-- 3. Políticas RLS para notices: todos os perfis autorizados podem ver e gerenciar
-- SELECT: Portaria, Síndico e Moradores visualizam todos os avisos
CREATE POLICY "notices_select_all_roles" ON notices
  FOR SELECT USING (true);

-- INSERT: Moradores, Portaria e Síndico podem criar avisos
CREATE POLICY "notices_insert_all_roles" ON notices
  FOR INSERT WITH CHECK (true);

-- UPDATE: Permitir edição (ex.: síndico/portaria ajustando conteúdo)
CREATE POLICY "notices_update_all_roles" ON notices
  FOR UPDATE USING (true);

-- DELETE: Permitir exclusão (ex.: síndico removendo aviso)
CREATE POLICY "notices_delete_all_roles" ON notices
  FOR DELETE USING (true);

-- 4. notice_reads: permitir leitura/gravação para integração com "lidos" por morador
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'notice_reads'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON notice_reads', r.policyname);
    RAISE NOTICE 'Política notice_reads removida: %', r.policyname;
  END LOOP;
END $$;

CREATE POLICY "notice_reads_select" ON notice_reads FOR SELECT USING (true);
CREATE POLICY "notice_reads_insert" ON notice_reads FOR INSERT WITH CHECK (true);
CREATE POLICY "notice_reads_delete" ON notice_reads FOR DELETE USING (true);

-- Verificação
SELECT schemaname, tablename, policyname, cmd, roles
  FROM pg_policies
  WHERE tablename IN ('notices', 'notice_reads')
  ORDER BY tablename, cmd;
