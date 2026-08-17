# SENTINELA AUT. — G6-2 Confirmation Store (Design + Decisions)

**Status:** G6-2 = **SQL CREATED — AWAITING DEEP REVIEW**  
**Data:** 2026-08-14  
**Tipo:** SQL preparado — **sem APPLY · sem wiring · sem n8n/WhatsApp**  
**Pré-requisito:** G6-1 = CLOSED / PASS · DR1–DR20 CLOSED  
**Evidência decisões:** `docs/evidence/results/SENTINELA-G6-2-DECISIONS-2026-08-14.txt`  
**Evidência SQL:** `docs/evidence/results/SENTINELA-G6-2-SQL-CREATION-2026-08-14.txt`  
**Contrato G4:** `api/v1/_lib/confirmations/*` · `docs/SENTINELA-AUT-CONFIRMATIONS.md`

```
DATABASE CHANGES = 0
MIGRATIONS EXECUTED = 0
LIVE WRITE = 0
G6-1 = CLOSED / PASS
M1–M4 = INTACTOS
N8N = 0
WHATSAPP = 0
APPLY = NÃO
```

### Artefatos SQL (NOT EXECUTED)

| Tipo | Caminho |
|------|---------|
| Migration | `supabase/migrations/20260814200000_006_api_confirmations.sql` |
| Rollback | `supabase/migrations/20260814200000_006_api_confirmations.rollback.sql` |
| Pré-check | `docs/evidence/M-G6-2-PRECHECK-LIVE.sql` |

---

## 1. Objetivo

Persistir confirmações **single-use** para operações **SENSITIVE**, de forma segura em serverless multi-instância:

| Operação | Classe |
|----------|--------|
| `pickup_package` | SENSITIVE |
| `cancel_reservation` | SENSITIVE |

Princípios: tenant-scoped · uso único · expirável · vinculada à operação · vinculada ao fingerprint · consumo atômico · fail-closed.

---

## 2. Fluxo (quatro fases distintas)

```
HMAC → Tenant → AuthZ → Classification=SENSITIVE
    ↓
(1) CREATE confirmation     → desafio (id + token plaintext UMA VEZ)
    ↓
Canal externo (futuro WA/n8n/humano) aprova
    ↓
(2) VALIDATE bindings       → tenant/client/op/resource/fingerprint/token
    ↓
(3) CONSUME atomicamente    → consumed_at setado (single-use)
    ↓
(4) EXECUTE Core            → pickup/cancel (wiring futuro; após G6-2 store)
```

| Fase | Persiste? | Core? |
|------|-----------|-------|
| Create | INSERT `pending` | Não |
| Validate | READ only | Não |
| Consume | UPDATE atômico | Não |
| Execute | (Idempotency G6-1 + Core) | Sim |

**HMAC ≠ confirmação.**  
**Idempotency (G6-1) ≠ confirmação (G6-2).**  
Ambas podem coexistir em SENSITIVE: confirmação prova intenção; idempotency evita mutação duplicada por retry.

---

## 3. Contrato API existente (fonte de verdade)

Já implementado em G4 (`ConfirmationRecord` / `createConfirmationRequest` / `validateConfirmation`):

| Campo / binding | Uso atual |
|-----------------|-----------|
| `confirmation_id` | id opaco `cnf_` + hex |
| `confirmation_token` | plaintext **só na resposta de create**; store guarda `token_hash` |
| `organization_id` + `condominium_id` | tenant |
| `client_id` | credential HMAC |
| `operation` | `pickup_package` \| `cancel_reservation` |
| `resource_id` | package/reservation id |
| `prompt` | texto do desafio |
| `requester_identity` | opcional (WA/actor) |
| `expires_at` | TTL default **300s** (clamp 30–3600) |
| `used_at` | single-use (null até consume) |
| `created_at` | |

Código já faz: hash SHA-256 do token · timing-safe compare · `markUsed` fail se já usado.

**Lacuna vs requisito G6-2:** o contrato atual **não** persiste `operation_fingerprint`. G6-2 **adiciona** esse binding (DR5) sem quebrar o restante.

---

## 4. Tabela proposta: `public.api_confirmations`

Campos **mínimos** (fechados pelas DRs):

| Coluna | Tipo (previsto) | Nulo | Motivo |
|--------|-----------------|------|--------|
| `confirmation_id` | text PK | NO | DR1 — id estável da API (`cnf_…`) |
| `token_hash` | text | NO | DR2 — SHA-256 hex; **nunca** plaintext |
| `organization_id` | uuid | NO | DR4 — FK organizations |
| `condominium_id` | uuid | NO | DR4 — FK condominiums |
| `client_id` | text | NO | binding credential |
| `operation` | text | NO | DR3 — SENSITIVE only |
| `resource_id` | text | NO | recurso alvo |
| `operation_fingerprint` | text | NO | DR5 — hash canônico da intenção |
| `status` | text | NO | DR9 — `pending` \| `consumed` |
| `prompt` | text | NO | desafio humano/canal |
| `requester_identity` | text | YES | opcional |
| `created_request_id` | text | YES | observabilidade (não segurança) |
| `created_at` | timestamptz | NO | default now() |
| `expires_at` | timestamptz | NO | DR6 |
| `consumed_at` | timestamptz | YES | DR7 — null até consume |

