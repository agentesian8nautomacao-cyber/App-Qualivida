# SENTINELA AUT. — G6-1 Idempotency Store (SQL)

**Status:** G6-1 = **CLOSED / PASS**  
**Data:** 2026-08-14  
**Decisão TTL×UNIQUE:** **R1 — LAZY RECLAIM**  
**APPLY:** PASS · **CLOSEOUT LIVE:** PASS · Wiring: **NÃO**

```
G6-1 = CLOSED / PASS
DATABASE CHANGES THIS STEP (closeout) = 0
MIGRATIONS EXECUTED THIS STEP = 0
WRITE OPERATIONS THIS STEP = 0
M1–M4 = INTACTOS
API WIRING = 0
G6-2 = NÃO INICIADO
N8N = 0
WHATSAPP = 0
```

Evidências:
- APPLY: `docs/evidence/results/SENTINELA-G6-1-APPLY-2026-08-14.txt`
- CLOSEOUT: `docs/evidence/results/SENTINELA-G6-1-CLOSEOUT-2026-08-14.txt`

Observação closeout: `relrowsecurity=t` com **0 policies** (fail-closed; sem policy inventada).

---

## 1. Objetivo

Persistir `Idempotency-Key` no Postgres para operações **WRITE** da Sentinela API, impedindo mutações duplicadas quando n8n/WhatsApp reenviam a mesma requisição.

```
WhatsApp → n8n → Sentinela API → (Idempotency Store + R1 reclaim) → Core → Adapter → DB
```

---

## 2. Artefatos

| Tipo | Caminho |
|------|---------|
| Migration (revisada) | `supabase/migrations/20260814190000_005_api_idempotency_keys.sql` |
| Rollback | `supabase/migrations/20260814190000_005_api_idempotency_keys.rollback.sql` *(inalterado)* |
| Pré-check READ-ONLY | `docs/evidence/M-G6-1-PRECHECK-LIVE.sql` |
| Evidência criação | `docs/evidence/results/SENTINELA-G6-1-IDEMPOTENCY-SQL-CREATION-2026-08-14.txt` |
| Deep review | `docs/evidence/results/SENTINELA-G6-1-IDEMPOTENCY-DEEP-REVIEW-2026-08-14.txt` |
| Evidência revisão | `docs/evidence/results/SENTINELA-G6-1-IDEMPOTENCY-REVISION-2026-08-14.txt` |

---

## 3. Tabela (campos — sem novos além dos autorizados)

| Coluna | Tipo | Null | Notas |
|--------|------|------|-------|
| `id` | uuid PK | NO | `gen_random_uuid()` |
| `organization_id` | uuid | NO | FK + escopo reclaim |
| `condominium_id` | uuid | NO | FK + escopo reclaim |
| `idempotency_key` | text | NO | parte da UNIQUE |
| `fingerprint` | text | NO | body hash |
| `operation` | text | NO | |
| `request_id` | text | NO | |
| `status` | text | NO | `in_progress` \| `completed` \| `failed` |
| `response_status` | integer | YES* | *obrigatório se completed/failed |
| `response_body` | jsonb | YES* | *obrigatório se completed |
| `created_at` | timestamptz | NO | default `now()` |
| `expires_at` | timestamptz | NO | TTL lógico 48h |
| `completed_at` | timestamptz | YES* | *obrigatório se completed/failed |

**UNIQUE mantida:** `(organization_id, condominium_id, idempotency_key)`

---

## 4. CHECKs de coerência (revisão)

| Status | Exigido pelo CHECK |
|--------|-------------------|
| `completed` | `response_body` + `response_status` + `completed_at` NOT NULL |
| `failed` | `response_status` + `completed_at` NOT NULL (`response_body` opcional) |
| `in_progress` | responses podem ser NULL |

---

## 5. TTL — o que `expires_at` **não** faz

- **Não** remove a row automaticamente  
- **Não** libera a UNIQUE sozinho  
- **Não** há cron/trigger nesta migration  
- É retenção **lógica** de 48h (`created_at + 48 hours` na app)

A UNIQUE **permanece** após `expires_at` até o **lazy reclaim** da API.

---

## 6. R1 — Contrato LAZY RECLAIM (wiring futuro)

> Implementação de código = gate futuro. Aqui só o contrato.

### Algoritmo (sempre tenant-scoped)

