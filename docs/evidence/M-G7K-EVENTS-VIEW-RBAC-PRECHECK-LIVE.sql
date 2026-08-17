-- =============================================================================
-- M-G7K EVENTS.VIEW RBAC PRE-CHECK LIVE — SOMENTE LEITURA
-- =============================================================================
-- Status: DOCUMENTADO / executar no SQL Editor ANTES do APPLY 009
-- Project alvo: zaemlxjwhzrfmowbckmk
-- Gate: G7-K-RBAC
-- Migration: supabase/migrations/20260815230000_009_events_view_permission.sql
--
-- Interpretação (PASS para APPLY):
--   events.view ABSENT
--   roles sindico + administradora EXIST
--   role_permissions events.view ABSENT (0 grants)
--   sentinela.view EXISTS (intacta)
--   api_domain_events EXISTS (G7-J intact — não alterar)
--   G6-1 / G6-2 / G7-C intactos (informativo)
--
-- Este script NÃO contém INSERT/UPDATE/DELETE/DDL.
-- =============================================================================

-- 1) events.view deve estar AUSENTE
SELECT
  COUNT(*) AS events_view_count,
  CASE
    WHEN COUNT(*) = 0 THEN 'ABSENT — OK for G7-K-RBAC CREATE'
    ELSE 'EXISTS — STOP / BLOCKED (já criada?)'
  END AS events_view_verdict
FROM public.permissions
WHERE key = 'events.view';

-- 2) Roles esperadas para grants propostos
SELECT
  name,
  CASE WHEN name IN ('sindico', 'administradora') THEN 'GRANT_TARGET'
       WHEN name IN ('morador', 'porteiro', 'cabo_turma') THEN 'NO_GRANT'
       ELSE 'UNKNOWN'
  END AS grant_plan
FROM public.roles
ORDER BY name;

SELECT
  (SELECT COUNT(*) FROM public.roles WHERE name = 'sindico') AS sindico_count,
  (SELECT COUNT(*) FROM public.roles WHERE name = 'administradora') AS administradora_count,
  CASE
    WHEN (SELECT COUNT(*) FROM public.roles WHERE name = 'sindico') = 1
     AND (SELECT COUNT(*) FROM public.roles WHERE name = 'administradora') = 1
    THEN 'ROLES OK'
    ELSE 'STOP / BLOCKED — roles alvo ausentes'
  END AS roles_verdict;

-- 3) Grants events.view devem estar AUSENTES
SELECT
  COUNT(*) AS events_view_grant_count,
  CASE
    WHEN COUNT(*) = 0 THEN 'ABSENT — OK for CREATE grants'
    ELSE 'EXISTS — STOP / revisar antes do APPLY'
  END AS events_view_grants_verdict
FROM public.role_permissions rp
JOIN public.permissions p ON p.id = rp.permission_id
WHERE p.key = 'events.view';

-- 4) sentinela.view intacta (NÃO reutilizar / NÃO alterar)
SELECT
  key,
  label,
  CASE WHEN key = 'sentinela.view' THEN 'EXISTS — OK (intacta)' ELSE 'UNEXPECTED' END AS sentinela_view_verdict
FROM public.permissions
WHERE key = 'sentinela.view';

-- 5) Contagem baseline permissions (esperado 50 antes do APPLY → 51 após)
SELECT COUNT(*) AS permissions_count_before_apply
FROM public.permissions;

-- 6) Integridade M1 / G6 / G7 (informativo — não alterar)
SELECT
  to_regclass('public.organizations') AS organizations_m1,
  to_regclass('public.condominiums') AS condominiums_m1,
  to_regclass('public.units') AS units_m2,
  to_regclass('public.tenant_memberships') AS tenant_memberships_m3,
  to_regclass('public.api_idempotency_keys') AS g61,
  to_regclass('public.api_confirmations') AS g62,
  to_regclass('public.api_domain_events') AS g7j;

-- 7) G7-C exclusion constraint informativo (nome LIVE: reservations_area_date_slot_excl)
SELECT
  c.conname,
  c.contype,
  CASE
    WHEN c.conname = 'reservations_area_date_slot_excl' AND c.contype = 'x'
    THEN 'EXISTS — OK (G7-C intact)'
    ELSE 'UNEXPECTED'
  END AS g7c_verdict
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'reservations'
  AND c.contype = 'x'
ORDER BY c.conname;

-- 8) Resumo create-safe
SELECT
  (SELECT COUNT(*) = 0 FROM public.permissions WHERE key = 'events.view') AS events_view_absent,
  (SELECT COUNT(*) = 1 FROM public.roles WHERE name = 'sindico') AS sindico_ok,
  (SELECT COUNT(*) = 1 FROM public.roles WHERE name = 'administradora') AS administradora_ok,
  (SELECT COUNT(*) = 0
     FROM public.role_permissions rp
     JOIN public.permissions p ON p.id = rp.permission_id
     WHERE p.key = 'events.view') AS grants_absent,
  (SELECT COUNT(*) = 1 FROM public.permissions WHERE key = 'sentinela.view') AS sentinela_view_intact,
  (
    (SELECT COUNT(*) = 0 FROM public.permissions WHERE key = 'events.view')
    AND (SELECT COUNT(*) = 1 FROM public.roles WHERE name = 'sindico')
    AND (SELECT COUNT(*) = 1 FROM public.roles WHERE name = 'administradora')
    AND (SELECT COUNT(*) = 0
           FROM public.role_permissions rp
           JOIN public.permissions p ON p.id = rp.permission_id
           WHERE p.key = 'events.view')
    AND (SELECT COUNT(*) = 1 FROM public.permissions WHERE key = 'sentinela.view')
  ) AS m_g7k_create_safe;
