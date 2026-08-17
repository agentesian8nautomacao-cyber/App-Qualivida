# SentinelaAUT — Arquitetura Master (Platform Admin)

**Status:** FASE A+B aprovadas; FASE C **preparada** (código + SQL) — **não APPLY live**  
**Data:** 2026-08-17  
**Migrations executadas nesta etapa:** NO (arquivo PREPARED / NOT EXECUTED)  
**Código de produto `/master`:** SIM (UI + `/api/master/*` + testes)  
**M5:** permanece NOT READY (não tocado)  
**Plano M1–M16:** não alterado  

Senhas, e-mails de sócios e tokens **não** constam neste documento.

## Decisões aprovadas (obrigatórias)

1. `platform_admins` permanece separado de `public.roles`.
2. `platform_admins` permanece separado de `tenant_memberships`.
3. Master **não** recebe `condominium_id`.
4. Master **não** depende de membership operacional.
5. Autorização é server-side.
6. UI nunca é autoridade de segurança.
7. `is_platform_admin()` deriva o usuário de `auth.uid()` (sessão/JWT).
8. **Não** aceitar `user_id` arbitrário do cliente como prova Master.
9. `platform_admins.user_id` é UNIQUE.
10. `status` permite `active` e `suspended`; só `active` autoriza.
11. Platform Admin autenticado **não** implica qualquer operação sem validar a ação.

```text
MASTER ARCHITECTURE = READY FOR PHASE C
M5 = NOT READY
```

---

## 1. Objetivo

Área `/master` para **administradores da plataforma SaaS** (proprietários / sócios), acima de Organization e Operational Site.

```text
PLATFORM ADMIN  ≠  ORGANIZATION ADMIN  ≠  CONDOMINIUM USER
```

O Master administra empresas contratantes, assinaturas e sites.  
O Master **não** é Morador, Porteiro, Síndico nem Administradora.  
O Master **não** se autoriza por `condominium_id`.

---

## 2. Arquitetura atual (resumo)

Ver evidência completa: `docs/evidence/results/MASTER-READINESS-AUDIT.md`.

```text
auth.users (identidade)
    → public.users / public.staff / public.residents   (perfis operacionais)
    → roles + permissions + role_permissions           (RBAC de condomínio)
    → (futuro M11) tenant_memberships                  (User ↔ Org ↔ Site ↔ Role)

organizations (M1) 1→N condominiums (Operational Site)
```

**Não existe hoje:**

* rota `/master`
* `platform_admin` / `platform_owner` / `is_master`
* tabelas `plans`, `subscriptions`, `invoices`, `billing`
* MFA administrativo
* React Router (rotas por `window.location.pathname`)

RBAC operacional (não destruir): `morador`, `porteiro`, `cabo_turma`, `administradora`, `sindico`.

---

## 3. Arquitetura proposta

```text
Platform
  platform_admins (user_id UNIQUE → auth.users, role, status)
       ↓  is_platform_admin()  [auth.uid() only]
  organizations
       ↓
  condominiums (Operational Site)
       ↓
  (memberships / users / staff / residents)   ← isolamento operacional intacto

  organization_subscriptions → platform_plans   ← FASE D (domínio; sem gateway)
  platform_audit_events                         ← trilha Master
```

### Dois planos de autorização (nunca misturar)

| Plano | Cadeia | Escopo |
|-------|--------|--------|
| **Master** | `auth.users` → `platform_admins` → Organization → Site | Plataforma |
| **Operacional** | `auth.users` → `tenant_memberships` → Site → Role → Permission | Condomínio |

`tenant_memberships.condominium_id` é **NOT NULL** (M3). Membership **não** pode representar o Master.

---

## 4. Role Master

**Não** inserir `platform_admin` em `public.roles` na FASE C.

Motivo: o catálogo `roles` alimenta o painel operacional (`AdminPermissionsView`) e grants como `events.view` (G7-K). Master não é um 6º perfil de condomínio.

Tabela dedicada (separada de `public.roles` e de `tenant_memberships`):