Antes de criar uma nova operação com uma `Idempotency-Key`:

1. **SELECT** row onde  
   `organization_id = $org AND condominium_id = $condo AND idempotency_key = $key`

2. **Se NÃO existir** → `INSERT` com `status = in_progress`, `expires_at = now()+48h`

3. **Se existir e `expires_at > now()`** → chave **ATIVA** (sem reclaim):
   - fingerprint **igual** → reutilizar conforme status:
     - `completed` / `failed` → replay `response_body` / erro cacheado
     - `in_progress` → política de lease/retry (não criar segunda row)
   - fingerprint **diferente** → `DUPLICATE_REQUEST` (não apagar)

4. **Se existir e `expires_at <= now()`** → chave **EXPIRADA**:
   ```sql
   DELETE FROM public.api_idempotency_keys
   WHERE organization_id = $org
     AND condominium_id = $condo
     AND idempotency_key = $key
     AND expires_at <= now();
   ```
   **Nunca** `DELETE ... WHERE idempotency_key = $key` sozinho.  
   Depois → tentar `INSERT` da nova operação.

### Concorrência (obrigatório no wiring)

| Técnica | Uso |
|---------|-----|
| Transação única | `BEGIN` → SELECT → (DELETE expirada?) → INSERT → `COMMIT` |
| Tratar `unique_violation` | Outro worker ganhou a corrida → re-SELECT e aplicar regras ativas (replay/conflito/`in_progress`) |
| UNIQUE | Continua sendo a serialização final — duas rows da mesma key no tenant são impossíveis |
| Lock opcional | `SELECT … FOR UPDATE` na row existente antes de decidir reclaim vs replay |

**Proibido:** trigger de reclaim · cron nesta fase · memory fallback em produção.

---

## 7. Matriz de cenários

| ID | Cenário | Comportamento esperado |
|----|---------|------------------------|
| **A** | Primeira utilização da key | SELECT miss → INSERT `in_progress` → Core → `completed`/`failed` |
| **B** | Mesma key + mesmo fingerprint + `in_progress` (ativa) | Sem novo INSERT; retry/await conforme lease; UNIQUE impede segunda row |
| **C** | Mesma key + mesmo fingerprint + `completed` (ativa) | Replay `response_body`; Core **não** reexecuta |
| **D** | Mesma key + fingerprint diferente (ativa) | `DUPLICATE_REQUEST`; **sem** reclaim |
| **E** | Duas concorrentes mesma key (ativa ou claim) | Uma INSERT OK; outra `unique_violation` → re-SELECT → B/C/D |
| **F** | Key expirada (`expires_at <= now()`) | Lazy reclaim: DELETE tenant-scoped → INSERT nova operação |
| **G** | Key expirada no tenant A | Reclaim em A **não** apaga/afeta row do tenant B (mesmo string de key) |
| **H** | Tentativa de reclaim sem match exato de tenant | DELETE com org/condo/key errados → 0 rows; não pode “pegar” key de outro tenant |

---

## 8. Tenant / FKs / RLS

- FKs `ON DELETE RESTRICT` → `organizations` / `condominiums`
- Residual: condo ∈ org sem FK composta (API enforce; sem ALTER M1–M4)
- **Sem RLS** nesta migration (intencional); API fail-closed + service-role

---

## 9. Fail-closed (API)

| Situação | Código |
|----------|--------|
| Store indisponível | `IDEMPOTENCY_STORE_UNAVAILABLE` |
| Sem header WRITE | `IDEMPOTENCY_KEY_REQUIRED` |
| Key ativa + body diferente | `DUPLICATE_REQUEST` |

Memory = **TEST_ONLY**.

---

## 10. Rollback

Inalterado:

```sql
DROP TABLE public.api_idempotency_keys;
```

Sem `CASCADE` · sem `IF EXISTS` no comando.

---

## 11. Fora de escopo

HMAC · AuthZ · Core · Confirmation · Event Store · n8n · WhatsApp · APPLY · wiring código

---

## 12. Resultado

**G6-1 = CLOSED / PASS**

Evidência closeout: `docs/evidence/results/SENTINELA-G6-1-CLOSEOUT-2026-08-14.txt`

Próximo (somente com autorização explícita): wiring da Idempotency Store e/ou M-G6-2.  
G6-2 / n8n / WhatsApp = **não iniciados**.
