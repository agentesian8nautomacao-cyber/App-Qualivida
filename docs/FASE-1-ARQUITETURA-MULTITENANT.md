# Fase 1 — Especificação de arquitetura multi-tenant

**Status do gate:** direção arquitetural **APROVADA** — implementação **NÃO AUTORIZADA**  
**Pré-implementação (gates M1):** RLS live **PENDENTE** | Storage live **PENDENTE** | Backup **PENDENTE** | Git baseline **OK** | Plano M1–M16 **OK (revisado Operaut)** | Addendum Operaut **OK (publicado)**  
**Evidências:** [docs/evidence/](./evidence/README.md) · [PRE-M1-GATE-STATUS.md](./evidence/PRE-M1-GATE-STATUS.md)  
**Addendum:** [OPERAUT-ARCHITECTURE-ADDENDUM.md](./OPERAUT-ARCHITECTURE-ADDENDUM.md)  
**Última revisão:** 2026-08-12 (ponte Operaut + M1–M16 revisados)  
**Baseline (Fase 0 + RBAC):** 5 roles, 50 permissions, 187 role_permissions; 4 residents, 4 users, 1 staff, 9 packages; 0 boletos, 0 occurrences; sem tenant formal hoje.

**Escopo:** especificação exclusiva. Proibido nesta entrega: DDL/DML, migrations, RLS, Storage, Auth, RBAC, frontend.

---

## Hierarquia canônica (obrigatória)

> **Operaut:** a hierarquia abaixo permanece válida para a **vertical condomínios**.  
> A generalização PLATFORM → ORGANIZATION → VERTICAL → OPERATIONAL_SITE → UNIT está em  
> **[OPERAUT-ARCHITECTURE-ADDENDUM.md](./OPERAUT-ARCHITECTURE-ADDENDUM.md)**.  
> No piloto, `condominiums` = Operational Site (`vertical=condominium`); `condominium_id` ≡ `site_id`.

### Espacial / produto

```
PLATFORM
    ↓
ORGANIZATION          (administradora cliente — ex.: Administradora XPTO)
    ↓
CONDOMINIUM           (tenant operacional — ex.: Qualivida Club Residence)
    ↓
UNIT                  (unidade física — bloco, número, status, metadados)
    ↓
RESIDENT              (morador vinculado à unidade / condomínio)
```

### Identidade / autorização

```
USER                  (auth.users — identidade única global)
    ↓
TENANT_MEMBERSHIP     (nome canônico; sinônimo documentado: membership)
    ↓
CONDOMINIUM           (contexto operacional ativo)
    ↓
ROLE                  (roles.id / roles.name — catálogo RBAC existente)
    ↓
PERMISSION            (permissions.key via role_permissions)
```

---

## Regras fundamentais (anti-padrões proibidos)

| Proibido | Motivo | Substituto |
|----------|--------|------------|
| **`users.tenant_id`** como eixo principal de autorização | Acopla perfil legado ao tenant; não suporta multi-condomínio por usuário | **`tenant_memberships`** + `active_condominium_id` |
| **`users.role` como único mecanismo de autorização** | Bypass SINDICO, listas hardcoded, sem contexto de condomínio | **`tenant_membership.role_id`** + permissions no **contexto do condomínio ativo** |
| Confiar só em `hasPermission` no React | Contornável via PostgREST | RLS + membership no Postgres |
| Segundo RBAC paralelo | Duplicação | Reutilizar `roles`, `permissions`, `role_permissions` |

**`public.users` e `public.staff` (legado):** podem permanecer como **perfis operacionais / display** durante transição, mas **não** definem escopo de tenant. Escopo = **tenant_membership**.

**Uma conta Auth, N condomínios:** mesmo `auth_user_id` → múltiplas linhas em `tenant_memberships` (condomínios e papéis diferentes). **Não duplicar** contas Auth.

---

## 1. PLATFORM

