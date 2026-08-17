# MASTER READINESS AUDIT

**Data:** 2026-08-17  
**Modo:** FASE C preparada (código + SQL). SQL **não** aplicado no live.  
**Migration executada:** NO  
**Frontend `/master`:** implementado (`/master/login`, `/master`, `/master/organizations`, `/master/organizations/:id`)  
**API `/api/master/*`:** implementada (server-side)  
**Senhas / e-mails de sócios neste arquivo:** NENHUM  

```text
MASTER ARCHITECTURE = READY FOR PHASE C
M5 = NOT READY
FASE A = COMPLETE
FASE B = COMPLETE (APPROVED)
FASE C = PREPARED (SQL NOT APPLIED)
FASE D = NOT STARTED
PRE-APPLY SECURITY GATE = PASS
MIGRATION = READY TO APPLY
```

**Spec de produto:** `docs/MASTER-ARCHITECTURE.md`  
**Plano M1–M16:** não modificado.

---

## 1. CURRENT ARCHITECTURE

### 1.1 Hierarquia (já na spec Fase 1 / Operaut)

```text
PLATFORM
  → ORGANIZATION          (public.organizations — M1 APPLIED)
    → OPERATIONAL_SITE    (public.condominiums, vertical=condominium)
      → UNIT / RESIDENT / STAFF / PACKAGES …
```

Identidade operacional (spec):

```text
auth.users → tenant_memberships → condominium + role_id → permissions
```

App **hoje** ainda autoriza por `public.users.role` / `staff.role` / `residents` (legado). Memberships existem (M3) mas **não** são o eixo do login.

### 1.2 Tabelas relevantes

| Tabela | Existe | Papel | Master hoje? |
|--------|--------|-------|--------------|
| `organizations` | SIM (M1) | Empresa B2B; `name`, `slug`, `status` text default `active` | Sem UI/API Master |
| `condominiums` | SIM (M1) | Site; `organization_id`, `vertical`, `slug`, `status` | Idem |
| `tenant_memberships` | SIM (M3) | User↔org↔**site**↔role; `condominium_id NOT NULL` | **Não serve** para Master global |
| `roles` | SIM | 5 nomes: morador, porteiro, cabo_turma, administradora, sindico | Sem platform_* |
| `permissions` / `role_permissions` | SIM | Keys operacionais + `events.view` (G7-K) | Sem `platform.*` |
| `users` | SIM | Perfil staff/síndico; `role` VARCHAR operacional | Não é plataforma |
| `staff` | SIM | Funcionários do condomínio | Não é plataforma |
| `residents` | SIM | Moradores | Fora de escopo Master; **M5 não alterar** |
| `profiles` | NÃO encontrada como tabela de produto | — | — |
| `plans` / `subscriptions` / `invoices` / `billing` | **NÃO** | — | Billing = Não configurado |
| `admin_audit_logs` | SIM | Auditoria **operacional** (boletos/settings) | Policies leem PORTEIRO+; inadequado para Master |
| `platform_admins` / `is_platform_admin()` | SQL PREPARED (não applied) | IAM de plataforma | Código FASE C pronto; live pending APPLY |

### 1.3 RBAC operacional (não destruir)

`supabase/migrations/20250301120000_rbac_roles_permissions.sql`:

* roles: `morador`, `porteiro`, `cabo_turma`, `administradora`, `sindico`
* App `UserRole`: MORADOR, PORTEIRO, SINDICO, ADMINISTRADORA, ADMIN, CABO_TURMA
* `AuthContext`: `isAdminPrincipal = role === 'SINDICO'` (bypass de permissões no client)
* G7-K: `events.view` só sindico + administradora

**Não há** `platform_admin`, `platform_owner`, `super_admin`, `is_master`, `owner` de plataforma.

### 1.4 Auth / rotas

* Login operacional: `components/Login.tsx` + `userAuth` / `residentAuth`
* Pathnames especiais: `/accept-invite`, `/accept-resident-invite`, `/reset-password`, **`/master/*`**
* **Sem** React Router (pathname + `index.tsx`)
* Autorização Master: servidor (`/api/master/*` + RLS). UI não é autoridade.

### 1.5 RLS (org/condo)

