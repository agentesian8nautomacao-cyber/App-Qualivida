-- migrations/0001_add_auth_user_id.sql
-- 1) Adiciona coluna auth_user_id (nullable)
-- 2) Cria índices únicos para garantir 1:1
-- IMPORTANTE: Não execute ALTER ... SET NOT NULL ou adicionar FK até popular todas as linhas.

BEGIN;

ALTER TABLE IF EXISTS public.resident
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

ALTER TABLE IF EXISTS public.staff
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

ALTER TABLE IF EXISTS public.funcionarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resident_auth_user ON public.resident(auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_auth_user ON public.staff(auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user ON public.users(auth_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_auth_user ON public.funcionarios(auth_user_id);

COMMIT;

-- After running migration and populating auth_user_id for all rows:
-- ALTER TABLE public.resident ADD CONSTRAINT fk_resident_auth_user FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);
-- ALTER TABLE public.resident ALTER COLUMN auth_user_id SET NOT NULL;
-- Repeat FK/NOT NULL for other tables.

