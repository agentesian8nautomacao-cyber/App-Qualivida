# PRE-M1 — Baseline Git e checkpoint

**Data UTC:** 2026-08-13  
**Modo:** READ-ONLY — sem commit, sem reset, sem delete, **sem M1**  
**Classificação:** **BLOCKED — WORKTREE NOT CLEAN**

Nada foi apagado, resetado ou commitado nesta tarefa.

---

## Identidade do repositório

| Campo | Valor |
|-------|--------|
| Git inicializado | **SIM** (`git rev-parse --is-inside-work-tree` = true) |
| Branch atual | **`master`** |
| Upstream / `origin` | **não configurado** nesta sessão (`origin/master` inexistente) |
| Commit atual (HEAD) | `7ee0131d0e58f39f4a36d0e0125b7000ae760904` |
| Short | `7ee0131` |
| Parent | `f6307264d5aef97d2c8aed51a4c8d2b90d5ef902` |
| Mensagem | `chore: protect local environment secrets` |
| Autor | morais705412 |
| Data commit | 2026-08-12T16:39:20-03:00 |
| Working tree | **SUJA** |

---

## Tag já existente

| Tag | SHA | Nota |
|-----|-----|------|
| `pre-multitenant-baseline` | `f6307264d5aef97d2c8aed51a4c8d2b90d5ef902` | **intacta**; é o **parent** de HEAD, não o HEAD atual |

HEAD (`7ee0131`) = baseline de código **após** proteção de secrets, **antes** das evidências/migrations R1–R2A-MIN no índice.

---

## Status (`git status --porcelain`)

### Modificados (tracked)

| Arquivo | Diff (aprox.) |
|---------|----------------|
| `docs/FASE-1-ARQUITETURA-MULTITENANT.md` | +/− (180 linhas tocadas no stat) |
| `docs/FASE-1-MIGRATION-PLAN.md` | +/− (318 linhas tocadas no stat) |

Stat combinado: `2 files changed, 270 insertions(+), 228 deletions(-)`.

### Não rastreados — docs

- `docs/OPERAUT-ARCHITECTURE-ADDENDUM.md`
- `docs/evidence/` (árvore inteira; ver § evidências)

### Não rastreados — migrations novas

- `supabase/migrations/20260812220000_r1_packages_drop_allow_all_policy.sql`
- `supabase/migrations/20260812220000_r1_packages_drop_allow_all_policy.rollback.sql`
- `supabase/migrations/20260812230000_r2a_storage_boletos_security.sql`
- `supabase/migrations/20260812230000_r2a_storage_boletos_security.rollback.sql`
- `supabase/migrations/20260813090000_r2a_min_remove_public_exposure.sql`
- `supabase/migrations/20260813090000_r2a_min_remove_public_exposure.rollback.sql`

Este arquivo (`PRE-M1-GIT-BASELINE-2026-08-13.md`) também fica **untracked** após ser criado.

---

## Migrations existentes

### Rastreadas no HEAD (`git ls-files`)

- `20250225000000_staff_invites.sql`
- `20250226000000_staff_invites_rls_allow_adm_and_staff.sql`
- `20250226100000_resident_invites.sql`
- `20250301090000_enable_pg_cron.sql`
- `20250301100000_data_retention_cleanup_function.sql`
- `20250301120000_rbac_roles_permissions.sql`
- `20250301130000_rbac_role_permissions_allow_staff_admin.sql`
- `20250301140000_rbac_rpc_grant_revoke.sql`
- `20250301150000_rbac_grant_all_permissions_to_all_roles.sql`
- `20250301160000_rbac_rpc_normalize_role.sql`
- `20250301170000_rbac_permissions_granular_pages.sql`

### No disco e **fora** do HEAD

R1, R2A completa, R2A-MIN (+ rollbacks) — listadas acima. **M1 não existe** como arquivo de migration.

---

## `docs/evidence`

Pasta **não rastreada** no HEAD. Conteúdo no disco inclui scripts D1/D2/D5, audits, R1/R2/R2A, resultados `results/*`, manifesto de backup PENDING. É a evidência pré-M1; ainda **não** faz parte do commit `7ee0131`.

---

## Baseline esperada (quando a worktree estiver limpa)

Para M1, a baseline git desejada é **um commit** que contenha:

1. HEAD atual (`7ee0131`) **mais**
2. docs Fase 1 / Operaut (já modificados/novos);
3. `docs/evidence/` (gates + resultados);
4. SQL R1 / R2A-MIN (e R2A completa **só como proposta não executada**, se versionada).

**Não** incluir `.env.localnet` nem dumps de banco.

Enquanto houver `M`/`??`, **não** há SHA único que represente esse conjunto.

---

## Tag recomendada

| Tag | Quando |
|-----|--------|
| `pre-multitenant-baseline` (`f630726`) | Já existe — **não** mover |
| **`pre-m1-checkpoint`** (recomendado) | **Após** commit explícito da worktree limpa (evidências + docs + SQL de remediação). Apontar para **esse** commit, não para `f630726` |

Não criar a tag nesta tarefa.

---

## Classificação

# BLOCKED — WORKTREE NOT CLEAN

Há 2 arquivos modificados e dezenas de untracked (`docs/evidence/`, Operaut, 6 SQL novos).  
Não corrigido automaticamente. M1 **não** executada.

Para desbloquear o checkpoint: o operador decide o que entra no commit (autorização explícita), depois tag `pre-m1-checkpoint`.
