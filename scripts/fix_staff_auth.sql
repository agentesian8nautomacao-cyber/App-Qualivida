-- scripts/fix_staff_auth.sql
-- Safe dynamic update SQL for staff/users.
-- This script avoids referencing columns that may not exist (e.g. username).
-- Copy into Supabase SQL Editor and execute.

BEGIN;

-- Helper DO block: update staff rows only updating columns that exist.
DO $$
DECLARE
  v_table text := 'staff';
  exists_role boolean;
  exists_username boolean;
  exists_email boolean;
  exists_is_active boolean;
  exists_auth_user_id boolean;
  exists_updated_at boolean;
  stmt text;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = v_table AND column_name = 'role') INTO exists_role;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = v_table AND column_name = 'username') INTO exists_username;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = v_table AND column_name = 'email') INTO exists_email;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = v_table AND column_name = 'is_active') INTO exists_is_active;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = v_table AND column_name = 'auth_user_id') INTO exists_auth_user_id;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = v_table AND column_name = 'updated_at') INTO exists_updated_at;

  -- Row 1
  stmt := 'UPDATE ' || quote_ident(current_schema()) || '.staff SET ';
  IF exists_role THEN stmt := stmt || 'role = ' || quote_literal('SINDICO') || ', '; END IF;
  IF exists_username THEN stmt := stmt || 'username = ' || quote_literal('desenvolvedor') || ', '; END IF;
  IF exists_email THEN stmt := stmt || 'email = ' || quote_literal('agentesian8nautomacao@gmail.com') || ', '; END IF;
  IF exists_is_active THEN stmt := stmt || 'is_active = true, '; END IF;
  IF exists_auth_user_id THEN stmt := stmt || 'auth_user_id = ' || quote_literal('8b64065a-cbad-4fdb-9b24-3b4aeb6e343a') || ', '; END IF;
  IF exists_updated_at THEN stmt := stmt || 'updated_at = now(), '; END IF;
  IF right(stmt,2) = ', ' THEN stmt := left(stmt, length(stmt)-2) || ' WHERE id = ' || quote_literal('4fd1744a-55ef-4264-bce0-037c00af90aa') || ';' ;
    EXECUTE stmt;
  END IF;

  -- Row 2
  stmt := 'UPDATE ' || quote_ident(current_schema()) || '.staff SET ';
  IF exists_role THEN stmt := stmt || 'role = ' || quote_literal('SINDICO') || ', '; END IF;
  IF exists_username THEN stmt := stmt || 'username = ' || quote_literal('admin') || ', '; END IF;
  IF exists_email THEN stmt := stmt || 'email = ' || quote_literal('paulohmorais@hotmail.com') || ', '; END IF;
  IF exists_is_active THEN stmt := stmt || 'is_active = true, '; END IF;
  IF exists_auth_user_id THEN stmt := stmt || 'auth_user_id = ' || quote_literal('9ab3ffa6-5762-4700-9d19-758ad2f115a6') || ', '; END IF;
  IF exists_updated_at THEN stmt := stmt || 'updated_at = now(), '; END IF;
  IF right(stmt,2) = ', ' THEN stmt := left(stmt, length(stmt)-2) || ' WHERE id = ' || quote_literal('b889ac45-2362-4247-9dd9-ef5d104ab81b') || ';' ;
    EXECUTE stmt;
  END IF;

  -- Row 3
  stmt := 'UPDATE ' || quote_ident(current_schema()) || '.staff SET ';
  IF exists_role THEN stmt := stmt || 'role = ' || quote_literal('PORTEIRO') || ', '; END IF;
  IF exists_username THEN stmt := stmt || 'username = ' || quote_literal('portaria') || ', '; END IF;
  IF exists_email THEN stmt := stmt || 'email = ' || quote_literal('email.real@dominio.com') || ', '; END IF;
  IF exists_is_active THEN stmt := stmt || 'is_active = true, '; END IF;
  IF exists_auth_user_id THEN stmt := stmt || 'auth_user_id = ' || quote_literal('1368510e-329a-4ded-87ea-d606b24d2676') || ', '; END IF;
  IF exists_updated_at THEN stmt := stmt || 'updated_at = now(), '; END IF;
  IF right(stmt,2) = ', ' THEN stmt := left(stmt, length(stmt)-2) || ' WHERE id = ' || quote_literal('dfc1507f-d1c6-4c37-bc0d-53af8bfef39e') || ';' ;
    EXECUTE stmt;
  END IF;
