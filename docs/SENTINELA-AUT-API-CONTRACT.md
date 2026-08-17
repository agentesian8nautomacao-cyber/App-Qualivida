# SENTINELA AUT — Contrato da API (integração n8n)

**Gate:** G7-E — API Integration Readiness  
**Data:** 2026-08-15  
**Pré-requisito:** G7-D = PASS  
**OpenAPI:** [`docs/openapi/sentinela-api-v1.yaml`](./openapi/sentinela-api-v1.yaml)

```
DATABASE CHANGES   = 0
MIGRATIONS EXECUTED = 0
LIVE WRITE         = 0
n8n workflow       = 0
WhatsApp           = 0
```

Este documento é o contrato **externo** para o n8n como orquestrador.  
A API não contém regra de negócio duplicada: Auth → Tenant → AuthZ → classificação → Idempotency/Confirmation → Operational Core → Server Adapter → PostgreSQL.

---

## 0. Fluxo oficial

```
n8n
→ Sentinela API
→ HMAC
→ Tenant
→ AuthZ
→ classificação (READ | WRITE | SENSITIVE)
→ Idempotency / Confirmation
→ Operational Core
→ Server Adapter
→ PostgreSQL
```

- Secrets HMAC **somente** no servidor / credenciais n8n (nunca `VITE_*` / frontend).
- Sem fallback global de tenant.
- Sem payload bruto de WhatsApp no Core (apenas dados normalizados pelo n8n).

---

## 1. Inventário de endpoints

Base URL: `/api/v1`  
Envelope comum: ver §10.

### Headers comuns (rotas protegidas)

| Header | Obrigatório | Notas |
|--------|-------------|--------|
| `X-Sentinela-Client-Id` | sim | Credencial de integração |
| `X-Sentinela-Timestamp` | sim | Unix **seconds** (não ms) |
| `X-Sentinela-Signature` | sim | HMAC-SHA256 hex lowercase |
| `X-Organization-Id` | sim | Tenant org (UUID) |
| `X-Condominium-Id` | sim | Tenant condo (UUID) |
| `Idempotency-Key` | WRITE: sim | Incluído no canonical HMAC |
| `X-Request-Id` | opcional | Aceito se `^[A-Za-z0-9_.:-]{8,128}$`; senão servidor gera `req_…` |
| `X-Correlation-Id` | opcional | Observabilidade; max 128 chars seguros |
| `Content-Type` | POST/PATCH | `application/json` |
| `X-Confirmation-Id` | SENSITIVE (2ª chamada) | Ou no body |
| `X-Confirmation-Token` | SENSITIVE (2ª chamada) | Ou no body |

Tenant **sempre** via headers. Body com `organization_id`/`condominium_id` divergentes → `TENANT_MISMATCH`.

---

### READ

#### `identify_resident`

| Campo | Valor |
|-------|--------|
| Method / path | `GET /api/v1/residents/identify` |
| Operation | `identify_resident` |
| Permission | `residents.view` |
| Idempotency-Key | não |
| Confirmation | não |
| Tenant | obrigatório |

**Query (body lógico):** pelo menos um de `phone`, `name`, `unit`, `resident_id`.

**2xx:** `{ success, request_id, operation, data: { ok, operation, core_executed, result, … } }`  
**4xx:** HMAC/tenant/authz/`INVALID_REQUEST` / `RESOURCE_NOT_FOUND` / `NEEDS_CONFIRMATION` (ambiguidade)  
**5xx:** `INTERNAL_ERROR`

#### `identify_unit`

| Campo | Valor |
|-------|--------|
| Method / path | `GET /api/v1/units/identify` |
| Operation | `identify_unit` |
| Permission | `residents.view` |
| Idempotency-Key | não |
| Confirmation | não |

**Query:** `unit` obrigatório.

#### `get_boleto`

