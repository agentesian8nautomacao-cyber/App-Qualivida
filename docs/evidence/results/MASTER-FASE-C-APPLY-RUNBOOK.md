# MASTER FASE C — APPLY RUNBOOK

**Status:** MIGRATION = READY FOR MANUAL APPLY  
**Data:** 2026-08-17  
**Este documento NÃO aplica SQL.** Não contém CLI de APPLY.  
**M5:** NOT READY (não tocado)  
**Plano M1–M16:** não alterado  

Senhas, e-mails de sócios e tokens **não** constam neste arquivo.

Pré-requisito: `docs/evidence/results/MASTER-READINESS-AUDIT.md` §17  
`PRE-APPLY SECURITY GATE = PASS`

```text
Executar manualmente no SQL Editor do projeto Supabase alvo.
NÃO executar via agente, CLI, ou script automático nesta etapa.
```

---

## 1. Objetivo

Criar a infraestrutura Master da plataforma (IAM de plataforma + auditoria + RLS aditiva + função `is_platform_admin()`).

Não cria billing, planos, MRR, nem altera `residents` / `users` / `public.roles` / `tenant_memberships`.

---

## 2. Arquivos

| Papel | Caminho |
|-------|---------|
| **UP** | `supabase/migrations/20260817190000_010_platform_master_fase_c.sql` |
| **ROLLBACK** | `supabase/migrations/20260817190000_010_platform_master_fase_c.rollback.sql` |

Projeto alvo (documentado nas evidências M1): operador confirma no dashboard Supabase antes de colar o SQL.

---

## 3. PRE-APPLY CHECK (somente leitura)

**Não executar neste gate.** Copiar no SQL Editor **antes** do APPLY. Esperado: `precheck_ok = true`.

Se qualquer linha `ok = false`, **STOP**. Não aplicar.

```sql
-- MASTER FASE C — PRE-APPLY READ-ONLY
-- Sem INSERT/UPDATE/DELETE/DDL.

WITH expected AS (
  SELECT
    to_regclass('public.organizations') IS NOT NULL AS organizations_exists,
    to_regclass('public.condominiums') IS NOT NULL AS condominiums_exists,
    to_regclass('public.platform_admins') IS NULL AS platform_admins_absent,
    to_regclass('public.platform_audit_events') IS NULL AS platform_audit_events_absent,
    NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'is_platform_admin'
        AND p.pronargs = 0
    ) AS is_platform_admin_absent
),
rls AS (
  SELECT
    c.relname,
    c.relrowsecurity AS rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('organizations', 'condominiums')
),
snapshot_policies AS (
  SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    roles
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('organizations', 'condominiums')
  ORDER BY tablename, policyname
)
SELECT
  e.organizations_exists,
  e.condominiums_exists,
  (SELECT rls_enabled FROM rls WHERE relname = 'organizations') AS organizations_rls_enabled,
  (SELECT rls_enabled FROM rls WHERE relname = 'condominiums') AS condominiums_rls_enabled,
  e.platform_admins_absent,
  e.platform_audit_events_absent,
  e.is_platform_admin_absent,
  (
    e.organizations_exists
    AND e.condominiums_exists
    AND COALESCE((SELECT rls_enabled FROM rls WHERE relname = 'organizations'), false)
    AND COALESCE((SELECT rls_enabled FROM rls WHERE relname = 'condominiums'), false)
    AND e.platform_admins_absent
    AND e.platform_audit_events_absent
    AND e.is_platform_admin_absent
  ) AS precheck_ok
FROM expected e;

-- Snapshot de policies pré-existentes (guardar o resultado).
-- Pós-APPLY: todas estas linhas devem continuar existindo.
SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'condominiums')
ORDER BY tablename, policyname;
```

Esperado (live conhecido M1 closeout):

| Check | Esperado |
|-------|----------|
| `organizations` existe | true |
| `condominiums` existe | true |
| `organizations.rls_enabled` | true |
| `condominiums.rls_enabled` | true |
| `platform_admins` NÃO existe | true |
| `platform_audit_events` NÃO existe | true |
| `is_platform_admin()` NÃO existe | true |
| policies org/condo pré-C | 0 linhas (M1) **ou** o snapshot acima intacto |

---

## 4. APPLY MANUAL

```text
Executar manualmente no SQL Editor do projeto Supabase alvo.
```

1. Abrir o SQL Editor do projeto correto.  
2. Confirmar `precheck_ok = true`.  
3. Abrir o arquivo **UP** no repositório:  
   `supabase/migrations/20260817190000_010_platform_master_fase_c.sql`  
4. Colar o conteúdo **integral** no editor.  
5. Executar **uma vez**.  
6. Se o guard `MASTER FASE C BLOCKED` disparar: **STOP** (tabela já existe ou M1 ausente).  
7. Não executar o rollback salvo incidente documentado.

**Não usar** (nesta etapa / neste runbook):

* `supabase db push`
* `psql -f …`
* qualquer script de agente que conecte ao banco

---

