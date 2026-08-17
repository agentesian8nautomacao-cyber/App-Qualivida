# M5 Application Binding Design

**Data:** 2026-08-17  
**Modo:** ARQUITETURA / ANÁLISE / DOCUMENTAÇÃO  
**Código alterado:** NO  
**Banco alterado:** NO  
**Migration criada:** NO  
**RLS / policies / Storage / INSERT / UPDATE / DELETE:** NO  

```text
M5 READINESS = NOT READY
APPLICATION BINDING DESIGN = COMPLETE
NOT NULL APPLIED = NO
```

**Fontes:**

* `docs/FASE-1-ARQUITETURA-MULTITENANT.md`
* `docs/OPERAUT-ARCHITECTURE-ADDENDUM.md`
* `docs/FASE-1-MIGRATION-PLAN.md` (M1–M16; **não alterado**)
* `docs/evidence/results/M5-READINESS-AUDIT.md` (inclui §25)
* Schema live M1–M4 (`organizations`, `condominiums`, `units`, `tenant_memberships`)
* Código atual: `registerResident`, `saveResident`, import, `accept-resident-invite`, `offlineDataService`

Este documento **não autoriza** implementação. Decisões abaixo são `PROPOSED` ou `NEEDS DECISION`, nunca `APPROVED` automático.

---

## 1. Contexto

M5 planejado (`005_residents_condo_id`):

```text
residents.condominium_id  nullable
        → backfill piloto
        → NOT NULL + FK → condominiums.id
```

M1–M4 criaram Organization + Operational Site (`condominiums`, `vertical=condominium`) + `units` + `tenant_memberships` (vazia).  
M5-READINESS-AUDIT permanece **NOT READY**. O blocker principal de aplicação é:

```text
NOT NULL / APP INSERT = BLOCKED
```

§25 comprovou que **todos** os CREATEs de `residents` inserem **sem** `condominium_id`:

| Fluxo | Status |
|-------|--------|
| `registerResident` | BLOCKED |
| `saveResident` CREATE | BLOCKED |
| import | BLOCKED |
| `accept-resident-invite` | BLOCKED |
| `NOT NULL` feasibility | BLOCKED |

O objetivo final **continua** sendo `residents.condominium_id NOT NULL`.  
Esta etapa define **como** o Operaut deve determinar o site de forma segura. **Não** aplica NOT NULL. **Não** cria a coluna.

No piloto: `condominium_id` ≡ `site_id`. `condominiums` = Operational Site da vertical `condominium`.

---

## 2. Problema

O produto ainda opera como **single-tenant implícito**:

* `types.Resident` não tem `condominium_id`.
* Sessão UI guarda `currentResident` / `role`; **não** guarda site.
* `AuthContext` **não** contém `condominium_id` / `organization_id` / membership.
* Unicidade de `unit` é **global**, não por site.
* `resident_invites` não carrega site.
* Outbox Dexie não carrega site.
* Branding (`condominiumName`) é texto de UI, **não** UUID de tenant.

Aplicar `NOT NULL` agora **quebra** cadastro, import e convite.  
Confiar em `condominium_id` enviado pelo cliente **quebra** isolamento multi-tenant.

O problema não é “falta um campo no formulário”. É a **ausência de um contexto de Operational Site autorizado**.

---

## 3. Estado atual

### 3.1 Hierarquia canônica (já aprovada na spec)

```text
PLATFORM
  → ORGANIZATION          (administradora; 1 → N sites)
    → OPERATIONAL_SITE    (piloto: condominiums; isolamento de dados)
      → UNIT
        → RESIDENT
```

Identidade / autorização:

```text
USER (auth.users)          identidade global — NÃO é o site
  → TENANT_MEMBERSHIP      vínculo User ↔ Org ↔ Site ↔ Role
    → OPERATIONAL_SITE
      → ROLE → PERMISSION
```