| Campo | Valor |
|-------|--------|
| Method / path | `GET /api/v1/boletos` |
| Operation | `get_boleto` |
| Permission | `boletos.view` |
| Idempotency-Key | não |
| Confirmation | não |

**Query:** `boleto_id` e/ou `resident_id` e/ou `unit` (system exige filtro adequado).  
Resposta **não** inclui paths internos de arquivo.

---

### ADMIN (auditoria)

#### `list_events` (`events.view`)

| Campo | Valor |
|-------|--------|
| Method / path | `GET /api/v1/events` |
| Operation | `list_events` |
| Permission | `events.view` |
| Classification | `READ` |
| Idempotency-Key | não |
| Confirmation | não |
| Core execution | **não** (`core_executed: false`) |
| Tenant | obrigatório via headers autenticados |

**Semântica**

- Event Store (`public.api_domain_events`) é **auditoria/observabilidade**, não domínio de negócio.
- Consulta é **tenant-scoped** (organization + condominium do contexto autenticado).
- `organization_id` / `condominium_id` na query string são **ignorados** (nunca substituem o tenant).
- n8n **não** acessa SQL direto; painel futuro consome esta API.
- `sentinela.view` **não** concede acesso.
- Grants RBAC LIVE (G7-K-RBAC): `sindico`, `administradora` (não `porteiro` / `cabo_turma` / `morador`).

**Query (filtros opcionais)**

| Param | Notas |
|-------|--------|
| `event_type` | Subset persistível G7-I |
| `operation` | Nome da operação Core/admin |
| `status` | Status do evento |
| `request_id` | Filtro somente (não autoriza cross-tenant) |
| `from` / `to` | ISO-8601 com timezone explícito; inclusivos em `occurred_at`; máx. 93 dias |
| `limit` | Default 50, máx. 100 |
| `cursor` | Keyset `(occurred_at DESC, event_id DESC)` |

**2xx data:** `{ operation, core_executed: false, events[], pagination: { limit, next_cursor, count } }`  
Campos por evento: sanitizados (sem `attributes`, secrets, HMAC, body bruto, SQL, stack).  
**4xx:** HMAC/tenant/`FORBIDDEN`/`INVALID_REQUEST`  
**Observabilidade:** emit in-process permitido; **não** persiste novo row em `api_domain_events` por consulta bem-sucedida neste gate.

---

### WRITE

#### `create_package`

| Campo | Valor |
|-------|--------|
| Method / path | `POST /api/v1/operations/packages` |
| Operation | `create_package` |
| Permission | `packages.create` |
| Idempotency-Key | **obrigatória** |
| Confirmation | não |

**Body (mínimo):** `recipient` + `unit`, ou `recipient_id`, ou `resident_phone`.  
Opcionais: `type`, `image_url`, `qr_code_data` / `barcode_data` / `code`, `received_by_name`, `input_type`, `text`, `metadata` (§7–8).

#### `create_occurrence`

| Campo | Valor |
|-------|--------|
| Method / path | `POST /api/v1/operations/occurrences` |
| Operation | `create_occurrence` |
| Permission | `occurrences.create` |
| Idempotency-Key | **obrigatória** |

**Body:** `description` obrigatório; opcionais `resident_name`, `unit`, `resident_id`, `reported_by`, `image_url`.

#### `update_occurrence`

| Campo | Valor |
|-------|--------|
| Method / path | `PATCH /api/v1/operations/occurrences/update` |
| Operation | `update_occurrence` |
| Permission | `occurrences.update` |
| Idempotency-Key | **obrigatória** |

**Body:** `{ "occurrence": { "id": "…", … } }` — `occurrence.id` obrigatório.

#### `create_reservation`

| Campo | Valor |
|-------|--------|
| Method / path | `POST /api/v1/operations/reservations` |
| Operation | `create_reservation` |
| Permission | `reservations.create` |
| Idempotency-Key | **obrigatória** |

