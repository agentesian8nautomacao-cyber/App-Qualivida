-- =============================================================================
-- G7-K-RBAC — 009 events.view permission
-- =============================================================================
-- Status: APPLIED LIVE 2026-08-16 (zaemlxjwhzrfmowbckmk) — G7-K-RBAC CLOSED/PASS
-- Gate: G7-K-RBAC
-- Project alvo: zaemlxjwhzrfmowbckmk
--
-- Escopo (somente RBAC):
--   1) INSERT permission key = events.view (idempotente)
--   2) GRANT explícito somente para roles: sindico, administradora
--
-- NÃO altera:
--   - tabelas de domínio / M1–M4
--   - api_idempotency_keys (G6-1)
--   - api_confirmations (G6-2)
--   - reservations exclusion (G7-C)
--   - api_domain_events (G7-J) / RLS / wiring
--   - sentinela.view (permanece intacta; NÃO reutilizada)
--
-- NÃO concede a: morador, porteiro, cabo_turma
-- NÃO usa DROP / CASCADE
-- NÃO modifica permissions existentes (ON CONFLICT DO NOTHING)
-- =============================================================================

BEGIN;

-- 1) Permission dedicada (sem description column no schema atual)
INSERT INTO public.permissions (key, label)
VALUES ('events.view', 'Eventos — visualizar auditoria')
ON CONFLICT (key) DO NOTHING;

-- 2) Grants explícitos (menor privilégio administrativo)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('sindico', 'administradora')
  AND p.key = 'events.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