Camada da **plataforma SaaS** (operador do produto).

- Catálogo global: `roles`, `permissions`, `role_permissions` (SHARED/PLATFORM).
- Futuro: platform admins, billing, observabilidade global.
- **Não** mistura dados operacionais de condomínios.

---

## 2. ORGANIZATION

**Definição:** empresa **administradora** cliente (B2B).

**Exemplo:** Administradora XPTO.

| Relação | Cardinalidade |
|---------|----------------|
| Organization → Condominium | **1 → N** |

**Campos conceituais (futuro):** `id`, `name`, `slug`, `status`, timestamps.

**Isolamento:** organization_id em `condominiums` e em `tenant_memberships` (escopo org).

---

## 3. CONDOMINIUM

**Definição:** **tenant operacional** — limite de isolamento de dados de portaria, moradores, financeiro do prédio.

**Exemplo:** Qualivida Club Residence.

| Relação | Cardinalidade |
|---------|----------------|
| Organization → Condominium | **1 → N** |
| Condominium → Unit | **1 → N** |

**Chave de isolamento principal (futuro):** `condominium_id` em entidades tenant-owned **ou** FK transitiva (ex.: `package_id → packages.condominium_id`).

---

## 4. UNIT

**Definição:** unidade física dentro do condomínio.

**Deve representar:** bloco, número/apto, código normalizado (`unitFormatter`), status (occupied/vacant/maintenance), metadados (vaga, observação).

| Campo conceitual | Uso |
|------------------|-----|
| `condominium_id` | FK tenant |
| `code` | Unique **por condomínio** (ex.: `03/005`) |
| `block`, `number`, `label` | Exibição / busca |
| `status`, `metadata` | jsonb opcional |

**Transição:** manter `residents.unit`, `packages.unit` (string) até backfill `unit_id` opcional.

---

## 5. TENANT_MEMBERSHIP

**Nome canônico da tabela (proposta):** `tenant_memberships`  
(Documentação anterior usava “membership”; significa a mesma entidade.)

### Propósito

**Principal camada de vínculo** entre `auth.users` e contexto **Organization + Condominium + Role**.

### Exemplos exigidos

```
USER A → Condomínio A → role sindico
USER A → Condomínio B → role administradora
USER B → Condomínio A → role morador
```

Mesmo **USER A** (um `auth_user_id`), **duas memberships**, **dois condomínios**, **papéis diferentes**.

### Campos conceituais (futuro)

| Campo | Descrição |
|-------|-----------|
| `id` | uuid PK |
| `auth_user_id` | FK → auth.users (**identidade única**) |
| `organization_id` | FK NOT NULL |
| `condominium_id` | FK NOT NULL para escopo operacional (exceção futura: org-only admin com policy explícita) |
| `role_id` | FK → `roles.id` |
| `resident_id` | nullable — preenchido se role = morador |
| `staff_profile_id` | nullable — link opcional a `staff.id` legado |
| `status` | active / invited / suspended |
| `is_default` | membership padrão ao login |
| `created_at`, `updated_at` | auditoria |

### Contexto de sessão (futuro)

- `active_condominium_id` + `active_membership_id` (JWT claim ou session server-side).
- Toda query operacional validada contra membership ativa.
- Troca de condomínio = trocar contexto + **limpar cache offline** (ver Offline isolation).

---

## 6. RBAC existente (preservar)

### O que NÃO fazer

- Não criar segundo RBAC.
- Não apagar permissions legadas (`manage_*`, `view_*`).
- Não renomear keys existentes nesta etapa.

### Conexão membership → RBAC

```
tenant_membership.role_id
    → roles (ex.: porteiro, sindico, morador)
        → role_permissions
            → permissions.key
```

### RBAC contextual (por tenant)

- **Catálogo** global: 50 permissions, 187 links (baseline).
- **Avaliação:** permission só é válida se:
  1. Existe membership **ativa** para `active_condominium_id`;
  2. `membership.role_id` possui a permission em `role_permissions`;
  3. RLS confirma recurso ∈ mesmo `condominium_id`.

