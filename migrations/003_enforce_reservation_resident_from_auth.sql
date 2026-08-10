-- migrations/003_enforce_reservation_resident_from_auth.sql
-- Garante que, quando o usuário autenticado for um MORADOR (existir em residents/resident via auth_user_id),
-- a reserva SEMPRE será registrada em seu próprio nome, ignorando resident_id/resident_name/unit do payload.
-- Isso protege contra manipulação via DevTools.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_reservation_resident_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
  rname text;
  runit text;
BEGIN
  -- Se não houver usuário autenticado, não interferir.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Tentar resolver o morador logado (compatível com deployments que usam public.residents ou public.resident).
  rid := NULL;
  rname := NULL;
  runit := NULL;

  BEGIN
    SELECT id, name, unit
      INTO rid, rname, runit
    FROM public.residents
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    BEGIN
      SELECT id, name, unit
        INTO rid, rname, runit
      FROM public.resident
      WHERE auth_user_id = auth.uid()
      LIMIT 1;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      rid := NULL;
      rname := NULL;
      runit := NULL;
    END;
  END;

  -- Se este auth.uid() pertence a um morador, forçar associação.
  IF rid IS NOT NULL THEN
    NEW.resident_id := rid;
    IF rname IS NOT NULL THEN NEW.resident_name := rname; END IF;
    IF runit IS NOT NULL THEN NEW.unit := runit; END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'reservations' AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_enforce_reservation_resident_from_auth ON public.reservations;
    CREATE TRIGGER trigger_enforce_reservation_resident_from_auth
      BEFORE INSERT OR UPDATE OF resident_id, resident_name, unit ON public.reservations
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_reservation_resident_from_auth();
  END IF;
END
$$;

COMMIT;

