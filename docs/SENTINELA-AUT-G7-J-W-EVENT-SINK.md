# SENTINELA AUT — G7-J-W — Persistent Event Store Sink

**Gate:** G7-J-W  
**Data:** 2026-08-15  
**Pré-requisito:** G7-J = CLOSED / PASS (`public.api_domain_events` LIVE)  
**Status:** PASS (wiring fail-safe; sem migration; sem WhatsApp)

```
DATABASE CHANGES    = 0
MIGRATIONS EXECUTED = 0
LIVE WRITE          = 0 (sem INSERT arbitrário LIVE neste gate)
WHATSAPP            = 0
N8N PROD            = 0
ENDPOINT /events    = 0
```

---

## 1. Mapa (evento → emissão → sink)

| Evento | Ponto de emissão | Local sink | Event Store |
|--------|------------------|------------|-------------|
| `request.received` | `protectedHandler` | sim | **não** |
| `request.authorized` | AuthZ OK | sim | **não** |
| `request.rejected` | HMAC/tenant fail | sim | **sim*** |
| `request.denied` | AuthZ deny | sim | **sim** |
| `confirmation.required` | confirmation gate | sim | **sim** |
| `confirmation.consumed` | confirmation gate | sim | **sim** |
| `idempotency.replay` | `executeCore` | sim | **sim** |
| `idempotency.created` | `executeCore` | sim | **não** (omitido) |
| `core.started` | `executeCore` | sim | **não** |
| `core.completed` | `executeCore` | sim | **não** |
| `core.failed` | `executeCore` | sim | **sim** |
| `operation.completed` | `withCoreExecution` | sim | **sim** |
| `operation.failed` | `withCoreExecution` | sim | **sim** |

\*Somente se `organization_id` + `condominium_id` UUIDs válidos (fail-closed). Rejeições pré-tenant → só logs.

---

## 2. Arquitetura

```
safeEmit / safeEmitOnce
  → buildOperationalEvent + redact
  → activeSink (console/ring)          // sempre
  → queuePersistentPersist (async)     // G7-J-W best-effort
       → mapEnvelopeToDomainEventRow
       → INSERT api_domain_events
```

Composition: `createProductionApiDeps` → `wireSupabasePersistentEventStore(client)`.

---

## 3. Fail-safe

Falha / timeout / skip do Event Store **nunca** altera status HTTP nem `core_executed` da operação.

Erros: `console.error('[sentinela-obs] persistent sink failure (non-fatal)', …)` redacted.

---

## 4. Tenant

INSERT exige UUIDs válidos de org + condo. Sem inventar tenant. Sem fallback global.

---

## 5. Arquivos

- `api/v1/_lib/observability/persistentEventStore.ts` (novo)
- `api/v1/_lib/observability/runtime.ts` (queue após emit)
- `api/v1/_lib/composition/productionDeps.ts` (wire)
- `api/v1/_lib/execution/fakePersistenceDb.ts` (`api_domain_events`)
- `api/v1/_lib/observability/g7jw.event-sink.test.ts` (novo)

---

## 6. STOP

Sem WhatsApp, endpoint de consulta, purge, G7-K sem autorização.
