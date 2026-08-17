-- =============================================================================
-- G7-K-RBAC ROLLBACK — 009_events_view_permission
-- =============================================================================
-- Status: PREPARED — NÃO executar sem autorização explícita
-- Companion: 20260815230000_009_events_view_permission.sql
--
-- Ordem obrigatória:
--   1) remover grants (role_permissions) da permission events.view
--   2) remover a permission events.view
--
-- Remove SOMENTE o que a migration 009 criou.
-- SEM CASCADE. SEM DROP TABLE. SEM tocar em outras permissions.
-- =============================================================================

BEGIN;

-- 1) Grants primeiro (FK role_permissions.permission_id → permissions.id)
DELETE FROM public.role_permissions rp
USING public.permissions p
WHERE rp.permission_id = p.id
  AND p.key = 'events.view';

-- 2) Permission (falha se ainda houver dependências inesperadas via FK)
DELETE FROM public.permissions
WHERE key = 'events.view';

COMMIT;
