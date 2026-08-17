# SENTINELA AUT. — G7 Server Runtime Readiness (Audit)

**Status:** G7 = **READY FOR IMPLEMENTATION**  
**Data:** 2026-08-14  
**Tipo:** auditoria / desenho — **sem wiring · sem migration · sem n8n/WhatsApp**  
**Pré-requisitos:** M1–M4 · G1–G5 · G6-1 · G6-2 = CLOSED / PASS  
**Evidência:** `docs/evidence/results/SENTINELA-G7-SERVER-RUNTIME-AUDIT-2026-08-14.txt`

```
DATABASE CHANGES = 0
MIGRATIONS EXECUTED = 0
LIVE WRITE = 0
N8N = 0
WHATSAPP = 0
```

---

## 1. Objetivo

Preparar o **Operational Core** para execução **real** em server/Vercel:

```
API (HMAC → tenant → AuthZ → class → idempotency|confirmation)
  → Core (regras)
  → Server Adapter (Supabase/Postgres service-role)
  → DB
```

**Nesta etapa (G7 audit):** somente mapear.  
**Não:** n8n, WhatsApp, migrations, Event Store, M5, ALTER G6-1/G6-2, remover features do painel.

---

## 2. Arquitetura atual

### 2.1 Fronteira alvo

| Camada | Responsabilidade | Estado |
|--------|------------------|--------|
| API `api/v1/*` | HMAC, tenant, AuthZ, classification, idempotency, confirmation | G1–G5 + SQL G6 CLOSED; **wiring stores = NÃO** |
| Core `sentinela/core/*` | Regras de negócio puras | Existe; **sem React/Dexie no pacote** |
| Port `CorePersistence` | Interface de persistência | Existe |
| Default adapter | `getDefaultPersistence()` → `dataService` | **Browser / Dexie** |
| Memory stub | `createMemoryCorePersistence` | TEST_ONLY |
| **Server Adapter** | Supabase service-role Node | **AUSENTE** |

### 2.2 Como o Core acessa dados hoje

```
Core operation(input, ctx, persistence?)
  └─ persistence ?? await getDefaultPersistence()
        └─ dynamic import services/dataService + notificationService
              └─ offlineDataService → offlineDb (Dexie/IndexedDB) + outbox
                    └─ services/supabase.ts (import.meta.env.VITE_*)
```

Na API G5:

```
withCoreExecution / withConfirmedOperation
  → executeCoreOperation({ deps: { persistence?, residentsProvider?, idempotencyStore? } })
```

Handlers default **não** injetam `deps` → WRITE falha (`IDEMPOTENCY_STORE_UNAVAILABLE` / adapter missing); SENSITIVE falha (`CONFIRMATION_STORE_UNAVAILABLE` + `sensitiveBlocked`).

### 2.3 Contrato do Server Adapter (G7)

O adapter de produção **deve**:

- implementar `CorePersistence` (+ `getPackageById` obrigatório para pickup)
- usar cliente Supabase/Postgres **server** (`process.env`, service-role)
- ser tenant-aware nos writes/reads (org/condo do request)
- **nunca** usar Dexie, localStorage, IndexedDB, React, `window`, `navigator`, `App.tsx`, `import.meta.env.VITE_*`
- **nunca** fallback para `getDefaultPersistence()` / dados globais do painel

Composition root sugerido (implementação futura):

```ts
createProductionApiDeps(): ExecutionDeps
  = {
      persistence: createSupabaseCorePersistence(env),
      residentsProvider: createSupabaseResidentsProvider(env),
      idempotencyStore: createSupabaseIdempotencyStore(env),
      // confirmation store resolvido em resolveConfirmationStore()
    }
```

---

## 3. Dependências browser-only (path default)

| Local | Dependência | Impacto server |
|-------|-------------|----------------|
| `services/offlineDb.ts` | Dexie / IndexedDB | **Proibido** no adapter server |
| `services/offlineDataService.ts` | outbox + `navigator.onLine` | Proibido |
| `services/dataService.ts` | offline layer + browser | Proibido como default server |
| `services/supabase.ts` | `import.meta.env.VITE_*` | Cliente Vite — inadequado serverless |
| `App.tsx` | passa snapshots / `existingSlots` | UI only; Core não importa |
| `DashboardView.tsx` | `subscribeDomainEvents` | UI only |
| `sentinela/core/**` | — | **Limpo** (sem DOM) |