**Body:** `area_id`, `resident_id`, `resident_name`, `unit`, `date`, `start_time`, `end_time` (half-open `[start,end)`).  
`start==end` ou `end<start` → `INVALID_TIME_RANGE`. Overlap → `CONFLICT`.

---

### SENSITIVE

#### `pickup_package`

| Campo | Valor |
|-------|--------|
| Method / path | `POST /api/v1/operations/packages/pickup` |
| Operation | `pickup_package` |
| Permission | `packages.update` |
| Idempotency-Key | não (single-use confirmation) |
| Confirmation | **obrigatória** |

**Fluxo:**

1. `POST` com `resource_id` (ou `package_id`) → `409 CONFIRMATION_REQUIRED` + `confirmation_id` + `confirmation_token` (token **uma vez**).
2. `POST` com `resource_id` + `confirmation_id` + `confirmation_token` → executa Core (consume token).
3. Replay do mesmo token → `CONFIRMATION_ALREADY_CONSUMED`.

#### `cancel_reservation`

| Campo | Valor |
|-------|--------|
| Method / path | `POST /api/v1/operations/reservations/cancel` |
| Operation | `cancel_reservation` |
| Permission | `reservations.delete` |
| Idempotency-Key | não |
| Confirmation | **obrigatória** |

Mesmo protocolo de confirmation; `resource_id` / `reservation_id`. Status oficial pós-cancel: `canceled`.

---

### Público

| Method / path | Auth | Notas |
|---------------|------|--------|
| `GET /api/v1/health` | nenhuma | Status + stage; sem secrets |

---

## 2. HMAC

### Canonical string (LF, sem newline final extra)

```
v1
{timestamp}
{METHOD}
{path_with_query}
{body_sha256_hex}
{organization_id}
{condominium_id}
{idempotency_key_or_empty}
```

- `path_with_query` = `pathname + search` (ex.: `/api/v1/boletos?unit=3-5`)
- `body_sha256_hex` = SHA-256 do body **bruto** (GET vazio = hash de `""`)
- `Signature` = hex lowercase `HMAC-SHA256(secret, canonical)`
- Comparação timing-safe

### Timestamp

Janela default **300s** (`SENTINELA_API_TIMESTAMP_WINDOW_SECONDS`). Fora → `TIMESTAMP_EXPIRED` (401).  
Timestamps em milissegundos (13+ dígitos) → inválidos.

### Credenciais

Env server-only `SENTINELA_API_CREDENTIALS`. **Nunca** no frontend.

---

## 3. Idempotency (WRITE)

| Cenário | HTTP | Código |
|---------|------|--------|
| Sem key | 400 | `IDEMPOTENCY_KEY_REQUIRED` |
| Primeira chamada | 200 | sucesso + grava fingerprint |
| Retry mesma fingerprint | 200 | replay da resposta (sem reexecutar Core) |
| Mesma key, fingerprint diferente | 409 | `IDEMPOTENCY_FINGERPRINT_MISMATCH` |
| Key expirada | 200 | reclaim R1 → nova execução |
| Concorrência (`in_progress`) | 409 | `CONFLICT` / in_progress |
| Store indisponível | 501 | `IDEMPOTENCY_STORE_UNAVAILABLE` (`core_executed: false`) |

Fingerprint = hash do body bruto alinhado ao HMAC.

---

## 4. Confirmation (SENSITIVE)

Operações: `pickup_package`, `cancel_reservation`.

| Etapa | Comportamento |
|-------|----------------|
| create | Sem token: cria challenge (pending) |
| validate | Token + binding tenant/op/resource |
| consume | Single-use no sucesso |
| execute | Core só após consume válido |

| Código | HTTP |
|--------|------|
| `CONFIRMATION_REQUIRED` | 409 |
| `CONFIRMATION_INVALID` | 409 |
| `CONFIRMATION_EXPIRED` | 409 |
| `CONFIRMATION_ALREADY_CONSUMED` | 409 |
| `CONFIRMATION_STORE_UNAVAILABLE` | 501 |