**User ≠ Condominium.** Uma conta Auth pode ter N memberships em N sites.

### 3.2 Quem existe hoje no banco vs no app

| Entidade | Banco (M1–M4) | App usa para writes de residents? |
|----------|---------------|-----------------------------------|
| Organization | SIM (piloto) | NÃO |
| Condominium / site | SIM (piloto) | NÃO |
| `tenant_memberships` | SIM (0 rows no último REST; app não lê) | NÃO |
| Staff session tenant | NÃO | NÃO (`users.role` legado) |
| Resident session tenant | NÃO | NÃO |
| Invite site context | NÃO | NÃO |
| API v1 HMAC tenant | SIM (credencial + validação) | NÃO usado nestes CREATEs |

### 3.3 Quem NÃO é responsável por determinar o site

| Ator / conceito | Pode determinar o site sozinho? | Motivo |
|-----------------|--------------------------------|--------|
| **User** (`auth.users`) | NÃO | Identidade global; 1 user → N sites |
| **Organization** | NÃO | 1 org → N sites; inferir um único condo é ambíguo |
| **Role legado** (`users.role`, `staff.role`) | NÃO | Spec: anti-padrão; sem contexto de condomínio |
| **Resident session** (hoje) | NÃO | Sessão só após a linha existir; o CREATE ainda não tem site |
| **Cliente / body** | NÃO (não confiável) | Spoofing |

### 3.4 Quem É responsável (contrato)

O **Operational Site** é `condominiums.id` (`condominium_id` = `site_id` no piloto).

A **responsabilidade de determinar** o site, por fluxo:

| Fluxo | Fonte autorizada (futuro) | Quem NÃO pode ser a fonte |
|-------|---------------------------|---------------------------|
| Staff CREATE / import | Membership **ativa** do ator + permission no site | User isolado; org isolada; CSV; body livre |
| Resident invite accept | Site **congelado no convite** na criação (staff) | User que aceita; `unit` do form; body |
| Auto-register público | Contexto **pré-autorizado** (link/token/código scoped) — ver §5 e §7 | Formulário aberto; seleção livre de UUID |
| Resident session (pós-cadastro) | `residents.condominium_id` + membership morador | Inferência por e-mail/unidade global |
| Integração n8n / API v1 | Binding da **credencial** (já existe em G2) | Body `condominium_id` sem match |

`staff` legado e `users` legado continuam **perfil/display**. Escopo = **membership**.

---

## 4. Princípios de segurança

### P1 — Site não é campo de formulário

`residents.condominium_id` é **referência de isolamento**, não um input de UX equivalente a `name` ou `unit`.

### P2 — Cliente não é fonte da verdade

```text
condominium_id NÃO é confiável apenas porque veio do cliente.
```

Se o cliente enviar `condominium_id = X`, o servidor **deve** verificar se o ator possui autorização para operar no site X.

Não implementado nesta etapa. Contrato:

```text
PRESENTED_BY_CLIENT  ≠  AUTHORIZED_FOR_ACTOR
SERVER_MUST_BIND_OR_REJECT
```

### P3 — Fail-closed

Sem contexto de site **autorizado** → recusar CREATE.  
Não defaultar silenciosamente para o piloto em produção multi-tenant.

### P4 — Precedente já existente (API v1) — não reutilizar às cegas no UI

A API Sentinela (HMAC G2):

* aceita headers `X-Organization-Id` / `X-Condominium-Id`;
* **valida** contra catálogo/credencial (`validateTenantBinding`);
* o Core **descarta** override de tenant no body se divergir do tenant autenticado.

Isso é **client-presented + server-validated**.  
Os fluxos de cadastro de morador **não** têm essa camada. Copiar o header/body para o UI **sem** membership = spoofing.

### P5 — Não duplicar `organization_id` em `residents`

Isolamento operacional = site.  
Org é transitiva: `residents → condominiums → organizations`.  
Denormalizar org em residents reproduz o residual DR7 de M3 (org da linha pode divergir da org do site).

