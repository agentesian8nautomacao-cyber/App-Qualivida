-- 001_add_auth_user_id_nullable.sql
-- Adiciona coluna auth_user_id (nullable) nas tabelas autenticáveis.
-- Executar antes de rodar a migração que popula auth_user_id.
-- Use: psql / supabase sql editor / ou ferramenta de migração do seu CI.

BEGIN;

ALTER TABLE IF EXISTS residents ADD COLUMN IF NOT EXISTS auth_user_id uuid;
ALTER TABLE IF EXISTS resident ADD COLUMN IF NOT EXISTS auth_user_id uuid;
ALTER TABLE IF EXISTS staff ADD COLUMN IF NOT EXISTS auth_user_id uuid;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS auth_user_id uuid;
ALTER TABLE IF EXISTS funcionarios ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Opcional: criar índice para acelerar updates/joins
CREATE INDEX IF NOT EXISTS idx_residents_auth_user_id ON residents(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_resident_auth_user_id ON resident(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_staff_auth_user_id ON staff(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_auth_user_id ON funcionarios(auth_user_id);

COMMIT;

-- Após executar: rode o script Node de migração para popular auth_user_id.