M1 criou org/condo **sem** policies. Evidência M5: REST anon em org/condo → 0 rows (RLS ON, 0 policies = deny).  
`admin_audit_logs`: INSERT próprio; SELECT amplo (inclui PORTEIRO).

### 1.6 MFA

Não há fluxo MFA no app. Auth recovery de senha **existe**.

---

## 2. PROPOSED MASTER ARCHITECTURE

Ver `docs/MASTER-ARCHITECTURE.md`.

```text
auth.users
  → platform_admins (global; sem condominium_id)
       → is_platform_admin()
            → /api/master/*  + RLS aditiva em organizations/condominiums
                 → UI /master (UX only)

Operacional permanece:
  auth.users → membership/users.role → site
```

Roles de plataforma **fora** de `public.roles` na FASE C: `platform_owner` | `platform_admin` na tabela `platform_admins`.

Billing: FASE D; UI mostra “Não configurado” até lá.

---

## 3. CONFLICTS

| Conflito | Detalhe | Resolução proposta |
|----------|---------|-------------------|
| Master vs `tenant_memberships` | `condominium_id` obrigatório | **Não** usar membership para Master |
| Master vs `public.roles` | Painel de permissões do condomínio | **Não** inserir 6º role operacional na FASE C |
| Master vs `users.role` / SINDICO | Client trata SINDICO como superuser | Master **independente**; não promover síndico a platform |
| `admin_audit_logs` | Porteiro pode SELECT | Nova `platform_audit_events` |
| Addendum “sem segundo RBAC” | Refere-se a **não** duplicar catálogo operacional | IAM de plataforma é **outro plano**, não um segundo `manage_residents` |
| M8 “invites / audit + condominium_id” | Poderia vazar para tabelas novas | `platform_*` **sem** `condominium_id` (dependência documental; plano M1–M16 intacto) |
| `AuthContext` / localStorage | Insuficiente | API 403 obrigatório |
| Org `status` text sem CHECK | Pode reutilizar `active`/`suspended` | Não criar enum paralelo na FASE C; documentar valores |
| Anon / USING true | Histórico permissivo em algumas tabelas | Proibido em `platform_*` |

Nenhum equivalente de subscription/plan encontrado → **criar** na FASE D, não reutilizar.

---

## 4. MIGRATION REQUIREMENTS (não aplicar automaticamente)

Arquivo: `supabase/migrations/20260817190000_010_platform_master_fase_c.sql`  
Rollback: `supabase/migrations/20260817190000_010_platform_master_fase_c.rollback.sql`  
**PREPARED / NOT EXECUTED.**

### FASE C (mínimo)

| Objeto | Ação |
|--------|------|
| `platform_admins` | CREATE + UNIQUE(user_id) + CHECK role/status + RLS |
| `is_platform_admin()` | CREATE FUNCTION DEFINER — **sem** UUID de cliente |
| `platform_audit_events` | CREATE + RLS |
| Policies org/condo | ADD `is_platform_admin()` SELECT/UPDATE (não DROP existentes) |
| API `/api/master/*` | Código |
| UI `/master/*` | Código |
| Script provision | Env `PLATFORM_OWNER_EMAILS`; **zero senhas no SQL** |

### FASE D

| Objeto | Ação |
|--------|------|
| `platform_plans` | CREATE |
| `organization_subscriptions` | CREATE + FK org/plan |
| UI planos/assinaturas | Código |

### Explicitamente FORA

* `residents.*` / `resident_invites` / M5  
* Alterar `docs/FASE-1-MIGRATION-PLAN.md`  
* Gateway de pagamento  
* MFA  
* `USING (true)`  
* Senhas em INSERT  

---

## 5. TABLES TO CREATE / CHANGE

| Tabela | Create/Change | FASE |
|--------|---------------|------|
| `platform_admins` | CREATE | C |
| `platform_audit_events` | CREATE | C |
| `organizations` | POLICY aditiva apenas | C |
| `condominiums` | POLICY aditiva apenas | C |
| `platform_plans` | CREATE | D |
| `organization_subscriptions` | CREATE | D |
| `roles` / `permissions` | **sem INSERT** na C | — |
| `users` / `staff` / `residents` | NÃO | — |

---

## 6. RLS IMPACT

