# SENTINELA AUT. — G6 Fundação de Produção (Auditoria + Plano)

**Status:** G6 = **AUDIT / READY FOR IMPLEMENTATION**  
**Data:** 2026-08-14  
**Tipo:** documentação apenas — **sem código · sem migration · sem n8n · sem WhatsApp**  
**Evidência:** `docs/evidence/results/SENTINELA-ETAPA-8-G6-AUDIT-2026-08-14.txt`  
**Pré-requisitos:** G1–G5 CLOSED/PASS · M1–M4 CLOSED/PASS (intactos)

```
DATABASE CHANGES = 0
MIGRATIONS EXECUTED = 0
N8N = 0
WHATSAPP = 0
M1–M4 = INTACTOS
```

**Regra desta fase:** propor e decidir. **Não implementar** até autorização explícita.

---

## 1. Estado atual

### 1.1 Gates

| Gate | Status | Função |
|------|--------|--------|
| G1 Foundation | CLOSED/PASS | Envelope, CORS, health, errors |
| G2 Authn+Tenant | CLOSED/PASS | HMAC + tenant fail-closed |
| G3 AuthZ | CLOSED/PASS | Profile/permissions, sem bypass role |
| G4 Confirmation | CLOSED/PASS | Classificação + gate SENSITIVE |
| G5 Core Execution | CLOSED/PASS | API → Core (READ; WRITE só com store TEST_ONLY) |
| **G6 Produção** | **AUDIT** | Stores + adapter + eventos + conflito |

### 1.2 O que já existe e funciona

| Componente | Local | Estado |
|------------|-------|--------|
| Operational Core | `sentinela/core/` | Ops de negócio centralizadas |
| Adapter port | `sentinela/core/adapters/persistence.ts` | Interface `CorePersistence` |
| Default adapter | `dataService` / Dexie / outbox | **Browser / painel** — não Vercel |
| API `/api/v1/` | Vercel handlers | Cadeia HMAC→tenant→AuthZ→Core |
| Idempotency port | `api/v1/_lib/idempotency/store.ts` | `unavailable` (prod) / memory TEST_ONLY |
| Confirmation port | `api/v1/_lib/confirmations/` | `unavailable` (prod) / memory TEST_ONLY |
| Event bus | `sentinela/core/domain/events.ts` | Memória in-process (cap 200) |
| Conflito reservas | `reservationConflict.ts` | Client-supplied slots |
| Plataforma tenant | M1–M4 | org / condo / units / memberships / seed piloto |
| RBAC legado | `roles` / `permissions` / `role_permissions` | Reutilizado pelo G3 |
| Domínio operacional | `packages`, `occurrences`, `reservations`, `boletos`, `residents` | Via `dataService` (sem `condominium_id`) |

### 1.3 Cadeia alvo (ainda incompleta)

```
n8n / WhatsApp          ← NÃO IMPLEMENTAR AGORA
    ↓
API Sentinela /api/v1/
    ↓
HMAC → Tenant → AuthZ
    ↓
Idempotency Store       ← FALTA (persistente)
    ↓
Confirmation Store      ← FALTA (persistente; SENSITIVE)
    ↓
Operational Core        ← OK
    ↓
Server Adapter          ← FALTA (sem Dexie)
    ↓
Postgres / Supabase     ← domínio legado + M1–M4
    ↓
Event Store             ← FALTA (auditoria)
    ↓
Painel operacional      ← UI já existe; observabilidade limitada
```

### 1.4 Bloqueios de produção (hoje)

| Operação | Classe | Prod default |
|----------|--------|--------------|
| `identify_resident` | READ | Parcial (falta ResidentsProvider server) |
| `identify_unit` | READ | OK se AuthZ |
| `get_boleto` | READ | Bloqueia sem `CorePersistence` |
| `create_package` / occurrence / reservation | WRITE | `IDEMPOTENCY_STORE_UNAVAILABLE` |
| `pickup_package` / `cancel_reservation` | SENSITIVE | `CONFIRMATION_STORE_UNAVAILABLE` + Core não executa |
| `notify_resident` | — | DENY (DECISION REQUIRED AuthZ) |