**Assunções client-ish no Core (sem DOM):** vários inputs exigem catálogo/snapshot (`residents[]`, `package`, `existingSlots`, `boletos?`) — no server o **adapter/provider** deve preencher antes da regra.

---

## 4. Mapa de operações

Legenda classes: READ / WRITE / SENSITIVE (`ops/classification.ts`).

### 4.1 `identify_resident` — READ

| Item | Valor |
|------|--------|
| Entrada | `residentId?`, `name?`, `unit?`, `phone?`, `whatsapp?` + catálogo `residents[]` |
| Validação | payload G5; resolução no Core |
| Tenant | org+condo headers (API) |
| Permission | `residents.view` |
| Adapter | `ResidentsProvider.listResidents()` (não CorePersistence) |
| DB | **R** residents (provider) |
| Resultado | match / ambiguous / not resolved |
| Erros | `NOT_FOUND`, clarifications |
| Idempotência | Não |
| Confirmação | Não |
| Server-safe? | Sim, **com** ResidentsProvider |

### 4.2 `identify_unit` — READ

| Item | Valor |
|------|--------|
| Entrada | `unit?`, `knownUnitCodes?` |
| Permission | `residents.view` |
| Adapter | opcional load `public.units` (M2) |
| DB | R opcional units |
| Idempotência / Confirmação | Não |
| Server-safe? | Sim (hoje API **não** passa codes M2) |

### 4.3 `create_package` — WRITE

| Item | Valor |
|------|--------|
| Entrada | recipient/unit/type/items/… |
| Permission | `packages.create` |
| Adapter | `savePackage` (+ enrich via residents) |
| DB | **W** packages |
| Evento | `package.created` |
| Idempotência | **Obrigatória** (`Idempotency-Key`) |
| Confirmação | Não |
| Server-safe? | Sim, com Server Adapter + Idempotency store |

### 4.4 `pickup_package` — SENSITIVE

| Item | Valor |
|------|--------|
| Entrada | `packageId` + (hoje) snapshot `package` |
| Permission | `packages.update` |
| Adapter | `getPackageById` + `updatePackage` |
| DB | **R+W** packages |
| Evento | `package.picked_up` |
| Idempotência | Recomendada (docs G6); **não exigida** no path SENSITIVE atual |
| Confirmação | **Obrigatória** (validate + atomic consume) |
| Server-safe? | Core existe; API **bloqueada** (`sensitiveBlocked`); falta getById no default port |

### 4.5 `create_occurrence` — WRITE

| Item | Valor |
|------|--------|
| Permission | `occurrences.create` |
| Adapter | `saveOccurrence` |
| DB | **W** |
| Evento | `occurrence.created` |
| Idempotência | Obrigatória |
| Confirmação | Não |

### 4.6 `update_occurrence` — WRITE

| Item | Valor |
|------|--------|
| Permission | `occurrences.update` |
| Adapter | `updateOccurrence` |
| Evento | `occurrence.updated` |
| Idempotência | Obrigatória |

### 4.7 `create_reservation` — WRITE

| Item | Valor |
|------|--------|
| Permission | `reservations.create` |
| Adapter | `saveReservation` + **list slots** (gap) |
| DB | **W** (+ **R** slots para conflito) |
| Evento | `reservation.created` |
| Warning | `RESERVATION_CONFLICT_CLIENT_ONLY` |
| Idempotência | Obrigatória |
| Confirmação | Não |
| Bloqueio n8n | Conflito server-side **ainda não authoritative** |

### 4.8 `cancel_reservation` — SENSITIVE

| Item | Valor |
|------|--------|
| Permission | `reservations.delete` |
| Adapter | `deleteReservation` |
| Evento | `reservation.cancelled` |
| Confirmação | Obrigatória |
| Core na API | **não wired** (mesmo padrão pickup) |

### 4.9 `get_boleto` — READ

| Item | Valor |
|------|--------|
| Permission | `boletos.view` |
| Adapter | `getBoletos` (sem `onRemoteUpdate` browser) |
| DB | **R** |
| Idempotência / Confirmação | Não |

### 4.10 `notify_resident` — WRITE (classificação) / AuthZ DENY

| Item | Valor |
|------|--------|
| Permission | **`decision_required`** (sem key RBAC) |
| Status | **DECISION REQUIRED** — fora do caminho crítico G7 |
| Endpoint prod | Não expor até decisão |

---

## 5. Idempotency — ponto de integração (`api_idempotency_keys`)

