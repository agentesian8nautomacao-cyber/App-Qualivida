# SENTINELA AUT — Contrato de entrada do n8n

**Gate:** G7-F — Preparação integração operacional n8n  
**Data:** 2026-08-15  
**Atualização G7-L:** 2026-08-16 — ver [`SENTINELA-AUT-G7-L-N8N-WORKFLOW-CONTRACT.md`](./SENTINELA-AUT-G7-L-N8N-WORKFLOW-CONTRACT.md)  
**Pré-requisito:** G7-E = PASS  
**API contract:** [`SENTINELA-AUT-API-CONTRACT.md`](./SENTINELA-AUT-API-CONTRACT.md)  
**Observabilidade:** [`SENTINELA-AUT-OBSERVABILITY.md`](./SENTINELA-AUT-OBSERVABILITY.md)

```
N8N REAL      = 1 (piloto local G7-H-B / G7-L — workflow importável, active=false)
WHATSAPP REAL = 0
DATABASE      = 0 (n8n sem PostgreSQL; API usa Server Adapter)
```

**Piloto G7-H-B:** ver `scripts/n8n-harness/G7-H-B-PILOT.md`  
**Workflow G7-L (primeiro real, inactive):** `scripts/n8n-harness/workflows/SENTINELA-G7-L-FIRST-REAL-WORKFLOW.json`  
Workflow H-B: `scripts/n8n-harness/workflows/SENTINELA-G7-H-B-API-PILOT.json`  
Runner HTTP (mesmo contrato): `node scripts/n8n-harness/pilot-http.mjs`

---

## Princípio

> O usuário informa. O Sentinela entende. A automação executa. O painel acompanha.

| Camada | Papel |
|--------|--------|
| WhatsApp (futuro) | Canal de mensagem |
| **n8n** | Orquestrador externo: normaliza, roteia, chama API, responde |
| **Sentinela API `/api/v1`** | Única porta de entrada externa |
| **Operational Core** | Única fonte de regras de negócio |
| Painel | Interface operacional humana |
| PostgreSQL | Persistência via Server Adapter (nunca pelo n8n) |

### Proibições absolutas para o n8n

1. Não acessar PostgreSQL diretamente  
2. Não executar SQL  
3. Não conhecer constraints/índices internos  
4. Não implementar regra de negócio do condomínio  
5. Não chamar Core/adapters diretamente  
6. Não usar service-role / Dexie / memória de processo como “produção”

---

## F2 — Envelope externo estável (pré-API)

O n8n pode receber mensagens de canais futuros (WhatsApp etc.) e **normalizar** para este envelope **antes** de decidir a intenção.  
Este envelope **não** é regra de negócio e **não** substitui o payload da API.

```json
{
  "source": "whatsapp",
  "input_type": "text",
  "external_message_id": "wamid.HBgL...",
  "sender": {
    "phone": "5511999999999"
  },
  "content": {
    "text": "encomenda para Maria apto 101"
  },
  "metadata": {
    "received_at": "2026-08-15T22:00:00.000Z",
    "channel_hint": "wa"
  }
}
```

| Campo | Tipo | Notas |
|-------|------|--------|
| `source` | string | Ex.: `whatsapp`, `manual`, `harness` — só telemetria |
| `input_type` | enum | `text` \| `voice` \| `photo` \| `qrcode` \| `barcode` |
| `external_message_id` | string | Id do canal; base de Idempotency-Key estável |
| `sender.phone` | string | Identificação do remetente (não autenticar sozinho) |
| `content` | object | Texto / URL de mídia já processada / código decodificado |
| `metadata` | object | ≤ ~4 KiB após mapear para API; sem binários |

### Pipeline do n8n (somente orquestração)

```
1. recebe mensagem
2. normaliza → envelope
3. identifica intenção (router conceitual)
4. prepara payload + headers HMAC da API
5. chama Sentinela API
6. interpreta response (code, retry_hint, confirmation)
7. responde ao usuário (futuro WhatsApp)
```

A **execução** da operação continua em API → Core → Adapter → PostgreSQL.

---

## F3 — Router de intenções (conceitual)

Sem IA complexa nesta etapa. Mapa estático:

| Intenção n8n | Operação API/Core | Class | Path | Notas |
|--------------|-------------------|-------|------|--------|
| `PACKAGE_CREATE` | `create_package` | WRITE | `POST /operations/packages` | Única op de encomenda |
| `PACKAGE_PICKUP` | `pickup_package` | SENSITIVE | `POST /operations/packages/pickup` | Confirmation |
| `PACKAGE_STATUS` | — | — | — | **FUTURE** — sem endpoint v1 |
| `OCCURRENCE_CREATE` | `create_occurrence` | WRITE | `POST /operations/occurrences` | |
| `OCCURRENCE_UPDATE` | `update_occurrence` | WRITE | `PATCH /operations/occurrences/update` | |
| `OCCURRENCE_STATUS` | — | — | — | **FUTURE** |
| `RESERVATION_CREATE` | `create_reservation` | WRITE | `POST /operations/reservations` | |
| `RESERVATION_CANCEL` | `cancel_reservation` | SENSITIVE | `POST /operations/reservations/cancel` | Confirmation |
| `RESERVATION_STATUS` | — | — | — | **FUTURE** |
| `BOLETO_GET` | `get_boleto` | READ | `GET /boletos` | |
| `RESIDENT_IDENTIFY` | `identify_resident` | READ | `GET /residents/identify` | |
| `UNIT_IDENTIFY` | `identify_unit` | READ | `GET /units/identify` | |
| `NOTIFICATION_QUERY` | — | — | — | **FUTURE** (`notify_resident` blocked) |
| `UNKNOWN` | — | — | — | Pedir clarificação; **não** mutar |
| `NEEDS_CONFIRMATION` | — | — | — | Desambiguar (API 409 ou pré-check) |

Intenções `FUTURE` **não** devem ser inventadas no n8n com SQL/Dexie. Aguardar gate com operação Core oficial.

---

## F4 — Multimídia → uma operação

Todos os canais de encomenda convergem para **`create_package`**:

```
VOICE  → STT (n8n)     → texto estruturado → create_package
PHOTO  → OCR/visão     → dados estruturados → create_package
QRCODE → decode        → code/text          → create_package
BARCODE→ decode        → code/text          → create_package
TEXT   → extração      → campos API         → create_package
```

Payload API (exemplo QR/barcode):

```json
{
  "input_type": "barcode",
  "text": "7891000100103",
  "recipient": "Maria",
  "unit": "101",
  "metadata": { "source": "n8n" }
}
```

- Sem cinco implementações de encomenda.  
- Sem tabela nova.  
- Sem bytes de áudio/foto na API (só URL/`text`/códigos).

---

## Chamada à API (resumo)

Seguir [`SENTINELA-AUT-API-CONTRACT.md`](./SENTINELA-AUT-API-CONTRACT.md):

- HMAC canonical v1  
- Tenant headers obrigatórios  
- `Idempotency-Key` em WRITE (sugerido: `n8n:{external_message_id}:{intent}`)  
- SENSITIVE: challenge → token → execute; **não** retry cego após 200  
- Timeout cliente: 25–30s; WRITE retry com **mesma** key

### Interpretação rápida de resposta

| Situação | Ação n8n |
|----------|----------|
| 200 WRITE/READ | Mensagem de sucesso ao usuário |
| 409 `CONFIRMATION_REQUIRED` | Pedir “sim” ao usuário; reenviar com token |
| 409 `CONFIRMATION_ALREADY_CONSUMED` | Informar já processado; não reexecutar |
| 409 `CONFLICT` + `retry_hint` | Oferecer outro horário |
| 409 fingerprint mismatch | Nova Idempotency-Key + revisar body |
| 400 `INVALID_TIME_RANGE` | Corrigir horários com o usuário |
| 401 assinatura/timestamp | Reassinar |
| 403/404 | Mensagem clara; sem retry mutativo |
| 5xx / 501 store | Backoff; WRITE mesma key |

---

## F7 — Credencial n8n (futuro)

Credencial **tenant-scoped**, apenas server-side / vault do n8n.

Variáveis conceituais (não commitadas):

```
SENTINELA_N8N_CLIENT_ID=...
SENTINELA_N8N_SECRET=...
SENTINELA_N8N_ORGANIZATION_ID=...
SENTINELA_N8N_CONDOMINIUM_ID=...
```

No servidor Sentinela, a mesma credencial entra em `SENTINELA_API_CREDENTIALS` (JSON), com `permission_keys` mínimas necessárias.

**Proibido:**

- `VITE_*` com secret  
- secret no frontend / git / `.env.example` com valor real  
- credential global multi-tenant  

Neste gate: **nenhum segredo real** é criado.

---

## Harness local (F5) + Piloto G7-H-B

Fixtures/scripts em `scripts/n8n-harness/` + testes Vitest `g7f.n8n-readiness.test.ts`.

**G7-H-B (piloto controlado):**

| Artefato | Função |
|----------|--------|
| `local-api-pilot.ts` | API HTTP local (fake stores) para o n8n chamar |
| `pilot-http.mjs` | Runner dos cenários (HMAC + HTTP) |
| `workflows/SENTINELA-G7-H-B-API-PILOT.json` | Workflow importável no n8n local |
| `n8n-code-hmac.js` | Snippet Code node HMAC |

Credenciais **somente** em env/vault do n8n. Sem node PostgreSQL. Sem WhatsApp.
