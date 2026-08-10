-- Migration: Add auth_user_id (uuid) to resident and staff/users tables
-- Creates foreign key referencing auth.users(id)
-- Run this with a supabase/sql editor or psql connected to the project database.

-- resident table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'resident' AND n.nspname = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'resident' AND column_name = 'auth_user_id'
    ) THEN
      ALTER TABLE public.resident ADD COLUMN auth_user_id uuid;
    END IF;

    -- Add foreign key constraint if not exists
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'resident_auth_user_id_fkey'
    ) THEN
      BEGIN
        ALTER TABLE public.resident
        ADD CONSTRAINT resident_auth_user_id_fkey
        FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
      EXCEPTION WHEN undefined_table OR undefined_column THEN
        -- auth.users may not be accessible in some contexts; ignore to allow manual review
        RAISE NOTICE 'Could not create FK resident->auth.users (auth.users may be inaccessible). Review manually.';
      END;
    END IF;
  END IF;
END
$$;

-- staff table (preferred) — create column and FK if staff exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'staff' AND n.nspname = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'auth_user_id'
    ) THEN
      ALTER TABLE public.staff ADD COLUMN auth_user_id uuid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'staff_auth_user_id_fkey'
    ) THEN
      BEGIN
        ALTER TABLE public.staff
        ADD CONSTRAINT staff_auth_user_id_fkey
        FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
      EXCEPTION WHEN undefined_table OR undefined_column THEN
        RAISE NOTICE 'Could not create FK staff->auth.users (auth.users may be inaccessible). Review manually.';
      END;
    END IF;
  END IF;
END
$$;

-- users table fallback (if staff does not exist and users exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'staff' AND n.nspname = 'public'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'users' AND n.nspname = 'public'
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id'
      ) THEN
        ALTER TABLE public.users ADD COLUMN auth_user_id uuid;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_user_id_fkey'
      ) THEN
        BEGIN
          ALTER TABLE public.users
          ADD CONSTRAINT users_auth_user_id_fkey
          FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
        EXCEPTION WHEN undefined_table OR undefined_column THEN
          RAISE NOTICE 'Could not create FK users->auth.users (auth.users may be inaccessible). Review manually.';
        END;
      END IF;
    END IF;
  END IF;
END
$$;

-- End migration

