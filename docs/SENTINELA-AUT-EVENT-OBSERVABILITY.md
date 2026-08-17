# SENTINELA AUT — Event / Observability Readiness

**Gate:** G7-G  
**Data:** 2026-08-15  
**Pré-requisito:** G7-F = PASS  
**Código suporte:** `api/v1/_lib/observability/` (sink in-process — **não** Event Store)

```
DATABASE CHANGES = 0
MIGRATIONS       = 0
LIVE WRITE       = 0
N8N REAL         = 0
WHATSAPP         = 0
```

Complementa: [`SENTINELA-AUT-OBSERVABILITY.md`](./SENTINELA-AUT-OBSERVABILITY.md) (G7-F).

---

## G7-G1 — Fluxo atual (auditoria)

```
HTTP request
→ HMAC
→ tenant
→ AuthZ
→ classification (READ|WRITE|SENSITIVE)
→ idempotency (WRITE)
→ confirmation (SENSITIVE)
→ Operational Core
→ Server Adapter
→ database
→ response
```

| Etapa | Entrada | Saída | Campos observáveis |
|-------|---------|-------|-------------------|
| HTTP | Request + headers | `request_id` | request_id, method, path (sem query sensível) |
| HMAC | Signature + timestamp | OK / 401 | client_id; **nunca** secret/signature |
| Tenant | org+condo headers | OK / 4xx | organization_id, condominium_id |
| AuthZ | operation + permissions | OK / 403 | operation, denied reason code |
| Classification | operation name | READ/WRITE/SENSITIVE | classification |
| Idempotency | key + fingerprint | proceed / replay / mismatch | replay flag, error_code |
| Confirmation | challenge / token | required / consumed / invalid | confirmation_id **sem** token |
| Core | validated input | success / fail | core_executed, error_code |
| Adapter/DB | persistence call | OK / CONFLICT / … | duration_ms, retry_hint |
| Response | envelope | HTTP + body | status, error_code, request_id |

Perguntas que a observabilidade deve responder (sem secrets):

1. Quem chamou? → `client_id`  
2. Qual tenant? → org + condo  
3. Qual operação? → `operation`  
4. Qual `request_id`?  
5. Qual resultado? → `status` / HTTP  
6. Qual erro? → `error_code`  
7. Quanto tempo? → `duration_ms`  
8. Houve retry? → mesmo `correlation_id` / `Idempotency-Key` + eventos  
9. Houve confirmação? → `confirmation.*`  
10–12. Chegou/executou Core / persistiu? → `core_executed` + eventos `core.*` / resultado 2xx WRITE

---

## G7-G2 — Event envelope

```json
{
  "event_id": "evt_…",
  "event_name": "operation.completed",
  "occurred_at": "2026-08-15T22:00:00.000Z",
  "request_id": "req_…",
  "correlation_id": "n8n-exec-…",
  "client_id": "n8n-pilot",
  "organization_id": "…",
  "condominium_id": "…",
  "operation": "create_package",
  "classification": "WRITE",
  "status": "completed",
  "http_status": 200,
  "error_code": null,
  "retry_hint": null,
  "retry_class": "NO_RETRY",
  "core_executed": true,
  "duration_ms": 123,
  "external_ref": "hash:wamid…"
}
```

### Redaction (obrigatória)

Não registrar: HMAC secret, signature, confirmation_token, senhas, service-role, payload WhatsApp bruto, áudio, imagem, boleto completo, CPF/documento, SQL/stack, body bruto.

Implementação: `redactObservabilityValue` / `sanitizePublicDetails`.

---

## G7-G3 — Eventos mínimos

| Evento | Quando |
|--------|--------|
| `request.received` | Entrada HTTP |
| `request.rejected` | HMAC/tenant/auth falhou |
| `request.authorized` | AuthZ OK |
| `request.denied` | AuthZ deny |
| `idempotency.replay` | Mesma key+fingerprint |
| `idempotency.created` | Nova execução WRITE concluída |
| `confirmation.required` | Challenge SENSITIVE |
| `confirmation.consumed` | Token consumido |
| `core.started` | Antes da op Core |
| `core.completed` | Core OK |
| `core.failed` | Core falhou |
| `operation.completed` | Resultado final OK |
| `operation.failed` | Resultado final erro |

