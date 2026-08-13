# R2A.2 — Auditoria de autorização Storage × RBAC

**Status:** **DIAGNÓSTICO PRONTO** — nenhuma alteração  
**Data:** 2026-08-12  
**Project ref:** `zaemlxjwhzrfmowbckmk`  
**Origem:** R2A.1 = **BLOCKED** (`CABO_TURMA` = REGRESSION RISK)  
**R2A:** continua **NÃO EXECUTADA**  
**M1:** continua **bloqueada**

| Declaração | Valor |
|-----------|--------|
| Banco / Storage / código / helpers / migrations / deploy | **NÃO ALTERADO** |
| Migration R2A executada | **NÃO** |

---

## 1. Matriz RBAC (repo + live Fase 0)

### Objetos existentes

| Objeto | Existe LIVE/repo? | Escopo tenant? | Uso |
|--------|-------------------|----------------|-----|
| `public.roles` | **SIM** (5) | **Não** | slug: `morador`, `porteiro`, `cabo_turma`, `administradora`, `sindico` |
| `public.permissions` | **SIM** (50) | **Não** | legado `manage_*` + granular `modulo.acao` |
| `public.role_permissions` | **SIM** (187 live) | **Não** | N:N role↔permission; editável via Admin |
| `public.users` | **SIM** | **Não** | `role` texto (`PORTEIRO`, …) + `auth_user_id` |
| `public.staff` | **SIM** | **Não** | `role` texto livre; `auth_user_id` |
| `public.residents` | **SIM** | **Não** | `auth_user_id` |
| `tenant_memberships` / memberships | **NÃO** | — | previsto M3/M11 |
| Permission específica de **Storage** | **NÃO** | — | só `boletos.*` / `manage_boletos` (domínio financeiro) |

### Permissions relacionadas a boletos

| Key | Família | Consumida pela UI? |
|-----|---------|-------------------|
| `boletos.view` | granular | **SIM** (`Layout` Financeiro, `App`) |
| `boletos.create` | granular | **SIM** (import / create) |
| `boletos.update` | granular | **SIM** (gate UI) |
| `boletos.delete` | granular | **SIM** |
| `boletos.download` | granular | **SIM** (download PDF) |
| `manage_boletos` | legado | **NÃO** na UI (AuthContext usa keys granulares) |

### Matriz Role × boletos × helpers

Legenda helpers: **Y** = role reconhecida pelo helper; **N** = não.

| Role (app / slug) | `boletos.*` (seed/UI) | `manage_boletos` (legado seed) | `is_staff_from_auth` | `is_admin_for_staff_invites` |
|-------------------|----------------------|--------------------------------|----------------------|------------------------------|
| **CABO_TURMA** / `cabo_turma` | **SIM** (legado + granular seed) | **SIM** (seed inicial) | **N** | **N** |
| **PORTEIRO** / `porteiro` | **SIM** se matriz live/grant (granular CROSS JOIN; legado **sem** manage_boletos) | **N** no seed inicial | **Y** | **N** |
| **SINDICO** / `sindico` | **SIM** (todas; UI bypass SINDICO) | **SIM** (seed all) | **Y** | **Y** |
| **ADMINISTRADORA** / `administradora` | **SIM** | **SIM** | **N** | **Y** |
| **ADMIN** / **ADMINISTRADOR** → slug `administradora` | via mesmo slug | via mesmo | **N** | **Y** (users list) |
| **MORADOR** / `morador` | **SIM** possível na matriz (view/download); create bloqueado na UI | **SIM** no seed legado | **N** | **N** |
| **staff** (tabela, não role RBAC) | N/A direto | N/A | **N** (só lê `users`) | **Y** se role admin-like / ILIKE |
| RONDISTA (invite) | não é slug em `roles` | — | **N** | **N** |

**Live users (Fase 0):** 4 usuários — só `PORTEIRO` (2) e `SINDICO` (2). **Nenhum CABO_TURMA live** na amostra; o risco permanece para **convites/futuro**.

**Fonte da matriz `boletos.*`:** seeds `20250301120000` (cabo tem `manage_boletos`), `20250301150000` (CROSS JOIN all), `20250301170000` (granular all roles × boletos.*). Contagem live **187** ≠ 250 → admin pode ter revogado links; **não** há export boletos-only nesta auditoria — classificação “SIM no seed/UI” = capacidade de configuração, não garantia por usuário.

---

## 2. Helpers

### `is_staff_from_auth()`