* Novas tabelas: RLS ON; policies **somente** `is_platform_admin()`.
* Org/condo: policy **aditiva** Master; operacional continua deny-by-default até M13.
* Não remover policies de `roles`/`permissions`/`residents`.
* `anon`: nenhuma policy Master.

Função `is_platform_admin`: DEFINER, `search_path` fixo, GRANT EXECUTE a `authenticated` (não a `anon`).

---

## 7. RBAC IMPACT

* 5 roles operacionais: **intocados**
* `role_permissions` / G7-K `events.view`: **intocados**
* `UserRole` TS: **não** adicionar MASTER como alias de SINDICO
* Futuro: keys `platform.organizations.view` etc. no **mesmo** `permissions` **sem** grant a morador/porteiro — opcional pós-C

---

## 8. AUTH IMPACT

* Reutiliza `auth.users` + `signInWithPassword` / recovery
* Nova prova: linha `platform_admins`
* Login Master **separado** (`/master/login`) para não misturar sessão operacional na UX; a sessão Auth é a mesma tecnologia, o **gate** é a tabela platform
* 403 explícito se autenticado mas não Master
* Provisionamento: invite Auth, senha definida pelo usuário

---

## 9. M5 IMPACT

```text
M5 = NOT READY
```

Nenhuma coluna em `residents`. Nenhum backfill. Nenhum `resident_invites.condominium_id`.

---

## 10. M8 IMPACT

```text
MASTER ARCHITECTURE DEPENDENCY
```

M8 (plano) propaga `condominium_id` em tabelas **operacionais** (occurrences, notices, visitors, boletos, reservations, chat, audit, invites, notes, crm_*).

Tabelas `platform_*` **não** entram nessa lista.  
`platform_audit_events` ≠ `admin_audit_logs`.  
Arquivo `FASE-1-MIGRATION-PLAN.md` **não** foi editado.

---

## 11. SECURITY RISKS

| Risco | Mitigação de design |
|-------|---------------------|
| UI-only Master | API + RLS; 403 |
| Síndico vira Master | Não mapear roles operacionais |
| Service role no bundle | Proibido; scan de teste FASE C |
| Senha no Git | Env + invite |
| Audit operacional vaza / é fraco | Tabela própria |
| USING true | Proibido |
| Membership NULL condo | Não usar membership |

MFA: infraestrutura Auth existe no produto Supabase; **não** ligada no app → “preparar, não implementar”.

---

## 12. MIGRATION PLAN

Não executar até review humano.

1. Aceite de `docs/MASTER-ARCHITECTURE.md`  
2. SQL FASE C (admins + audit + função + policies aditivas)  
3. API + UI + testes  
4. Provisionamento local via secrets de ambiente  
5. FASE D billing domain  

---

## 13. TEST PLAN

Matriz FASE C (vitest `api/master/_lib/fase-c.master-authz.test.ts`):

1. Master session → 200 ALLOW  
2–6. comum / morador / porteiro / síndico / administradora → 403  
7. sessão expirada → 401  
8. admin suspenso → 403  
9. API sem auth → 401  
10. ação não implementada → ACTION_DENIED  
11. `.env.example` sem `VITE_SUPABASE_SERVICE_ROLE`  
12. SQL FASE C não altera residents/roles/memberships/users; sem `USING (true)`; sem `TO anon`

UI `/master` DENY para papéis operacionais depende da API 403 (não de `sessionStorage`).

---

## 14. CURRENT vs PROPOSED (quadro)

```text
CURRENT ARCHITECTURE
  Platform (conceitual) sem admins
  Org + Site (M1)
  RBAC condomínio (5 roles)
  Sem billing
  Sem /master

PROPOSED MASTER ARCHITECTURE
  platform_admins + is_platform_admin()
  /master/* + /api/master/*
  org/site visíveis ao Master
  billing FASE D
  audit platform_* 
  RBAC operacional intacto

CONFLICTS
  membership NOT NULL condo; roles catálogo operacional;
  admin_audit_logs permissivo; AuthContext client-side

MIGRATION REQUIREMENTS
  FASE C: 2 tabelas + 1 função + policies aditivas
  FASE D: plans + subscriptions
  Sem M5, sem mudança do plano M1–M16
```

---

## 15. Gate FASE C