### Pipeline WRITE alvo

```
request
  → HMAC (+ Idempotency-Key no canônico)
  → tenant
  → AuthZ
  → classification = WRITE
  → Idempotency claim (get / R1 reclaim / put in_progress)
  → Core + Server Adapter
  → persist result (completed|failed + response)
```

### Estado

| Peça | Estado |
|------|--------|
| Tabela LIVE | EXISTS (G6-1 CLOSED) |
| Port `IdempotencyStore` | Existe (`get`/`put`) |
| Prod resolve | `unavailable` → `IDEMPOTENCY_STORE_UNAVAILABLE` |
| `createSupabaseIdempotencyStore` | **AUSENTE** |
| R1 lazy reclaim | Decidido no SQL/docs; **não** no port TS ainda |
| Gate `idempotency_store` / `writes_enabled` | `false` |

### Regras a respeitar no wiring (não implementar nesta auditoria)

- UNIQUE `(organization_id, condominium_id, idempotency_key)`
- Nunca DELETE só por key (sempre tenant-scoped)
- R1: se `expires_at <= now()` → DELETE tenant-scoped → INSERT
- Fingerprint mismatch em chave ativa → `DUPLICATE_REQUEST`
- TTL lógico 48h; sem cron

**Decisão aberta menor:** exigir também `Idempotency-Key` em SENSITIVE (docs G6 sugerem; código atual não). **Não bloqueia** início do adapter; fechar no wiring SENSITIVE.

---

## 6. Confirmation — ponto de integração (`api_confirmations`)

### Pipeline SENSITIVE alvo

```
request
  → HMAC → tenant → AuthZ
  → classification = SENSITIVE
  → confirmation validate (bindings + token_hash + not expired + pending)
  → atomic consume (UPDATE pending→consumed WHERE … RETURNING)
  → Core + Server Adapter
  → (opcional) Idempotency se decidido
```

Operações: `pickup_package`, `cancel_reservation`.

### Estado

| Peça | Estado |
|------|--------|
| Tabela LIVE | EXISTS (G6-2 CLOSED) |
| G4 service | create/validate/markUsed (memory/unavailable) |
| Prod resolve | `unavailable` |
| `createSupabaseConfirmationStore` | **AUSENTE** |
| Core pós-confirm | **bloqueado** (`sensitiveBlocked`) |
| Gate `confirmation_persistent_store` / `sensitive_execution_enabled` | `false` |

**Regra:** Core SENSITIVE **só** após consume atômico bem-sucedido. Sem confirmação válida → sem execução.

---

## 7. Eventos (memória — sem Event Store)

Bus: `sentinela/core/domain/events.ts` — in-process, ring buffer 200.

| Evento | Origem | Payload típico | Consumidor atual | Futuro n8n |
|--------|--------|----------------|------------------|------------|
| `package.created` | `createPackage` | id + meta | DashboardView / response JSON | notificar / sync |
| `package.picked_up` | `pickupPackage` | id | idem | WA confirmação retirada |
| `occurrence.created` | `createOccurrence` | id | idem | alerta |
| `occurrence.updated` | `updateOccurrence` | id | idem | alerta |
| `reservation.created` | `createReservation` | id | idem | confirmação área |
| `reservation.cancelled` | `cancelReservation` | id | idem | aviso cancelamento |

**Não emitidos:** identify_*, get_boleto, notify_resident.

**G7:** não criar Event Store. Adapter server deve continuar emitindo via `publishDomainEvents` no processo (efêmero). Persistência de eventos = gate futuro.

---

## 8. Reservas — `RESERVATION_CONFLICT_CLIENT_ONLY`

### Problema

- Core recebe `existingSlots` do **caller**.
- Painel (`App.tsx`) monta slots do estado local.
- API G5 passa `existingSlots: []` → checagem **vazia** → double-book possível sob concorrência.
- Sem exclusion constraint no Postgres.

### O que corrigir **antes** de n8n criar reservas com segurança

1. **Obrigatório (app-level):** Server Adapter (ou executeCore) carregar slots reais (`areaId`+`date`) e passar ao Core **antes** de `saveReservation`.
2. **Fortemente recomendado (DB):** exclusion / constraint overlap em `reservations` — **fora** deste audit; **não criar agora**.
3. Reclassificar/remover warning quando a fonte for server-authoritative.

**NÃO** criar constraint nesta etapa G7 audit.

---

