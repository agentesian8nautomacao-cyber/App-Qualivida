-- 002_enforce_auth_user_id_not_null_unique.sql
-- Versão segura da migration 002: aplica constraints e NOT NULL apenas quando seguro.
-- Execute AFTER executar 001_add_auth_user_id_nullable.sql e após popular auth_user_id.

-- 1) Tentar popular auth_user_id automaticamente a partir de auth.users (match por email)
DO $$
BEGIN
  IF to_regclass('public.residents') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.residents r
      SET auth_user_id = a.id
      FROM auth.users a
      WHERE r.auth_user_id IS NULL
        AND r.email IS NOT NULL
        AND lower(trim(r.email)) = lower(trim(a.email));
    $sql$;
  END IF;

  IF to_regclass('public.staff') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.staff r
      SET auth_user_id = a.id
      FROM auth.users a
      WHERE r.auth_user_id IS NULL
        AND r.email IS NOT NULL
        AND lower(trim(r.email)) = lower(trim(a.email));
    $sql$;
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE $sql$
      UPDATE public.users r
      SET auth_user_id = a.id
      FROM auth.users a
      WHERE r.auth_user_id IS NULL
        AND r.email IS NOT NULL
        AND lower(trim(r.email)) = lower(trim(a.email));
    $sql$;
  END IF;
END
$$;

-- 2) Criar UNIQUE constraints se ainda não existirem (por tabela existente)
DO $$
BEGIN
  IF to_regclass('public.residents') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'residents_auth_user_id_unique') THEN
      EXECUTE 'ALTER TABLE public.residents ADD CONSTRAINT residents_auth_user_id_unique UNIQUE (auth_user_id)';
    END IF;
  END IF;

  IF to_regclass('public.staff') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_auth_user_id_unique') THEN
      EXECUTE 'ALTER TABLE public.staff ADD CONSTRAINT staff_auth_user_id_unique UNIQUE (auth_user_id)';
    END IF;
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_user_id_unique') THEN
      EXECUTE 'ALTER TABLE public.users ADD CONSTRAINT users_auth_user_id_unique UNIQUE (auth_user_id)';
    END IF;
  END IF;
END
$$;

-- 3) Criar FOREIGN KEY constraints (se ausentes) apontando para auth.users(id)
DO $$
BEGIN
  IF to_regclass('public.residents') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'residents_auth_user_id_fkey') THEN
      EXECUTE 'ALTER TABLE public.residents ADD CONSTRAINT residents_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
  END IF;

  IF to_regclass('public.staff') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'staff_auth_user_id_fkey') THEN
      EXECUTE 'ALTER TABLE public.staff ADD CONSTRAINT staff_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_auth_user_id_fkey') THEN
      EXECUTE 'ALTER TABLE public.users ADD CONSTRAINT users_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL';
    END IF;
  END IF;
END
$$;

-- 4) Aplicar SET NOT NULL somente quando não houver NULLs (emite NOTICE caso contrário)
DO $$
DECLARE n int;
BEGIN
  IF to_regclass('public.residents') IS NOT NULL THEN
    SELECT COUNT(*) INTO n FROM public.residents WHERE auth_user_id IS NULL;
    IF n = 0 THEN
      EXECUTE 'ALTER TABLE public.residents ALTER COLUMN auth_user_id SET NOT NULL';
      RAISE NOTICE 'residents.auth_user_id set to NOT NULL';
    ELSE
      RAISE NOTICE 'residents has % NULL auth_user_id rows; NOT NULL not applied', n;
    END IF;
  END IF;

  IF to_regclass('public.staff') IS NOT NULL THEN
    SELECT COUNT(*) INTO n FROM public.staff WHERE auth_user_id IS NULL;
    IF n = 0 THEN
      EXECUTE 'ALTER TABLE public.staff ALTER COLUMN auth_user_id SET NOT NULL';
      RAISE NOTICE 'staff.auth_user_id set to NOT NULL';
    ELSE
      RAISE NOTICE 'staff has % NULL auth_user_id rows; NOT NULL not applied', n;
    END IF;
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    SELECT COUNT(*) INTO n FROM public.users WHERE auth_user_id IS NULL;
    IF n = 0 THEN
      EXECUTE 'ALTER TABLE public.users ALTER COLUMN auth_user_id SET NOT NULL';
      RAISE NOTICE 'users.auth_user_id set to NOT NULL';
    ELSE
      RAISE NOTICE 'users has % NULL auth_user_id rows; NOT NULL not applied', n;
    END IF;
  END IF;
END
$$;

