# RESIDENT ACCESS REMOVAL — AUDIT

**Data:** 2026-08-17  
**Objetivo:** reposicionar SentinelaAUT como **Central de Operações Inteligentes** — **sem acesso autenticado de morador**.  
**Modo:** inventário + classificação. **Sem DROP. Sem migration destrutiva. Sem DML live.**  
**M5:** NOT READY (não alterado)  
**MASTER FASE C:** não alterado (runbook/closeout intactos)  
**Plano M1–M16:** não alterado  

```text
SENTINELAAUT = CENTRAL OPERACIONAL (meta)
MORADOR = SEM ACESSO AO SISTEMA (meta — pós-implementação)
RESIDENT DATA = PRESERVAR ENQUANTO NECESSÁRIO À OPERAÇÃO
RESIDENT DATA REMOVAL (DROP) = PROPOSED / NEEDS APPROVAL (fora desta etapa)
```

Senhas, e-mails reais e tokens **não** constam neste documento.

---

## 0. Escopo da mudança

| Remover | Manter (provável) |
|---------|-------------------|
| Login / sessão / dashboard **de morador** | `public.residents` como **dado operacional** (unidade, nome, contato) |
| Cadastro público de morador | Staff gerenciando moradores (`ResidentsView`, import) |
| Convite de **acesso** de morador | RBAC operacional: síndico, porteiro, administradora, cabo_turma |
| Rotas `/accept-resident-invite`, auto-register | Master `/master/*` (separado) |
| Role `MORADOR` como **UserRole de sessão UI** | Permissões `residents.view/create/...` para staff |
| `residentAuth` como caminho de entrada | API v1 `residents/identify` (HMAC operacional) |

**Distinção obrigatória:**

```text
RESIDENT DATA (entidade)     ≠  RESIDENT ACCESS (login/portal)
public.residents             ≠  role MORADOR + sessionStorage.currentResident
resident_invites (acesso)    ≠  cadastro feito por portaria/síndico
```

---

## 1. Inventário por classificação (A–F)

Legenda:

* **A** = acesso de morador (remover do produto)
* **B** = dado de morador necessário ao domínio (manter)
* **C** = código compartilhado (refatorar, não apagar cegamente)
* **D** = histórico/migração (não executar; referência)
* **E** = documentação (atualizar depois)
* **F** = teste (atualizar/criar)

### 1.1 UI / rotas

| Item | Classe | Decisão | Notas |
|------|--------|---------|-------|
| `App.tsx` — sessão `currentResident`, `role === 'MORADOR'` (~50+ refs) | A | **REMOVE** | Núcleo do portal morador |
| `App.tsx` rota `/accept-resident-invite` | A | **REMOVE** | Pathname dispatch |
| `App.tsx` `showResidentRegister` + `ResidentRegister` | A | **REMOVE** | Cadastro público |
| `App.tsx` `handleResidentLogin`, `handleResidentRegister` | A | **REMOVE** | Auth morador |
| `App.tsx` `?morador=true` / `?resident=true` | A | **REMOVE** | Deep link login morador |
| `components/Login.tsx` — `onMoradorLogin`, branch `MORADOR` | A | **REMOVE** | UI operacional já sem botão Morador no grid; **código morto permanece** |
| `components/ResidentRegister.tsx` | A | **DEPRECATE → REMOVE** | Fluxo acesso |
| `components/AcceptResidentInvitePage.tsx` | A | **DEPRECATE → REMOVE** | Fluxo acesso |
| `components/views/MoradorDashboardView.tsx` | A | **REMOVE** | Dashboard exclusivo morador |
| `components/views/MoradorSettingsView.tsx` | A | **REMOVE** | Settings exclusivo morador |
| `components/views/PresentationView.tsx` — card/copy "Morador" | A | **REMOVE/REPLACE** | Copy residencial |
| `components/Layout.tsx` — menu `residentProfile`, grupo `Morador`, `roles: ['MORADOR']` | A | **REMOVE** | Nav morador |
| `components/views/ResidentsView.tsx` | B | **KEEP** | Gestão operacional de moradores |
| `components/modals/ImportResidentsModal.tsx` | B | **KEEP** | Import staff |
| `components/modals/ActionModals.tsx` — `ResidentInviteModal` | A | **DEPRECATE** | Convite **acesso** morador |
| `components/modals/DetailModals.tsx` — branches `MORADOR` (retirada encomenda, etc.) | A | **REMOVE** | Self-service morador |
| `components/views/VisitorsView.tsx` — `isResident` | A | **REMOVE** branch | Pré-cadastro morador |
| `components/ForgotPassword.tsx` — `isResident` | C | **NEEDS REVIEW** | Recovery operacional vs morador |
| `sentinela/components/LandingPage.tsx` — `UserRole.Resident` fallback | C | **NEEDS REVIEW** | Sub-app Sentinela AI |
| `index.tsx` — bootstrap operacional | C | **KEEP** | |