## 9. Tenant gaps

| Caminho | org+condo | Severidade |
|---------|-----------|------------|
| API protegida (`protectRequest`) | Obrigatórios | OK |
| AuthZ / confirmation / idempotency scopes | Tenant-scoped | OK |
| Core `tenantWarnings` | Warning se ausente; **não** hard-fail | OK na API (ctx preenchido) |
| Server Adapter (futuro) | Deve fail-closed sem tenant | **Requisito G7 impl** |
| Tabelas operacionais legadas (packages/…) | Sem colunas org/condo (M5+) | **WARNING** no piloto (API fail-closed); **BLOCKING** multi-condo produção |
| `identify_unit` sem catálogo M2 | Condo units não lidas | WARNING |
| `GET /health` | Sem tenant | OK (público) |

**Não criar M5 automaticamente.**

---

## 10. Riscos

| ID | Risco | Severidade | Mitigação G7 |
|----|-------|------------|--------------|
| R1 | Default Core → Dexie se adapter omitido | HIGH | Nunca chamar `getDefaultPersistence` na API; injetar sempre |
| R2 | WRITE sem store persistente | HIGH (já fail-closed) | `createSupabaseIdempotencyStore` + flip gates |
| R3 | SENSITIVE sem store / Core blocked | HIGH (já fail-closed) | Confirmation store + wire Core |
| R4 | Double-book reservas | HIGH p/ n8n | list slots server; constraint depois |
| R5 | Pickup sem `getPackageById` | HIGH | Implementar no adapter |
| R6 | Isolamento linha operacional (M5) | MED/HIGH multi-tenant | M5+ gate separado |
| R7 | Events efêmeros em serverless | MED | Event Store futuro |
| R8 | `notify_resident` unmapped | LOW (deny) | Decisão RBAC humana |
| R9 | Vite supabase client no server | HIGH se reutilizado | Cliente server separado |

---

## 11. Ordem recomendada de implementação (pós-autorização)

1. **G7-A** — `createSupabaseCorePersistence` + cliente server env (sem Dexie)  
2. **G7-B** — `ResidentsProvider` server + wire `identify_resident` / enrich packages  
3. **G7-C** — `createSupabaseIdempotencyStore` (R1 reclaim) + composition root WRITE  
4. **G7-D** — `createSupabaseConfirmationStore` (consume atômico) + wire pickup/cancel → Core  
5. **G7-E** — `getPackageById` + list reservation slots no adapter; endurecer `create_reservation`  
6. **G7-F** — Flip gates (`idempotency_store`, `writes_enabled`, `confirmation_persistent_store`, `sensitive_execution_enabled`) com evidência  
7. **Depois (outros gates):** exclusion constraint reservas · Event Store · M5 tenant columns · n8n · WhatsApp · `notify_resident` decision  

Cada sub-gate: autorização explícita · testes · evidência · **STOP**.

---

## 12. Decisões

### Fechadas o suficiente para implementar G7

- Fronteira API → Core → Server Adapter → DB  
- Ports `CorePersistence` / stores G6  
- Pipelines WRITE (idempotency) e SENSITIVE (confirmation → consume → Core)  
- Proibições browser no adapter  
- Ordem de implementação acima  

### Abertas (não bloqueiam início do adapter; documentadas)

| ID | Tema | Status |
|----|------|--------|
| D-G7-1 | `notify_resident` permission RBAC | **DECISION REQUIRED** (já G3) |
| D-G7-2 | Idempotency obrigatória também em SENSITIVE? | Preferência docs = sim; fechar no wiring SENSITIVE |
| D-G7-3 | Constraint DB de overlap de reservas | Adiado (não nesta etapa) |
| D-G7-4 | Event Store schema | Adiado |
| D-G7-5 | M5 colunas tenant em tabelas operacionais | Adiado |

Nenhuma decisão **bloqueante** impede começar G7-A/B com autorização explícita.

---

## 13. Resultado

**G7 = READY FOR IMPLEMENTATION**  
**G7-A = PASS** · **G7-B = PASS**

```
DATABASE CHANGES = 0
MIGRATIONS EXECUTED = 0
LIVE WRITE = 0
N8N = 0
WHATSAPP = 0
G6-1 = CLOSED / PASS
G6-2 = CLOSED / PASS
M1–M4 = INTACTOS
```

**STOP após cada sub-gate.** Não iniciar G7-C / n8n / WhatsApp automaticamente.
