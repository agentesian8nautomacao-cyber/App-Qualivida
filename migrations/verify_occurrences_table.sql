-- ============================================
-- VERIFICAÇÃO: tabela occurrences e RLS
-- ============================================
-- Execute no SQL Editor do Supabase para confirmar que está tudo certo.
-- No Dashboard, a tabela aparece como "occurrences" (schema public é o padrão).
-- ============================================

-- 1) A tabela existe? (deve retornar 1 linha)
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'occurrences'
) AS tabela_occurrences_existe;

-- 2) Colunas da tabela (deve ter: id, resident_id, resident_name, unit, description, status, date, reported_by, deleted_by_admin, updated_at, image_url, messages)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'occurrences'
ORDER BY ordinal_position;

-- 3) RLS está ativo e políticas existem?
SELECT
  c.relname AS tabela,
  c.relrowsecurity AS rls_ativo,
  (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS qtd_politicas
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'occurrences';

-- 4) Listar políticas RLS em occurrences
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'occurrences';

-- 5) Teste: quantas ocorrências existem?
SELECT count(*) AS total_occurrences FROM public.occurrences;

-- 6) (Opcional) Se quiser testar INSERT manualmente, descomente e execute:
/*
INSERT INTO public.occurrences (resident_name, unit, description, status, date, reported_by)
VALUES ('Teste SQL', '101', 'Ocorrência de teste pelo SQL Editor', 'aberta', NOW(), 'Sistema')
RETURNING id, resident_name, unit, status, date;
*/