| Campo | Valor |
|-------|--------|
| Origem | `migrations/006_packages_receipt_and_hide.sql` |
| `auth.uid()` | **SIM** |
| Tabelas | **somente** `public.users` |
| Roles | `PORTEIRO`, `SINDICO` |
| staff table | **NÃO** |
| Tenant/site | **NÃO** |
| Bypass | se `auth.uid()` null → false; exception table → false |
| Uso atual | RLS **packages** staff |

### `is_admin_for_staff_invites()`

| Campo | Valor |
|-------|--------|
| Origem | `20250226000000_staff_invites_rls_allow_adm_and_staff.sql` |
| `auth.uid()` | **SIM** |
| Tabelas | `users` **ou** `staff` |
| Roles users | `SINDICO`, `ADMIN`, `ADMINISTRADOR`, `ADMINISTRADORA`, `ADM` |
| Roles staff | admin-like + ILIKE `%ndico%` / `%dmin%` |
| CABO_TURMA / PORTEIRO | **NÃO** (exceto ILIKE improvável) |
| Tenant/site | **NÃO** |
| Uso atual | RLS `staff_invites`, `resident_invites` |

### `current_resident_id_from_auth()`

| Campo | Valor |
|-------|--------|
| Origem | `006` |
| `auth.uid()` | **SIM** |
| Tabelas | `residents` (fallback `resident`) |
| Roles | N/A — retorna UUID ou NULL |
| Tenant/site | **NÃO** |
| Uso atual | RLS packages resident; R2A propõe SELECT Storage |

**Conclusão helpers:** são **atalhos de papel para RLS pontual**, **não** o RBAC do produto. Não leem `roles` / `permissions` / `role_permissions`.

---

## 3. Fluxo atual (dois canais)

```
[UI]
  users.role → appRoleToRoleName → roles → role_permissions → permissions.key
  AuthContext.userPermissions + useHasPermission / hasPermission
  SINDICO: bypass ALL_PERMISSION_KEYS (não consulta matriz)

[Storage hoje — LIVE]
  authenticated + bucket_id='boletos'  (insert/update)
  public SELECT + bucket public=true   (read)

[Storage R2A proposta — BLOCKED]
  helpers is_staff / is_admin / resident
  ≠ canal RBAC da UI
```

Upload/download: `services/dataService.ts` → Storage; gates de tela via `boletos.*`, **não** via helpers.

---

## 4. CABO_TURMA — por que a divergência?

**Resposta:** **helper incompleto** + **dois sistemas de autorização coexistentes** (não é “permission obsoleta”).

| Hipótese | Avaliação |
|----------|-----------|
| Bug histórico pontual | Parcial — `is_staff_from_auth` nascido para **packages** (porteiro/síndico) e **nunca** alinhado ao catálogo RBAC de 5 roles |
| Bypass legado | Não — CABO_TURMA foi **incluído de propósito** no seed RBAC com boletos/sentinela vs porteiro |
| **Helper incompleto** | **SIM** — lista hardcoded `PORTEIRO`/`SINDICO` ignora `CABO_TURMA`, `ADMINISTRADORA`, etc. |
| Role mal configurada | Não — `cabo_turma` é role oficial (`roles`, Layout, convites, `appRoleToRoleName`) |
| Permission obsoleta | **Não** — `boletos.*` é o que a UI usa; `manage_boletos` legado é que pode ser inócuo na UI |
| Outra | Seed granular/`grant all` ampliou `boletos.*` a vários roles; Storage R2A amarra a helpers **mais estreitos** que o RBAC |

Intenção histórica do seed: cabo_turma = porteiro **+ boletos + sentinela**. O helper de packages **nunca** refletiu isso (packages nem era o foco do cabo no seed legado).

---

## 5. Divergências (resumo)

| Canal | O que decide | Alinha com Storage R2A? |
|-------|--------------|-------------------------|
| RBAC UI | `role_permissions` + keys `boletos.*` | **NÃO** |
| Helpers packages/invites | subset de `users.role` / admin | **Parcial** (quebra CABO_TURMA + qualquer role só-RBAC) |
| Storage LIVE | qualquer `authenticated` | Aberto demais |
| Membership | **ausente** | — |
| Ownership path/boleto | **ausente** (OWNERSHIP C) | — |

Usar helpers na R2A = **criar enforcement paralelo** ao RBAC → viola “não criar segundo RBAC”.

---

## 6. Fonte de verdade recomendada

Prioridade arquitetural do produto: **membership → role → permission**.

| Opção | Adequação Storage |
|-------|-------------------|
| A) Só helper staff | **Rejeitada** como definitivo — incompleta, paralelo ao RBAC |
| B) Só RBAC roles/permissions (hoje) | Melhor que A **no curto prazo**, mas **sem** membership/site |
| C) Membership + permission | **Alvo oficial** (Operaut / M3+M11+M12) |
| D) Combinação | **Sim:** membership resolve site; role+permission resolve ação |
| E) Outro | Storage path ownership — complemento, não substituto |