## 5. POST-APPLY VERIFICATION (somente leitura)

**Não executar agora.** Após o APPLY manual, correr as queries abaixo.

Nota de schema: `platform_audit_events` usa **`occurred_at`**, não `created_at`. A verificação abaixo confere a coluna real.

### 5.A Tabelas

```sql
SELECT
  to_regclass('public.platform_admins') IS NOT NULL AS platform_admins_exists,
  to_regclass('public.platform_audit_events') IS NOT NULL AS platform_audit_events_exists;
```

Esperado: ambos `true`.

### 5.B Colunas

```sql
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('platform_admins', 'platform_audit_events')
ORDER BY table_name, ordinal_position;
```

Esperado `platform_admins`: `id`, `user_id`, `role`, `status`, `created_at`, `created_by`.  
Esperado `platform_audit_events`: `id`, `occurred_at`, `actor_user_id`, `action`, `resource_type`, `resource_id`, `metadata`.

### 5.C Constraints

```sql
-- Só após o UP. `::regclass` em tabela inexistente gera 42P01.
SELECT
  n.nspname || '.' || c.relname AS table_name,
  con.conname,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('platform_admins', 'platform_audit_events')
ORDER BY table_name, con.conname;
```

Esperado em `platform_admins`:

* `UNIQUE (user_id)` — `platform_admins_user_id_key`
* FK `user_id` → `auth.users(id)` ON DELETE RESTRICT
* CHECK `role IN ('platform_owner', 'platform_admin')`
* CHECK `status IN ('active', 'suspended')`

### 5.D RLS

```sql
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'platform_admins',
    'platform_audit_events',
    'organizations',
    'condominiums'
  )
ORDER BY c.relname;
```

Esperado: `rls_enabled = true` nas quatro.

### 5.E Policies FASE C

```sql
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'platform_admins_select_self',
    'platform_audit_select_admin',
    'platform_audit_insert_admin',
    'platform_audit_insert_access_denied',
    'organizations_select_platform_admin',
    'organizations_update_platform_admin',
    'condominiums_select_platform_admin'
  )
ORDER BY tablename, policyname;
```

Esperado: **7** policies. Nenhuma usa `USING (true)`. Nenhuma `TO anon`.

Policies pré-existentes (snapshot §3) devem **ainda** aparecer em:

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'condominiums')
ORDER BY tablename, policyname;
```

FASE C **não** faz `DROP POLICY` de policies alheias. Se o snapshot pré-APPLY tinha N linhas não-C, o pós-APPLY deve ter N + 3 (org select, org update, condo select).

### 5.F Função `is_platform_admin()`

```sql
SELECT
  p.proname,
  p.pronargs AS arg_count,
  p.prosecdef AS security_definer,
  p.proconfig AS config,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_platform_admin';

SELECT
  r.rolname,
  has_function_privilege(r.oid, 'public.is_platform_admin()', 'EXECUTE') AS can_execute