```text
platform_admins
  id uuid PK
  user_id uuid UNIQUE NOT NULL → auth.users(id) ON DELETE RESTRICT
  role text NOT NULL CHECK (role IN ('platform_owner', 'platform_admin'))
  status text NOT NULL DEFAULT 'active'  -- active | suspended
  created_at timestamptz NOT NULL DEFAULT now()
  created_by uuid NULL → auth.users(id) ON DELETE SET NULL
```

Sem `condominium_id`. Sem senha. Sem token. Master **não** depende de membership operacional.

| Valor `role` | Uso |
|--------------|-----|
| `platform_owner` | Sócios / donos da plataforma (FASE C) |
| `platform_admin` | Staff futuro da SaaS (mesmo modelo; granularidade depois) |

**Somente `status = active` autoriza Master.**  
`suspended`: a linha permanece; `/master` e `/api/master/*` = DENY.

Ser Platform Admin autenticado **não** autoriza automaticamente qualquer operação: cada request valida a **ação** (allowlist). FASE C implementa um subconjunto; ações futuras falham fechado (`ACTION_DENIED`).

Função (sem argumento; identidade só da sessão/JWT):

```text
public.is_platform_admin() RETURNS boolean
  SECURITY DEFINER, search_path = public
  SELECT EXISTS (
    SELECT 1 FROM platform_admins
    WHERE user_id = auth.uid() AND status = 'active'
  )
```

**Nunca:** função que aceita UUID arbitrário do cliente.  
**Nunca:** `anon` + `USING (true)`.  
**Nunca:** `localStorage.role === 'master'`.  
**Nunca:** `users.role` / `staff.role` como prova de Master.

### Permissões administrativas (conceitual — catálogo futuro)

Não é um segundo RBAC operacional. Não está em `public.roles` / `role_permissions` nesta fase.

| Chave | FASE C |
|-------|--------|
| `platform.organizations.read` | implementada (session/dashboard/list/detail) |
| `platform.organizations.update` | implementada (PATCH name/slug/status) |
| `platform.organizations.suspend` | validada quando `status=suspended` |
| `platform.subscriptions.read` | documentada; não implementada |
| `platform.subscriptions.update` | documentada; não implementada |
| `platform.audit.read` | documentada; escrita de eventos ocorre nas ações implementadas |
| `platform.admins.read` | documentada; não implementada |
| `platform.admins.manage` | documentada; não implementada |

Os dois sócios iniciais podem ter acesso amplo (`platform_owner` + allowlist FASE C). A arquitetura **não impede** granularidade futura por `role` ou tabela de grants.

---

## 5. Autorização (contrato)

```text
Cliente (UI)
  esconde/mostra /master     ← UX apenas; NUNCA autoridade de segurança

Servidor
  1. autenticar JWT (auth.getUser / auth.uid())
  2. validar Platform Admin (is_platform_admin / platform_admins.status=active)
  3. validar ação (allowlist platform.*)
  4. executar operação
  5. registrar auditoria quando aplicável
      → senão 401 (sem auth) ou 403 (não Master / suspenso / ação negada)
      → não redirecionar “só no frontend” como defesa
```

Superfície FASE C (código no repositório; SQL **não** aplicado no live):

* `GET/PATCH /api/master/session|dashboard|organizations|organizations/:id`
* Identidade via Bearer JWT + chave **anon** no servidor (RLS). **Não** service_role para prova de Master.
* RLS aditiva em `platform_*` / `organizations` / `condominiums` via `is_platform_admin()` para `authenticated`

Service role permanece **somente** no servidor (provisionamento / convites). Nunca `VITE_*`.

Ações de auditoria implementadas: `MASTER_LOGIN`, `MASTER_ACCESS_DENIED`, `ORGANIZATION_VIEW`, `ORGANIZATION_UPDATE`.  
Nunca registrar senha, token, service_role, anon key ou JWT completo.

---

## 6. Provisionamento de sócios

As contas Master são `auth.users` + linha em `platform_admins`.

**Proibido:** senha no código, migration, Git, README, relatório, screenshot.

**Mecanismo proposto (script local, não versionar secrets):**