**Escolha:**

- **Definitivo (produto):** **D** = membership + role + permission (`has_permission(key)` no Postgres, previsto M12).  
- **Hoje (pré-M1):** **não existe** membership → enforcement Storage alinhado ao RBAC exigiria helper SQL que leia `users.role` → `roles` → `role_permissions` → `permissions.key` (**B como ponte**), **sem** expandir a lista hardcoded de `is_staff_from_auth`.

**Não** escolher A como fonte de verdade para Storage.

---

## 7. Impacto multi-tenant

| Capacidade futura | Helpers atuais | RBAC atual | Alvo M12+ |
|-------------------|----------------|------------|-----------|
| `organization_id` / `site_id` | Não | Não | Via membership |
| Membership | Não | Não | `tenant_memberships` |
| Permission por site | Não | Global ao projeto | `has_permission` + `is_member` |
| Ownership objeto | Não | Não | path/`boletos.condominium_id` + membership |

Solução baseada só em helpers **não** escala para multi-tenant sem virar “RBAC paralelo por condomínio”.  
Solução baseada em **membership + permission** é a mesma trilha do plano Fase 1 — **não** cria autorização isolada só para Storage.

---

## 8. Proposta conceitual de policy (NÃO implementar)

### Alvo (pós-M12) — esboço

```text
SELECT storage.objects (bucket boletos):
  authenticated
  AND is_member(current_site())
  AND (
    has_permission('boletos.download')   -- staff
    OR (has_permission('boletos.view') AND object_owned_by_resident(...))  -- morador
  )

INSERT/UPDATE:
  authenticated
  AND is_member(current_site())
  AND has_permission('boletos.create')   -- ou update
  AND path/site coerente com membership
```

**Proibido como definitivo:** `USING (true)` / `WITH CHECK (true)`.

### Pré-M1 (conceitual — opções, sem escolher implementação agora)

| Opção | Fecha exposição pública? | Alinha RBAC? | Risco |
|-------|--------------------------|--------------|-------|
| R2A-min: só `public=false` + drop `boletos_read_all` + SELECT auth amplo | Parcial | Fraco | INSERT ainda aberto |
| R2A + helpers (atual) | Sim write tighter | **Não** | BLOCKED CABO_TURMA |
| Ponte: `has_permission_sql('boletos.create')` lendo `role_permissions` | Sim | Melhor | Ainda sem site; SINDICO bypass UI ≠ SQL |

---

## 9. Riscos

| Risco | Nível |
|-------|--------|
| Executar R2A com helpers | HIGH funcional (CABO_TURMA + drift RBAC) |
| Manter bucket público | HIGH segurança |
| Tratar helpers como RBAC definitivo | HIGH arquitetural (segundo RBAC) |
| Assumir matriz live = seed | MEDIUM (187 links customizados) |
| Ownership C até M8+ | MEDIUM residual aceito pré-multi-tenant |

---

## 10. Decisão

### Classificação da solução correta de autorização Storage

# REQUIRES M1

(na prática: **M1 → M3 membership → M11 backfill → M12 `has_permission` / `is_member` → policies Storage alinhadas**)

| Classificação | Quando aplicaria |
|---------------|------------------|
| SAFE | Apenas hotfix **mínimo** de exposição pública **sem** amarrar write a helpers incompletos — **não** é a autorização correta do produto |
| REQUIRES ARCHITECTURAL CHANGE | Se insistir em “consertar” só expandindo `is_staff_from_auth` com mais roles hardcoded |
| **REQUIRES M1** | **Fonte de verdade membership → role → permission** para Storage |

### R2A atual

Permanece **PREPARADA / NÃO EXECUTADA** e **não** aprovada para execução no desenho com helpers.

---

## Próximo passo (após esta auditoria)

1. **Não executar** a migration R2A atual.  
2. Decidir escopo imediato de segurança:
   - **(preferido curto prazo)** redesenhar R2A-min: fechar **só** SELECT público + `public=false`, mantendo INSERT/UPDATE como estão **ou** ponte RBAC explícita — **nova** preparação (R2A.3), sem tocar helpers packages; **ou**
   - **(preferido produto)** adiar aperto de write Storage até existir `has_permission` (pós-M12) e, se urgente, só fechar exposição pública.  
3. Opcional: export LIVE da matriz `role × boletos.*` (SQL Fase 0) para confirmar se `cabo_turma` ainda tem as keys.  
4. M1 continua bloqueada pelos gates; esta auditoria **não** desbloqueia M1.

---

*Diagnóstico only. Nada executado.*
