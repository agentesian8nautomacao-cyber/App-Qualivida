# SENTINELA AUT — G7-D — Operational Contract (n8n-ready)

**Status:** `G7-D = PASS` (código) · n8n/WhatsApp **não** conectados  
**Data:** 2026-08-15  
**Pré-requisito:** G7-C = CLOSED / PASS

---

## Fluxo futuro (não implementado neste gate)

```
WhatsApp → n8n → Sentinela API
  → HMAC → Tenant → AuthZ
  → Idempotency / Confirmation
  → Operational Core
  → Server Adapter
  → PostgreSQL
```

**Proibido:** n8n → banco; WhatsApp direto; service-role no n8n.

---

## Envelope de erro (todas as rotas)

```json
{
  "ok": false,
  "success": false,
  "request_id": "…",
  "correlation_id": "…",
  "operation": "create_reservation",
  "api_version": "v1",
  "error": {
    "code": "CONFLICT",
    "message": "…",
    "details": { }
  }
}
```

Sucesso: `ok/success=true`, `data`, `request_id`, `operation`.

Sem stack, SQL, service-role, paths internos de Storage, dados de outro tenant.

---

## Códigos operacionais (n8n)

| Código | HTTP | Uso |
|--------|------|-----|
| `INVALID_TIME_RANGE` | 400 | `start==end` ou `end<start` |
| `CONFLICT` | 409 | conflito de horário (Core **ou** PG `23P01`) |
| `IDEMPOTENCY_KEY_REQUIRED` | 400 | WRITE sem key |
| `IDEMPOTENCY_STORE_UNAVAILABLE` | 501 | store ausente |
| `IDEMPOTENCY_FINGERPRINT_MISMATCH` | 409 | mesma key, body diferente |
| `DUPLICATE_REQUEST` | 409 | legado / genérico (preferir fingerprint mismatch) |
| `CONFIRMATION_REQUIRED` | 409 | challenge SENSITIVE |
| `CONFIRMATION_STORE_UNAVAILABLE` | 501 | |
| `CONFIRMATION_EXPIRED` | 409 | |
| `CONFIRMATION_INVALID` | 409 | |
| `CONFIRMATION_ALREADY_CONSUMED` | 409 | single-use (alias legado: `CONFIRMATION_ALREADY_USED`) |
| `TENANT_REQUIRED` / `TENANT_NOT_FOUND` / `TENANT_MISMATCH` | 400/404/403 | fail-closed |
| `CREDENTIAL_TENANT_MISMATCH` | 403 | alias documentado (= mismatch credencial) |
| `FORBIDDEN` / `OPERATION_NOT_ALLOWED` | 403 | |
| `RESOURCE_NOT_FOUND` | 404 | telefone/recurso inexistente |
| `NEEDS_CONFIRMATION` | 409 | identificação ambígua |

---

## Reservas

1. **Autoridade final:** exclusion constraint `reservations_area_date_slot_excl` (G7-C).
2. **API/Core não duplicam** a regra de overlap além do pré-check otimista; `23P01` → `CONFLICT`.
3. Details públicos em conflito:
   - `areaId`, `date`, `startTime`, `endTime`
   - `reason: schedule_conflict`
   - `retry_hint: try_another_time_slot`
4. Intervalos inválidos **antes** do Core/persistência: `INVALID_TIME_RANGE`.
5. Status oficial soft-cancel: **`canceled`** (CHECK LIVE).  
   Filtros aceitam aliases legados `cancelled`/`cancelada`/`cancelado` **somente leitura** — sem UPDATE histórico.

---

## Identificação / boletos

- Telefone inexistente → `RESOURCE_NOT_FOUND` (`NOT_FOUND` no Core).
- Múltiplos candidatos → `NEEDS_CONFIRMATION` (nunca escolher arbitrariamente).
- `get_boleto` canal `system`: exige `boletoId` \| `residentId` \| `unit`; sem paths internos.

---

## Fronteiras G7-D

| Item | Valor |
|------|-------|
| DATABASE CHANGES | 0 |
| MIGRATIONS | 0 |
| LIVE WRITE | 0 |
| n8n workflow | 0 |
| WhatsApp | 0 |
| Event Store | 0 |
| M1–M4 / G6 / G7-C constraint | intactos |

Próximos gates (não neste documento): pilot n8n, Event Store, WhatsApp.