`gates.writes_enabled = false` · `sensitive_execution_enabled = false` · `idempotency_store = false` · `confirmation_persistent_store = false`

---

## 2. Lacunas (o que falta para produção)

### L1 — Idempotency Store persistente
- Interface existe; default = unavailable
- Sem tabela, sem TTL/cleanup, sem `put` atômico multi-instância
- Sem isso: retries n8n/WhatsApp podem duplicar WRITE

### L2 — Confirmation Store persistente
- Interface existe; default = unavailable
- Sem tabela; `markUsed` atômico necessário (`WHERE used_at IS NULL`)
- Sem isso: pickup/cancel permanecem bloqueados (correto)

### L3 — Server-side CorePersistence
- Default Core → `dataService` → Dexie/IndexedDB/outbox (**quebra em serverless**)
- API G5 exige `deps.persistence` injetado; handlers default **não** injetam
- Falta adapter Supabase service-role, sem browser, fail-closed sem tenant
- Falta `ResidentsProvider` server (identify / enrich package)

### L4 — Event Store
- Eventos só em memória do processo
- Cold start / multi-lambda = perda; inútil para auditoria e n8n
- Não deve virar segundo banco de domínio

### L5 — Reservation conflict server-side
- Warning `RESERVATION_CONFLICT_CLIENT_ONLY`
- API G5 passa `existingSlots: []` → checagem efetiva **vazia**
- Sem exclusion constraint / query no adapter → race possível

### L6 — Isolamento multi-tenant no domínio (trilhas M5+)
- Tabelas operacionais **sem** `organization_id` / `condominium_id`
- Tenant hoje só na fronteira API (headers/credential)
- Antes de WhatsApp multi-site: plano Fase 1 M5–M11 (não reabrir M1–M4)
- **Decisão:** G6 stores/adapter podem começar no piloto single-site; isolamento de linhas = trilha paralela obrigatória antes de multi-tenant real

### L7 — Composition root de produção
- Não existe `createProductionApiDeps()`
- Sem wiring único: credentials, tenants, stores, persistence, residents

### L8 — Observabilidade de painel
- Dashboard mostra eventos recentes da sessão
- Não responde de forma confiável: quem / quando / canal / request_id / resultado cross-instance

### L9 — Contratos n8n
- Rotas já existem; falta documentação operacional unificada + stores ativos
- **Não** criar endpoints paralelos tipo `/operations/create-package` se os atuais bastarem

### Explicitamente fora de G6 implementação imediata
- Workflows n8n
- WhatsApp Cloud
- Remover login de moradores
- SPA paralela
- Duplicar tabelas de domínio
- Alterar M1–M4
- Secrets no frontend

---

## 3. Arquitetura proposta

### 3.1 Princípio

| Camada | Pode regra de negócio? |
|--------|------------------------|
| n8n / WhatsApp | Não |
| API | Só fronteira (auth, tenant, idempotency, confirmation, validação) |
| Operational Core | **Sim — único dono** |
| Server Adapter | Persistência técnica + queries de conflito/listagem |
| Postgres | Constraints de segurança (unicidade, exclusão) |
| Event Store | Auditoria / outbox de integração — **não** CRUD de domínio |

### 3.2 Idempotency Store (desenho)

**Tabela proposta:** `api_idempotency_keys` (schema `public`)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL | FK → organizations |
| `condominium_id` | uuid NOT NULL | FK → condominiums |
| `idempotency_key` | text NOT NULL | header |
| `client_id` | text NOT NULL | |
| `operation` | text NOT NULL | |
| `request_fingerprint` | text NOT NULL | sha256 body |
| `request_id` | text | último request_id |
| `status` | text | `completed` / `in_progress` (opcional anti-race) |
| `response_body` | jsonb | envelope cacheado (sem secrets) |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | TTL (ex.: 24–72h) |

**Constraints / índices:**
- `UNIQUE (organization_id, condominium_id, idempotency_key)`
- Index `(expires_at)` para cleanup
- Opcional: FK composta validando condo∈org (como M1)

**Comportamento:**
- mesma key + mesmo fingerprint → replay resposta
- mesma key + fingerprint diferente → `DUPLICATE_REQUEST`
- store down → fail-closed `IDEMPOTENCY_STORE_UNAVAILABLE`
- **nunca** memory em produção