1. Operador define no ambiente (não commitado), por exemplo:
   - `PLATFORM_OWNER_EMAILS` (lista)
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (já padrão de scripts admin)
2. Script `scripts/provision-platform-owners.mjs` (manual; **não** roda no APPLY):
   - `auth.admin.inviteUserByEmail` **sem** senha no argv / SQL / Git
   - INSERT `platform_admins` (`role=platform_owner`, `status=active`)
   - imprime só: e-mail mascarado e status (`provisioned` / `already_platform_admin`)
3. O sócio define senha pelo e-mail de convite / “Esqueci minha senha” (fluxo Auth já existente).

E-mails **não** são listados neste repositório. O proprietário fornece-os só no ambiente local/CI secret.

---

## 7. Rotas e UI (FASE C)

O app despacha `/master/*` em `index.tsx` (layout separado; não usa `Layout.tsx` operacional).

| Rota | Comportamento |
|------|----------------|
| `/master/login` | Login **só** Auth (e-mail/senha). Após `getSession`, chama `/api/master/session`. 403 se não Master (mensagem explícita). |
| `/master` | Dashboard |
| `/master/organizations` | Lista |
| `/master/organizations/:id` | Detalhe |
| `/master/subscriptions` | Overview; se schema FASE D ainda não applied → “Não configurado” |
| `/master/plans` | Idem |
| `/master/sites` | Lista sites (read) |
| `/master/users` | FASE posterior |
| `/master/audit` | `platform_audit_events` |
| `/master/settings` | FASE posterior |

`MasterLayout`: sidebar própria (Dashboard, Empresas, Assinaturas, Planos, Sites, Usuários, Auditoria, Configurações). **Não** reutilizar `Layout.tsx` operacional.

Logout: `supabase.auth.signOut()` + limpar qualquer cache de UI; próxima visita revalida no servidor.

---

## 8. Dashboard (métricas honestas)

Contar só o que o schema permite:

| Card | Fonte FASE C | Se ausente |
|------|----------------|------------|
| Total organizações | `organizations` | — |
| Ativas / suspensas | `organizations.status` | status texto já existe (default `active`) |
| Sites | `condominiums` | — |
| Assinaturas ativas / vencidas / trial / MRR | FASE D | **Não configurado** |

Não inventar MRR.

---

## 9. Organizations

CRUD administrativo (FASE C: list + detail + edit name/slug/status).  
Suspender/reativar: `status` + evento de auditoria.

Detalhe: org → sites (`condominiums`) → subscription (FASE D ou “Não configurado”) → users (count via memberships quando M11 existir; senão “Não configurado”) → audit Master.

---

## 10. Subscriptions e planos (FASE D)

**Não existem** tabelas equivalentes. Não implementar gateway.

Schema conceitual (não SQL aplicado):

```text
platform_plans
  id, name, slug UNIQUE, description,
  amount_cents, currency, billing_interval,  -- monthly | yearly
  max_sites, max_users, features jsonb, status, timestamps

organization_subscriptions
  id
  organization_id UNIQUE? ou 1→N histórico (preferir 1 ativa + histórico)
  plan_id
  status  -- trialing | active | past_due | suspended | canceled | expired
  started_at, expires_at, trial_ends_at, canceled_at
  billing_cycle
  external_customer_id, external_subscription_id
  timestamps
```

Acesso futuro da org operacional (não FASE C):

| status | Org operacional | Master |
|--------|-----------------|--------|
| active / trialing | acesso (trial pode limitar) | vê tudo |
| past_due | política comercial TBD | vê tudo |
| suspended / canceled / expired | bloquear operações | **continua vendo** |

Nenhum CHECK/enum operacional existente cobre esses estados — domínio **novo**, sem duplicar `organizations.status`.

---

## 11. Auditoria

**Não** reutilizar `admin_audit_logs` como trilha Master:

* policies atuais permitem SELECT a PORTEIRO e vários aliases
* M8 pode exigir `condominium_id` (tenant-owned)
* INSERT é “qualquer authenticated por si mesmo”

Nova tabela `platform_audit_events`:

```text
id, occurred_at
actor_user_id
action
resource_type, resource_id
metadata jsonb   -- sem senha/token
```