**Não incluir:** token plaintext · secrets HMAC · payload completo do domínio · ENUM Postgres.

Mapeamento wiring: `consumed_at` ≡ `used_at` do contrato TypeScript atual.

---

## 5. Fingerprint canônico (DR5)

Na **create**, a API calcula e persiste:

```
operation_fingerprint = SHA-256_hex(
  "sentinela-confirm/v1\n" +
  organization_id + "\n" +
  condominium_id + "\n" +
  operation + "\n" +
  resource_id
)
```

Na **validate/consume**, recalcula com os mesmos campos da request e exige igualdade.

Isso impede reutilizar uma confirmação emitida para `(op, resource)` A em um contexto B, mesmo com token vazado parcialmente, se bindings divergirem.

**Não** substitui Idempotency-Key (G6-1): fingerprint de confirmação ≠ fingerprint de body HTTP completo da mutação.

---

## 6. Estados (DR9)

| Status | Significado |
|--------|-------------|
| `pending` | emitida; não consumida; pode estar logicamente expirada se `expires_at <= now()` |
| `consumed` | `consumed_at` preenchido; irreversível |

Expiração é **temporal** (`expires_at`), não exige status `expired` (evita job de transição).  
Validate deve rejeitar `pending` com `expires_at <= now()` → `CONFIRMATION_EXPIRED` **sem** consumir.

---

## 7. Consumo atômico / concorrência (DR7 / DR8)

```sql
-- pseudocódigo wiring (NÃO é migration desta etapa)
UPDATE api_confirmations
SET status = 'consumed', consumed_at = $now
WHERE confirmation_id = $id
  AND organization_id = $org
  AND condominium_id = $condo
  AND status = 'pending'
  AND consumed_at IS NULL
  AND expires_at > $now
RETURNING *;
```

- 1 row → consume OK → seguir Execute  
- 0 rows → `CONFIRMATION_ALREADY_USED` / `EXPIRED` / `INVALID`  
Duas validações concorrentes: no máximo uma executa Core.

---

## 8. TTL (DR6)

| Parâmetro | Valor |
|-----------|-------|
| Default | **300 segundos (5 min)** |
| Clamp | 30–3600 (já no serviço G4) |

Justificativa: janela curta para desafio sensível (retirada/cancelamento); reduz janela de token vazado; alinhado ao default já testado em G4.  
Sem cron de purge nesta migration (igual G6-1 — lazy opcional no wiring futuro).

---

## 9. Índices previstos (DR11)

1. PK `confirmation_id`  
2. `idx_api_confirmations_expires_at` (`expires_at`) — retenção futura  
3. `idx_api_confirmations_tenant` (`organization_id`, `condominium_id`)  

LookupNão** indexar `token_hash` para lookup (auth é por id + hash compare).  
Opcional futuro: `(org, condo, operation, resource_id)` se listagem de desafios abertos for necessária — **fora** do mínimo G6-2.

---

## 10. Relação com G6-1 (DR17)

| Store | Pergunta que responde |
|-------|----------------------|
| G6-1 Idempotency | “Esta mutação HTTP já foi executada / é retry?” |
| G6-2 Confirmation | “O caller confirmou explicitamente esta intenção sensível?” |

Não duplicar. SENSITIVE em produção futura: Confirmation **e** Idempotency-Key.

---

## 11. Segurança / n8n / RLS (DR12–DR19)

- Token: só hash no banco; plaintext uma vez na create response  
- n8n: somente via API HMAC; **zero** SQL/service_role no workflow  
- RLS: **não** inventar policies na migration; API fail-closed; service-role server-side  
- Sem trigger · sem cron · sem seed/DML  
- Rollback: `DROP TABLE public.api_confirmations;` sem CASCADE  

---

## 12. Fora de escopo desta etapa

SQL · APPLY · wiring persistent store · liberar Core SENSITIVE · Event Store · M5+ · n8n · WhatsApp · alteração G6-1

---

## 13. Próximo gate

**G6-2 SQL = CREATED — AWAITING DEEP REVIEW**

Ordem após autorização explícita:
1. Deep Review do SQL  
2. LIVE PRE-CHECK (`docs/evidence/M-G6-2-PRECHECK-LIVE.sql`)  
3. APPLY  
4. CLOSEOUT  
5. Wiring API (`kind: 'persistent'`) — gate separado  

NÃO executar Deep Review / Pre-check / APPLY automaticamente nesta criação.