**Frontend (futuro):** `getPermissionsByRoleName` passa a usar **`membership.role_id`** (ou slug derivado), nunca `users.role` sozinho.

### Permissions legadas vs granulares

| Tipo | Qtd. | Uso no frontend hoje |
|------|------|------------------------|
| Legado `manage_*` / `view_*` | 12 | **Nenhum** TS/TSX |
| Granular `modulo.acao` | 38 | **Sim** — AuthContext, App, Layout |

Plano transição (sem remover agora): mapeamento documental legado → granular; depreciação só em fase posterior.

---

## 7. SINDICO / bypass — inventário e substituição futura

**Não remover nesta fase.** Substituir posteriormente por: **tenant_membership → role → permission** (e RLS).

### Bypass de autorização (crítico)

| Arquivo | Ocorrência | Substituição futura |
|---------|------------|---------------------|
| `contexts/AuthContext.tsx` | `isAdminPrincipal = role === 'SINDICO'` | Remover; usar permissions de `membership.role_id = sindico` |
| `contexts/AuthContext.tsx` | SINDICO → `ALL_PERMISSION_KEYS` sem DB | `getPermissionsByRoleName` via membership |
| `App.tsx` | `hasPermission = isAdminPrincipal \|\| includes(key)` | `authorize(membership, key)` |
| `Layout.tsx` | idem | idem |
| `hooks/useHasPermission.ts` | `if (isAdminPrincipal) return true` | Remover bypass |

### Gates por permission (dependem indiretamente do bypass SINDICO)

| Arquivo | Padrão | Substituição |
|---------|--------|--------------|
| `App.tsx` | ~40+ `hasPermission('…')` | Contextual tenant + membership role |
| `Layout.tsx` | menu `item.roles` + `hasPermission` | membership role + permission |

### Checks por `role ===` / `.includes(role)` (UI / fluxo — substituir por capability)

| Arquivo | Uso | Substituição |
|---------|-----|--------------|
| `App.tsx` | `SINDICO`, staff roles, `MORADOR`, presentation, permissões tab, Sentinela `allowManager`, filtros unidade | Permission keys + membership role slug |
| `Layout.tsx` | labels, menu roles | idem |
| `components/views/NoticesView.tsx` | `canManageNotices` por role array | `notices.create/update/delete` |
| `components/views/FinanceiroView.tsx` | `isManagerRole` | `boletos.*` / role administradora |
| `components/views/BoletosView.tsx` | role checks | permissions |
| `components/views/VisitorsView.tsx` | role checks | permissions |
| `components/modals/DetailModals.tsx` | PORTEIRO/SINDICO entrega encomenda, ocorrência resolve | `packages.update`, `occurrences.update` |
| `components/modals/ActionModals.tsx` | `canCreateAdminUsers` | `staff.create` + org policy |
| `components/Login.tsx` | selectedRole SINDICO | login flow + membership |
| `services/userAuth.ts` | bypass brute-force roles | policy segurança (independente tenant) |
| `services/dataService.ts` | roleDb SINDICO/PORTEIRO convites | membership + condo |
| `api/accept-staff-invite.ts` | role SINDICO | invite scoped to condominium |
| `sentinela/*` | `allowManager`, role Manager/Doorman | `sentinela.view` + config por membership |

### Metadados (não são bypass de segurança)

`author_role`, `senderRole`, `reportedBy`, labels “Síndico” — manter como display; opcionalmente normalizar para `membership.role_id` no futuro.

---

## 8. Classificação das tabelas (detalhada)

Legenda isolamento: **PK tenant** = coluna `condominium_id` futura; **transitivo** = via FK pai; **membership** = via tenant_memberships.

