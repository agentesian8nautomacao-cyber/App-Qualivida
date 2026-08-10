-- migrations/007_packages_backfill_recipient_id.sql
-- Garante vínculo encomenda -> morador (recipient_id) para RLS/ocultar funcionar.
-- 1) Backfill recipient_id em packages onde estiver NULL, por unidade (normalizada).
-- 2) Trigger para preencher recipient_id automaticamente no INSERT/UPDATE quando possível.

BEGIN;

-- Helper: normaliza unidade (remove tudo que não é A-Z0-9 e upper)
CREATE OR REPLACE FUNCTION public.normalize_unit_for_match(p_unit text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(upper(coalesce(p_unit,'')), '[^A-Z0-9]', '', 'g');
$$;

-- 1) Backfill (prioriza residents; fallback resident)
DO $$
BEGIN
  BEGIN
    UPDATE public.packages p
    SET recipient_id = r.id
    FROM public.residents r
    WHERE p.recipient_id IS NULL
      AND public.normalize_unit_for_match(p.unit) = public.normalize_unit_for_match(r.unit);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;

  BEGIN
    UPDATE public.packages p
    SET recipient_id = r.id
    FROM public.resident r
    WHERE p.recipient_id IS NULL
      AND public.normalize_unit_for_match(p.unit) = public.normalize_unit_for_match(r.unit);
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    NULL;
  END;
END
$$;

-- 2) Trigger: preencher recipient_id quando vier NULL (staff inserindo)
CREATE OR REPLACE FUNCTION public.fill_package_recipient_id_from_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
BEGIN
  -- Se já veio preenchido, ok.
  IF NEW.recipient_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  rid := NULL;
  BEGIN
    SELECT r.id INTO rid
    FROM public.residents r
    WHERE public.normalize_unit_for_match(r.unit) = public.normalize_unit_for_match(NEW.unit)
    LIMIT 1;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    rid := NULL;
  END;

  IF rid IS NULL THEN
    BEGIN
      SELECT r.id INTO rid
      FROM public.resident r
      WHERE public.normalize_unit_for_match(r.unit) = public.normalize_unit_for_match(NEW.unit)
      LIMIT 1;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      rid := NULL;
    END;
  END IF;

  IF rid IS NOT NULL THEN
    NEW.recipient_id := rid;
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
    WHERE c.relname = 'packages' AND n.nspname = 'public'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_fill_package_recipient_id_from_unit ON public.packages;
    CREATE TRIGGER trigger_fill_package_recipient_id_from_unit
      BEFORE INSERT OR UPDATE OF unit, recipient_id ON public.packages
      FOR EACH ROW
      EXECUTE FUNCTION public.fill_package_recipient_id_from_unit();
  END IF;
END
$$;

COMMIT;