### 3.3 Confirmation Store (desenho)

**Tabela proposta:** `api_confirmations`

| Campo | Tipo | Notas |
|-------|------|-------|
| `confirmation_id` | uuid PK | |
| `token_hash` | text NOT NULL | SHA-256; plaintext só na resposta de create |
| `organization_id` | uuid NOT NULL | |
| `condominium_id` | uuid NOT NULL | |
| `client_id` | text NOT NULL | |
| `operation` | text NOT NULL | pickup / cancel |
| `resource_id` | text NOT NULL | |
| `prompt` | text | |
| `context_fingerprint` | text | opcional |
| `status` | text | `pending` / `used` / `expired` |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | |
| `consumed_at` | timestamptz NULL | |

**Constraints:**
- Index `(organization_id, condominium_id, operation, resource_id)`
- Consume atômico: `UPDATE … SET consumed_at=now(), status='used' WHERE consumed_at IS NULL AND expires_at > now()`

**Comportamento:** uso único, tenant-scoped, expiração; sem store → SENSITIVE bloqueada.

### 3.4 Server-side Adapter

**Novo módulo proposto (implementação futura):**  
`sentinela/core/adapters/serverPersistence.ts` (ou `api/v1/_lib/execution/supabasePersistence.ts`)

Requisitos:
- Implementa `CorePersistence`
- Usa `SUPABASE_SERVICE_ROLE_KEY` **somente server**
- **Zero** Dexie / localStorage / navigator / outbox offline
- Exige `organizationId` + `condominiumId` no contexto; ausência → fail-closed
- Reutiliza tabelas legado (`packages`, `occurrences`, `reservations`, `boletos`, `residents`)
- Não duplica regras do Core
- `listReservationSlots(area, date)` para conflito server-side
- `ResidentsProvider.listResidents()` scoped (piloto: filtro futuro por condo_id; hoje: catálogo site com cuidado)

**Painel:** continua usando default `dataService` até decisão de unificar; **não** substituir sem necessidade.

### 3.5 Event Store (desenho)

**Tabela proposta:** `api_domain_events` (append-only)

| Campo | Tipo |
|-------|------|
| `event_id` | uuid PK |
| `event_type` | text |
| `organization_id` | uuid |
| `condominium_id` | uuid |
| `actor_role` / `actor_display` / `source_channel` | text |
| `operation` | text |
| `entity_type` / `entity_id` | text |
| `request_id` / `correlation_id` | text |
| `occurred_at` | timestamptz |
| `payload` | jsonb (mínimo; sem PII excessivo / sem secrets) |

Tipos iniciais alinhados ao Core:
- `package.created`, `package.picked_up`
- `occurrence.created`, `occurrence.updated`
- `reservation.created`, `reservation.cancelled`
- Futuro: `boleto.accessed`, `notification.sent`, `resident.identified`

**Não é:** segundo CRUD de packages/occurrences.  
**É:** trilha de auditoria + fonte para painel + futura fan-out n8n.

Publicação: após sucesso do Core, adapter/API persiste eventos (substituir ou complementar o bus in-memory).

### 3.6 Reservation conflict (proposta — não implementar sem aprovação)

**Opção A (mínima, adapter):**  
Antes de `saveReservation`, query slots existentes no mesmo `area_id`+`date` e aplicar `hasReservationConflict` no Core com slots reais.

**Opção B (forte, DB):**  
Exclusion constraint Postgres (`tstzrange` / overlap) em `reservations` por área+intervalo — race-safe.

**Recomendação:** A na implementação G6 imediata; B como migration opcional de endurecimento.

---

## 4. Migrations necessárias (proposta — NÃO EXECUTAR)

Numeração sugerida **após M4**, sem tocar M1–M4. Nomes finais a confirmar na autorização.

### 4.1 MIGRATION NECESSÁRIA (G6 produção API)