| Tabela | Categoria | Por quê | Chave isolamento | `condominium_id` direto? | Acesso |
|--------|-----------|---------|------------------|---------------------------|--------|
| `organizations` *(nova)* | PLATFORM / ORG-OWNED | Cliente B2B | `organization.id` | N/A | Platform / org admin |
| `condominiums` *(nova)* | ORGANIZATION-OWNED | Filho da org | `organization_id` | self | Membership |
| `units` *(nova)* | TENANT-OWNED | Unidade física | `condominium_id` | **Sim** | Via condo |
| `tenant_memberships` *(nova)* | USER-OWNED | Vínculo user↔tenant | `condominium_id` + `auth_user_id` | **Sim** | Auth + RLS self |
| `roles` | PLATFORM-OWNED / SHARED | Catálogo global | — | Não | Read authenticated |
| `permissions` | SHARED/REFERENCE | Catálogo global | — | Não | Read authenticated |
| `role_permissions` | SHARED/REFERENCE | Matriz global | — | Não | RPC admin |
| `residents` | TENANT-OWNED | Moradores do prédio | `condominium_id` | **Sim** | Membership + RLS |
| `users` | USER-OWNED (legado) | Perfil staff/síndico | **Não tenant** — via membership | **Não** | Descontinuar escopo; só perfil |
| `staff` | TENANT-OWNED | Funcionários | `condominium_id` | **Sim** | Membership |
| `packages` | TENANT-OWNED | Encomendas | `condominium_id` | **Sim** | Membership |
| `package_items` | TENANT-OWNED | Itens | **transitivo** `package_id` | **Não** (preferido) | Join packages |
| `visitors` | TENANT-OWNED | Portaria | `condominium_id` | **Sim** | Membership |
| `occurrences` | TENANT-OWNED | Ocorrências | `condominium_id` | **Sim** | Membership |
| `notices` | TENANT-OWNED | Mural | `condominium_id` | **Sim** | Membership |
| `notice_reads` | USER-OWNED | Leitura | **transitivo** `notice_id` | **Não** | notice ∈ condo |
| `notifications` | USER-OWNED | Inbox morador | **transitivo** `morador_id→residents` | **Não** | resident ∈ condo |
| `reservations` | TENANT-OWNED | Reservas | `condominium_id` | **Sim** | Membership |
| `areas` | TENANT-OWNED | Áreas comuns | `condominium_id` | **Sim** | Membership |
| `boletos` | TENANT-OWNED | Financeiro | `condominium_id` | **Sim** | Membership |
| `chat_messages` | TENANT-OWNED | Chat mural | `condominium_id` | **Sim** | Membership |
| `app_config` | TENANT-OWNED | Settings condo | `condominium_id` | **Sim** | Membership |
| `admin_audit_logs` | TENANT-OWNED | Auditoria | `condominium_id` | **Sim** | Admin roles |
| `staff_invites` | TENANT-OWNED | Convite | `condominium_id` | **Sim** | Membership |
| `resident_invites` | TENANT-OWNED | Convite | `condominium_id` | **Sim** | Membership |
| `password_reset_tokens` | USER-OWNED | Auth | user/token | Não | Auth flow |
| `notes` | TENANT-OWNED | Portaria | `condominium_id` | **Sim** | Membership |
| `crm_issues`, `crm_units` | TENANT-OWNED | CRM | `condominium_id` | **Sim** | Membership |
| `auth.users` | PLATFORM-OWNED | Identidade | auth uid | Não | Supabase Auth |

---

## 9. Tabelas operacionais — relacionamento antes de coluna

Princípio: **nem toda tabela precisa de `condominium_id` direto** se o isolamento for garantido por FK **obrigatória** a entidade pai tenant-scoped.

