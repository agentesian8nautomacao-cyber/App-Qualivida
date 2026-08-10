-- ============================================
-- OCORRÊNCIAS: RLS para morador criar e admin visualizar
-- ============================================
-- Sem políticas que permitam INSERT/SELECT, ocorrências criadas pelo morador
-- falham silenciosamente (vão para outbox) e o admin não vê na lista.
-- Este script garante que qualquer usuário autenticado ou anon possa
-- inserir (morador) e ler (admin/síndico/porteiro).
-- ============================================

BEGIN;

-- Habilitar RLS na tabela (se já estiver, não faz mal)
ALTER TABLE IF EXISTS public.occurrences ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas que possam restringir demais
DROP POLICY IF EXISTS "occurrences_select_all" ON public.occurrences;
DROP POLICY IF EXISTS "occurrences_insert_all" ON public.occurrences;
DROP POLICY IF EXISTS "occurrences_update_all" ON public.occurrences;
DROP POLICY IF EXISTS "occurrences_delete_all" ON public.occurrences;

-- SELECT: todos podem ler (admin/síndico/porteiro listam; morador vê as suas na aplicação)
CREATE POLICY "occurrences_select_all" ON public.occurrences
  FOR SELECT USING (true);

-- INSERT: morador e staff podem criar (app controla quem abre o modal)
CREATE POLICY "occurrences_insert_all" ON public.occurrences
  FOR INSERT WITH CHECK (true);

-- UPDATE: resolver/editar (staff e fluxo de resposta)
CREATE POLICY "occurrences_update_all" ON public.occurrences
  FOR UPDATE USING (true);

-- DELETE: soft delete já usado; política permite para consistência
CREATE POLICY "occurrences_delete_all" ON public.occurrences
  FOR DELETE USING (true);

COMMIT;