#### M-G6-1 — `005_api_idempotency_keys` (nome lógico)
| Item | Conteúdo |
|------|----------|
| **Objetivo** | Persistência de Idempotency-Key para WRITE |
| **Tabelas** | `api_idempotency_keys` |
| **Campos** | ver §3.2 |
| **Índices** | UNIQUE (org, condo, key); expires_at |
| **Constraints** | FK org/condo; CHECK status |
| **RLS** | service-role only / deny anon+authenticated (tabela de infra API) |
| **Tenant** | scoped org+condo |
| **Rollback** | DROP TABLE |
| **Riscos** | JSON response grande; TTL curto demais → retries falham; TTL longo → storage |
| **Dependências** | M1 (org/condo) |
| **Legado** | zero alteração em packages/occurrences |

#### M-G6-2 — `006_api_confirmations`
| Item | Conteúdo |
|------|----------|
| **Objetivo** | Confirmações single-use para SENSITIVE |
| **Tabelas** | `api_confirmations` |
| **Campos** | ver §3.3 |
| **Índices** | org+condo+op+resource; expires_at |
| **Constraints** | token_hash NOT NULL; consume atômico via UPDATE |
| **RLS** | service-role only |
| **Rollback** | DROP TABLE |
| **Riscos** | clock skew vs expires_at; token plaintext só 1× na resposta |
| **Dependências** | M1 |
| **Legado** | zero |

#### M-G6-3 — *(código, não migration)* Server Adapter + composition root
Não cria tabela; obrigatório para READ boleto / WRITE real.

### 4.2 MIGRATION OPCIONAL / PARALELA

| Nome lógico | Objetivo | Prioridade |
|-------------|----------|------------|
| `007_api_domain_events` | Event Store append-only | Alta para observabilidade; pode seguir logo após stores |
| `008_reservation_exclusion` | Exclusion constraint overlap | Média — após Opção A |
| M5–M8 (plano Fase 1) | `condominium_id` em residents/packages/… | **Obrigatória antes multi-tenant WA**; não misturar com M-G6-1 sem decisão |
| `api_integration_credentials` | Credentials fora de env | Baixa (env funciona no piloto) |
| Seed `units` from residents | Ligar M2 ao legado | Média |

### 4.3 Separação clara

```
NECESSÁRIA PARA WRITE PROD:     idempotency + server adapter
NECESSÁRIA PARA SENSITIVE PROD: confirmation (+ wiring Core pickup/cancel)
NECESSÁRIA PARA AUDITORIA:      event store (ou aceitar gap temporário)
NECESSÁRIA PARA MULTI-TENANT:   M5+ isolamento domínio (trilha Fase 1)
NÃO FAZER AGORA:                n8n, WhatsApp, alterar M1–M4
```

---

## 5. Riscos

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| Liberar WRITE sem idempotency persistente | Crítica | Manter fail-closed |
| Usar memory store “só um pouco” em prod | Crítica | Proibido |
| Adapter service-role sem filtro tenant | Crítica | Fail-closed + queries scoped (e M5+ ASAP) |
| Domínio sem `condominium_id` + WhatsApp | Alta | Bloquear WA até M5–M11 |
| Event Store como segundo domínio | Alta | Append-only; sem UPDATE de entidade de negócio |
| Exclusion reservation quebra dados legados | Média | Validar overlaps existentes antes |
| Response_body idempotency com PII | Média | Minimizar campos; TTL; sem secrets |
| Substituir dataService do painel cedo demais | Média | Manter dual-path (UI browser / API server) |
| Reabrir M1–M4 | Alta | Proibido |

---

## 6. Dependências

```
M1–M4 (intactos)
    ↓
[G6-A] Migrations api_idempotency_keys + api_confirmations   ← precisa autorização
    ↓
[G6-B] Adapters persistent stores + CorePersistence server + ResidentsProvider
    ↓
[G6-C] Composition root + gates.writes_enabled (condicional)
    ↓
[G6-D] Ligar pickup/cancel → Core após confirmation válida
    ↓
[G6-E] Event Store (+ painel lê eventos persistidos)
    ↓
[G6-F] Conflito reserva server-side (A → opcional B)
    ↓
─── só então ───
n8n (orquestração sem SQL)
WhatsApp (canal)
M5+ isolamento domínio (pode avançar em paralelo, idealmente antes WA)
```