| Tabela | Relacionamento recomendado | `condominium_id` direct |
|--------|---------------------------|-------------------------|
| `packages` | Raiz operacional portaria | **Sim** |
| `package_items` | `package_id` → `packages` | Não (transitivo) — RLS via join/trigger |
| `residents` | Raiz pessoa no tenant | **Sim** |
| `occurrences` | Raiz; opcional `resident_id` | **Sim** |
| `notices` | Raiz | **Sim** |
| `notice_reads` | `notice_id` → `notices` | Não |
| `notifications` | `morador_id` → `residents` | Não (transitivo) |
| `reservations` | `area_id` → `areas`, `resident_id` | **Sim** em reservations **ou** via areas |
| `areas` | Raiz catálogo áreas | **Sim** |
| `boletos` | Raiz; `resident_id` opcional | **Sim** |
| `chat_messages` | Raiz mural | **Sim** |
| `admin_audit_logs` | Evento admin | **Sim** (metadata) |

**RLS:** policies devem usar `condominium_id` efetivo (direct ou subquery), nunca confiar só no client.

---

## 10. Estratégia de isolamento (visão geral)

1. **Identidade:** `auth.uid()`.
2. **Contexto:** linha ativa em `tenant_memberships` (`status=active`, `condominium_id=active`).
3. **Autorização:** `has_permission(key)` derivado de `membership.role_id` + catálogo global.
4. **Dados:** recurso.condominium_id = membership.condominium_id (ou transitivo provável).
5. **Storage / Realtime / Offline:** mesmo `condominium_id` em path, channel, cache namespace.

---

## 11. Storage isolation (futuro)

### Path canônico (conceitual)

```
organizations/{organization_id}/condominiums/{condominium_id}/packages/{package_id}/{filename}
organizations/{organization_id}/condominiums/{condominium_id}/boletos/original/{boleto_id}.pdf
organizations/{organization_id}/condominiums/{condominium_id}/residents/{resident_id}/...
organizations/{organization_id}/condominiums/{condominium_id}/documents/...
```

**Hoje:** bucket `boletos`, path `original/{boletoId}.pdf` — **sem** tenant no path (risco multi-tenant).

**Policies (futuro):** `storage.objects` name prefix match + membership; negar cross-condominium.

**Migrar:** copy objetos legados → novo prefix piloto; manter redirect/leitura temporária.

---

## 12. Offline isolation (futuro)

### Estado atual (`services/offlineDb.ts`)

- DB Dexie: `qualivida_offline_db`.
- Índices: `cache_data` por `table` (string) **sem** tenant.
- Outbox: `table` + payload **sem** tenant.

**Risco:** login Tenant B após operar Tenant A → cache/outbox de A ainda legível.

### Estratégia especificada (não implementada)

1. **Namespace de cache:** chave composta `{condominium_id}:{table}` em `CacheRecord.table` ou campo `tenant_id` dedicado.
2. **Outbox:** cada registro inclui `condominium_id`; sync recusa enviar se ≠ active.
3. **Troca de condomínio:** `clearTenantCache(previousCondominiumId)` + opcional wipe outbox pending com confirmação.
4. **Bump schema Dexie** version 2+ com migração local wipe one-time.
5. **sessionStorage:** armazenar `active_condominium_id` alinhado ao Auth context.
6. **`offlineDataService`:** todas as leituras/escritas recebem condo do contexto ativo.

---

## 13. Realtime isolation (futuro)

### Canais atuais (`App.tsx`)

| Canal | Escopo hoje | Risco |
|-------|-------------|-------|
| `chat-messages-global` | global | cross-tenant |
| `occurrences-live` | global | cross-tenant |
| `notices-live` | global | cross-tenant |
| `notifications-{residentId}` | por morador | OK se resident ∈ condo |

### Estratégia especificada

- Padrão: `condo:{condominium_id}:occurrences`, `condo:{condominium_id}:notices`, etc.
- Subscription só após validar membership no condomínio.
- Filtro Postgres Realtime: `condominium_id=eq.{active}` quando coluna existir.
- Morador: canal `notifications` + validar `resident.condominium_id`.

---