SQL **não** foi aplicado. Este arquivo agora inclui o FINAL PRE-APPLY SECURITY GATE (§17).

## 16. REGRESSÃO (2026-08-17)

* `npm run test:run` → 333 passed (inclui 23 testes Master)
* `npm run build` → OK
* `dist/` sem `VITE_SUPABASE_SERVICE` / `service_role`
* `docs/FASE-1-MIGRATION-PLAN.md` não modificado
* `residents` / `users` / `public.roles` / `tenant_memberships` não ALTER
* M5 permanece NOT READY
* M8 não alterado
* Provisionamento de sócios **não** executado (script existe; env-only)

---

## 17. FINAL PRE-APPLY SECURITY GATE

**Data:** 2026-08-17  
**Modo:** auditoria estática (SQL + API + testes). **Sem APPLY. Sem DML live. Sem alteração de código.**  
**Fontes:**  
`supabase/migrations/20260817190000_010_platform_master_fase_c.sql`  
`supabase/migrations/20260817190000_010_platform_master_fase_c.rollback.sql`  
`api/master/_lib/{authorize,handler,live}.ts`  
`api/master/_lib/fase-c.master-authz.test.ts`  
M1 closeout: `organizations`/`condominiums` já tinham `relrowsecurity = true` e **0** policies.

Regra PostgreSQL usada em todo o gate: **GRANT (privilégio de tabela) ∧ RLS policy (comando + USING/WITH CHECK)**.  
Falta de um dos dois = DENY. `service_role` / `BYPASSRLS` estão fora do modelo cliente.

Nenhum BLOCKER encontrado.

### 17.1 ORGANIZATIONS — GRANT + RLS

A migration faz:

```text
GRANT SELECT, UPDATE ON public.organizations TO authenticated
POLICY organizations_select_platform_admin  FOR SELECT TO authenticated
  USING (public.is_platform_admin())
POLICY organizations_update_platform_admin  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin())
Nenhuma policy TO anon
Nenhum GRANT TO anon nesta migration
```

Policies **aditivas**. M1/live: RLS ON, 0 policies. Nenhuma policy operacional pré-existente foi DROP ou `USING (true)`.

| Sujeito | SELECT organizations | UPDATE organizations | Prova |
|---------|----------------------|----------------------|--------|
| USER OPERACIONAL (`authenticated`, `is_platform_admin()=false`) | **DENY** | **DENY** | GRANT pode existir; **nenhuma** policy casa. Default RLS = deny. |
| MASTER active | **ALLOW** | **ALLOW** | GRANT + `is_platform_admin()` |
| MASTER suspended | **DENY** | **DENY** | Função exige `status = 'active'` |
| ANON | **DENY** | **DENY** | Policies só `TO authenticated`; sem policy anon. RLS ON → deny. |

O GRANT `SELECT, UPDATE` **amplia privilégio de tabela** para `authenticated`, mas **não amplia acesso efetivo** de usuário operacional: sem policy correspondente o comando continua DENY.

**WARN (não explorável por operacional):** o GRANT é em **nível de tabela** (todas as colunas). Um Master JWT pode, via PostgREST direto, atualizar colunas além do allowlist da API (`id`, `created_at`, …). A API `/api/master` só envia `name`/`slug`/`status`. Não é bypass de tenant para usuário comum.

### 17.2 CONDOMINIUMS

```text
GRANT SELECT ON public.condominiums TO authenticated
POLICY condominiums_select_platform_admin FOR SELECT TO authenticated
  USING (public.is_platform_admin())
Sem policy UPDATE/INSERT/DELETE Master
Nenhuma policy existente DROP
```

| Sujeito | SELECT condominiums | Prova |
|---------|---------------------|--------|
| USER OPERACIONAL | **DENY** | GRANT SELECT possível; policy só `is_platform_admin()` |
| MASTER active | **ALLOW** | GRANT + policy |
| MASTER suspended | **DENY** | função `status=active` |
| ANON | **DENY** | sem policy `TO anon` |

Nenhuma policy operacional foi enfraquecida (não havia policies). UPDATE de sites pelo cliente Master = **DENY** (sem policy UPDATE). **PASS**

### 17.3 `is_platform_admin()`

