# RBAC atual — diagnóstico (somente leitura)

**Data:** 2026-08-08  
**Project Supabase:** `zaemlxjwhzrfmowbckmk`  
**Regra:** nenhum INSERT/UPDATE/DELETE/DDL nesta análise.

**Contagens confirmadas pelo operador (SQL Editor / postgres):**

| Entidade | Quantidade |
|----------|------------|
| `roles` | **5** |
| `permissions` | **50** |
| `role_permissions` | **187** |
| `users` | 4 |
| `staff` | 1 |
| `residents` | 4 |
| `packages` | 9 |

**Nota de acesso:** consultas via **chave anon** (sem login) retornam **0 linhas** em `roles` / `permissions` / `role_permissions` (RLS exige `authenticated`). Os detalhes abaixo combinam **schema versionado**, **migrations**, **código frontend** e **amostra anon** em `users`/`staff`. Para a matriz **live** exata, usar o SQL da seção [Export SQL (operador)](#export-sql-operador).

---

## Roles atuais

### Schema físico (`roles`)

| Coluna | Tipo | Observação |
|--------|------|------------|
| `id` | uuid PK | |
| `name` | text UNIQUE | Slug em **minúsculas** (ex.: `porteiro`) |
| `created_at` | timestamptz | |

**Não existem** colunas `description`, `status` ou `tenant_id`.

### Perfis esperados (seed `20250301120000_rbac_roles_permissions.sql`)

| name (slug) | Uso no app (`appRoleToRoleName`) |
|-------------|----------------------------------|
| `morador` | `MORADOR` |
| `porteiro` | `PORTEIRO` |
| `cabo_turma` | `CABO_TURMA` |
| `administradora` | `ADMINISTRADORA` / `ADMIN` / `ADMINISTRADOR` |
| `sindico` | `SINDICO` |

**Total:** 5 roles — **consistente** com a contagem do operador.

### SQL (operador)

```sql
SELECT id, name, created_at FROM public.roles ORDER BY name;
```

---

## Permissions atuais

### Schema físico (`permissions`)

| Coluna | Tipo | Observação |
|--------|------|------------|
| `id` | uuid PK | |
| `key` | text UNIQUE | Identificador da permissão |
| `label` | text | Rótulo para UI admin |
| `created_at` | timestamptz | |

**Não existem** colunas separadas `name`, `description`, `module`, `action`.  
**Convenção:** módulo e ação são inferidos da `key`:

- **Granular (UI):** `modulo.acao` — ex.: `packages.view`, `residents.create`
- **Legado (seed inicial):** `manage_*`, `view_*` — ex.: `manage_packages`, `view_dashboard`

### Composição esperada das 50 permissions

| Origem | Qtd. | Exemplos |
|--------|------|----------|
| Seed RBAC inicial (`20250301120000`) | **12** | `view_dashboard`, `manage_residents`, `manage_packages`, … |
| Granular (`20250301170000`) | **38** | `dashboard.view`, `packages.create`, `boletos.download`, … |
| **Total** | **50** | Compatível com contagem do operador |

### Lista granular (38 keys — usada pelo frontend)

Padrão `modulo.acao`:

- **dashboard:** `dashboard.view`
- **residents:** view, create, update, delete
- **staff:** view, create, update, delete
- **visitors:** view, create, update, delete
- **occurrences:** view, create, update, delete, **resolve**
- **reservations:** view, create, update, delete
- **packages:** view, create, update, delete
- **notices:** view, create, update, delete
- **boletos:** view, create, update, delete, download
- **sentinela:** `sentinela.view`
- **settings:** view, update

### SQL (operador)

```sql
SELECT id, key, label, created_at FROM public.permissions ORDER BY key;
```

---

## Role permissions

### Schema (`role_permissions`)

| Coluna | Tipo |
|--------|------|
| `role_id` | uuid → `roles.id` |
| `permission_id` | uuid → `permissions.id` |
| PK composta `(role_id, permission_id)` | |

### Evolução dos seeds (por que 187 e não 250?)

1. **Seed restritivo** (`20250301120000`) — subsets por perfil (legado `manage_*`).
2. **CROSS JOIN total** (`20250301150000`) — tentativa de ligar **cada role × cada permission** (até 5×50 = **250**).
3. **Seed granular** (`20250301170000`) — adiciona links para keys `*.view`, etc.
4. **Contagem live 187** — indica que **nem todas** as 250 combinações existem: revogações via **Admin Permissões** (`togglePermission` → RPC) e/ou ordem de aplicação dos scripts.

### Matriz live (operador)

```sql
SELECT r.name AS role, p.key AS permission, p.label
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
ORDER BY r.name, p.key;
```

### Matriz agrupada (SQL → exportar e agrupar no Excel/pivot)

Mesma query acima; agrupar por `role` e prefixo da key (`split_part(p.key, '.', 1)` para granular, ou key inteira para legado).

### Modelo conceitual (seed **inicial** legado — referência histórica)

```
morador
├── view_dashboard
├── manage_reservations
├── manage_occurrences
├── manage_notices
├── manage_boletos
├── manage_visitors
└── manage_settings

porteiro
├── view_dashboard
├── manage_residents
├── manage_reservations
├── manage_packages
├── manage_occurrences
├── manage_notices
└── manage_visitors

cabo_turma
├── (+ boletos, sentinela vs porteiro)

administradora
├── (+ staff, reports, settings, …)

sindico
└── (seed: ALL permissions na tabela na época do script)
```

**Importante:** o **frontend não consulta** keys `manage_*`; consulta **`modulo.acao`**. Ver [Riscos](#riscos).

---

## Users

### Schema relevante para autorização (`public.users`)

Campos observados (amostra live anon + types):

| Campo | Uso |
|-------|-----|
| `id` | PK interna |
| `role` | **Papel operacional** (`PORTEIRO`, `SINDICO`, …) — **fonte principal** para mapear → `roles.name` |
| `is_active` | Login / conta ativa |
| `auth_user_id` / `auth_id` | Vínculo **Supabase Auth** (`auth.users.id`) |
| `username` | Login legado / exibição |

**Não há** `staff_id`, `resident_id` ou `tenant_id` em `users`.

### Distribuição atual (sem PII)

| role (campo `users.role`) | Quantidade |
|---------------------------|------------|
| PORTEIRO | 2 |
| SINDICO | 2 |
| **Total** | **4** |

Todos com `is_active = true` e vínculo Auth (`auth_user_id` ou `auth_id` preenchido).

### SQL (operador — sem dados sensíveis)

```sql
SELECT id, role, is_active,
       (auth_user_id IS NOT NULL OR auth_id IS NOT NULL) AS has_auth_link
FROM public.users
ORDER BY role, id;
```

---

## Staff

### Schema relevante

| Campo | Uso |
|-------|-----|
| `id` | PK |
| `role` | Texto livre (ex.: `Porteiro`) — **não** é FK para `roles.id` |
| `status` | ex.: `Ativo` |
| `auth_user_id` | Vínculo Auth (mesmo usuário pode existir em `users` **ou** `staff`) |

**Não há** `user_id` FK para `users.id`. Relacionamento: **`staff.auth_user_id` ≈ `users.auth_user_id`** (quando ambos existem).

### Amostra atual

| id (truncado) | role | status | auth |
|---------------|------|--------|------|
| `0f6765b5-…` | Porteiro | Ativo | sim |

**Total:** 1 registro staff.

### SQL (operador)

```sql
SELECT id, role, status, (auth_user_id IS NOT NULL) AS has_auth
FROM public.staff
ORDER BY role;
```

---

## Fluxo de autorização

### Não existe tenant / condomínio

- **Não há** tabela `organizations`, `condominiums`, `tenant_id` ou membership multi-tenant.
- **Escopo implícito:** um único banco = um condomínio.
- Configuração de “nome do condomínio”: `app_config` + `localStorage` (`AppConfigContext`) — **não** participa do RBAC.

### Staff / síndico / porteiro

```
Login (userAuth.loginUser)
  → Supabase Auth (signInWithPassword)
  → Linha em public.users (role: PORTEIRO | SINDICO | …)
  → sessionStorage currentUser
  → AuthContext.setUser(user)
       → Se role === SINDICO: userPermissions = ALL_PERMISSION_KEYS (hardcoded, 37 keys)
       → Senão: appRoleToRoleName(role) → getPermissionsByRoleName(slug)
            → SELECT roles WHERE name = slug
            → SELECT role_permissions → permissions.key
  → UI: hasPermission(key) = isAdminPrincipal || userPermissions.includes(key)
```

### Morador

```
Login (residentAuth.loginResident)
  → Supabase Auth
  → public.residents (auth_user_id)
  → App: role state MORADOR + currentResident
  → AuthContext.setUser({ role: 'MORADOR', id: residents.id, … })
       → getPermissionsByRoleName('morador')  — mesmo pipeline RBAC
  → Filtros adicionais por role === 'MORADOR' (unidade, listas) no App.tsx — **fora** do RBAC
```

### Duas camadas paralelas

| Camada | Mecanismo |
|--------|-----------|
| **RBAC dinâmico** | `roles` → `role_permissions` → `permissions.key` |
| **Papel legado** | `users.role` / `staff.role` + checks `role === 'MORADOR'` espalhados |
| **Bypass síndico** | `isAdminPrincipal` ignora matriz do banco |

---

## Frontend

| Arquivo | Função |
|---------|--------|
| `contexts/AuthContext.tsx` | `ALL_PERMISSION_KEYS`, `setUser`, `refreshPermissions`, `isAdminPrincipal` |
| `services/permissionsService.ts` | `getPermissionsByRoleName`, `getRolesPermissionsMatrix`, `grant/revoke/toggle` via RPC |
| `hooks/useHasPermission.ts` | Wrapper sobre `userPermissions` |
| `components/Layout.tsx` | Menu: `item.roles.includes(role)` **e** `hasPermission(item.permission)` |
| `App.tsx` | `hasPermission` local; dezenas de gates por aba (`packages.view`, …) |
| `components/views/AdminPermissionsView.tsx` | UI matriz; persiste via `togglePermission` → RPC |

**Onde o frontend consulta RBAC:** apenas em **runtime autenticado**, via Supabase client:

- `from('roles')`, `from('role_permissions')`, `from('permissions')`
- RPC `rpc_grant_role_permission` / `rpc_revoke_role_permission`

**Morador** usa keys do perfil `morador` no banco, mas **muitas telas** dependem de `role === 'MORADOR'`, não de permission keys.

---

## Banco

### RPCs de permission

| RPC | Função |
|-----|--------|
| `rpc_grant_role_permission(p_role_id, p_permission_id)` | INSERT em `role_permissions`; valida admin em `users`/`staff` |
| `rpc_revoke_role_permission(p_role_id, p_permission_id)` | DELETE |

Definidas em `20250301140000` + normalização de role em `20250301160000`.

### Funções SECURITY DEFINER (autorização relacionada)

| Função | Uso |
|--------|-----|
| `is_admin_for_staff_invites()` | RLS `staff_invites` |
| `is_staff_from_auth()` | RLS `packages` (staff) |
| `current_resident_id_from_auth()` | RLS `packages` (morador) |
| `rpc_grant_*` / `rpc_revoke_*` | Matriz RBAC |
| `seed_*` (dropadas após seed) | Histórico migrations |

### RLS em tabelas RBAC (`20250301120000`)

- `roles`, `permissions`: SELECT para **authenticated**
- `role_permissions`: SELECT authenticated; INSERT/DELETE só admin (users role SINDICO/ADMIN…)

**Policies não consultam** `role_permissions` para autorizar outras tabelas — RBAC **não** protege dados operacionais (packages, occurrences, etc.) de forma centralizada.

### Triggers / views

- Triggers de autorização operacional: `packages` (006), `reservations` (003), etc. — **não** leem `permissions`.
- **Sem view** tipo `v_user_permissions` no repo.

### SQL inspeção (operador)

```sql
-- RPCs
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name ILIKE '%grant%' OR routine_name ILIKE '%revoke%' OR routine_name ILIKE '%permission%';

-- SECURITY DEFINER (subset)
SELECT p.proname, pg_get_function_identity_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef = true
  AND (p.proname ILIKE '%role%' OR p.proname ILIKE '%permission%' OR p.proname ILIKE '%staff%' OR p.proname ILIKE '%admin%');
```

---

## Riscos

1. **Duas famílias de keys** (`manage_*` vs `modulo.acao`) — UI só entende a segunda; matriz pode conter legado **sem efeito** na UI.
2. **SINDICO bypass** — não reflete `role_permissions` no banco.
3. **PORTEIRO** mapeia para slug `porteiro` — permissões vêm do banco; se matriz revogou `packages.view`, menu some, mas **RLS** pode ainda permitir POST direto.
4. **RLS operacional fraco** — RBAC é **predominantemente UI**; não substitui tenant isolation.
5. **staff.role** texto livre (`Porteiro`) **≠** `roles.name` (`porteiro`) — funções RPC normalizam em alguns pontos, não em todos.
6. **Morador** — mistura RBAC `morador` + filtros hardcoded por unidade.
7. **187 links** — estado customizado pós-admin; difícil reproduzir só lendo migrations.

---

## Recomendações para Multi-Tenant

1. Introduzir **`tenant_id` + `memberships`** antes de expandir RBAC; permissions passam a ser `(tenant_id, role_id, permission_key)` ou claim JWT.
2. **Unificar keys** — deprecar `manage_*`; uma única enum alinhada a `AuthContext.ALL_PERMISSION_KEYS`.
3. **Enforcement no Postgres** — policies usando `membership` + permission check (RPC ou `authorize(action)`), não só React.
4. Remover bypass absoluto de SINDICO ou convertê-lo em role platform super-admin **fora** do tenant.
5. Exportar e versionar matriz **live** (SQL abaixo) como artefato pré-migration.
6. Vincular `users` ↔ `staff` ↔ `residents` via `auth.users.id` + tabela membership explícita.

---

## Export SQL (operador)

Executar no SQL Editor (**SELECT only**). Anexar resultados ao controle de versão.

```sql
-- Roles
SELECT id, name, created_at FROM public.roles ORDER BY name;

-- Permissions
SELECT id, key, label FROM public.permissions ORDER BY key;

-- Matriz completa
SELECT r.name AS role, p.key AS permission, p.label
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
JOIN public.permissions p ON p.id = rp.permission_id
ORDER BY r.name, p.key;

-- Contagem por role
SELECT r.name, count(*) AS permission_count
FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
GROUP BY r.name ORDER BY r.name;

-- Users (autorização)
SELECT id, role, is_active,
       (auth_user_id IS NOT NULL OR auth_id IS NOT NULL) AS has_auth
FROM public.users ORDER BY role;

-- Staff
SELECT id, role, status, (auth_user_id IS NOT NULL) AS has_auth FROM public.staff;
```

---

*Diagnóstico RBAC — Fase 0. Sem alteração de banco.*