### 1.2 Autenticação / sessão

| Item | Classe | Decisão | Notas |
|------|--------|---------|-------|
| `services/residentAuth.ts` — `registerResident`, `loginResident`, `updateResidentPassword` | A | **DEPRECATE → REMOVE** | Cria `auth.users` + sessão |
| `services/userAuth.ts` — fallback `role: 'MORADOR'` | A | **REMOVE** | Linhas ~342, 386, 547 |
| `App.tsx` `sessionStorage.currentResident`, `residentRole` | A | **REMOVE** | Sessão paralela ao AuthContext |
| `contexts/AuthContext.tsx` | C | **KEEP** | Só staff; garantir morador não entra |
| `services/permissionsService.ts` — map `MORADOR → morador` | C | **NEEDS REVIEW** | RBAC DB role vs UI role |

### 1.3 API / convites

| Item | Classe | Decisão | Notas |
|------|--------|---------|-------|
| `api/accept-resident-invite.ts` | A | **DEPRECATE → REMOVE** | POST cria auth + resident |
| `api/resident-invite.ts` | A | **DEPRECATE → REMOVE** | Valida token convite |
| `api/send-invite-email.ts` — branch `MORADOR` | A | **REMOVE** branch | E-mail convite morador |
| `services/dataService.ts` — `createResidentInvite`, `createResidentInvitesBulk` | A | **DEPRECATE** | Gera link `/accept-resident-invite` |
| `api/v1/residents/identify.ts` | B | **KEEP** | API operacional HMAC (não login morador) |
| `api/master/*` | — | **KEEP** | Master separado |

### 1.4 RBAC / types

| Item | Classe | Decisão | Notas |
|------|--------|---------|-------|
| `types.ts` — `'MORADOR'` em `UserRole` | A | **REMOVE** (TS) | Quebrar compilação = forçar limpeza |
| `types.ts` — `authorRole`/`senderRole` inclui `'MORADOR'` | B/C | **KEEP** (dado histórico) | Mensagens **de** moradores no mural |
| `public.roles.name = 'morador'` | C | **NEEDS REVIEW** | RBAC DB; não DROP sem inventário live |
| `role_permissions` grants a `morador` | A/C | **DEPRECATE** | Permissões de **acesso** morador |
| `permissions` keys `residents.*`, label "Moradores" | B | **KEEP** | Staff gerencia dados |
| `tenant_memberships` com role morador (futuro M11) | C | **NEEDS REVIEW** | M3 schema existe; FK opcional `resident_id` |

### 1.5 Banco (schema — repo; contagens live = read-only abaixo)

| Objeto | Classe | Decisão | Notas |
|--------|--------|---------|-------|
| `public.residents` | B | **KEEP** | Dado operacional (M5 pendente) |
| `public.resident_invites` | A | **DEPRECATE** | Exclusivo acesso morador |
| `auth.users` vinculados a residents | C | **NEEDS REVIEW** | Não apagar; desvincular acesso |
| `public.roles` row `morador` | C | **DEPRECATE** | Após confirmar zero memberships |
| `tenant_memberships.resident_id` FK | C | **KEEP** | Coluna para morador futuro M11 |
| Funções `current_resident_id_from_auth()` | C | **NEEDS REVIEW** | R2A storage; policies packages |
| Policies RLS com morador/resident | C | **NEEDS REVIEW** | Classificar por policy |

### 1.6 Testes / scripts

| Item | Classe | Decisão |
|------|--------|---------|
| `scripts/test_resident_login.js` | F | **REMOVE** |
| `scripts/test_forgot_password_resident.js` | F | **REMOVE** |
| `scripts/migrateResidentsToAuth.ts` | D | **KEEP** (histórico) |
| `api/master/_lib/fase-c.master-authz.test.ts` — morador 403 Master | F | **KEEP** |
| Testes novos: morador não acessa Central | F | **CREATE** (pós-implementação) |

### 1.7 Documentação

| Item | Classe | Decisão |
|------|--------|---------|
| `MIGRACAO_SUPABASE.md`, `docs/SENTINELA-AUT-FUNCIONALIDADES-REUTILIZAVEIS.md` | E | **UPDATE** (fase 2) |
| `docs/FASE-1-MIGRATION-PLAN.md` | E | **KEEP** (não alterar) |
| `DATA_RETENTION_POLICY.md` — resident_invites | E | **UPDATE** após deprecação |