### P6 — RLS não substitui binding na origem

Policy futura (M13) deve **confirmar** `resource.condominium_id = membership.condominium_id`.  
Isso não dispensa o INSERT de já carregar um site válido. Linhas NULL furam isolamento.

---

## 5. Register (`registerResident`)

**Estado:** público, não autenticado. INSERT `{ name, unit, email, phone, whatsapp, extra_data, auth_user_id }`. Sem site. Unicidade global de `unit`.

Pergunta: como um cadastro público saberia o site correto?

### Opções (nenhuma implementada; nenhuma APPROVED)

| Opção | Mecanismo | Segurança | UX | Multi-tenant | Spoofing | Complexidade | Arquitetura | RLS | Impacto M5 |
|-------|-----------|-----------|----|--------------|----------|--------------|-------------|-----|------------|
| **A** página/URL scoped (`/c/{slug}/register` ou `?site=`) | slug na rota | média se o servidor resolve slug→id e **não** aceita UUID cru do form | boa | boa | médio (enumeração de slug; baixo se só slugs públicos intencionais) | média | alinhada a site como tenant | RLS não protege INSERT anônimo sozinha; precisa token/policy específica | desbloqueia INSERT **depois** do binding |
| **B** código / invite de cadastro | token opaco no servidor já aponta ao site | **alta** | boa (link no e-mail/WhatsApp) | boa | baixo (token ≠ UUID) | média | alinhada a `resident_invites` TENANT-OWNED | accept via service_role ainda precisa gravar o site do convite | o fluxo invite pode absorver o auto-register |
| **C** domínio / subdomínio | `qualivida.operaut.app` → site | alta se DNS é controlado pelo operador | boa no piloto; cara em N sites | boa | baixo se TLS+mapa server-side | **alta** | compatível; overkill para Fase 1 | independente | não desbloqueia M5 agora |
| **D** link de cadastro associado ao site | igual B, sem e-mail prévio (token de “vaga”) | alta se token one-time / expiração | boa | boa | baixo | média | mesmo contrato de invite | idem B | candidato forte a substituir register aberto |
| **E** seleção explícita do site no form | combo/UUID | **baixa** se anônimo | simples | aparente | **alto** (qualquer UUID conhecido) | baixa | **conflita P2** | RLS anon não deve permitir escolher site | **não** aceitável como fonte |
| **F** mecanismo já existente | branding `condominiumName`; HMAC API; membership | HMAC não se aplica a humano anônimo; membership exige login; branding ≠ UUID | n/a | n/a | n/a | — | **não há** binding de site no register hoje | — | **não resolve** |

### Leitura (não é escolha automática)

* **E é incompatível** com P2 para ator anônimo.
* **C é correta** mas fora do escopo M5 / Fase 1.
* **A** só é segura se o servidor traduz **slug controlado** → `condominium_id` e o cliente **não** envia o UUID como autoridade.
* **B/D** reutilizam o contrato de convite (spec já classifica `resident_invites` como TENANT-OWNED com `condominium_id`).
* Manter register **aberto e unscoped** é **incompatível** com `NOT NULL` multi-tenant.

**PROPOSED (aberto em D2):** descontinuar auto-register unscoped; cadastro público somente via contexto pré-autorizado (invite ou token/link scoped). Slug na URL (A) é complemento de UX, não autoridade.

---

## 6. Staff create (`saveResident`)

**Estado:** staff autenticado (síndico/portaria via `users.role` legado) chama `saveResident` → `createData('residents', payload)` sem site.

### Fontes avaliadas