## 14. Primeiro tenant (formal — backfill não autorizado)

| Entidade | Valor piloto |
|----------|----------------|
| **Organization** | `"Empresa/Administradora piloto"` (nome legal a confirmar com negócio) |
| **Condominium** | `"Qualivida Club Residence"` |

**Dados existentes = primeiro conjunto do tenant:**

| Recurso | Qtd. |
|---------|------|
| residents | 4 |
| users (legado) | 4 → 4 **tenant_memberships** (não duplicar Auth) |
| staff | 1 |
| packages | 9 |

**Plano backfill (spec only):** criar org + condo → units DISTINCT de residents/packages → memberships para cada auth user → set `condominium_id` onde aplicável.

---

## 15. Critérios de aceitação (implementação futura)

A Fase 1 **implementada** só é **concluída** se:

### Isolamento Tenant A ≠ Tenant B

Para **User A** (membership só A) e **User B** (membership só B):

| Operação | User A → dados A | User A → dados B | User B → dados B | User B → dados A |
|----------|------------------|------------------|------------------|------------------|
| SELECT | ALLOW | **DENY** | ALLOW | **DENY** |
| INSERT | ALLOW | **DENY** | ALLOW | **DENY** |
| UPDATE | ALLOW | **DENY** | ALLOW | **DENY** |
| DELETE | ALLOW | **DENY** | ALLOW | **DENY** |

**Aplicar a:** residents, units, packages, occurrences, notifications, notices, boletos, reservations, Storage.

### Membership

- Multi-condomínio **somente** com múltiplas `tenant_memberships` para o mesmo `auth_user_id`.

### RBAC

- Permission avaliada **dentro** do condomínio ativo (membership + role_permissions).

### Storage / Offline / Realtime

- Arquivo A inacessível a B; cache/outbox A não visível após login B; eventos realtime A não entregues a B.

### Regressão

- Fluxos críticos preservados no tenant piloto (encomendas manual/QR/foto/voz, ocorrências, boletos, notificações, Sentinela, outbox).

---

## 16. Teste obrigatório — especificação TENANT A / TENANT B

### Setup

- Organization única (teste).
- Condominium **TENANT_A**, Condominium **TENANT_B**.
- **USER_A:** membership (A, role staff/sindico); **USER_B:** membership (B, role staff).
- Moradores opcionais MA/MB para notifications.

### Matriz

| Actor | Recurso | Op | Esperado |
|-------|---------|-----|----------|
| USER_A | TENANT_A packages | SELECT/INSERT/UPDATE/DELETE | ALLOW |
| USER_A | TENANT_B packages | SELECT/INSERT/UPDATE/DELETE | DENY |
| USER_B | TENANT_B packages | * | ALLOW |
| USER_B | TENANT_A packages | * | DENY |

Repetir para: residents, units, occurrences, notices, notifications, boletos, reservations.

### Storage

- Upload em A → download com sessão B → **DENY**.

### Realtime

- Evento INSERT packages A → subscriber B → **não recebe**.

### Automatização sugerida

- Script SQL + JWT de teste, ou Vitest + Supabase local com dois users.

---

## 17. Plano de rollback (implementação futura)

1. **Antes de cada migration:** snapshot Supabase + export schema.
2. **Migrations reversíveis:** preferir ADD nullable → backfill → NOT NULL; evitar DROP até estabilizar.
3. **Feature flag app:** `VITE_MULTI_TENANT=false` força caminho single-tenant (single condo default).
4. **Rollback app:** deploy versão anterior (Vercel).
5. **Rollback DB:** restore snapshot ou migration DOWN documentada (drop colunas condominium_id only after backup).
6. **Storage:** manter cópia prefixo antigo até validação.

---

## 18. Ordem exata das migrations futuras (proposta)

