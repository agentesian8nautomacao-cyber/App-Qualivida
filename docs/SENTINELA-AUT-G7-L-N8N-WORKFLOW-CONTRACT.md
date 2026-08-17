# SENTINELA AUT — G7-L — N8N Workflow Contract

**Gate:** G7-L — N8N Production Readiness / Workflow Contract  
**Data:** 2026-08-16  
**Pré-requisitos:** G7-K = PASS · G7-K-RBAC = CLOSED/PASS · G7-J-W-LIVE = PASS · G7-F/H-B = PASS  
**API:** [`SENTINELA-AUT-API-CONTRACT.md`](./SENTINELA-AUT-API-CONTRACT.md)  
**Contrato n8n (F):** [`SENTINELA-AUT-N8N-CONTRACT.md`](./SENTINELA-AUT-N8N-CONTRACT.md)  
**Código-contrato:** `api/v1/_lib/execution/g7l.n8n-workflow-contract.ts`  
**Workflow piloto:** `scripts/n8n-harness/workflows/SENTINELA-G7-L-FIRST-REAL-WORKFLOW.json` (`active: false`)

```
DATABASE CHANGES = 0
MIGRATIONS       = 0
LIVE WRITE       = 0 (neste gate)
N8N PRODUÇÃO     = 0
WHATSAPP         = 0
WORKFLOW ACTIVE  = false
SQL FROM N8N     = 0
```

---

## Princípio

> n8n = **orquestrador**. Sentinela API v1 = **única porta**. Operational Core = **única regra de negócio**.

### Proibições absolutas

1. SQL / PostgreSQL node no n8n  
2. Supabase client / service-role no n8n  
3. Acesso direto a `api_domain_events` / G6 stores  
4. Duplicar regra do Core  
5. WhatsApp / Telegram / frontend neste gate  
6. Ativar workflow em produção  
7. Inventar endpoint para intenção sem suporte  
8. Gerar `Idempotency-Key` aleatória em cada retry  

---

## Pipeline genérico do workflow

```
INPUT
 → NORMALIZAÇÃO (envelope externo)
 → IDENTIFICAÇÃO DE INTENÇÃO
 → VALIDAÇÃO DE INPUT (campos mínimos; sem regra de domínio)
 → CHAMADA API V1 (HMAC + tenant + headers)
 → TRATAMENTO DE RESULTADO
 → RETRY SE SEGURO (mesma Idempotency-Key em WRITE)
 → AUDITORIA (via API / request_id — não SQL)
 → OUTPUT
```

---

## Fase 1 — Inventário de operações (contrato atual)

Headers comuns (rotas protegidas):  
`X-Sentinela-Client-Id`, `X-Sentinela-Timestamp`, `X-Sentinela-Signature`,  
`X-Organization-Id`, `X-Condominium-Id`, `X-Request-Id` (opcional),  
`Idempotency-Key` (WRITE).

HMAC canonical v1 (inalterado — ver API contract §2 / `scripts/n8n-harness/n8n-code-hmac.js`).

Timeout cliente recomendado: **30s**.

| Op / probe | Method / path | Perm | Class | Idem | Conf | Forward user? | Tratamento interno |
|------------|---------------|------|-------|------|------|---------------|--------------------|
| health | `GET /api/v1/health` | — | — | — | — | status ok | probe |
| protected-probe | `GET /api/v1/protected-probe` | — | — | — | — | não | HMAC/tenant smoke |
| list_events | `GET /api/v1/events` | `events.view` | READ | — | — | **não** (admin) | auditoria excepcional |
| identify_resident | `GET /api/v1/residents/identify` | `residents.view` | READ | — | — | sim | ambiguidade → clarificar |
| identify_unit | `GET /api/v1/units/identify` | `residents.view` | READ | — | — | sim | |
| get_boleto | `GET /api/v1/boletos` | `boletos.view` | READ | — | — | sim (sem path interno) | |
| create_package | `POST /api/v1/operations/packages` | `packages.create` | WRITE | **sim** | — | sim | retry mesma key |
| create_occurrence | `POST …/occurrences` | `occurrences.create` | WRITE | **sim** | — | sim | |
| update_occurrence | `PATCH …/occurrences/update` | `occurrences.update` | WRITE | **sim** | — | sim | |
| create_reservation | `POST …/reservations` | `reservations.create` | WRITE | **sim** | — | sim | CONFLICT → nova key+slot |
| pickup_package | `POST …/packages/pickup` | `packages.update` | SENSITIVE | não | **sim** | mensagem genérica | confirmation flow |
| cancel_reservation | `POST …/reservations/cancel` | `reservations.delete` | SENSITIVE | não | **sim** | mensagem genérica | confirmation flow |

Erros: ver API contract §9. Nunca encaminhar SQL/stack/secrets ao usuário.

---

## Fase 3 — Intenções suportadas