| Fonte | Determinística? | Multi-site? | Compatível RBAC/RLS futuro? |
|-------|-----------------|-------------|-----------------------------|
| `users.role` | NÃO (sem site) | NÃO | NÃO — anti-padrão da spec |
| `staff` legado como eixo de tenant | só depois de M7 `staff.condominium_id` | frágil (1 staff 1 site legado) | NÃO como eixo; perfil opcional |
| `organization_id` do user | NÃO (1→N sites) | NÃO | NÃO para escolher o site |
| Rota/página atual | só se a rota já estiver scoped e o servidor revalidar | aparente | insuficiente sozinha |
| **Membership ativa** (`tenant_memberships` + `active_condominium_id`) | SIM, se existir linha active | SIM (troca de contexto) | **SIM** — eixo canônico M3/M11/M12/M13 |
| Body `condominium_id` | só se membership autorizar X | só com validação | apresentação, não autoridade |

### Contrato staff (futuro)

```text
Actor (auth.uid)
  → memberships WHERE status=active
  → active_membership_id / active_condominium_id (sessão)
  → has_permission(manage/create residents) no site ativo
  → INSERT residents.condominium_id = active_condominium_id
```

Se o cliente enviar outro `condominium_id`:

* igual ao ativo **e** membership válida → OK;
* diferente → DENY (não “trocar site no payload”).

**Não** copiar `organization_id` para `residents`.  
Org do INSERT, se necessária em eventos/auditoria, deriva de `condominiums.organization_id`.

**Dependência:** M11 (backfill memberships) + contexto de sessão (hoje inexistente). M5-A (coluna+backfill) **não** exige isso; M5-B (NOT NULL) **exige**.

**PROPOSED (D1):** fonte = membership ativa da sessão staff, validada no servidor. Role legado e org isolada = rejeitadas como fonte.

---

## 7. Import

**Estado:** CSV/JSON/PDF → `processImportFile` (nome/unidade/e-mail) → loop `saveResident` com `temp-*` → INSERT sem site. O arquivo **não** carrega condomínio.

### Risco alvo

```text
arquivo A  →  site X
operador autorizado somente em site Y
```

Isso deve ser **impossível**.

### Contrato de import (futuro)

| Camada | Regra |
|--------|--------|
| Contexto do importador | O mesmo de staff CREATE: **site ativo da membership** |
| Site selecionado na UI | Permitido como *hint*; servidor ignora se ≠ membership ativa |
| Coluna/campo no CSV `condominium_id` | **Não confiável.** Se presente e ≠ site autorizado → recusar o lote (fail-closed), não “importar no site do arquivo” |
| Membership | Obrigatória, `status=active`, permission de criar/importar moradores |
| Validação server-side | Todo INSERT do lote usa o **mesmo** `condominium_id` autorizado; unicidade de `unit` passa a ser **por site** |
| Bulk | Um lote = um site. Trocar de site no meio do arquivo = DENY |

Import **não** é um canal paralelo de tenant. É staff CREATE em massa no site já autorizado.

**PROPOSED (D3):** site do import = site da membership ativa do operador; arquivo nunca escolhe o tenant.

---

## 8. Invite (`resident_invites`)

**Hoje:** `email`, `token`, `expires_at`, `created_by`. Sem site. Accept público POST `{ token, name, unit, password }` → service_role INSERT sem site.

**Spec Fase 1** já classifica `resident_invites` como **TENANT-OWNED** com chave `condominium_id`. M8 lista “invites” entre tabelas a receber a coluna. `staff_invites` tem o **mesmo buraco** hoje.

### Contrato recomendado (não implementado)

```text
resident_invites.condominium_id  (FK → condominiums.id)
```

`organization_id` no convite: **não necessário** (transitivo via site). Evita DR7.