Detalhamento completo (objetivo, dependências, rollback, testes, **revisão Operaut**): **[FASE-1-MIGRATION-PLAN.md](./FASE-1-MIGRATION-PLAN.md)**.  
Contrato de produto: **[OPERAUT-ARCHITECTURE-ADDENDUM.md](./OPERAUT-ARCHITECTURE-ADDENDUM.md)**.

| # | Migration | Conteúdo | Operaut |
|---|-----------|----------|---------|
| M1 | `001_platform_org_condo` | `organizations`, `condominiums` (+ vertical/site) | **AJUSTE** |
| M2 | `002_units` | `units` + FK site (`condominium_id`) | **AJUSTE** doc |
| M3 | `003_tenant_memberships` | memberships no site | **AJUSTE** |
| M4 | `004_pilot_seed` | INSERT org + site Qualivida | **IGUAL** |
| M5 | `005_residents_condo_id` | nullable → backfill → NOT NULL | **AJUSTE** doc |
| M6 | `006_packages_condo_id` | idem | **AJUSTE** doc |
| M7 | `007_staff_areas_app_config` | condo_id (= site) | **AJUSTE** doc |
| M8 | `008_operational_rest` | demais tabelas + condo_id | **AJUSTE** doc |
| M9 | `009_notifications_transitive_rls` | inbox como canal | **IGUAL** + nota |
| M10 | `010_package_items_transitive` | RLS via packages | **IGUAL** |
| M11 | `011_memberships_backfill` | a partir users/staff/residents | **IGUAL** |
| M12 | `012_rls_helpers` | helpers + alias `site_id` | **AJUSTE** |
| M13 | `013_rls_policies_core` | packages, residents, notifications | **IGUAL** |
| M14 | `014_rls_policies_extended` | demais tenant-owned | **IGUAL** |
| M15 | `015_storage_policies_paths` | prefix org/site | **AJUSTE** |
| M16 | `016_realtime_publication` | filter site / alias canal | **AJUSTE** |
| — | Operations Core (futuro) | eventos, n8n, canais, audit ops | **pós-M16** |

**Entre M4–M11:** app ainda pode operar com fallback single site.  
**App changes** (contexto tenant, offline, realtime) **após M11–M13**, em release coordenado.  
**Eventos / automações / Central Operaut:** **após** isolamento (não misturar em M1).

---

## 19. Compatibilidade fluxos críticos

Sem alteração nesta entrega — ver critérios de aceitação e mitigações em implementação: `savePackage`, Sentinela, outbox, boletos Storage, RBAC UI.

---

## 20. Gates antes de autorizar implementação

- [x] Direção arquitetural aprovada  
- [x] Addendum Operaut publicado — [OPERAUT-ARCHITECTURE-ADDENDUM.md](./OPERAUT-ARCHITECTURE-ADDENDUM.md)  
- [ ] Addendum Operaut **aceito** explicitamente pela equipe  
- [ ] Implementação explicitamente autorizada  
- [ ] Export **live** RLS (`pg_policies`, `relrowsecurity`) documentado no repositório ou anexo seguro  
- [ ] Export **live** Storage (`storage.buckets`, policies `storage.objects`) documentado  
- [ ] Backup verificável (schema + dados + policies + funções + triggers + Storage conforme possível)  
- [x] Git baseline `pre-multitenant-baseline`  
- [x] Plano M1–M16 detalhado e **revisado Operaut** — [FASE-1-MIGRATION-PLAN.md](./FASE-1-MIGRATION-PLAN.md)  

---

## 21. Pré-implementação — fechamento dos gates (atualizado 2026-08-12)

Esta seção registra o checkpoint **antes de M1**. Nenhum DDL/DML/policies foi executado nesta etapa.  
Status resumido: [docs/evidence/PRE-M1-GATE-STATUS.md](./evidence/PRE-M1-GATE-STATUS.md).

### GATE 1 — RLS live