| Critério | Resultado |
|----------|-----------|
| Sem argumentos | **PASS** — `is_platform_admin()` |
| Usa `auth.uid()` | **PASS** — `pa.user_id = auth.uid()` |
| Lê `platform_admins` | **PASS** — `FROM public.platform_admins` (qualificado) |
| `status = 'active'` | **PASS** |
| Não aceita UUID do cliente | **PASS** — assinatura vazia |
| SECURITY DEFINER | **PASS** |
| `search_path` | **WARN** — `SET search_path = public` (não `public, pg_temp`) |
| Grants | **PASS** — `REVOKE ALL FROM PUBLIC`; `GRANT EXECUTE TO authenticated`; `REVOKE FROM anon` |
| Anon EXECUTE | **DENY** |

Risco de search_path injection: **baixo**. Tabela está `public.platform_admins`. `auth.uid()` é schema-qualified (`auth`). Recomendação (não aplicada nesta etapa): `SET search_path = public, pg_temp`.

### 17.4 PLATFORM_ADMINS

Schema: FK `user_id` → `auth.users(id)` ON DELETE RESTRICT; `UNIQUE(user_id)`; CHECK `role IN ('platform_owner','platform_admin')`; CHECK `status IN ('active','suspended')`. Sem senha/token/`condominium_id`.

RLS ON. Única policy: `platform_admins_select_self` **SELECT** `TO authenticated` `USING (user_id = auth.uid())`.  
GRANT explícito da migration: **somente SELECT** a `authenticated`. Sem policy INSERT/UPDATE/DELETE → esses comandos = **DENY** para `authenticated`/`anon` mesmo que default privileges do projeto tenham `ALL`.

| Pergunta | Resultado | Policy / privilégio |
|----------|-----------|---------------------|
| Master cria outro Master pelo frontend (PostgREST)? | **DENY** | Sem policy INSERT |
| Usuário comum cria Master? | **DENY** | Sem policy INSERT |
| Autenticado altera `status` de outro Master? | **DENY** | Sem policy UPDATE; SELECT só self |
| Autenticado altera a própria `role` para owner? | **DENY** | Sem policy UPDATE |

Provisionamento: `scripts/provision-platform-owners.mjs` com **service role server-side** (bypass RLS esperado). Não é caminho de frontend.

### 17.5 AUDIT EVENTS (`actor_user_id`)

Policies INSERT:

1. `platform_audit_insert_admin`: `actor_user_id = auth.uid() AND is_platform_admin()`
2. `platform_audit_insert_access_denied`: `actor_user_id = auth.uid() AND action = 'MASTER_ACCESS_DENIED'`

SELECT: só `is_platform_admin()`.  
Sem policy UPDATE/DELETE → cliente **não** apaga nem altera eventos (**append-only efetivo** para `authenticated`/`anon`).

| Caso | Resultado |
|------|-----------|
| User A INSERT com `actor_user_id = B` | **DENY** — WITH CHECK `actor_user_id = auth.uid()` |
| Não-Master INSERT `ORGANIZATION_UPDATE` | **DENY** — exige `is_platform_admin()` |
| Não-Master INSERT `MASTER_ACCESS_DENIED` como si mesmo | **ALLOW** (desenho) — ator = sessão |
| Cliente UPDATE/DELETE eventos | **DENY** — sem policy |

API: `insertAudit` usa `user.id` do JWT verificado; `redactAuditMetadata` remove senha/token/service_role/JWT.

**WARN:** (1) não-Master pode inserir ruído `MASTER_ACCESS_DENIED` com `metadata`/`resource_id` livres, sempre como si mesmo — não é impersonation. (2) Master JWT via PostgREST pode inserir `action` arbitrário como si mesmo; a API restringe ações, o RLS do INSERT admin não tem allowlist de `action`. Não classificado como forgery de outro ator.

GRANT da migration: `SELECT, INSERT` (sem UPDATE/DELETE). Rollback não cria policies de escrita destrutiva.

### 17.6 MASTER_ACCESS_DENIED

Handler: `auditSafe(store, user.id, 'MASTER_ACCESS_DENIED', …)` após JWT `getUser`.  
RLS: `actor_user_id = auth.uid()`. Cliente **não** escolhe o ator. **PASS**