| Pergunta | Resposta proposta |
|----------|-------------------|
| Por que é necessário? | Accept é **anônimo**. Não há membership do morador ainda. O token é o único canal determinístico de site. Sem coluna, o accept **não pode** saber o site. |
| Quem define o valor? | Staff na **criação** do convite, a partir da **membership ativa** (não do body livre). |
| Como o servidor valida na criação? | `auth.uid` tem membership active no site S + permission de convidar. INSERT invite com `condominium_id = S`. |
| Como o accept usa o valor? | Lookup por `token` → ler `invite.condominium_id` no servidor → gravar **esse** valor em `residents`. Cliente **não** envia site. |
| Como evitar spoofing? | Ignorar `condominium_id` / `unit` como tenant no body. `unit` continua dado de apto **dentro** do site do convite. Token opaco, one-time, com expiry. |
| Múltiplos sites? | UNIQUE de e-mail pendente deve ser **por site** (hoje é global). Staff do site A não emite convite que caia no site B. |

Alternativas rejeitadas como autoridade:

* inferir site do `created_by` (texto, sem FK);
* inferir do e-mail do convidado;
* 1 org = 1 site (quebra no segundo condomínio);
* user autenticado no accept (não há sessão de site).

**Escopo de schema:** coluna em `resident_invites` é **M8** no plano atual, não M5. M5-B do fluxo invite **depende** dessa coluna (ou de um slice antecipado — decisão de plano, não desta etapa).

**PROPOSED (D4):** sim, `resident_invites.condominium_id`; accept usa só o valor persistido no convite.

---

## 9. Offline (`offlineDataService`)

**Estado auditado (sem alteração):**

| Peça | Tenant hoje |
|------|-------------|
| Dexie `qualivida_offline_db` | nome global; sem namespace de site |
| `cache_data` | índice `table` (string) **sem** `condominium_id` |
| `outbox` | `table` + `payload` **sem** campo de site |
| `queueOutbox` | grava payload cru |
| `syncOutbox` / `processOutboxEntry` | replay INSERT/UPDATE/DELETE **sem** checar site ativo |
| Troca de usuário | risco: cache/outbox do anterior permanece (spec §12) |

Spec já previa (`FASE-1-ARQUITETURA-MULTITENANT.md` §12): namespace `{condominium_id}:{table}`; outbox com `condominium_id`; recusar sync se ≠ active; wipe na troca de condomínio.

### Contrato offline (futuro) — CREATE resident

```text
enqueue:
  payload.condominium_id = session.active_condominium_id
  outbox.condominium_id  = mesmo valor (coluna própria, não só dentro do JSON)

replay:
  SE outbox.condominium_id ≠ session.active_condominium_id → NÃO enviar
  SE membership atual não cobre esse site → NÃO enviar
  servidor revalida membership (P2); payload local não é autoridade

troca de user/site:
  clearTenantCache(previous)
  outbox pendente de outro site: não replay automático
```

**Risco atual de replay no site errado:** **ALTO** assim que existir mais de um site e a coluna for NOT NULL/RLS. Hoje o replay simplesmente não envia site (INSERT sem coluna). Depois do M5-A nullable, replay ainda pode criar/atualizar no “vazio”. Depois do M5-B, replay sem site **falha**; replay com site stampado no device de outro tenant **vaza** se o servidor não revalidar.

**PROPOSED (D6):** stamp de site no enqueue a partir da sessão; replay fail-closed; wipe/isolamento na troca. Fora do DDL M5.

---

## 10. Contrato futuro — CREATE RESIDENT

```text
Actor
  ↓
Tenant/Site Context          (membership ativa  OU  invite.condominium_id
                              OU  token/link scoped resolvido no servidor)
  ↓
Authorization                (permission no site; fail-closed se ausente)
  ↓
Validated condominium_id     (UUID do site; NUNCA autoridade do form)
  ↓
INSERT public.residents
  ↓
condominium_id NOT NULL      (objetivo; só após todos os CREATEs cumprirem o contrato)
```

Regras do contrato:

1. `condominium_id` é **isolamento**, não campo de formulário.
2. O cliente pode *apresentar* um site; o servidor **liga ou rejeita**.
3. `unit` é identificador **dentro** do site, não o site.
4. `organization_id` **não** entra em `residents`.
5. Sem contexto autorizado → **não inserir**.
6. UPDATE de perfil não troca `condominium_id` (imutável após CREATE, salvo processo admin explícito fora deste design).