---

## 2. ROLE MORADOR — análise

### 2.1 Onde existe

| Camada | Identificador | Função |
|--------|---------------|--------|
| **UI TS** | `UserRole = 'MORADOR'` | Sessão app, menu, dashboards |
| **RBAC DB** | `public.roles.name = 'morador'` | Seed `20250301120000_rbac_roles_permissions.sql` |
| **App users** | `public.users.role` pode ser string livre | Staff; **não** é o login morador principal |
| **Residents** | `loginResident` → `sessionStorage` | Login por unidade/e-mail, **não** via `users.role` |
| **Permissions map** | `permissionsService`: `MORADOR → 'morador'` | Resolve keys RBAC |
| **Seed grants** | `morador` recebe dashboard, reservas, ocorrências, avisos, boletos, visitantes, settings | **Acesso portal** |
| **Chat/avisos** | `authorRole: 'MORADOR'` | **Autoria** de mensagem, não login |

### 2.2 Contagens (baseline repo / FASE-0 anon 2026-08-08)

| Tabela | Contagem documentada | Nota |
|--------|---------------------|------|
| `residents` | 4 | Sem `condominium_id` (M5 NOT READY) |
| `users` (staff) | 4 | 2× SINDICO, 2× PORTEIRO — **não** morador |
| `resident_invites` | 0 | Tabela existe |
| `roles` / `permissions` / `role_permissions` | 0 cada | RBAC seed possivelmente não applied no ref consultado |
| `tenant_memberships` | schema M3 | Contagem live: ver §9 SQL |

**Conclusão:** role `morador` no banco é **catálogo RBAC** + grants; o acesso real hoje é **`residentAuth` + `MORADOR` UI**, paralelo a `users`.

### 2.3 Remoção proposta (fase implementação — **não executar agora**)

1. Remover `MORADOR` de `UserRole` e todos os branches UI.  
2. Desativar `residentAuth`, rotas, APIs de convite.  
3. **Depois** de inventário live: deprecar row `roles.morador` e grants (migration **separada**, não destrutiva de dados).  
4. **Não** remover `authorRole MORADOR` de mensagens históricas sem migração de conteúdo.

---

## 3. Fluxos de acesso de morador (mapa)

```text
ENTRADA MORADOR (remover)
├── Login.tsx → onMoradorLogin → loginResident (unit+password)
├── ResidentRegister → registerResident → auth.signUp + residents INSERT
├── /accept-resident-invite → AcceptResidentInvitePage → api/accept-resident-invite
├── Staff → ResidentInviteModal → createResidentInvite → e-mail link
├── sessionStorage restore (currentResident) → App setRole('MORADOR')
└── ?morador=true / ?resident=true

PÓS-LOGIN MORADOR (remover)
├── MoradorDashboardView, MoradorSettingsView
├── Layout menu residentProfile
├── Filtros unitFilter em packages/occurrences/reservations
├── Morador cria ocorrência / reserva / visitante esperado
└── Notificações sino morador

OPERACIONAL (manter)
├── Staff login → userAuth → AuthContext
├── ResidentsView (CRUD moradores como DADO)
├── Packages/Occurrences referenciando resident_id/name/unit
└── API v1 HMAC (sem sessão morador)
```

---

## 4. Policies RLS (repo)

### 4.1 `resident_invites`

| Policy | Cmd | Role | Expressão | Classificação |
|--------|-----|------|-----------|---------------|
| `resident_invites_insert_admin` | INSERT | authenticated | `is_admin_for_staff_invites()` | Staff emite convite — **DEPRECATE** com fluxo |
| `resident_invites_select_admin` | SELECT | authenticated | idem | **DEPRECATE** |

Sem policy anon. Aceite do convite usa **service_role** na API (`accept-resident-invite.ts`).

### 4.2 `residents`

Policies legadas em scripts SQL fora de `supabase/migrations/` (ex.: `006_packages_*`, R2A). **Inventário live obrigatório** (§9).

Funções relacionadas (referências repo):

* `current_resident_id_from_auth()` — storage boletos, packages  
* `is_staff_from_auth()`, `is_admin_for_staff_invites()`

Classificação: **NEEDS REVIEW** por policy — separar "morador lê próprio dado" vs "staff lê todos".

### 4.3 `tenant_memberships`