END$$;

-- Upsert into users table, but do it defensively: check column existence and build dynamic INSERT/UPDATE.
DO $$
DECLARE
  u_table text := 'users';
  has_auth_user_id boolean;
  has_username boolean;
  has_role boolean;
  has_email boolean;
  has_is_active boolean;
  has_created_at boolean;
  has_updated_at boolean;
  sel text;
  ins_cols text;
  ins_vals text;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = u_table AND column_name = 'auth_user_id') INTO has_auth_user_id;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = u_table AND column_name = 'username') INTO has_username;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = u_table AND column_name = 'role') INTO has_role;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = u_table AND column_name = 'email') INTO has_email;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = u_table AND column_name = 'is_active') INTO has_is_active;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = u_table AND column_name = 'created_at') INTO has_created_at;
  SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = u_table AND column_name = 'updated_at') INTO has_updated_at;

  -- User 1
  IF has_auth_user_id THEN
    IF EXISTS (SELECT 1 FROM users WHERE auth_user_id = '8b64065a-cbad-4fdb-9b24-3b4aeb6e343a') THEN
      sel := 'UPDATE ' || quote_ident(current_schema()) || '.users SET ';
      IF has_username THEN sel := sel || 'username = ' || quote_literal('desenvolvedor') || ', '; END IF;
      IF has_role THEN sel := sel || 'role = ' || quote_literal('SINDICO') || ', '; END IF;
      IF has_email THEN sel := sel || 'email = ' || quote_literal('agentesian8nautomacao@gmail.com') || ', '; END IF;
      IF has_is_active THEN sel := sel || 'is_active = true, '; END IF;
      IF has_updated_at THEN sel := sel || 'updated_at = now(), '; END IF;
      IF right(sel,2) = ', ' THEN sel := left(sel, length(sel)-2) || ' WHERE auth_user_id = ' || quote_literal('8b64065a-cbad-4fdb-9b24-3b4aeb6e343a') || ';'; EXECUTE sel; END IF;
    ELSE
      ins_cols := '';
      ins_vals := '';
      IF has_auth_user_id THEN ins_cols := ins_cols || 'auth_user_id,'; ins_vals := ins_vals || quote_literal('8b64065a-cbad-4fdb-9b24-3b4aeb6e343a') || ','; END IF;
      IF has_username THEN ins_cols := ins_cols || 'username,'; ins_vals := ins_vals || quote_literal('desenvolvedor') || ','; END IF;
      IF has_role THEN ins_cols := ins_cols || 'role,'; ins_vals := ins_vals || quote_literal('SINDICO') || ','; END IF;
      IF has_email THEN ins_cols := ins_cols || 'email,'; ins_vals := ins_vals || quote_literal('agentesian8nautomacao@gmail.com') || ','; END IF;
      IF has_is_active THEN ins_cols := ins_cols || 'is_active,'; ins_vals := ins_vals || 'true,'; END IF;
      IF has_created_at THEN ins_cols := ins_cols || 'created_at,'; ins_vals := ins_vals || 'now(),' ; END IF;
      IF has_updated_at THEN ins_cols := ins_cols || 'updated_at,'; ins_vals := ins_vals || 'now(),'; END IF;
      IF ins_cols <> '' THEN
        ins_cols := left(ins_cols, length(ins_cols)-1);
        ins_vals := left(ins_vals, length(ins_vals)-1);
        EXECUTE 'INSERT INTO ' || quote_ident(current_schema()) || '.users(' || ins_cols || ') VALUES(' || ins_vals || ');';
      END IF;
    END IF;
  END IF;

  -- User 2
  IF has_auth_user_id THEN
    IF EXISTS (SELECT 1 FROM users WHERE auth_user_id = '9ab3ffa6-5762-4700-9d19-758ad2f115a6') THEN
      sel := 'UPDATE ' || quote_ident(current_schema()) || '.users SET ';
      IF has_username THEN sel := sel || 'username = ' || quote_literal('admin') || ', '; END IF;
      IF has_role THEN sel := sel || 'role = ' || quote_literal('SINDICO') || ', '; END IF;
      IF has_email THEN sel := sel || 'email = ' || quote_literal('paulohmorais@hotmail.com') || ', '; END IF;
      IF has_is_active THEN sel := sel || 'is_active = true, '; END IF;
      IF has_updated_at THEN sel := sel || 'updated_at = now(), '; END IF;
      IF right(sel,2) = ', ' THEN sel := left(sel, length(sel)-2) || ' WHERE auth_user_id = ' || quote_literal('9ab3ffa6-5762-4700-9d19-758ad2f115a6') || ';'; EXECUTE sel; END IF;
    ELSE
      ins_cols := '';
      ins_vals := '';
      IF has_auth_user_id THEN ins_cols := ins_cols || 'auth_user_id,'; ins_vals := ins_vals || quote_literal('9ab3ffa6-5762-4700-9d19-758ad2f115a6') || ','; END IF;
      IF has_username THEN ins_cols := ins_cols || 'username,'; ins_vals := ins_vals || quote_literal('admin') || ','; END IF;
      IF has_role THEN ins_cols := ins_cols || 'role,'; ins_vals := ins_vals || quote_literal('SINDICO') || ','; END IF;
      IF has_email THEN ins_cols := ins_cols || 'email,'; ins_vals := ins_vals || quote_literal('paulohmorais@hotmail.com') || ','; END IF;
      IF has_is_active THEN ins_cols := ins_cols || 'is_active,'; ins_vals := ins_vals || 'true,'; END IF;
      IF has_created_at THEN ins_cols := ins_cols || 'created_at,'; ins_vals := ins_vals || 'now(),' ; END IF;
      IF has_updated_at THEN ins_cols := ins_cols || 'updated_at,'; ins_vals := ins_vals || 'now(),'; END IF;
      IF ins_cols <> '' THEN
        ins_cols := left(ins_cols, length(ins_cols)-1);
        ins_vals := left(ins_vals, length(ins_vals)-1);
        EXECUTE 'INSERT INTO ' || quote_ident(current_schema()) || '.users(' || ins_cols || ') VALUES(' || ins_vals || ');';
      END IF;
    END IF;
  END IF;

  -- User 3
  IF has_auth_user_id THEN
    IF EXISTS (SELECT 1 FROM users WHERE auth_user_id = '1368510e-329a-4ded-87ea-d606b24d2676') THEN
      sel := 'UPDATE ' || quote_ident(current_schema()) || '.users SET ';
      IF has_username THEN sel := sel || 'username = ' || quote_literal('portaria') || ', '; END IF;
      IF has_role THEN sel := sel || 'role = ' || quote_literal('PORTEIRO') || ', '; END IF;
      IF has_email THEN sel := sel || 'email = ' || quote_literal('email.real@dominio.com') || ', '; END IF;
      IF has_is_active THEN sel := sel || 'is_active = true, '; END IF;
      IF has_updated_at THEN sel := sel || 'updated_at = now(), '; END IF;
      IF right(sel,2) = ', ' THEN sel := left(sel, length(sel)-2) || ' WHERE auth_user_id = ' || quote_literal('1368510e-329a-4ded-87ea-d606b24d2676') || ';'; EXECUTE sel; END IF;
    ELSE
      ins_cols := '';
      ins_vals := '';
      IF has_auth_user_id THEN ins_cols := ins_cols || 'auth_user_id,'; ins_vals := ins_vals || quote_literal('1368510e-329a-4ded-87ea-d606b24d2676') || ','; END IF;
      IF has_username THEN ins_cols := ins_cols || 'username,'; ins_vals := ins_vals || quote_literal('portaria') || ','; END IF;
      IF has_role THEN ins_cols := ins_cols || 'role,'; ins_vals := ins_vals || quote_literal('PORTEIRO') || ','; END IF;
      IF has_email THEN ins_cols := ins_cols || 'email,'; ins_vals := ins_vals || quote_literal('email.real@dominio.com') || ','; END IF;
      IF has_is_active THEN ins_cols := ins_cols || 'is_active,'; ins_vals := ins_vals || 'true,'; END IF;
      IF has_created_at THEN ins_cols := ins_cols || 'created_at,'; ins_vals := ins_vals || 'now(),' ; END IF;
      IF has_updated_at THEN ins_cols := ins_cols || 'updated_at,'; ins_vals := ins_vals || 'now(),'; END IF;
      IF ins_cols <> '' THEN
        ins_cols := left(ins_cols, length(ins_cols)-1);
        ins_vals := left(ins_vals, length(ins_vals)-1);
        EXECUTE 'INSERT INTO ' || quote_ident(current_schema()) || '.users(' || ins_cols || ') VALUES(' || ins_vals || ');';
      END IF;
    END IF;
  END IF;
