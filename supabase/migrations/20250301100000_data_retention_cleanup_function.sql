-- Função de limpeza conforme DATA_RETENTION_POLICY.md
-- Agendar com pg_cron: após ativar a extensão pg_cron no Dashboard, execute no SQL Editor:
--
--   SELECT cron.schedule(
--     'data-retention-daily',
--     '0 3 * * *',
--     'SELECT run_data_retention_cleanup()'
--   );
--
-- (executa todo dia às 03:00 UTC)

CREATE OR REPLACE FUNCTION run_data_retention_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Notificações: 90 dias
  DELETE FROM public.notifications
  WHERE created_at < now() - interval '90 days';

  -- Chat do mural: 180 dias
  DELETE FROM public.chat_messages
  WHERE timestamp < now() - interval '180 days';

  -- Reservas: 12 meses (coluna "date")
  DELETE FROM public.reservations
  WHERE (reservations.date::date) < (current_date - interval '12 months');

  -- Encomendas: 12 meses
  DELETE FROM public.packages
  WHERE received_at < now() - interval '12 months';

  -- Ocorrências: 24 meses (coluna "date")
  DELETE FROM public.occurrences
  WHERE (occurrences.date::date) < (current_date - interval '24 months');

  -- Convites staff: 30 dias após uso ou expirados
  DELETE FROM public.staff_invites
  WHERE (used_at IS NOT NULL AND used_at < now() - interval '30 days')
     OR (used_at IS NULL AND expires_at < now());

  -- Convites morador: 30 dias após uso ou expirados
  DELETE FROM public.resident_invites
  WHERE (used_at IS NOT NULL AND used_at < now() - interval '30 days')
     OR (used_at IS NULL AND expires_at < now());
END;
$$;

COMMENT ON FUNCTION run_data_retention_cleanup() IS 'Aplica política de retenção (DATA_RETENTION_POLICY.md). Agendar com pg_cron 1x/dia.';
