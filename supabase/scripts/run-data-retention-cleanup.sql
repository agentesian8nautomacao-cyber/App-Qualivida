-- =============================================================================
-- LIMPEZA AUTOMÁTICA – POLÍTICA DE RETENÇÃO DE DADOS
-- =============================================================================
-- Este script aplica a política definida em DATA_RETENTION_POLICY.md.
-- Executar 1x por dia (ex.: via pg_cron às 03:00 UTC).
-- Requer permissão DELETE nas tabelas (ex.: service_role ou função SECURITY DEFINER).
-- =============================================================================

-- Notificações: manter 90 dias
DELETE FROM public.notifications
WHERE created_at < now() - interval '90 days';

-- Chat do mural: manter 180 dias
DELETE FROM public.chat_messages
WHERE timestamp < now() - interval '180 days';

-- Reservas: manter 12 meses (coluna date)
DELETE FROM public.reservations
WHERE (reservations.date::date) < (current_date - interval '12 months');

-- Encomendas: manter 12 meses (baseado em received_at)
DELETE FROM public.packages
WHERE received_at < now() - interval '12 months';

-- Ocorrências: manter 24 meses (purge inclui soft-deleted; coluna date)
DELETE FROM public.occurrences
WHERE (occurrences.date::date) < (current_date - interval '24 months');

-- Convites staff: 30 dias após uso OU expirados não usados
DELETE FROM public.staff_invites
WHERE (used_at IS NOT NULL AND used_at < now() - interval '30 days')
   OR (used_at IS NULL AND expires_at < now());

-- Convites morador: 30 dias após uso OU expirados não usados
DELETE FROM public.resident_invites
WHERE (used_at IS NOT NULL AND used_at < now() - interval '30 days')
   OR (used_at IS NULL AND expires_at < now());

-- =============================================================================
-- NÃO INCLUIR NESTE SCRIPT (conforme política):
-- - boletos (manter mínimo 5 anos; não apagar sem política formal)
-- - admin_audit_logs (não apagar; só por exigência legal)
-- =============================================================================
