# SENTINELA AUT — G7-J — Event Store (`api_domain_events`)

**Gate:** G7-J  
**Data:** 2026-08-15  
**Pré-requisito:** G7-I = PASS (EVENT STORE = NECESSÁRIO)  
**Status atual:** **G7-J = CLOSED / PASS** (Event Store criado no LIVE; wiring = G7-J-W)

```
DATABASE CHANGES             = CREATE TABLE api_domain_events (+ índices + RLS ON)
MIGRATIONS EXECUTED          = 1 (008)
LIVE WRITE / rows iniciais   = 0
WIRING handlers              = 0  (G7-J-W = gate separado)
N8N                          = piloto intacto
WHATSAPP                     = 0
DOMAIN DATA CHANGES          = 0
PRE-CHECK LIVE               = PASS
APPLY                        = PASS
CLOSEOUT                     = PASS
```

---

## 1. Propósito

`public.api_domain_events` é **auditoria operacional append-only**.

Registra **o que aconteceu**. Não decide **o que deve acontecer**.

```
API → Core → Adapter → Domain DB     (fonte de verdade)

handlers → observability → [logs]
                        → [futuro G7-J-W] api_domain_events
```

---

## 2. Schema (mínimo)

| Coluna | Tipo | Notas |
|--------|------|--------|
| `event_id` | text PK | `evt_%` |
| `occurred_at` | timestamptz NOT NULL | envelope |
| `request_id` | text NOT NULL | N eventos / request OK |
| `organization_id` | uuid NOT NULL FK → organizations RESTRICT | |
| `condominium_id` | uuid NOT NULL FK → condominiums RESTRICT | |
| `client_id` | text NULL | |
| `correlation_id` | text NULL | |
| `operation` | text NULL | |
| `event_type` | text NOT NULL | CHECK subset G7-I |
| `status` | text NOT NULL | |
| `source` | text NOT NULL DEFAULT `api.v1` | |
| `classification` | text NULL | READ/WRITE/SENSITIVE |
| `http_status` | int NULL | |
| `error_code` | text NULL | |
| `retry_class` | text NULL | |
| `core_executed` | boolean NOT NULL DEFAULT false | |
| `duration_ms` | int NULL | ≥ 0 |
| `external_ref` | text NULL | opaco |
| `confirmation_id` | text NULL | `cnf_%` only |
| `attributes` | jsonb NULL | redacted |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

**Omitidos de propósito:** `idempotency_key` / hash (volume/PII); payload bruto; token.

### Tenant

- Sempre `organization_id` + `condominium_id` válidos (FK).  
- Eventos **sem** tenant confiável (ex. HMAC fail pré-tenant) → **somente logs** (wiring G7-J-W).  
- Sem fallback global. Sem `USING (true)`.

---

## 3. Eventos

### Persistir (CHECK)

`request.rejected` · `request.denied` · `confirmation.required` · `confirmation.consumed` · `idempotency.replay` · `core.failed` · `operation.completed` · `operation.failed`

### Somente logs

`request.received` · `request.authorized` · `core.started` · `core.completed`

### Opcional omitido

`idempotency.created` — não incluso no CHECK (baixo volume / sobreposição com completed).

---

## 4. Dados proibidos

Mesma redaction G7-G/H-A: HMAC, secrets, service-role, tokens, body/mídia WhatsApp, SQL, stack, PII desnecessária.  
`attributes` só pós-`redactObservabilityValue`.

---

## 5. Append-only

| Mecanismo | Detalhe |
|-----------|---------|
| Runtime | INSERT only (G7-J-W); sem UPDATE/DELETE na app |
| RLS | `ENABLE ROW LEVEL SECURITY` **sem** policies → anon/authenticated negados |
| service_role | Bypass RLS (Supabase); único escritor/leitor server-side |
| Triggers | Nenhum |
| Purge | Gate futuro (retenção) |

---

## 6. Retenção (documental)

| Classe | Dias |
|--------|------|
| Operacional | **90** |
| Segurança (`rejected` / `denied`) | **180** |

Sem cron nesta migration.

---

## 7. Índices

| Índice | Justificativa |
|--------|----------------|
| `(organization_id, condominium_id, occurred_at DESC)` | Feed painel / timeline |
| `(request_id)` | Correlação multi-evento |
| `(organization_id, condominium_id, event_type, occurred_at DESC)` | Filtro tipo (falhas, confirmation) |

---

## 8. Artefatos

| Arquivo | Função |
|---------|--------|
| `supabase/migrations/20260815220000_008_api_domain_events.sql` | CREATE |
| `supabase/migrations/20260815220000_008_api_domain_events.rollback.sql` | DROP TABLE only |
| `docs/evidence/M-G7J-EVENT-STORE-PRECHECK-LIVE.sql` | Pré-check READ-ONLY |
| `docs/evidence/results/SENTINELA-G7-J-EVENT-STORE-SQL-CREATION-2026-08-15.txt` | Evidência criação |
| `docs/evidence/results/SENTINELA-G7-J-EVENT-STORE-DEEP-REVIEW-2026-08-15.txt` | Deep review |

---

## 9. Wiring (NÃO neste gate)

**G7-J-W** (autorização futura):

```
envelope → redaction → persistent sink (fail-safe) → INSERT api_domain_events
```

Falha do store **não** desfaz operação de domínio. Observável via log.

---

## 10. STOP

- NÃO APPLY sem autorização explícita  
- NÃO WhatsApp / n8n prod / endpoint read / purge  
- Após APPLY + closeout → G7-J CLOSED; depois aguardar G7-J-W  