### 17.7 APIs

`handleLiveMasterRequest`: Bearer obrigatório; `auth.getUser(token)` com **anon key** (não service_role); store com JWT do usuário (RLS aplica). Body `user_id` ignorado.

| Chamada | Esperado | Evidência |
|---------|----------|-----------|
| sem auth | 401 | teste `API sem autenticação → 401`; `live.ts` token vazio |
| JWT inválido / sessão expirada | 401 | teste `sessão expirada` |
| autenticado não-Master | 403 | testes comum/morador/porteiro/síndico/administradora |
| Master active | 200 | teste `session = ALLOW` |
| Master suspended | 403 `SUSPENDED` | teste `admin suspenso` |

UI `/master` chama `/api/master/session`; 403 mostra `MasterDenied`. UI não é autoridade. **PASS**

### 17.8 ORGANIZATION_UPDATE

- **Quem:** Master active, após allowlist `platform.organizations.update` (suspende exige também `platform.organizations.suspend`).
- **Campos API:** somente `name`, `slug`, `status` (`active`\|`suspended`). `user_id` no body é ignorado.
- **`organization_id`:** coluna **não existe** em `organizations` (a linha *é* a org). Identidade no path UUID; não há troca de ownership.
- **`slug`:** **ALLOW** alterar (regra explícita FASE C). UNIQUE global permanece (constraint M1).
- **`id` PK via API:** não enviado. **WARN:** PostgREST direto com JWT Master + GRANT UPDATE tabela pode tocar `id`/`created_at` (ver §17.1).
- **Actor:** `user.id` do JWT, não do payload.
- Operacional UPDATE: **DENY** (RLS).

### 17.9 ROLLBACK

Remove somente:

* policies `*_platform_admin` e policies `platform_*` da FASE C  
* `is_platform_admin()`  
* `platform_audit_events`, `platform_admins`

**Não** DROP: `organizations`, `condominiums`, `residents`, `users`, `roles`, `tenant_memberships`. Sem CASCADE nessas tabelas.

**Limitação (WARN):** rollback **não** dá `REVOKE` nos GRANTs que a FASE C emitiu em `organizations`/`condominiums`, e **não** dá `DISABLE ROW LEVEL SECURITY`.  

Estado conhecido pré-C (M1 closeout): RLS **já ON**, 0 policies. Após rollback: RLS permanece ON, policies C saem, GRANT residual + 0 policies ⇒ operacional continua **DENY**. Não restaura automaticamente um hipotético RLS OFF (não é o estado live conhecido).

### 17.10 IDEMPOTÊNCIA

`CREATE TABLE` **sem** `IF NOT EXISTS`. Guard `RAISE EXCEPTION` se `platform_admins` ou `platform_audit_events` já existem. Segunda execução **falha no DO block**, sem CREATE/POLICY parciais. **PASS** (fail-safe, não idempotente).

### 17.11 PRIVILEGES

| Objeto | PUBLIC / anon | authenticated |
|--------|---------------|---------------|
| `is_platform_admin()` | REVOKE ALL | EXECUTE |
| `platform_admins` | REVOKE ALL | SELECT (+ RLS self) |
| `platform_audit_events` | REVOKE ALL | SELECT, INSERT (+ RLS) |
| `organizations` | sem GRANT C a anon | SELECT, UPDATE (+ RLS Master) |
| `condominiums` | sem GRANT C a anon | SELECT (+ RLS Master) |

Sem views/sequences novas. Sem `GRANT … TO anon`. Sem `USING (true)`.

**WARN:** `REVOKE ALL FROM PUBLIC` não remove grants **role-specific** que o default privilege do projeto Supabase possa ter dado a `authenticated`. RLS continua fail-closed na ausência de policy. Endurecimento futuro (não feito agora): `REVOKE INSERT, UPDATE, DELETE, TRUNCATE` explícito em `platform_admins` / audit.

### 17.12 SERVICE ROLE

* `live.ts`: `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` — identidade via JWT.  
* Provision: `SUPABASE_SERVICE_ROLE_KEY` server-only; recusa `VITE_SUPABASE_SERVICE_ROLE_KEY`.  
* `.env.example`: sem `VITE_SUPABASE_SERVICE_ROLE*`.  
* `dist/` (build 2026-08-17): sem `service_role` / `VITE_SUPABASE_SERVICE`.  
**PASS**