---

## 7. Plano de implementação (após autorização)

### Fase G6.1 — Migrations (com aprovação)
1. Criar SQL + rollback M-G6-1 / M-G6-2 (+ opcional events)
2. Precheck LIVE / readiness / apply / closeout (mesmo rigor M1–M4)
3. **Não** alterar tabelas M1–M4

### Fase G6.2 — Código adapters
1. `createSupabaseIdempotencyStore`
2. `createSupabaseConfirmationStore`
3. `createSupabaseCorePersistence` + `ResidentsProvider`
4. `resolve*` : override → persistent se env OK → **unavailable** (nunca memory prod)
5. `createProductionApiDeps()` injetado nos handlers default

### Fase G6.3 — Liberação controlada
1. WRITE com store + adapter → evidência replay/DUPLICATE
2. SENSITIVE → confirmation persistente → Core execute pickup/cancel
3. Atualizar gates / health / TRANSFORMACAO
4. Testes G6 obrigatórios

### Fase G6.4 — Observabilidade
1. Persistir eventos Core
2. Endpoint ou query painel: últimos eventos por condo
3. Campos: quem, quando, canal, request_id, entity, resultado

### Fase G6.5 — Reserva
1. Adapter lista slots
2. Core recebe `existingSlots` reais
3. (Opcional) exclusion constraint

### Stop explícito
**Não iniciar n8n/WhatsApp** sem G6.1–G6.3 PASS e decisão de isolamento.

---

## 8. Testes necessários (quando implementar)

### Idempotency
1. WRITE com key → PASS; retry mesma key+body → mesma resposta
2. mesma key + body diferente → `DUPLICATE_REQUEST`
3. sem key → `IDEMPOTENCY_KEY_REQUIRED`
4. store down → `IDEMPOTENCY_STORE_UNAVAILABLE`
5. tenant A não lê key de tenant B

### Confirmation
6. pickup sem token → `CONFIRMATION_REQUIRED`
7. token válido → Core executa (após liberação)
8. reuse → `CONFIRMATION_ALREADY_USED`
9. expired → `CONFIRMATION_EXPIRED`
10. store down → `CONFIRMATION_STORE_UNAVAILABLE` · `core_executed=false`

### Adapter
11. create_package → row em `packages` (piloto)
12. get_boleto → dados reais
13. sem Dexie no stack server
14. tenant ausente → DENY

### Eventos / obs
15. após create → evento persistido com request_id + condo
16. painel consegue listar “quem/quando/o quê”

### Reserva
17. dois horários sobrepostos → CONFLICT
18. (se exclusion) race concorrente → um falha no DB

### Regressão
19. G1–G5 suites continuam PASS
20. Core UI / painel continua funcionando via dataService
21. M1–M4 intactos · n8n=0 · WA=0
22. nenhum secret no frontend / envelope

---

## 9. Critérios de aceite (G6 implementação futura)

G6 implementação = **CLOSED / PASS** somente se:

1. Idempotency store **persistente** em produção (não memory)
2. Confirmation store **persistente** em produção (não memory)
3. Server adapter sem Dexie conectado ao Core na API
4. WRITE protegidas por idempotency + AuthZ + tenant
5. SENSITIVE exigem confirmation e executam Core só com store OK
6. Event Store (se no escopo aprovado) append-only e tenant-scoped
7. Conflito de reserva server-side (mínimo Opção A) documentado/testado
8. Testes + build + evidência
9. `DATABASE CHANGES` apenas nas migrations G6 aprovadas; M1–M4 intactos
10. n8n = 0 · WhatsApp = 0

Esta fase de **auditoria** aceita-se como:

**G6 = AUDIT / READY FOR IMPLEMENTATION**

---

## 10. Contratos para futuro n8n (sem novos endpoints desnecessários)

Reutilizar rotas atuais:

