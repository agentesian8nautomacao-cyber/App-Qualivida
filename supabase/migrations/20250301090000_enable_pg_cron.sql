-- Ativa a extensão pg_cron para agendar jobs (ex.: limpeza de retenção de dados).
-- Depois de aplicar esta migração, agende o job no SQL Editor:
--   SELECT cron.schedule('data-retention-daily', '0 3 * * *', 'SELECT run_data_retention_cleanup()');
--
-- Se aparecer "schema cron does not exist", execute primeiro no SQL Editor:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
-- (no Supabase isso costuma ser permitido; em alguns planos a extensão pode estar em "extensions" no Dashboard)

CREATE EXTENSION IF NOT EXISTS pg_cron;