### 17.13 MATRIZ

| # | SCENARIO | EXPECTED | ACTUAL/EVIDENCE | CLASS |
|---|----------|----------|-----------------|-------|
| 1 | anon → `/master` | DENY (login / 401 API) | UI exige sessão; API sem Bearer = 401 | PASS |
| 2 | authenticated comum → `/master` | DENY 403 | teste `usuário comum autenticado → 403` | PASS |
| 3 | morador → `/master` | DENY 403 | teste `morador autenticado → 403` | PASS |
| 4 | porteiro → `/master` | DENY 403 | teste `porteiro autenticado → 403` | PASS |
| 5 | síndico → `/master` | DENY 403 | teste `síndico autenticado → 403` | PASS |
| 6 | administradora → `/master` | DENY 403 | teste `administradora autenticado → 403` | PASS |
| 7 | Master active → `/master` | ALLOW | teste session 200 + `MASTER_LOGIN` | PASS |
| 8 | Master suspended → `/master` | DENY 403 | teste `reason=SUSPENDED`; SQL `status=active` | PASS |
| 9 | user A cria audit actor B | DENY | WITH CHECK `actor_user_id = auth.uid()` | PASS |
| 10 | user comum cria `platform_admin` | DENY | sem policy INSERT | PASS |
| 11 | Master cria `platform_admin` (frontend) | DENY | sem policy INSERT; FASE C sem API manage | PASS |
| 12 | user comum UPDATE organization | DENY | policy UPDATE só `is_platform_admin()` | PASS |
| 13 | Master UPDATE organization | ALLOW (name/slug/status via API) | handler allowlist + policy UPDATE | PASS |
| 14 | anon SELECT organization | DENY | RLS ON, policy só authenticated+Master | PASS |
| 15 | authenticated comum SELECT organization | DENY | `is_platform_admin()=false` | PASS |
| 16 | Master SELECT organization | ALLOW | GRANT + policy SELECT | PASS |

### 17.14 ACHADOS

| ID | Class | Achado |
|----|-------|--------|
| G1 | **PASS** | Operacional/anon DENY em org/condo apesar do GRANT (RLS fail-closed) |
| G2 | **PASS** | Sem impersonation Master; `auth.uid()` / JWT `getUser` |
| G3 | **PASS** | Audit não aceita `actor_user_id` de outro usuário |
| G4 | **PASS** | Append-only efetivo (sem policy UPDATE/DELETE no cliente) |
| G5 | **PASS** | API 401/403/ALLOW/SUSPENDED coberta por testes |
| G6 | **PASS** | Idempotência: 2ª execução aborta no guard |
| G7 | **PASS** | Sem service_role no frontend |
| W1 | **WARN** | GRANT UPDATE em `organizations` é table-wide; Master JWT pode PATCH colunas extra via PostgREST |
| W2 | **WARN** | `search_path = public` (preferir `public, pg_temp`) — função já qualifica `public.platform_admins` |
| W3 | **WARN** | INSERT `MASTER_ACCESS_DENIED` permitido a qualquer `authenticated` (self only); metadata livre |
| W4 | **WARN** | Rollback não reverte GRANTs C nem ENABLE RLS; seguro no live conhecido (RLS já ON, 0 policies) |
| W5 | **WARN** | Defaults Supabase `GRANT ALL` a `authenticated` podem sobreviver a `REVOKE FROM PUBLIC`; RLS ainda DENY |

**BLOCKER:** nenhum.

Não corrigido automaticamente (pedido: só documentar).

### 17.15 VEREDITO

```text
PRE-APPLY SECURITY GATE = PASS
RLS = PASS
PLATFORM ADMIN AUTH = PASS
AUDIT INTEGRITY = PASS
API AUTHORIZATION = PASS
ROLLBACK = WARN
PRIVILEGES = PASS
SERVICE ROLE EXPOSURE = PASS
MIGRATION = READY TO APPLY
M5 = NOT READY
```

**NÃO EXECUTAR** a migration neste gate. APPLY permanece decisão humana explícita.

Nenhuma senha / e-mail de sócio / token nesta saída.