END$$;

COMMIT;

-- Verification note:
-- The script executed updates/inserts defensively without referencing missing columns.
-- Now run the Admin API commands (or the provided shell/script) to set passwords and confirm emails:
--   PUT /auth/v1/admin/users/{auth_user_id} with {"email":"...","password":"...","email_confirm":true}

-- scripts/fix_staff_auth.sql
-- Use no editor: copy into Supabase SQL Editor and execute.
-- WARNING:
-- 1) THIS SCRIPT only updates your application's tables (staff, users) to ensure
--    emails, roles and auth_user_id are present/normalized.
-- 2) Creating or modifying records in the internal auth schema (GoTrue) via SQL
--    is NOT RECOMMENDED. To make users able to log in (set password + confirm email)
--    you MUST call the Admin API: PUT /auth/v1/admin/users/{user_id}
--    or use the provided scripts/*.sh or scripts/ensure_staff_roles_and_auth.js.
-- 3) After running this SQL, run the Admin API commands (or the shell/script I provided)
--    to set passwords and mark emails confirmed.
--
-- The following SQL:
-- - normalizes and updates the three staff rows you listed;
-- - upserts (update or insert) corresponding rows in "users" by auth_user_id when possible;
-- - returns resulting rows for verification.

BEGIN;

-- 1) Update staff rows (set role, username, email, is_active, auth_user_id)
UPDATE staff
SET
  role = 'SINDICO',
  username = 'desenvolvedor',
  email = 'agentesian8nautomacao@gmail.com',
  is_active = true,
  auth_user_id = '8b64065a-cbad-4fdb-9b24-3b4aeb6e343a',
  updated_at = NOW()
WHERE id = '4fd1744a-55ef-4264-bce0-037c00af90aa';

UPDATE staff
SET
  role = 'SINDICO',
  username = 'admin',
  email = 'paulohmorais@hotmail.com',
  is_active = true,
  auth_user_id = '9ab3ffa6-5762-4700-9d19-758ad2f115a6',
  updated_at = NOW()
WHERE id = 'b889ac45-2362-4247-9dd9-ef5d104ab81b';

UPDATE staff
SET
  role = 'PORTEIRO',
  username = 'portaria',
  email = 'email.real@dominio.com',
  is_active = true,
  auth_user_id = '1368510e-329a-4ded-87ea-d606b24d2676',
  updated_at = NOW()
WHERE id = 'dfc1507f-d1c6-4c37-bc0d-53af8bfef39e';

-- 2) Upsert rows in users table based on auth_user_id.
-- This block will UPDATE when a users row with the same auth_user_id exists,
-- otherwise INSERT a new minimal users row (id will be generated).
DO $$
DECLARE
  v_auth_id uuid;
BEGIN
  -- User 1: desenvolvedor
  v_auth_id := '8b64065a-cbad-4fdb-9b24-3b4aeb6e343a'::uuid;
  IF EXISTS (SELECT 1 FROM users WHERE auth_user_id = v_auth_id) THEN
    UPDATE users
    SET username = 'desenvolvedor', role = 'SINDICO', email = 'agentesian8nautomacao@gmail.com', is_active = true, updated_at = NOW()
    WHERE auth_user_id = v_auth_id;
  ELSE
    INSERT INTO users (auth_user_id, username, role, email, is_active, created_at, updated_at)
    VALUES (v_auth_id, 'desenvolvedor', 'SINDICO', 'agentesian8nautomacao@gmail.com', true, NOW(), NOW());
  END IF;

  -- User 2: admin
  v_auth_id := '9ab3ffa6-5762-4700-9d19-758ad2f115a6'::uuid;
  IF EXISTS (SELECT 1 FROM users WHERE auth_user_id = v_auth_id) THEN
    UPDATE users
    SET username = 'admin', role = 'SINDICO', email = 'paulohmorais@hotmail.com', is_active = true, updated_at = NOW()
    WHERE auth_user_id = v_auth_id;
  ELSE
    INSERT INTO users (auth_user_id, username, role, email, is_active, created_at, updated_at)
    VALUES (v_auth_id, 'admin', 'SINDICO', 'paulohmorais@hotmail.com', true, NOW(), NOW());
  END IF;

  -- User 3: portaria
  v_auth_id := '1368510e-329a-4ded-87ea-d606b24d2676'::uuid;
  IF EXISTS (SELECT 1 FROM users WHERE auth_user_id = v_auth_id) THEN
    UPDATE users
    SET username = 'portaria', role = 'PORTEIRO', email = 'email.real@dominio.com', is_active = true, updated_at = NOW()
    WHERE auth_user_id = v_auth_id;
  ELSE
    INSERT INTO users (auth_user_id, username, role, email, is_active, created_at, updated_at)
    VALUES (v_auth_id, 'portaria', 'PORTEIRO', 'email.real@dominio.com', true, NOW(), NOW());
  END IF;
END$$;

COMMIT;

-- 3) Verification: return the affected rows
SELECT id, username, email, role, auth_user_id, is_active, created_at, updated_at
FROM staff
WHERE id IN (
  '4fd1744a-55ef-4264-bce0-037c00af90aa',
  'b889ac45-2362-4247-9dd9-ef5d104ab81b',
  'dfc1507f-d1c6-4c37-bc0d-53af8bfef39e'
);

SELECT id, username, email, role, auth_user_id, is_active, created_at, updated_at
FROM users
WHERE auth_user_id IN (
  '8b64065a-cbad-4fdb-9b24-3b4aeb6e343a',
  '9ab3ffa6-5762-4700-9d19-758ad2f115a6',
  '1368510e-329a-4ded-87ea-d606b24d2676'
);

-- IMPORTANT NEXT STEP:
-- After running this SQL, run the Admin API calls (or the shell/script provided)
-- to set the users' passwords and mark email_confirmed = true in the Auth system:
--   PUT /auth/v1/admin/users/{auth_user_id} with {"email":"...","password":"...","email_confirm":true}
--
-- Only after that the users will be able to authenticate via supabase.auth.signInWithPassword.