M3: `condominium_id NOT NULL`, `role_id` → `roles`, opcional `resident_id`.  
Master **não** usa memberships. Morador como membership = **candidato DEPRECATE** se existir row com role morador.

### 4.4 Regra

Nenhuma policy com `USING (true)`. Nenhum acesso anon administrativo identificado no escopo morador.

---

## 5. COPY / posicionamento atual vs alvo

| Local | Atual | Alvo |
|-------|-------|------|
| `config/branding.ts` | tagline OK; description genérica | Refinar description operacional |
| `PresentationView.tsx` | "...síndicos, portaria e **moradores**..." + card Morador | Copy §14 do pedido; **Administradora** no 3º card |
| `Login.tsx` | "Acesso ao Painel Operacional" | "ACESSAR CENTRAL" + subtítulo operacional |
| `ResidentRegister.tsx` | "Acesso moradores" | Remover componente |
| `Layout.tsx` | grupo menu "Morador" | Remover |

---

## 6. MASTER / M5 / M1–M16

| Item | Impacto desta iniciativa |
|------|--------------------------|
| **MASTER FASE C** | Nenhum — `/master` permanece |
| **M5** | NOT READY — `residents` permanece; remoção de **acesso** não resolve M5 |
| **M8** | `resident_invites.condominium_id` continua plano M8 — deprecar convite ≠ executar M8 |
| **M11** | `tenant_memberships.resident_id` — revisar se morador some como membership |
| **Plano M1–M16** | **Não alterar** arquivo de plano |

---

## 7. RESIDENT DATA REMOVAL (DROP) — PROPOSED / NEEDS APPROVAL

**Não executar.** Só considerar se produto deixar de precisar de cadastro de unidades/moradores.

Dependências de `public.residents` (operacional):

* `packages.recipient_id`, `visitors`, `occurrences`, `reservations`, `notifications`, `boletos`  
* `ResidentsView`, import, voz/chat (nome/unidade)  
* M5 futuro: `condominium_id`  
* M11: `tenant_memberships.resident_id`

**Veredito:** **KEEP** `public.residents`. Remover apenas **acesso**.

---

## 8. Plano de implementação (pós-aprovação desta auditoria)

Ordem sugerida — **sem migration destrutiva na fase 1**:

1. **Copy/UI:** `PresentationView`, `Login`, branding, remover botões/links morador  
2. **Rotas:** remover `/accept-resident-invite`, `ResidentRegister`, dispatch morador em `App.tsx`  
3. **Auth:** remover `residentAuth` imports, sessionStorage morador, branches `MORADOR`  
4. **Componentes:** remover `Morador*View`, limpar `Layout`, modals morador-only  
5. **API:** despublicar `accept-resident-invite`, `resident-invite`; remover `ResidentInviteModal`  
6. **Types/RBAC TS:** remover `MORADOR` de `UserRole`; manter labels "Moradores" na página staff  
7. **Testes:** matriz §10 + `test:run` + `build`  
8. **Docs:** atualizar docs operacionais (não M1–M16)  
9. **Banco (fase 2, migration separada):** deprecar `resident_invites`, role `morador`, policies exclusivas — **após** backup + inventário live + rollback

---

## 9. SQL READ-ONLY — inventário live (NÃO EXECUTAR nesta etapa pelo agente)

Operador pode rodar no SQL Editor. **Sem senhas.** E-mails mascarados.

### 9.1 Contagens

```sql
SELECT 'residents' AS tbl, count(*) FROM public.residents
UNION ALL SELECT 'resident_invites', count(*) FROM public.resident_invites
UNION ALL SELECT 'users', count(*) FROM public.users
UNION ALL SELECT 'roles', count(*) FROM public.roles
UNION ALL SELECT 'role_permissions', count(*) FROM public.role_permissions
UNION ALL SELECT 'tenant_memberships', count(*) FROM public.tenant_memberships
UNION ALL SELECT 'platform_admins', count(*) FROM public.platform_admins;
```

### 9.2 Role morador

```sql
SELECT r.id, r.name, count(rp.permission_id) AS perm_count
FROM public.roles r
LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
WHERE r.name = 'morador'
GROUP BY r.id, r.name;

SELECT p.key, p.label
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
WHERE r.name = 'morador'
ORDER BY p.key;
```

### 9.3 Residents ↔ Auth (e-mail mascarado)

