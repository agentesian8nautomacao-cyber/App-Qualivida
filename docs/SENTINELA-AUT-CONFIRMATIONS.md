# SENTINELA AUT — Confirmações e operações sensíveis (G4)

**Status:** Etapa 6 / G4 — contratos + gate implementados  
**Data:** 2026-08-14  
**Evidência:** `docs/evidence/results/SENTINELA-ETAPA-6-G4-CONFIRMATION-2026-08-14.txt`

## Princípio

Mensagem recebida ≠ autorização para executar ação sensível.

```
HMAC → Tenant → AuthZ → Classification → Confirmation (se SENSITIVE) → Core (G5+)
```

HMAC (janela temporal) **não** substitui confirmação.

## Classificação central

| Classe | Operações |
|--------|-----------|
| **READ** | `identify_resident`, `identify_unit`, `get_boleto` |
| **WRITE** | `create_package`, `create_occurrence`, `update_occurrence`, `create_reservation` |
| **SENSITIVE** | `pickup_package`, `cancel_reservation` |

`notify_resident` permanece bloqueado no AuthZ (DECISION REQUIRED G3).

Código: `api/v1/_lib/ops/classification.ts` — `requiresConfirmation(operation)`.

## Contrato de confirmação

### Create

Bindings obrigatórios:

- `organization_id`
- `condominium_id`
- `client_id`
- `operation`
- `resource_id`
- `prompt`
- expiração (`ttl_seconds`, default 300)

Retorno (uma vez):

- `confirmation_id`
- `confirmation_token` (mostrado uma vez; store guarda só hash)
- `expires_at`
- `prompt`

### Validate (uso único)

Deve casar exatamente:

- tenant (org + condo)
- client_id
- operation
- resource_id
- token

Falhas:

- `CONFIRMATION_INVALID`
- `CONFIRMATION_EXPIRED`
- `CONFIRMATION_ALREADY_USED`
- `CONFIRMATION_STORE_UNAVAILABLE`

## Comportamento da API

### SENSITIVE sem confirmação

`CONFIRMATION_REQUIRED` (409) com desafio mínimo — **não** executa Core.

### SENSITIVE com confirmação válida

Ainda **`GATE_PENDING` (501)** — Core execution = G5.  
`core_executed: false`.

### WRITE / READ autorizados

Continuam `GATE_PENDING` até G5 (sem liberar negócio).

### Produção sem store persistente

Default: `ConfirmationStore.kind = unavailable`  
→ `CONFIRMATION_STORE_UNAVAILABLE`  
Memória = **TEST_ONLY**, nunca default de produção.

## Persistência

**DECISION REQUIRED / FUTURE MIGRATION**

Tabela sugerida (não criar agora): `api_confirmations`  
(ou store compartilhado Redis/KV com TTL + single-use).

Sem store durável, confirmação de uso único **não** é segura em serverless multi-instância.

## Anti-replay

| Camada | Papel |
|--------|-------|
| HMAC timestamp | proteção temporal da request |
| Confirmation single-use | intenção sensível |
| Idempotency-Key store | FUTURE (mutações) |

## Endpoints técnicos

- `GET /api/v1/confirmation-probe?operation=…` — classificação
- `POST /api/v1/operations/packages/pickup` — SENSITIVE gate
- `POST /api/v1/operations/reservations/cancel` — SENSITIVE gate

## Limitações

- Sem n8n / WhatsApp
- Sem Event Store
- Sem UI de confirmação
- Store persistente ausente (`confirmation_persistent_store = false`)
- Prompt é texto genérico (personalização = G5+/canal)

## Decisões pendentes

1. Migration do store de confirmações (Postgres vs KV)
2. `notify_resident` permission (G3 residual)
3. G5 — execução real no Operational Core após confirmação
