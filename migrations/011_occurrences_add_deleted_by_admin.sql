-- ============================================
-- OCORRÊNCIAS: Adicionar coluna deleted_by_admin
-- ============================================
-- Erro no app: "Could not find the 'deleted_by_admin' column of 'occurrences'
-- in the schema cache". A tabela foi criada sem essa coluna. Este script
-- adiciona deleted_by_admin (e garante resident_id se faltar).
-- Execute no SQL Editor do Supabase.
-- ============================================

BEGIN;

-- Coluna usada pelo app para soft delete (admin "remove" sem apagar histórico)
ALTER TABLE IF EXISTS public.occurrences
  ADD COLUMN IF NOT EXISTS deleted_by_admin boolean NOT NULL DEFAULT false;

-- Garantir resident_id se a tabela foi criada sem (opcional)
ALTER TABLE IF EXISTS public.occurrences
  ADD COLUMN IF NOT EXISTS resident_id UUID REFERENCES public.residents(id);

COMMIT;