FROM pg_roles r
WHERE r.rolname IN ('anon', 'authenticated', 'public')
ORDER BY r.rolname;
```

Esperado:

* existe; `arg_count = 0`; `args` vazio  
* `security_definer = true`  
* `config` contém `search_path=public` (WARN conhecido: não inclui `pg_temp`)  
* `authenticated.can_execute = true`  
* `anon.can_execute = false`

### 5.G Grants

```sql
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'platform_admins',
    'platform_audit_events',
    'organizations',
    'condominiums'
  )
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;
```

Esperado (FASE C):

| Tabela | anon | authenticated (mínimo FASE C) |
|--------|------|-------------------------------|
| `platform_admins` | sem privilégio administrativo | SELECT |
| `platform_audit_events` | sem | SELECT, INSERT |
| `organizations` | sem GRANT novo a anon | SELECT, UPDATE |
| `condominiums` | sem GRANT novo a anon | SELECT |

`PUBLIC` não deve ter privilégios administrativos inesperados nas tabelas `platform_*`.  
Defaults do projeto Supabase podem listar grants extras em `authenticated`; o gate de segurança trata o **efeito** via RLS (sem policy = DENY). Registrar o resultado real no closeout.

---

## 6. SECURITY TEST MATRIX (pós-APPLY + contas reais)

Executar contra a API (`/api/master/*`) com Bearer JWT. A UI não é autoridade.

| # | Caller | Endpoint | Esperado |
|---|--------|----------|----------|
| 1 | anonymous (sem Authorization) | `GET /api/master/session` | **401** |
| 2 | anonymous | `GET /api/master/dashboard` | **401** |
| 3 | anonymous | `GET /api/master/organizations` | **401** |
| 4 | anonymous | `GET /api/master/organizations/:id` | **401** |
| 5 | authenticated non-master | `GET /api/master/session` | **403** |
| 6 | authenticated non-master | `GET /api/master/dashboard` | **403** |
| 7 | authenticated non-master | `GET /api/master/organizations` | **403** |
| 8 | authenticated non-master | `GET /api/master/organizations/:id` | **403** |
| 9 | platform_admin **suspended** | `GET /api/master/session` | **403** (`SUSPENDED`) |
| 10 | platform_admin **suspended** | demais `/api/master/*` | **403** |
| 11 | platform_admin **active** | `GET /api/master/session` | **200** |
| 12 | platform_admin **active** | `GET /api/master/dashboard` | **200** |
| 13 | platform_admin **active** | `GET /api/master/organizations` | **200** |
| 14 | platform_admin **active** | `GET /api/master/organizations/:id` | **200** (id existente) |

Cobertura unitária equivalente (sem live): `api/master/_lib/fase-c.master-authz.test.ts`.

### 6.1 Audit tests

Com Master active (via API, não PostgREST direto):

| Ação API | Evento esperado | `actor_user_id` |
|----------|-----------------|-----------------|
| `GET /session` 200 | `MASTER_LOGIN` | JWT `auth.uid()` |
| non-master `GET /session` 403 | `MASTER_ACCESS_DENIED` | JWT do não-Master |
| `GET /organizations` 200 | `ORGANIZATION_VIEW` | Master |
| `PATCH /organizations/:id` 200 | `ORGANIZATION_UPDATE` | Master |

Spoofing (SQL Editor **como o papel `authenticated` da vítima**, não como `postgres`/`service_role`):

```sql
-- Conceito: NÃO executar como superuser (bypass RLS).
-- INSERT com actor_user_id = outro UUID deve falhar (WITH CHECK actor_user_id = auth.uid()).
-- UPDATE/DELETE em platform_audit_events deve falhar (sem policy).
```

Esperado: INSERT actor B = **DENY**; UPDATE audit = **DENY**; DELETE audit = **DENY**.

### 6.2 Organization / condominium security (PostgREST ou SQL como role)

| Sujeito | SELECT organizations | UPDATE organizations | SELECT condominiums |
|---------|----------------------|----------------------|---------------------|
| operacional (`authenticated`, não Master) | **DENY** | **DENY** | **DENY** |
| Master active | **ALLOW** | **ALLOW** | **ALLOW** |
| anon | **DENY** | **DENY** | **DENY** |

Prova: GRANT ∧ RLS. Policy Master usa `is_platform_admin()`. Sem policy para operacional/anon = deny.

---

## 7. WARNs (não corrigir nesta etapa)

Do FINAL PRE-APPLY SECURITY GATE:

1. **GRANT UPDATE** em `organizations` é amplo no nível de tabela (Master JWT pode PATCH colunas extra via PostgREST).  
2. **`search_path = public`** (preferível `public, pg_temp`); tabela da função já é `public.platform_admins`.  
3. **Rollback não reverte GRANTs** da FASE C nem `ENABLE RLS`. No live conhecido (RLS já ON, 0 policies pré-C) o fail-closed operacional permanece.

Rollback, se necessário **depois** de APPLY e só com autorização humana: colar  
`supabase/migrations/20260817190000_010_platform_master_fase_c.rollback.sql`  
no SQL Editor. Não executar agora.

---

## 8. MASTER PROVISIONING PROCEDURE

**Não executar neste gate.** Depois do APPLY + verificação de schema.

### Regras

* NÃO armazenar senha no Git, SQL, `.env.example`, relatório ou terminal.  
* NÃO criar senha no script.  
* NÃO imprimir senha.  
* Service role **somente** no ambiente server-side (`SUPABASE_SERVICE_ROLE_KEY`).  
* **Proibido** `VITE_SUPABASE_SERVICE_ROLE_KEY`.  
* Senha do sócio: convite Auth / recovery (fluxo Supabase existente).

### Ambiente (não commitar valores reais)

```text
PLATFORM_OWNER_EMAILS=<e-mails dos sócios, separados por vírgula>
SUPABASE_URL=<url do projeto>
SUPABASE_SERVICE_ROLE_KEY=<server-only>
```

### Script (já no repositório; não rodar agora)

```text
node scripts/provision-platform-owners.mjs
```

Comportamento documentado:

1. Recusa se `VITE_SUPABASE_SERVICE_ROLE_KEY` estiver definido.  
2. `auth.admin.inviteUserByEmail` **sem** senha.  
3. INSERT `platform_admins` (`role=platform_owner`, `status=active`).  
4. stdout: e-mail **mascarado** + `provisioned` / `already_platform_admin`.  

O sócio define a senha no e-mail de convite ou em “Esqueci minha senha”. Login Master: `/master/login` → API `/api/master/session`.

---

## 9. Ordem sugerida (humana)

1. PRE-APPLY SQL (§3) → `precheck_ok`  
2. APPLY UP no SQL Editor (§4)  
3. POST-APPLY SQL (§5)  
4. Preencher `docs/evidence/results/MASTER-FASE-C-CLOSEOUT.md`  
5. Provisionamento (§8) — **depois** do schema PASS  
6. Matriz API (§6) com as contas provisionadas  

```text
MIGRATION = READY FOR MANUAL APPLY
M5 = NOT READY
```