Ações FASE C: `MASTER_LOGIN`, `MASTER_ACCESS_DENIED`, `ORGANIZATION_VIEW`, `ORGANIZATION_UPDATE`.  
Outras (`ORGANIZATION_CREATED`, `SUBSCRIPTION_*`, `MASTER_USER_CREATED`, …) só quando implementadas.

RLS: SELECT/INSERT apenas `is_platform_admin()`. Writes preferencialmente via API server-side.

---

## 12. Segurança e RLS

| Regra | Como |
|-------|------|
| Sem `USING (true)` em tabelas Master | policies com `is_platform_admin()` |
| Sem service_role no frontend | handlers `/api/master` |
| Sem senha no Git | bootstrap via env + Auth invite |
| MFA / reauth | **preparar** (coluna/flag); **não** implementar agora (Auth MFA do Supabase não está no app) |
| Sessão expirada | API 401; UI não trata cache como authz |

`organizations` / `condominiums` hoje: isolamento por **ausência** de policy (anon não lê) ou policies operacionais futuras (M13).  
Acrescentar policy Master **aditiva**: `is_platform_admin()` para SELECT/UPDATE administrativo.  
Não dropar policies existentes.

---

## 13. Isolamento multi-tenant

Master é **exceção controlada**: vê todas as orgs/sites.  
Usuário operacional permanece membership → site.  
Suspender org **não** apaga dados; bloqueio operacional é fase posterior (gate no login/membership), fora de M5.

---

## 14. Fases

| Fase | Conteúdo | Esta entrega |
|------|----------|--------------|
| **A** | Auditoria | SIM |
| **B** | Design | SIM (aprovado com ajustes obrigatórios) |
| **C** | `platform_admins` + `is_platform_admin` + `platform_audit_events`; API; login; layout; dashboard; organizations; testes | **SIM no código**; SQL **PREPARED / NOT EXECUTED** |
| **D** | plans + subscriptions | NÃO |

---

## 15. Impactos

| Item | Impacto |
|------|---------|
| **M5** | Nenhum. Não criar `residents.condominium_id`. M5 = NOT READY |
| **M8** | `MASTER ARCHITECTURE DEPENDENCY`: tabelas `platform_*` **não** recebem `condominium_id`. `admin_audit_logs` operacional ≠ `platform_audit_events`. Plano M1–M16 **não** editado |
| **M11–M13** | Master não usa membership. RLS M13 não deve ser o único caminho do Master |
| **RBAC 5 roles** | Intacto. Sem GRANT de `platform.*` a sindico/morador |
| **users.role** | Intacto |

---

## 16. Plano de migration (não executar automaticamente)

Arquivo:

`supabase/migrations/20260817190000_010_platform_master_fase_c.sql`  
Rollback: `supabase/migrations/20260817190000_010_platform_master_fase_c.rollback.sql`

**Status:** PREPARED / NOT EXECUTED. Não APPLY sem revisão humana do pacote UP/ROLLBACK.

---

## 17. Plano de testes (após FASE C)

1. Master acessa `/master` após session API 200  
2–6. Morador / porteiro / síndico / administradora / user comum → 403 em `/api/master/*` e tela de negação em `/master`  
7–8. Master lista organizations; subscriptions = dados ou “Não configurado”  
9. Operacional continua scoped ao site (regressão)  
10. Bundle sem JWT `service_role` / `VITE_SUPABASE_SERVICE*`  
11. Logout → 401  
12. Sessão expirada → 401  

---

## 18. Riscos

* Confundir Master com `users.role = SINDICO`  
* Policy `USING (true)` em org/condo  
* Colocar Master em `tenant_memberships`  
* Copiar `admin_audit_logs` (porteiro lê)  
* Injetar senhas no SQL  
* Implementar UI Master **antes** da API (falsa segurança)  
* M8 marcar `platform_*` como tenant-owned  

---

```text
MASTER ARCHITECTURE = READY FOR PHASE C
IMPLEMENTATION = PREPARED (SQL NOT APPLIED)
M5 = NOT READY
```
