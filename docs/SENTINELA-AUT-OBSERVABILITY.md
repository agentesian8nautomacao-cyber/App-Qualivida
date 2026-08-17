# SENTINELA AUT — Observabilidade (API / n8n)

**Gate:** G7-F  
**Data:** 2026-08-15  
**Pré-requisito:** G7-E contract

---

## Objetivo

Tornar chamadas `n8n → Sentinela API` rastreáveis sem vazar segredos ou dados privados desnecessários.

---

## Campos recomendados (log / métrica)

| Campo | Origem | Uso |
|-------|--------|-----|
| `request_id` | Header/envelope | Correlação ponta a ponta |
| `correlation_id` | Opcional n8n | Agrupa retries / conversation |
| `operation` | Handler / envelope | Qual op Core |
| `organization_id` | Header tenant | Isolamento |
| `condominium_id` | Header tenant | Isolamento |
| `client_id` | `X-Sentinela-Client-Id` | Qual integração |
| `status` | HTTP status | 2xx/4xx/5xx |
| `error_code` | `error.code` | Contrato estável |
| `retry_hint` | `error.details.retry_hint` | Quando presente |
| `core_executed` | `data` / `details` | Distingue gate vs Core |
| `latency_ms` | Medido no n8n e/ou edge | SLO |
| `classification` | READ/WRITE/SENSITIVE | Política de retry |
| `external_message_id` | Envelope n8n (hash ok) | Idempotency base |

### Exemplo de linha segura

```json
{
  "request_id": "n8n-corr-0001",
  "operation": "create_package",
  "organization_id": "0e5a5c4b-…",
  "condominium_id": "3f383313-…",
  "client_id": "n8n-pilot",
  "status": 200,
  "error_code": null,
  "core_executed": true,
  "latency_ms": 412,
  "classification": "WRITE"
}
```

---

## O que NÃO registrar

- HMAC secrets / `X-Sentinela-Signature` completa  
- `confirmation_token` plaintext (após uso; challenge one-shot só em canal controlado)  
- `SUPABASE_SERVICE_ROLE_KEY` / service-role  
- Senhas, tokens de sessão de moradores  
- Conteúdo integral de áudio/foto  
- Mensagens privadas completas (preferir hash / truncamento / classificação)  
- SQL, stack traces, paths internos (já sanitizados na API)

A API já aplica `sanitizePublicDetails` nas respostas ao cliente.

---

## Correlação n8n ↔ API

1. n8n gera `X-Request-Id` estável por tentativa (ou deixa a API gerar).  
2. Em retries WRITE, manter a mesma `Idempotency-Key`; pode gerar novo `request_id` por hop HTTP.  
3. Usar `X-Correlation-Id` = id da conversa / `external_message_id` hasheado.  
4. Resposta sempre ecoa `request_id` no body e header `X-Request-Id`.

---

## Alertas sugeridos (futuro)

| Sinal | Severidade |
|-------|------------|
| Taxa `IDEMPOTENCY_STORE_UNAVAILABLE` / `CONFIRMATION_STORE_UNAVAILABLE` | Alta |
| Pico `INVALID_SIGNATURE` | Média (credencial/skew) |
| Pico `TENANT_MISMATCH` | Média (misconfig) |
| `CONFLICT` reservas | Info operacional |
| Latência p95 > 10s | Média |
| Latência > 25s / timeouts | Alta |

---

## Fronteiras

- Observabilidade **não** autoriza o n8n a ler o banco.  
- Painel humano continua sendo a visão operacional rica.  
- Event Store de produção = gate futuro (ver `SENTINELA-AUT-EVENT-OBSERVABILITY.md` / G7-G).
- Envelope interno + política de retry/redaction: `api/v1/_lib/observability/`.
