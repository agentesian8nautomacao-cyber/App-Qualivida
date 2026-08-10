# Scripts de manutenção – Retenção de dados

## Script de limpeza

- **`run-data-retention-cleanup.sql`** – Aplica a política de retenção definida em `DATA_RETENTION_POLICY.md` (raiz do projeto).

Execute 1x por dia (recomendado: madrugada, ex. 03:00 UTC).

## Como executar

### Opção 1: pg_cron (recomendado no Supabase)

1. **Ativar a extensão pg_cron** (obrigatório; sem isso aparece "schema cron does not exist"):
   - No **SQL Editor** do Supabase, execute:
     ```sql
     CREATE EXTENSION IF NOT EXISTS pg_cron;
     ```
   - Ou no **Dashboard**: Database → **Extensions** → procure **pg_cron** → Enable.
2. Aplique as migrações do projeto (a migração `20250301090000_enable_pg_cron.sql` ativa o pg_cron; a `20250301100000_data_retention_cleanup_function.sql` cria a função de limpeza).
3. No **SQL Editor**, agende o job (1x por dia às 03:00 UTC):

   ```sql
   SELECT cron.schedule(
     'data-retention-daily',
     '0 3 * * *',
     'SELECT run_data_retention_cleanup()'
   );
   ```

4. Para remover o agendamento: `SELECT cron.unschedule('data-retention-daily');`

**Se pg_cron não estiver disponível** no seu plano Supabase, use a Opção 2 (execução manual do script ou agende o script por outro meio, ex.: cron do sistema ou GitHub Actions).

### Opção 2: Execução manual

1. Abra o **SQL Editor** do Supabase.
2. Cole o conteúdo de `run-data-retention-cleanup.sql`.
3. Execute.

### Opção 3: Linha de comando (psql)

```bash
psql "$DATABASE_URL" -f supabase/scripts/run-data-retention-cleanup.sql
```

Use uma conexão com permissão de `DELETE` nas tabelas (ex.: `service_role` ou usuário de manutenção). Em projetos com RLS, o cron deve rodar com role que bypassa RLS ou use uma função `SECURITY DEFINER` que execute os DELETEs.

## Permissões

O script faz `DELETE` em:

- `public.notifications`
- `public.chat_messages`
- `public.reservations`
- `public.packages`
- `public.occurrences`
- `public.staff_invites`
- `public.resident_invites`

Não altera: `boletos`, `admin_audit_logs`, `residents`, `users`, `staff`, `areas`.
