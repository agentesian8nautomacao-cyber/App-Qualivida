-- =============================================================================
-- ROLLBACK — FASE C Platform Master
-- =============================================================================
-- Companion: 20260817190000_010_platform_master_fase_c.sql
-- NÃO usar CASCADE em organizations/condominiums.
--
-- DROP POLICY IF EXISTS ainda exige que a TABELA exista (Postgres 42P01).
-- Por isso: só DROP POLICY em platform_* se to_regclass não for NULL;
-- depois DROP TABLE IF EXISTS.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS condominiums_select_platform_admin ON public.condominiums;
DROP POLICY IF EXISTS organizations_update_platform_admin ON public.organizations;
DROP POLICY IF EXISTS organizations_select_platform_admin ON public.organizations;

DO $$
BEGIN
  IF to_regclass('public.platform_audit_events') IS NOT NULL THEN
    DROP POLICY IF EXISTS platform_audit_insert_access_denied ON public.platform_audit_events;
    DROP POLICY IF EXISTS platform_audit_insert_admin ON public.platform_audit_events;
    DROP POLICY IF EXISTS platform_audit_select_admin ON public.platform_audit_events;
  END IF;
  IF to_regclass('public.platform_admins') IS NOT NULL THEN
    DROP POLICY IF EXISTS platform_admins_select_self ON public.platform_admins;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.is_platform_admin();

DROP TABLE IF EXISTS public.platform_audit_events;
DROP TABLE IF EXISTS public.platform_admins;

COMMIT;
