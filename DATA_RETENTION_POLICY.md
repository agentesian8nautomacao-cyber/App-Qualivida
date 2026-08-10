# Política de Retenção de Dados

Este documento define a política oficial de retenção de dados do sistema de gestão condominial. O objetivo é manter o banco saudável, reduzir custos de armazenamento e cumprir boas práticas, preservando dados sensíveis conforme exigido por lei.

---

## 1. Dados operacionais (retenção por prazo definido)

| Tabela | Manter por | Ação após o prazo |
|--------|------------|-------------------|
| **packages** (encomendas) | 12 meses | Apagar ou arquivar |
| **occurrences** (ocorrências) | 24 meses | Purge automática (exclusão física) |
| **reservations** (reservas) | 12 meses | Apagar |
| **notifications** (notificações) | 90 dias | Apagar |
| **chat_messages** (chat do mural) | 180 dias | Apagar |
| **staff_invites** (convites staff) | 30 dias após uso ou expirados | Apagar |
| **resident_invites** (convites morador) | 30 dias após uso ou expirados | Apagar |

**Critérios técnicos:**

- **packages:** baseado em `received_at` (data de recebimento da encomenda).
- **occurrences:** baseado em `date` (data da ocorrência). Inclui registros com soft delete (`deleted_by_admin` / `deleted_by_resident`).
- **reservations:** baseado em `date` (data da reserva).
- **notifications:** baseado em `created_at`.
- **chat_messages:** baseado em `timestamp`.
- **staff_invites / resident_invites:** apagar onde `used_at IS NOT NULL AND used_at < now() - interval '30 days'` ou `used_at IS NULL AND expires_at < now()`.

---

## 2. Casos sensíveis (não apagar sem política formal)

### Boletos (`boletos`)

- **Não apagar** sem política formal e backup.
- **Recomendação:** manter no mínimo **5 anos** por questão fiscal e tributária.
- Exclusão somente com decisão formal do condomínio e procedimento documentado.

### Logs de auditoria (`admin_audit_logs`)

- **Não apagar** em operação normal.
- Exclusão apenas se houver **exigência legal** (ex.: LGPD, ordem judicial) ou procedimento interno aprovado.
- Esses registros são fundamentais para auditoria e conformidade.

---

## 3. Dados que permanecem (núcleo do sistema)

Não devem ser excluídos por rotina de limpeza:

- **residents** – Cadastro de moradores
- **users** – Usuários administrativos (porteiro, síndico, admin)
- **staff** – Cadastro de funcionários
- **areas** – Áreas comuns para reservas
- **boletos** – Conforme item 2 (retenção mínima 5 anos)
- **admin_audit_logs** – Conforme item 2

---

## 4. Execução da limpeza

- **Script SQL (manual):** `supabase/scripts/run-data-retention-cleanup.sql`
- **Função para cron:** `run_data_retention_cleanup()` (criada pela migração `supabase/migrations/20250301100000_data_retention_cleanup_function.sql`). A função usa `SECURITY DEFINER` para executar os DELETEs com permissões adequadas.
- **Frequência recomendada:** 1x por dia (ex.: 03:00 UTC).
- **Formas de agendamento:**
  - **pg_cron** (Supabase: Database → Extensions → pg_cron) – agendar com `SELECT cron.schedule('data-retention-daily', '0 3 * * *', 'SELECT run_data_retention_cleanup()');` (detalhes em `supabase/scripts/README.md`).
  - Execução manual: SQL Editor ou `psql` com o script acima.

Em projetos com RLS, a função `run_data_retention_cleanup` roda com `SECURITY DEFINER`, permitindo a limpeza independente das políticas RLS.

---

## 5. Revisão desta política

- Revisar anualmente ou quando houver mudança regulatória (ex.: LGPD, normas fiscais).
- Alterações devem ser aprovadas e documentadas; os scripts de limpeza e este arquivo devem ser atualizados em conjunto.

---

*Última atualização: março de 2025.*
