# PRE-BACKUP SECURITY REVIEW — 2026-08-13

**Classificação:** **BLOCKED**  
**Modo:** READ-ONLY — backup **não** executado; M1 **não** executada  
**Project ref de produção:** `zaemlxjwhzrfmowbckmk`  
**HEAD git:** `7ee0131` (`chore: protect local environment secrets`)  
**Tag baseline:** `pre-multitenant-baseline` → `f630726` (intacta)

| Declaração desta tarefa | Valor |
|-------------------------|--------|
| Banco / Storage / RLS / código / deploy | **NÃO ALTERADO** |
| Backup verificável | **NÃO EXECUTADO** |
| M1 | **NÃO** |

---

## Decisão

**BLOCKED** — não assinar um backup como baseline **pós-R2A-MIN**.

Motivo principal (check 3): `boletos.public = false` e ausência de SELECT público **não** estão comprovados em SQL 2026-08-13. D2/D5 desse dia estão **PENDING**. Probe anon `list` em `boletos` retornou HTTP **200**.

Um dump de produção **ainda é desejável** (estado documentado, mesmo com dívidas D2). Não é o mesmo que **READY FOR BACKUP** como snapshot de segurança pós-remediação Storage.

Para desbloquear: operador executa `D2-STORAGE-LIVE.sql` + `D5-STORAGE-EVIDENCE.sql` no SQL Editor de `zaemlxjwhzrfmowbckmk` e arquiva saída real (substituir só o conteúdo PENDING de `*-2026-08-13.txt`; **não** apagar `*-2026-08-12.txt`).

---

## 1. Project ref de produção

| Campo | Valor |
|-------|--------|
| Ref | **`zaemlxjwhzrfmowbckmk`** |
| URL | `https://zaemlxjwhzrfmowbckmk.supabase.co` |
| Prova | Bundle Vercel `index-BrROEMGa.js`; `.env.localnet`; audits Gate 0 / 0.1 |
| Ref legado a **não** usar | `asfcttxrrfwqunljorvm` |
| **Classificação** | **PASS** |

---

## 2. RLS

### Flag ON (D1 — 2026-08-12T20:49:00Z)

**PASS** — 19/19 tabelas prioritárias `rls_enabled=true` (`rls_forced=false`).

admin_audit_logs, app_config, areas, boletos, notice_reads, notices, notifications, occurrences, package_items, packages, permissions, reservations, resident_invites, residents, role_permissions, roles, staff, staff_invites, users.

D1 **não** foi reexecutado em 2026-08-13. Assumir estabilidade da flag ON; R1/R2A-MIN não desligam RLS.

### Policies (D2)

| Coleta | Status | Conteúdo relevante |
|--------|--------|-------------------|
| 2026-08-12 | **FAIL** (efetividade) | `{public}` + `true` em massa (users, staff, residents, boletos CRUD, notices, notifications, occurrences, areas, app_config, reservations, package_items); `packages` Allow all **no snapshot** (antes da R1) |
| 2026-08-13 | **PENDING** | `pg_policies` não lido |

**RLS ON ≠ isolamento.** Dívida D2 permanece para M1/go-live multi-tenant, **exceto** o que R1 já fechou em packages (ver §4).

---

## 3. Storage (`boletos`)

| Check | Última prova SQL | 2026-08-13 |
|-------|------------------|------------|
| Bucket existe | D5 2026-08-12: `id=name=boletos` | não relido |
| `public=false` | D5 2026-08-12: **`public=true`** | **NÃO COMPROVADO** |
| `boletos_read_all` `{public}` | D2 2026-08-12: **presente** | **NÃO COMPROVADO** ausente |
| INSERT `boletos_insert_authenticated` | D2: authenticated + `bucket_id='boletos'` | **NÃO COMPROVADO** inalterado |
| UPDATE `boletos_update_authenticated` | D2: idem | **NÃO COMPROVADO** inalterado |

Probe anon (2026-08-13T12:50Z): `POST /storage/v1/object/list/boletos` → **200** (prefixo `original`). Incompatível com o **esperado** pós-R2A-MIN; **não** substitui D5.

R2A-MIN no repo do agente: tentativa **não aplicada** (`results/R2A-MIN-LIVE-2026-08-13.txt`). Afirmação de execução pelo operador **sem** SQL pós = **não certificada**.

---

## 4. `packages` (R1)

| Item | Valor |
|------|--------|
| Evidência | `results/R1-PACKAGES-POST-2026-08-12.txt` (2026-08-12T23:32:00Z) |
| `"Allow all operations on packages"` | **AUSENTE** |
| Restantes | 6 policies da migration 006 |
| Releitura 2026-08-13 | **não feita** |
| **Classificação R1** | **PASS** (última prova operador) |