n8n **não** deve retry cego após consume bem-sucedido.

---

## 5. Tenant

- Sempre `X-Organization-Id` + `X-Condominium-Id`.
- Credential scoped deve coincidir.
- Condo deve pertencer à org.
- Mismatch → `TENANT_MISMATCH` / `TENANT_NOT_FOUND` / `TENANT_REQUIRED`.
- **Sem** fallback global.

---

## 6. `request_id`

- Sempre presente no envelope e em `X-Request-Id` da resposta.
- Cliente pode enviar `X-Request-Id` seguro (8–128 chars `[A-Za-z0-9_.:-]`).
- Inválido/ausente → servidor gera `req_{uuid}`.
- Não é fronteira de segurança; não assume unicidade global cross-region.
- `X-Correlation-Id` opcional (observabilidade).

---

## 7. Payloads multimídia (contrato futuro — sem WhatsApp)

n8n normaliza STT/OCR/vision **antes** de chamar a API. A API **não** recebe áudio/foto binários.

```json
{
  "input_type": "voice",
  "text": "encomenda para Maria apto 101",
  "metadata": { "source": "n8n", "channel_hint": "wa" },
  "recipient": "Maria",
  "unit": "101"
}
```

`input_type` ∈ `text` | `voice` | `photo` | `qrcode` | `barcode`.  
`metadata` = objeto JSON ≤ 4096 bytes.  
`photo` → apenas `image_url` (URL), nunca bytes.  
Core recebe campos normalizados de domínio — **nunca** payload WhatsApp Cloud API.

---

## 8. Barcode / QR

Não há endpoint nem tabela novos.  
`QR_CODE` e `BARCODE` → mesma operação **`create_package`** via `qr_code_data` / `barcode_data` / `code` / `text`+`input_type`.

---

## 9. Erros (códigos públicos)

| Código | HTTP | Retry? |
|--------|------|--------|
| `INVALID_REQUEST` | 400 | não (corrigir payload) |
| `INVALID_TIME_RANGE` | 400 | não |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | não (adicionar key) |
| `TENANT_REQUIRED` / `TENANT_INVALID` | 400 | não |
| `UNAUTHENTICATED` / `INVALID_SIGNATURE` / `TIMESTAMP_EXPIRED` | 401 | assinar de novo |
| `FORBIDDEN` / `OPERATION_NOT_ALLOWED` / `TENANT_MISMATCH` | 403 | não |
| `RESOURCE_NOT_FOUND` / `TENANT_NOT_FOUND` / `RESIDENT_NOT_FOUND` | 404 | não |
| `METHOD_NOT_ALLOWED` | 405 | não |
| `CONFLICT` | 409 | sim com **outro** slot/recurso |
| `DUPLICATE_REQUEST` | 409 | não (já processado) |
| `IDEMPOTENCY_FINGERPRINT_MISMATCH` | 409 | não (nova key) |
| `NEEDS_CONFIRMATION` | 409 | desambiguar |
| `CONFIRMATION_REQUIRED` | 409 | seguir challenge |
| `CONFIRMATION_INVALID` / `EXPIRED` / `ALREADY_CONSUMED` | 409 | novo challenge se aplicável; **não** reexecutar às cegas |
| `RATE_LIMITED` | 429 | backoff |
| `CONFIRMATION_STORE_UNAVAILABLE` / `IDEMPOTENCY_STORE_UNAVAILABLE` / `GATE_PENDING` | 501 | retry infra com cuidado |
| `INTERNAL_ERROR` | 500 | retry limitado + mesma Idempotency-Key em WRITE |

**Sanitização:** respostas nunca incluem SQL, stack, service-role, secrets, paths internos, dados de outro tenant (`sanitizePublicDetails`).

