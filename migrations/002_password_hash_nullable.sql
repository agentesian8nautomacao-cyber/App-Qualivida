-- 002_password_hash_nullable.sql
-- Torna password_hash opcional (auth.users é a única fonte de senha).
-- Executar no Supabase SQL Editor.

-- PostgreSQL não suporta ALTER COLUMN IF EXISTS; execute cada bloco separadamente
-- Se a coluna não existir em uma tabela, ignore ou comente aquele bloco

BEGIN;
ALTER TABLE residents ALTER COLUMN password_hash DROP NOT NULL;
COMMIT;

-- BEGIN;
-- ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
-- COMMIT;

-- BEGIN;
-- ALTER TABLE staff ALTER COLUMN password_hash DROP NOT NULL;
-- COMMIT;