| Verificação | Resultado |
|-------------|-----------|
| Script read-only D1 | **OK** — [docs/evidence/D1-RLS-LIVE.sql](./evidence/D1-RLS-LIVE.sql) |
| Resultado da execução D1 anexado | **PENDENTE — aguardando execução manual** |
| Relatório real `pg_policies` / `relrowsecurity` | **PENDENTE** |

**Status:** **PENDENTE**

**Ação operador:** no SQL Editor do project `zaemlxjwhzrfmowbckmk`, executar **somente** [D1-RLS-LIVE.sql](./evidence/D1-RLS-LIVE.sql). Exportar saída para `docs/evidence/results/`. **Não alterar policies.**

### GATE 1b / Storage — D2 + D5

| Verificação | Resultado |
|-------------|-----------|
| Script D2 (policies + `storage.objects`) | **OK** — [docs/evidence/D2-STORAGE-LIVE.sql](./evidence/D2-STORAGE-LIVE.sql) |
| Script D5 (`storage.buckets`) | **OK** — [docs/evidence/D5-STORAGE-EVIDENCE.sql](./evidence/D5-STORAGE-EVIDENCE.sql) |
| Resultados D2/D5 anexados | **PENDENTE — aguardando execução manual** |

**Storage live:** **PENDENTE**

**Ação operador:** executar D2 e D5 no mesmo projeto; não criar/alterar buckets nem policies.

### GATE 2 — Backup

| Item | Status |
|------|--------|
| Evidência concreta (dump/snapshot + hash ou ID) | **Ausente** |
| Restore test (ambiente separado) | **Não executado** |
| Procedimento documentado | **OK** — [docs/evidence/BACKUP-VERIFICAVEL.md](./evidence/BACKUP-VERIFICAVEL.md) |

**BACKUP VERIFICÁVEL = PENDENTE**

### GATE 3 — Git baseline

| Item | Valor (2026-08-12) |
|------|---------------------|
| Repositório `.git` | **Sim** |
| Branch | `master` |
| Commit atual (auditoria) | `f630726` — `chore: establish pre-multitenant baseline` |
| Tag `pre-multitenant-baseline` | **OK** (existe) |
| Working tree | **CLEAN** na auditoria |
| Arquivos modificados | Nenhum no momento da confirmação do baseline |

**Status:** **OK**

**Não** refazer `git init`. **Não** criar outra tag. **Não** alterar o baseline.

### GATE 3b — Segurança do repositório (auditoria 2026-08-12)

| Item | Resultado |
|------|-----------|
| Possível secret versionado | **BLOCKER:** possível secret versionado em `.env.localnet` |
| `node_modules.bak` | **PRESENTE** (disco + versionado; ~7851 paths; **não** removido nesta etapa) |

Tratar o BLOCKER operacionalmente antes de ampliar exposição do repo; **não** faz parte da implementação M1.

### GATE 4 — Plano de migrations M1–M16

Documento dedicado: **[FASE-1-MIGRATION-PLAN.md](./FASE-1-MIGRATION-PLAN.md)** (revisão Operaut 2026-08-12).  
Addendum: **[OPERAUT-ARCHITECTURE-ADDENDUM.md](./OPERAUT-ARCHITECTURE-ADDENDUM.md)**.

**Nota de ordem de execução:** manter numeração M1–M16; na prática **executar M12 (helpers RLS) antes de M9, M10, M13 e M14**. Eventos/n8n = Operations Core **após** M16.

**Status:** **OK** (documentação revisada) — aceite explícito do addendum ainda **pendente**

### Checkpoint pré-M1

| Item | Valor |
|------|--------|
| Banco alterado nesta etapa | **NÃO** |
| Código funcional alterado | **NÃO** (apenas docs / scripts read-only de evidência) |
| Migrations executadas | **NÃO** |
| Podemos executar M1? | **NÃO** (RLS/Storage/Backup pendentes; aceite Operaut pendente) |

---

*Especificação atualizada no gate de aprovação e checkpoint pré-M1. **Implementação não autorizada.***