Mapeamento por fluxo (quando o contrato estiver implementado):

| Fluxo | Actor | Context | AuthZ | Site gravado |
|-------|-------|---------|-------|--------------|
| Staff CREATE | staff auth | membership ativa | permission create | `active_condominium_id` |
| Import | staff auth | mesmo | permission import | mesmo, lote inteiro |
| Invite accept | anônimo + token | `invite.condominium_id` | token válido unused | valor do convite |
| Auto-register | anônimo | token/link scoped (ou desativado) | token válido | valor resolvido no servidor |
| API v1 | credencial HMAC | binding G2 | G3 | tenant da credencial (**não** cria resident hoje) |

---

## 11. M5-A — Schema + deterministic backfill

**Não executar nesta etapa.**

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Adicionar `residents.condominium_id` **nullable** + FK → `condominiums.id` + backfill **determinístico** dos residents existentes do piloto. **Sem** NOT NULL. **Sem** binding de app. |
| **Dependências** | M4 CLOSED; COUNT live `condominiums=1` + UUID piloto **revalidados**; snapshot pré-APPLY; decisão ON DELETE (D10). App **não** precisa estar pronto. |
| **Evidências** | PRECHECK LIVE postgres; 4 residents; piloto `qualivida-club-residence`; backup pós-M4/pré-M5. |
| **PASS** | Coluna existe; FK válida; 4 rows com o UUID do piloto **se e somente se** COUNT site=1 for relido; app legado ainda insere (nullable); login morador OK. |
| **BLOCKED** | COUNT site ≠ 1 ou não verificado; mapping não determinístico; sem snapshot; ON DELETE não decidido. |
| **Rollback** | DROP COLUMN / restore snapshot (coluna nova, sem NOT NULL). |
| **Risco** | 🟡 schema; 🔴 se backfill errado em multi-site (por isso COUNT=1 é gate). App CREATE continua gerando **NULL** até M5-B. |
| **O que M5-A NÃO faz** | NOT NULL; RLS nova; membership; invite.condominium_id; frontend; organization_id em residents. |

M5-A **não** torna `M5 READINESS` do plano original (NOT NULL) em READY. É um **split** para progresso de schema sem fingir isolamento rígido.

---

## 12. M5-B — Application tenant binding + NOT NULL

**Não executar nesta etapa.**

| Campo | Conteúdo |
|-------|----------|
| **Objetivo** | Todos os CREATEs de `residents` passam pelo contrato §10; em seguida `ALTER … SET NOT NULL`. |
| **Dependências** | M5-A aplicado; **D1–D6** decididos e implementados; memberships utilizáveis (M11 ou equivalente operacional); invite com site (M8 ou slice); sessão `active_condominium_id`; offline stamp (D6) se CREATE offline for suportado; register unscoped desligado ou scoped. |
| **Evidências** | Teste: cada fluxo INSERT inclui `condominium_id` autorizado; tentativa de INSERT sem site falha; spoofing de UUID alheio DENY; zero NULL em `residents`. |
| **PASS** | `NOT NULL` + FK; zero NULL; staff/import/invite/(register) binding comprovado; login morador OK no piloto. |
| **BLOCKED** | Qualquer CREATE ainda omite site; client-trusted UUID; membership 0 rows; invite sem site; outbox replay sem revalidação se CREATE offline existir. |
| **Rollback** | Reverter NOT NULL (coluna permanece); feature flag app; restore se dados corrompidos. |
| **Risco** | 🔴 — quebra cadastro se binding incompleto; 🔴 spoofing se P2 não for aplicado. |

**M5 original do plano = M5-A + M5-B.**  
Enquanto M5-B não passar, o status agregado permanece:

```text
M5 READINESS = NOT READY
```

---

## 13. Impacto nas fases seguintes

**O plano `FASE-1-MIGRATION-PLAN.md` NÃO foi alterado.** Abaixo é só análise de dependência se o split M5-A / M5-B for aceito depois.

| Etapa | Dependência original de M5 | Se M5-A only | Se esperar M5-B (NOT NULL) | Nota |
|-------|----------------------------|--------------|----------------------------|------|
| **M6** packages | recomendado M5; depende M4 | **Pode seguir** (padrão análogo: nullable+backfill) | Não precisa esperar NOT NULL de residents | Packages terão o **mesmo** blocker de INSERT sem site |
| **M7** staff/areas/config | M4 | **Independente** de M5-B | — | Staff CREATE de residents continua no app, não no M7 |
| **M8** operational rest + **invites** | M4–M7 | M5-A suficiente para `residents.condominium_id` existir | `resident_invites.condominium_id` é **pré-requisito de M5-B invite** | Possível tensão: M8 hoje é depois de M5 “completo” |
| **M9** notifications transitivo | M5, M8, M12 | Join via `residents.condominium_id` **funciona com nullable**, mas NULL = furo | Isolamento inbox mais forte com NOT NULL | RLS M9 não deve assumir zero NULL até M5-B |
| **M10** package_items | M6, M12 | Sem impacto direto de residents | — | — |
| **M11** memberships backfill | M3, M4, **M5–M7** | Backfill morador usa `residents.condominium_id` dos 4 piloto (**M5-A**) | Novos residents NULL não geram membership correta | M11 **não** substitui binding de CREATE |
| **M12** RLS helpers | M3, M11 | `current_condominium_id()` vem da **membership**, não da coluna residents | — | App ainda não popula sessão |
| **M13** RLS core residents | M12, M5, M6 | Policy `condominium_id = current_…` **deixa NULL fora ou visível** conforme WITH CHECK | NOT NULL reduz furo de INSERT | M13 com coluna nullable = isolamento incompleto |

**Leitura:** split **desbloqueia schema** (M5-A) e **atrasa o isolamento rígido** (NOT NULL) até o app.  
M11 pode backfillar os 4 existentes após M5-A.  
M13 “core RLS em residents” fica **fraco** até M5-B.  
M8 (invites) e M5-B (accept) precisam ser **coordenados** — hoje o plano não expressa essa aresta.

Nenhuma ordem M1–M16 foi reescrita neste arquivo.

---

## 14. Decision matrix

| ID | DECISION | RECOMMENDATION | RATIONALE | STATUS |
|----|----------|----------------|-----------|--------|
| **D1** | Fonte do condominium context para staff | Membership **ativa** da sessão (`tenant_memberships` + `active_condominium_id`); servidor revalida | Spec §5; User/role/org não determinam site; 1 user N sites | **PROPOSED** |
| **D2** | Fonte para auto-register | **Não** form aberto. Preferir convite/token/link scoped; slug na URL só como resolução server-side. Opção E (combo UUID anônimo) rejeitada | Register é público; P2; §5 A–F | **NEEDS DECISION** (qual de A/B/D; E incompatível) |
| **D3** | Fonte para import | Site da membership do importador; arquivo não escolhe tenant; lote = um site | Impede arquivo A → site X com auth só em Y | **PROPOSED** |
| **D4** | `condominium_id` em `resident_invites` | **SIM** (FK site). Accept lê o convite, não o body. Org no invite = não | Accept anônimo; spec já TENANT-OWNED; M8 no plano | **PROPOSED** |
| **D5** | Validação server-side | Obrigatória: presented ≠ authorized → DENY. Precedente G2/G7 payload strip | P2; UI hoje não valida | **PROPOSED** |
| **D6** | Offline tenant context | Stamp no enqueue; replay fail-closed se site ≠ sessão/membership; wipe na troca | Dexie sem tenant; spec §12; risco de replay | **PROPOSED** |
| **D7** | `organization_id` em `residents` | **DO NOT CREATE** | Isolamento = site; org transitiva; evita DR7 | **PROPOSED** |
| **D8** | Split M5-A / M5-B | **PROPOSED yes**: A = schema+backfill nullable; B = binding+NOT NULL | NOT NULL hoje BLOCKED pelo app; split evita fake READY | **NEEDS DECISION** |
| **D9** | Momento do NOT NULL | **Somente M5-B**, após evidência de INSERT em todos os CREATEs | Critério: evidência, não intenção | **PROPOSED** |
| **D10** | ON DELETE | **RESTRICT** (padrão M1–M3/G6). CASCADE apaga moradores; SET NULL conflita com NOT NULL futuro | M5-READINESS-AUDIT blocker 6 | **NEEDS DECISION** |