Sem dezenas de eventos adicionais neste gate.

---

## G7-G4 — Relação com n8n

| Papel | Responsável |
|-------|-------------|
| Orquestração / UX canal | n8n (futuro) |
| Resultado operacional / auditoria | **API Sentinela** |
| Event Store / fonte de verdade | **Não é o n8n** |

```
n8n → create_package → API → Core → DB → API response → n8n
```

n8n recebe só o necessário para continuar o workflow.  
Observabilidade da API existe **independentemente** do n8n.

---

## G7-G5 — Status operacionais

| Status | Significado | Relação com API |
|--------|-------------|-----------------|
| `accepted` | Aceito na borda (após auth) | pré-execução |
| `rejected` | Recusado (auth/tenant/validação) | 4xx auth/valid |
| `authorized` | AuthZ passou | evento |
| `executed` | Core rodou | `core_executed: true` |
| `completed` | Sucesso final | 2xx |
| `failed` | Falha operacional | 5xx / erros Core |
| `conflict` | Conflito de recurso | `CONFLICT` 409 |
| `confirmation_required` | Precisa challenge | `CONFIRMATION_REQUIRED` |
| `confirmation_consumed` | Token já usado / consumido | `CONFIRMATION_ALREADY_CONSUMED` |
| `duplicate` | Replay / fingerprint clash | idempotency |
| `needs_confirmation` | Ambiguidade domínio | `NEEDS_CONFIRMATION` |

**Não altera** contratos HTTP/códigos G7-D/E — camada de observabilidade.

---

## G7-G6 — Correlação `request_id`

```
WhatsApp message_id (futuro)
→ n8n execution_id
→ X-Correlation-Id / X-Request-Id
→ API request_id
→ Core (mesmo request_id em logs)
→ adapter/DB
→ API response (eco request_id)
```

- `request_id` correlaciona a operação; **não é segredo**.  
- Retries WRITE: mesma `Idempotency-Key`; `request_id` pode mudar por hop.  
- `correlation_id` agrupa conversa.

---

## G7-G7 — Retry

| Classe | Exemplos |
|--------|----------|
| `SAFE_RETRY` | 5xx, store unavailable, WRITE com **mesma** Idempotency-Key, READ |
| `CONTROLLED_RETRY` | SENSITIVE — só com novo challenge; **nunca** cego pós-200 |
| `NO_RETRY` | `INVALID_TIME_RANGE`, auth fail, `CONFIRMATION_REQUIRED`, 403/404 |
| `RETRY_AFTER_CHANGE` | `CONFLICT` — mudar horário/dados + nova key |

Código: `classifyRetry` / `describeRetryPolicy`.

---

## G7-G8 — Event Store futuro (avaliação — **sem migration**)

| Opção | Vantagens | Limitações |
|-------|-----------|------------|
| **A) Logs estruturados** | Rápido, barato, sem schema | Retenção/consulta frágil; difícil painel tenant |
| **B) `api_domain_events`** | Tenant isolation, query painel, retenção controlada | Migration futura; volume; não duplicar domínio |
| **C) Solução externa** (ex. APM) | Dashboards, alertas | Custo; dados fora do tenant PG; compliance |

### Recomendação G7-G

1. **Agora:** logs estruturados + envelope (`api/v1/_lib/observability`) + sink de teste.  
2. **Futuro (gate autorizado):** tabela append-only `api_domain_events` **somente** com envelope redacted — **não** segundo domínio de negócio (sem reimplementar packages/reservations).  
3. Índice sugerido (futuro): `(organization_id, condominium_id, occurred_at DESC)`, `(request_id)`, `(operation, status)`.  
4. Retenção sugerida: 30–90 dias operacional; auditoria longa = decisão compliance.  
5. Painel consulta eventos **via API admin futura**, nunca n8n→SQL.