| Uso n8n | Método | Path existente | Op |
|---------|--------|----------------|-----|
| Identificar morador | GET | `/api/v1/residents/identify?phone=` | identify_resident |
| Identificar unidade | GET | `/api/v1/units/identify?unit=` | identify_unit |
| Boleto | GET | `/api/v1/boletos?unit=` / `resident_id=` | get_boleto |
| Criar encomenda | POST | `/api/v1/operations/packages` | create_package |
| Retirar encomenda | POST | `/api/v1/operations/packages/pickup` | pickup_package |
| Criar ocorrência | POST | `/api/v1/operations/occurrences` | create_occurrence |
| Atualizar ocorrência | PATCH | `/api/v1/operations/occurrences/update` | update_occurrence |
| Criar reserva | POST | `/api/v1/operations/reservations` | create_reservation |
| Cancelar reserva | POST | `/api/v1/operations/reservations/cancel` | cancel_reservation |

### Headers obrigatórios
- `X-Sentinela-Client-Id`, `X-Sentinela-Timestamp`, `X-Sentinela-Signature`
- `X-Organization-Id`, `X-Condominium-Id`
- `Idempotency-Key` (WRITE e recomendado SENSITIVE)
- Opcional: `X-Request-Id`, `X-Correlation-Id`

### Sucesso
```json
{
  "ok": true,
  "success": true,
  "request_id": "req_…",
  "operation": "create_package",
  "api_version": "v1",
  "data": {
    "ok": true,
    "operation": "create_package",
    "core_executed": true,
    "result": { },
    "warnings": [],
    "events": []
  }
}
```

### Erro
```json
{
  "ok": false,
  "success": false,
  "request_id": "req_…",
  "operation": "create_package",
  "error": { "code": "IDEMPOTENCY_STORE_UNAVAILABLE", "message": "…" }
}
```

### Auth / tenant / AuthZ
- HMAC canônico v1 (inclui idempotency key)
- Credential scoped 1:1 org+condo
- Permission keys RBAC existentes (sem bypass SINDICO/PORTEIRO)

### Confirmation (SENSITIVE)
1. POST com `resource_id` → `CONFIRMATION_REQUIRED` + `confirmation_id` + `confirmation_token`
2. POST de novo com id+token+resource_id → execução (quando G6 liberar)

### n8n NÃO pode
- Conectar service_role / SQL direto
- Guardar secret no frontend
- Inventar regra de condomínio no workflow

---

## 11. Observabilidade (perguntas que o Sentinela deve responder)

| Pergunta | Fonte proposta |
|----------|----------------|
| Quem fez? | `actor_display` / `client_id` / role |
| Quando? | `occurred_at` / `created_at` |
| Qual condomínio? | `organization_id` + `condominium_id` |
| Qual morador? | `entity_id` / payload mínimo / resident_id |
| Qual operação? | `operation` / `event_type` |
| Qual resultado? | status HTTP + `core_executed` + entity ids |
| Foi automático? | `source_channel` ∈ {system, whatsapp, voice, …} |
| Foi WhatsApp? | channel = whatsapp (futuro) |
| Foi painel? | channel = panel / UI Core path |
| Qual request_id? | header + coluna eventos + idempotency |
| Qual evento? | `event_id` / `event_type` no Event Store |

Painel: evoluir a barra de eventos de “memória de sessão” → “últimos N do Event Store do condo”.

---

## 12. Decisão requerida (aguardar autorização)

Antes de qualquer migration/código, decidir:

1. **Autorizar M-G6-1 + M-G6-2** (idempotency + confirmation) nesta sprint?
2. **Incluir Event Store (`api_domain_events`) na mesma leva** ou fase seguinte?
3. **Conflito de reserva:** só Opção A (adapter) ou já Opção B (exclusion DB)?
4. **Isolamento M5+:** paralelo imediato ou depois do adapter piloto single-site?
5. **TTL idempotency** (sugestão: 48h) e **TTL confirmation** (já 300s default)?
6. **Credentials:** permanecer em `SENTINELA_API_CREDENTIALS` ou já migrar para tabela?
7. Confirmar: **proibir memory stores em qualquer ambiente marcado production**

### Resultado desta etapa

**G6 = AUDIT / READY FOR IMPLEMENTATION**

Pare. Aguardar autorização explícita para:
- criar migrations
- alterar código
- aplicar qualquer DDL

n8n e WhatsApp permanecem **fora de escopo** até a fundação persistente estar PASS.