Nenhuma linha **APPROVED**. Nenhuma linha **BLOCKED** como decisão (os blockers são de *readiness*, §16).

---

## 15. Riscos

| Risco | Se ignorado | Mitigação contratual |
|-------|-------------|----------------------|
| NOT NULL antes do binding | Cadastro/import/convite quebram | D8/D9 — M5-A nullable primeiro |
| Client-controlled `condominium_id` | Spoofing cross-tenant | D5; recusar E no auto-register |
| Inferir site pela Organization | Morador no site errado da mesma administradora | D1/D3; 1 org N sites |
| Inferir site pelo User autenticado no accept | Accept é anônimo; user pode ter N memberships | D4 |
| Manter register público unscoped | Qualquer um cria resident “órfão” ou no site errado | D2 |
| CSV com coluna de condomínio confiável | Import cross-site | D3 fail-closed |
| Outbox sem site / troca de user | Replay no tenant errado | D6 |
| `organization_id` duplicado em residents | Divergência org vs site (DR7) | D7 |
| RLS M13 com NULL residual | Furo de isolamento | D9; WITH CHECK obrigatório |
| DEFAULT SQL = UUID piloto | Segundo site herda o primeiro | P3 fail-closed |
| Tratar M5-A como M5 READY | Isolamento declarado sem enforcement | Status agregado permanece NOT READY até M5-B |

---

## 16. Open decisions

Aguardando aceite humano (não fechadas por este documento):

1. **D2** — auto-register: convite-only vs URL scoped vs token de vaga vs desligar o fluxo.
2. **D8** — autorizar formalmente o split M5-A / M5-B no plano (arquivo do plano **ainda não** mudou).
3. **D10** — ON DELETE RESTRICT.
4. Coordenação **M8 invites** vs **M5-B accept** (antecipar coluna de invite ou esperar M8).
5. Unicidade `residents.unit` **por site** (hoje global) — necessária no multi-tenant; fora do DDL desta etapa.
6. Revalidação live COUNT `condominiums=1` + snapshot pré-M5-A (blockers de *dados*, não de contrato).

---

## Resultado

```text
M5 READINESS = NOT READY

APPLICATION BINDING DESIGN = COMPLETE

OPEN DECISIONS =
  D2 auto-register mechanism
  D8 M5-A/M5-B split (aceite no plano)
  D10 ON DELETE
  M8 vs M5-B invite column timing
  unit uniqueness per site (follow-up)

BLOCKERS =
  NOT NULL / APP INSERT = BLOCKED  (register, saveResident CREATE, import, invite)
  MEMBERSHIP CONTEXT = ABSENT IN APP
  RESIDENT_INVITES SITE CONTEXT = ABSENT
  OFFLINE TENANT STAMP = ABSENT
  LIVE COUNT / SNAPSHOT = NOT VERIFIED (audit M5)
  ON DELETE = NEEDS DECISION
```

Possível solução futura **não** muda `M5 READINESS` para READY.  
NOT NULL permanece objetivo, não evidência.