Não modificar nesta revisão. D2-2026-08-12 **não** deve ser usado como estado atual de packages (é pré-R1).

---

## 5. `staff_invites`

| Item | Estado |
|------|--------|
| Token | **plaintext** (`token` UNIQUE) — audit 2026-08-12 |
| Policies LIVE (D2 2026-08-12) | `staff_invites_insert_admin` / `staff_invites_select_admin` → `is_admin_for_staff_invites()`, `{authenticated}` |
| Tenant / `condominium_id` | **AUSENTE** |
| **Classificação** | **REVIEW REQUIRED** — **não** corrigir agora; **não** bloqueia dump se o manifesto registrar o risco |

---

## 6. Membership / RBAC

Não modificado. Sem `tenant_memberships` live. Fonte de verdade alvo: membership → role → permission (R2A.2). Helpers ≠ RBAC. **Nenhuma ação.**

---

## 7. Migrations pendentes (somente identificar)

| Arquivo | Papel | LIVE |
|---------|--------|------|
| `20260812220000_r1_packages_drop_allow_all_policy.sql` | R1 packages | **Aplicada** (evidência R1); arquivo **não** está no commit HEAD |
| `20260812230000_r2a_storage_boletos_security.sql` | R2A completa (helpers) | **NÃO executar** (R2A.1 BLOCKED / R2A.2) |
| `20260813090000_r2a_min_remove_public_exposure.sql` | R2A-MIN | **Aplicação LIVE não certificada** |
| `*.rollback.sql` (R1/R2A/R2A-MIN) | Emergencial | **Não** usar como fluxo |
| M1–M16 (plano Fase 1) | org/condo/memberships/RLS | **Não criadas / não executar** |
| `20250225*`–`20250301*` | staff_invites, RBAC, cron | Históricas no repo (assumidas já aplicadas; não revalidar aqui) |

---

## 8. Git

| Campo | Valor |
|-------|--------|
| Branch | `master` |
| HEAD | `7ee0131d0e58f39f4a36d0e0125b7000ae760904` |
| Tag `pre-multitenant-baseline` | `f630726` — **não** movida |
| Working tree | **SUJA** |

Não commitado (amostra `git status`):

- `M` `docs/FASE-1-ARQUITETURA-MULTITENANT.md`, `docs/FASE-1-MIGRATION-PLAN.md`
- `??` `docs/OPERAUT-ARCHITECTURE-ADDENDUM.md`, `docs/evidence/`
- `??` migrations R1 / R2A / R2A-MIN (+ rollbacks)

Backup **de banco** não exige working tree limpa. Não commitar `.env.localnet` (anon key). Esta revisão **não** cria commit.

---

## 9. Evidências

| Item | Artefato | Classificação |
|------|----------|----------------|
| **D1** | `results/D1-RLS-LIVE-2026-08-12.txt` | **PASS** (flag RLS) |
| **D2** | `…-2026-08-12.txt` **FAIL** efetividade; `…-2026-08-13.txt` **PENDING** | **PENDING** para pós-R2A-MIN |
| **D5** | `…-2026-08-12.txt` **FAIL** (`public=true`); `…-2026-08-13.txt` **PENDING** | **PENDING** para `public=false` |
| **R1** | `R1-PACKAGES-*` + `results/R1-PACKAGES-POST-2026-08-12.txt` | **PASS** |
| **R2A-MIN** | plano + migration + pre-exec **READY**; `R2A-MIN-LIVE-2026-08-13.txt` = agente **não aplicou**; SQL pós **ausente** | **NOT CERTIFIED** |

---

## Resíduos de segurança (esperados no dump, se feito agora)

Documentar no manifesto de backup, **não** corrigir nesta tarefa:

- Policies `{public}` `true` em tabelas operacionais (D2-2026-08-12)
- Storage boletos: estado **incerto** vs `public=true` certificado em D5-2026-08-12
- INSERT/UPDATE Storage autenticado amplo (TOO_PERMISSIVE)
- `staff_invites` token claro, sem site
- OWNERSHIP boletos = C

---

## Como passar a READY FOR BACKUP

1. SQL Editor **somente** no ref `zaemlxjwhzrfmowbckmk`.  
2. Arquivar D2 + D5 **2026-08-13** com linhas reais.  
3. Confirmar: `boletos.public=false`; `boletos_read_all` ausente; INSERT/UPDATE inalterados; packages sem Allow all.  
4. Aí sim: seguir `BACKUP-VERIFICAVEL.md` (Dashboard PITR/`pg_dump` + manifesto). Restore só em ambiente separado.

Se D5 continuar `public=true`, o backup ainda pode ser feito como **baseline pré-fechamento Storage**, com FAIL explícito no manifesto — isso seria outro rótulo, não o desta revisão.

---

*READ-ONLY. Backup não executado. M1 não executada.*