Mapeamento central: `httpStatusForCode` em `api/v1/_lib/errors.ts` — handlers **não** escolhem status arbitrário.

---

## 10. Envelope HTTP

**Sucesso**

```json
{
  "ok": true,
  "success": true,
  "request_id": "req_…",
  "correlation_id": "…",
  "operation": "create_package",
  "api_version": "v1",
  "data": {
    "ok": true,
    "operation": "create_package",
    "core_executed": true,
    "result": {},
    "warnings": [],
    "events": []
  }
}
```

**Erro**

```json
{
  "ok": false,
  "success": false,
  "request_id": "req_…",
  "operation": "create_package",
  "api_version": "v1",
  "error": {
    "code": "CONFLICT",
    "message": "…",
    "details": { "retry_hint": "try_another_time_slot" }
  }
}
```

---

## 11. Retry policy (n8n)

| Classe | Política |
|--------|----------|
| 401 assinatura/timestamp | Reassinar; não alterar body sem nova key WRITE |
| 5xx / 501 store | Retry com backoff; WRITE **mesma** Idempotency-Key |
| 409 CONFLICT reserva | Nova tentativa com outro horário (nova key) |
| 409 fingerprint mismatch | **Nova** Idempotency-Key |
| SENSITIVE após 200 | **Não** retry |
| SENSITIVE `CONFIRMATION_REQUIRED` | Usar token; não loop cego |
| 400 / 403 / 404 | Não retry automático |

---

## 12. Timeout

- Expectativa cliente (n8n): **≤ 25–30s** por chamada HTTP (alinhado a serverless tipicamente ≤ 60s).
- Se `n8n → API → Core → DB` estourar: cliente vê timeout de rede; em WRITE, **retry com a mesma Idempotency-Key** (replay seguro se Core concluiu).
- SENSITIVE: se timeout após enviar token, verificar estado do recurso **antes** de novo challenge (evitar double-pickup cego).

---

## 13. Input limits

| Limite | Valor |
|--------|--------|
| JSON body bruto | 256 KiB (`MAX_API_BODY_BYTES`) |
| String genérica | 2000 |
| `description` | 8000 |
| `metadata` JSON | 4096 bytes |
| IDs / unit | 64 |
| Nomes | 200 |
| Telefone | 32 |
| URLs / códigos QR-barcode | 2000 |

Payload maior → `INVALID_REQUEST`. Binários multimídia **não** aceitos.

---

## 14. Observabilidade

Logar / correlacionar: `request_id`, `operation`, tenant (org/condo), resultado (`success` / `error.code`), `core_executed`.

**Não** logar: secrets, HMAC signature, tokens de confirmation em claro (além da resposta one-shot controlada), service-role, conteúdo integral de áudio/foto.

---

## 15. Fora de escopo (G7-E)

- Workflow n8n, WhatsApp Cloud API / webhooks / credenciais WA  
- Event Store, remoção de login de moradores, alteração RBAC  
- Novas migrations / tabelas  
- OCR / STT / vision na API  

M1–M4, G6-1/G6-2, G7-C (constraint 007) permanecem intactos.

---

## 16. Referências de código

| Tema | Arquivo |
|------|---------|
| HMAC | `api/v1/_lib/auth/hmac.ts` |
| Timestamp | `api/v1/_lib/auth/timestamp.ts` |
| Erros / HTTP | `api/v1/_lib/errors.ts` |
| Classificação | `api/v1/_lib/ops/classification.ts` |
| Permissions | `api/v1/_lib/authz/operations.ts` |
| Payload / limits | `api/v1/_lib/execution/payload.ts` |
| Body size | `api/v1/_lib/withCoreExecution.ts` |
| Request id | `api/v1/_lib/requestIds.ts` |
| Confirmation | `api/v1/_lib/protectedHandler.ts` |
| OpenAPI | `docs/openapi/sentinela-api-v1.yaml` |