| Intent | Status | API |
|--------|--------|-----|
| `IDENTIFY_RESIDENT` | supported | identify_resident |
| `IDENTIFY_UNIT` | supported | identify_unit |
| `GET_BOLETO` | supported | get_boleto |
| `CREATE_PACKAGE` | supported | create_package |
| `CREATE_OCCURRENCE` | supported | create_occurrence |
| `UPDATE_OCCURRENCE` | supported | update_occurrence |
| `CREATE_RESERVATION` | supported | create_reservation |
| `PICKUP_PACKAGE` | supported | pickup_package |
| `CANCEL_RESERVATION` | supported | cancel_reservation |
| `LIST_EVENTS` | supported (admin) | list_events |
| `PACKAGE_STATUS` / `OCCURRENCE_STATUS` / `RESERVATION_STATUS` | **needs_implementation** | — |
| `NOTIFICATION_QUERY` | **needs_implementation** | — |
| `NOTIFY_RESIDENT` | **not_supported** | notify_resident blocked |
| `UNKNOWN` | not_supported | clarificar |

Resposta de intenção sem endpoint: `NOT_SUPPORTED` / `NEEDS_IMPLEMENTATION` — **sem** SQL.

---

## Fase 4 — Idempotency-Key

### Formato (estável)

```text
n8n:{client_id}:{INTENT}:{external_message_id}:{family}
```

Ex.: `n8n:n8n-pilot-test:CREATE_PACKAGE:wamid.ABC:v1` (≤ 128 chars)

### Regras

| Situação | Key |
|----------|-----|
| Retry timeout / 5xx / network | **MESMA** |
| Nova mensagem / nova operação lógica | **NOVA** |
| `IDEMPOTENCY_FINGERPRINT_MISMATCH` | **NOVA** (body mudou) |
| `CONFLICT` reserva (outro slot) | **NOVA** + payload alterado |
| `DUPLICATE_REQUEST` / replay 200 | tratar como sucesso já aplicado — **não** nova key para “forçar” |

**PROIBIDO:** `Date.now()` / UUID novo a cada retry automático.

---

## Fase 5 — HMAC no n8n

Compatível com harness:

- `scripts/n8n-harness/n8n-code-hmac.js`
- `scripts/n8n-harness/sign.mjs`
- Workflow G7-L node **Generate HMAC**

Env (server-side n8n only):

- `SENTINELA_N8N_SECRET` / `SENTINELA_HARNESS_SECRET`
- `SENTINELA_N8N_CLIENT_ID`
- `SENTINELA_N8N_ORGANIZATION_ID`
- `SENTINELA_N8N_CONDOMINIUM_ID`
- `SENTINELA_PILOT_BASE`

Secret **nunca** em: payload, logs, Event Store, resposta, frontend, JSON do workflow.

---

## Fase 6 — Retry policy

### Retry automático (mesma Idempotency-Key em WRITE)

- timeout / network failure  
- HTTP 502 / 503 / 504 / 500 (`INTERNAL_ERROR`)  
- stores unavailable 501 (com cuidado / limite)

### Sem retry automático

- 400 / 401 (exceto re-sign) / 403 / 404 / 422  
- `CONFIRMATION_*` / `NEEDS_CONFIRMATION`  
- `TENANT_*` / `FORBIDDEN`  
- `IDEMPOTENCY_FINGERPRINT_MISMATCH`  
- `DUPLICATE_REQUEST`

### SENSITIVE

Após confirmation **consumida** com sucesso: **nunca** repetir automaticamente.  
Timeout após envio de token: verificar estado do recurso **antes** de novo challenge.

Código: `decideWorkflowRetry()` / `classifyRetry()`.

---

## Fase 7 — Confirmation

```
SENSITIVE REQUEST
 → 409 CONFIRMATION_REQUIRED (+ confirmation_id + token one-shot)
 → n8n solicita confirmação externa (humano / canal futuro)
 → usuário confirma
 → n8n reenvia com confirmation_id + confirmation_token
 → API consome atomicamente → Core
 → resultado
```

- Token **nunca** em logs.  
- Sem mecanismo paralelo de confirmação no n8n.  
- Replay token → `CONFIRMATION_ALREADY_CONSUMED`.

---

## Fase 8 — Event Store

- n8n **não** grava em `api_domain_events`.  
- API emite/persiste via G7-J-W.  
- `GET /api/v1/events` só com `events.view` e caso operacional legítimo (não roteamento de negócio).  
- Sem SQL no workflow.

---

## Fase 9 — Observabilidade / correlação

Correlacionar:

- `X-Request-Id`  
- `Idempotency-Key` (WRITE)  
- tenant (`X-Organization-Id` + `X-Condominium-Id`)

Não registrar: HMAC secret, signature, token, body sensível, PII extra, stack, SQL, credenciais.

---

## Fase 10 — Workflow piloto G7-L

Arquivo: `scripts/n8n-harness/workflows/SENTINELA-G7-L-FIRST-REAL-WORKFLOW.json`

| Campo | Valor |
|-------|--------|
| `active` | **false** |
| Cenário default | `identify_resident` (READ) |
| Segunda rota | `create_package` (WRITE, key estável) |
| WhatsApp / Telegram | 0 |
| Postgres / Supabase nodes | 0 |

Importação: UI n8n local → Import from file. **Não ativar.**

Env de cenário: `SENTINELA_G7L_SCENARIO=identify_resident|create_package|health|unknown`  
`SENTINELA_G7L_EXTERNAL_MESSAGE_ID` — fixa a família de idempotência.

---

## STOP

Não avançar para WhatsApp.  
Não criar migration.  
Não ativar workflow em produção.  
Não implementar novas operações Core neste gate.