**Não criar migration neste gate.**

---

## G7-G9 — Painel (mapa futuro — sem tela nova)

| Informação | Superfície existente |
|------------|----------------------|
| Encomendas / ocorrências / reservas | Views + Dashboard atuais |
| Operações recentes / erros automação | Futuro: widget em Dashboard usando feed de eventos |
| Pendências / confirmações | Futuro: lista filtrada `confirmation_required` |
| Status Sentinela / última atividade | `GET /api/v1/health` + último evento |
| Falhas n8n | Correlacionar `client_id` + `error_code` no feed |

Sem nova SPA; reutilizar Dashboard/cards existentes.

---

## G7-G10 — Testes

`api/v1/_lib/observability/g7g.observability.test.ts` — 15 cenários + redaction + correlation (sem LIVE).

---

## G7-H-A — Production wiring (2026-08-15)

**Status:** PASS — emit conectado aos handlers reais.  
**Event Store / migration:** ainda **0**.

### Pontos de emissão

| Ponto | Arquivo | Eventos |
|-------|---------|---------|
| Entrada protegida | `protectedHandler.ts` `withProtectedHandler` | `request.received` |
| HMAC/tenant fail | idem (parse response) | `request.rejected` (+ `operation.failed`) — **sem** tenant não confiável |
| AuthZ deny | `withAuthorizedOperation` | `request.denied`, `operation.failed` |
| AuthZ OK | idem | `request.authorized` |
| Confirmation | `withConfirmedOperation` | `confirmation.required` / `confirmation.consumed` |
| Idempotency | `executeCore.ts` | `idempotency.replay` / `idempotency.created` |
| Core | `executeCore.ts` | `core.started` / `completed` / `failed` |
| Resultado HTTP | `withCoreExecution.ts` | `operation.completed` / `failed` |

Dedup: `safeEmitOnce` por `(request_id, event_name)` evita duplicar received/authorized no re-entry SENSITIVE.

### Semântica `core_executed`

| Situação | Valor |
|----------|-------|
| Rejeição pré-Core (HMAC, AuthZ, confirmation_required, validação) | `false` |
| Idempotency replay (Core não reexecuta) | `false` (+ `idempotency_replay` no data) |
| Core rodou com sucesso | `true` |
| Core rodou e retornou erro de domínio | `true` |

### Fail-safe

`safeEmit` / sink: falha → `console.error` técnico; **não** altera resposta de negócio.

### Sink

In-process: console estruturado `[sentinela-obs]` + ring buffer 200. Sem SQL/HTTP/n8n.

### Testes

`api/v1/_lib/observability/g7ha.wiring.test.ts`

### Limitações

- Sem retenção durável / consulta painel por tenant  
- ~~Sem Event Store~~ → **G7-J** criou `api_domain_events`; **G7-J-W** liga sink fail-safe  
- Logs dependem do host (Vercel/Node)

### G7-J-W — Persistent sink (2026-08-15)

**Status:** PASS  
Ver: [`SENTINELA-AUT-G7-J-W-EVENT-SINK.md`](./SENTINELA-AUT-G7-J-W-EVENT-SINK.md)

- `safeEmit` → local sink + `queuePersistentPersist` (async, best-effort)
- Persistidos: rejected/denied/confirmation.*/idempotency.replay/core.failed/operation.*
- Sem tenant UUID válido → skip (não inventa tenant)
- Falha do INSERT **não** altera resultado do Core
- Wiring produção: `createProductionApiDeps` → `wireSupabasePersistentEventStore`
- Sem endpoint de consulta / purge / WhatsApp

---

## Decisões pendentes

1. ~~Autorizar migration `api_domain_events` após piloto n8n?~~ → G7-J CLOSED  
2. Role/permissão para consultar eventos no painel.  
3. Retenção e PII policy formal (purge gate).  
4. Endpoint admin de leitura (AuthZ) — gate futuro.