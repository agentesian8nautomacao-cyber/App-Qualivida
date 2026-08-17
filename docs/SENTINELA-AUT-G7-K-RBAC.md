# SENTINELA AUT — G7-K-RBAC

**Data:** 2026-08-15 (prep) / 2026-08-16 (APPLY + CLOSEOUT)  
**Status:** `G7-K-RBAC = CLOSED / PASS`  
**APPLY:** executado 2026-08-16T17:20:41Z → 2026-08-16T17:20:43Z (UTC)

---

## Decisão

**OPÇÃO 1** — permission dedicada `events.view`.

- `sentinela.view` permanece só para página Sentinela AI.
- Não criar `sentinela.events.view`.
- Event Store = auditoria/observabilidade operacional, não UI/IA.

---

## Permission

| Campo | Valor |
|--------|--------|
| `key` | `events.view` |
| `label` | `Eventos — visualizar auditoria` |
| `description` | N/A (schema LIVE não tem coluna `description`) |

---

## Grants LIVE (após APPLY 009)

```text
sindico        → events.view
administradora → events.view
```

Sem grant para: `cabo_turma`, `porteiro`, `morador`.

---

## Artefatos

| Artefato | Path |
|----------|------|
| Migration | `supabase/migrations/20260815230000_009_events_view_permission.sql` |
| Rollback | `supabase/migrations/20260815230000_009_events_view_permission.rollback.sql` |
| Pre-check | `docs/evidence/M-G7K-EVENTS-VIEW-RBAC-PRECHECK-LIVE.sql` |
| APPLY | `docs/evidence/results/SENTINELA-G7-K-RBAC-APPLY-2026-08-16.txt` |
| CLOSEOUT | `docs/evidence/results/SENTINELA-G7-K-RBAC-CLOSEOUT-2026-08-16.txt` |
| Backup | `docs/evidence/backups/backup-pre-g7k-009-2026-08-16-141917.dump` |
| TS mirror | `api/v1/_lib/authz/catalog.ts` (`events.view`) |
| Testes | `api/v1/_lib/authz/g7k.rbac.test.ts` |

---

## Fronteiras

- DATABASE CHANGES = somente 009
- EVENT STORE SCHEMA = inalterado
- GET `/api/v1/events` = **não iniciado**
- WhatsApp / n8n produção = 0

---

## Próximo gate

**G7-K — API `events.view`** — somente com autorização explícita.