```sql
SELECT
  r.id AS resident_id,
  r.unit,
  r.auth_user_id,
  CASE
    WHEN r.email IS NULL THEN NULL
    WHEN length(split_part(r.email, '@', 1)) <= 1 THEN '*@' || split_part(r.email, '@', 2)
    ELSE left(split_part(r.email, '@', 1), 1) || '***@' || split_part(r.email, '@', 2)
  END AS email_masked,
  (r.auth_user_id IS NOT NULL) AS has_auth_link
FROM public.residents r
ORDER BY r.unit
LIMIT 500;
```

### 9.4 Auth users com resident (sem encrypted_password)

```sql
SELECT
  u.id AS auth_user_id,
  left(split_part(u.email, '@', 1), 1) || '***@' || split_part(u.email, '@', 2) AS email_masked,
  u.created_at,
  r.id AS resident_id,
  r.unit
FROM auth.users u
LEFT JOIN public.residents r ON r.auth_user_id = u.id
WHERE r.id IS NOT NULL
ORDER BY u.created_at DESC
LIMIT 500;
```

### 9.5 Policies residents / invites / memberships

```sql
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('residents', 'resident_invites', 'tenant_memberships', 'users')
ORDER BY tablename, policyname;
```

### 9.6 Funções morador/resident

```sql
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname ILIKE '%resident%' OR p.proname ILIKE '%morador%')
ORDER BY p.proname;
```

---

## 10. Matriz de testes (pós-implementação)

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | Morador tenta `/` login | Sem opção / sem rota morador |
| 2 | Morador tenta `/accept-resident-invite` | 404 ou página desativada |
| 3 | `loginResident` / sessionStorage morador | Não restaura sessão |
| 4 | Síndico login | ALLOW |
| 5 | Porteiro login | ALLOW |
| 6 | Administradora login | ALLOW |
| 7 | Cabo_turma login | ALLOW (RBAC existente) |
| 8 | Master `/master` | ALLOW (Platform Admin) |
| 9 | Staff CRUD residents (dado) | ALLOW com permissão |
| 10 | API v1 HMAC | PASS regressão |
| 11 | Sem botão "Sou morador" / "Criar conta morador" | PASS UI |
| 12 | Convite morador desativado | Sem `createResidentInvite` ativo |

Comandos: `npm run test:run`, `npm run build`.

---

## 11. Riscos

| Risco | Mitigação |
|-------|-----------|
| Apagar `residents` por engano | **KEEP** explícito; DROP = NEEDS APPROVAL |
| Staff perde gestão de moradores | Manter `ResidentsView` + `residents.*` permissions |
| Mensagens com `authorRole=MORADOR` quebram UI | Manter enum em **dado**, remover só **UserRole sessão** |
| RLS `current_resident_id_from_auth` órfã | Inventário live antes de DROP policy |
| RBAC DB `morador` vs UI | Migration separada; não DROP role com FK |
| M5 NOT NULL quebra register | Já BLOCKED; remoção de register **reduz** superfície |

---

## 12. Veredito desta etapa

```text
AUDIT = COMPLETE
IMPLEMENTATION = NOT STARTED (aguardando aprovação)
DATABASE DESTRUCTIVE OPS = NONE
RESIDENT DATA REMOVAL (DROP) = PROPOSED / NEEDS APPROVAL
M5 = NOT READY
MASTER FASE C = UNCHANGED
```

**Próximo passo (humano):** aprovar auditoria → implementar remoção de **ACESSO** (UI/auth/API/RBAC TS) → rodar testes → só então migration controlada para `resident_invites` / role `morador` se inventário live confirmar.

---

## 13. Resumo executivo (entrega solicitada)

| # | Item | Status nesta etapa |
|---|------|-------------------|
| 1 | Arquivos a alterar | Inventariados §1 — **0 alterados agora** |
| 2 | Rotas a remover | `/accept-resident-invite`, fluxo register, `?morador=` |
| 3 | Componentes | `ResidentRegister`, `AcceptResidentInvitePage`, `Morador*View`, branches Layout/Login/App |
| 4 | Serviços | `residentAuth.ts`, `createResidentInvite*` |
| 5 | Roles afetados | UI `MORADOR`; DB `morador` → DEPRECATE (fase 2) |
| 6 | Tabelas afetadas | **Acesso:** `resident_invites` DEPRECATE; **Dados:** `residents` KEEP |
| 7 | Policies afetadas | `resident_invites_*` DEPRECATE; demais NEEDS REVIEW live |
| 8 | Migration criada | **Nenhuma** |
| 9 | Testes | Matriz §10 preparada; novos testes na implementação |
| 10 | Build | Não rerun nesta etapa (sem mudança código) |
| 11 | Riscos restantes | §11 |

Nenhuma senha nesta saída.
