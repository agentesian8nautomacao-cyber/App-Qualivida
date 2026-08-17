# MASTER FASE C — CLOSEOUT CHECKLIST

**Status deste arquivo:** TEMPLATE — APPLY **ainda não executado**  
**Data de preparação:** 2026-08-17  
**Runbook:** `docs/evidence/results/MASTER-FASE-C-APPLY-RUNBOOK.md`  
**UP:** `supabase/migrations/20260817190000_010_platform_master_fase_c.sql`  
**ROLLBACK:** `supabase/migrations/20260817190000_010_platform_master_fase_c.rollback.sql`  

Senhas / e-mails reais / tokens: **não registrar neste closeout**.

```text
MIGRATION APPLY = NOT EXECUTED
MIGRATION = READY FOR MANUAL APPLY
M5 = NOT READY
```

Preencher **somente após** execução manual no SQL Editor + queries read-only do runbook.

---

## Critérios (pós-APPLY)

Marcar PASS / FAIL / NOT RUN. FAIL em qualquer linha de schema/RLS/API = closeout incompleto.

| Critério | Esperado | Resultado | Evidência (colar resumo, sem secrets) |
|----------|----------|-----------|----------------------------------------|
| Migration APPLY | SQL Editor, arquivo UP, uma vez, sem BLOCKED | NOT RUN | |
| Schema | `platform_admins` + `platform_audit_events` existem; colunas/constraints do runbook §5.B–C | NOT RUN | |
| RLS | quatro tabelas `relrowsecurity = true`; 7 policies FASE C; snapshot pré-C intacto | NOT RUN | |
| Function | `is_platform_admin()` 0 args, SECURITY DEFINER, EXECUTE authenticated, **não** anon | NOT RUN | |
| Privileges | anon sem admin em `platform_*`; authenticated só o esperado (+ RLS) | NOT RUN | |
| API Auth | anon 401; non-master 403; suspended 403; active Master 200 | NOT RUN | |
| Audit | LOGIN / ACCESS_DENIED / VIEW / UPDATE; actor = `auth.uid()`; sem UPDATE/DELETE cliente | NOT RUN | |
| Master Login | `/master/login` → session 200 (após provisionamento) | NOT RUN | |
| Operational RBAC regression | login operacional + 5 roles intactos; sem ALTER residents/roles/memberships | NOT RUN | |
| Service Role Exposure | sem `VITE_SUPABASE_SERVICE*`; API Master usa anon + JWT | NOT RUN | |
| M5 | NOT READY | **NOT READY** | não tocado |

---

## WARNs (não bloquear closeout se o resto PASS)

| WARN | Status |
|------|--------|
| GRANT UPDATE `organizations` table-wide | conhecido; não corrigido nesta fase |
| `search_path = public` | conhecido; não corrigido nesta fase |
| Rollback não reverte GRANTs / ENABLE RLS | conhecido; não corrigido nesta fase |

---

## Veredito (preencher depois)

```text
Migration APPLY = ______
Schema = ______
RLS = ______
Function = ______
Privileges = ______
API Auth = ______
Audit = ______
Master Login = ______
Operational RBAC regression = ______
Service Role Exposure = ______
M5 = NOT READY
```

Alvo quando o operador concluir:

```text
Migration APPLY = PASS
Schema = PASS
RLS = PASS
Function = PASS
Privileges = PASS
API Auth = PASS
Audit = PASS
Master Login = PASS
Operational RBAC regression = PASS
Service Role Exposure = PASS
M5 = NOT READY
```

Nenhuma senha nesta saída.
