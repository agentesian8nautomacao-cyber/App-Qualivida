# SENTINELA AUT — G7-C — Integridade operacional server-side

**Data:** 2026-08-14 (CLOSEOUT 2026-08-15)  
**Status:** `G7-C = CLOSED / PASS`  
**Pré-requisitos:** G7-A PASS · G7-B PASS · G6-1/G6-2 CLOSED · M1–M4 intactos

---

## Princípio

> Uma intenção pode ser repetida; uma operação de negócio não pode ser executada incorretamente duas vezes.

API: autenticação, tenant, AuthZ, classificação, idempotência, confirmação, transporte.  
Core: regras de negócio.  
Adapter: persistência (Postgres/Supabase).  
Dexie: somente painel/browser.

---

## 1. Reservas — conflito server-side

### Antes
- Core usava `existingSlots` do caller.
- API G5/G7 passava `existingSlots: []` → checagem efetiva vazia.
- Warning `RESERVATION_CONFLICT_CLIENT_ONLY`.

### Depois (correção)
- Port `ReservationPersistence.listReservationSlots({ areaId, date })`.
- Implementado em:
  - `createSupabaseCorePersistence` (server)
  - `createMemoryCorePersistence` (testes)
  - `getDefaultPersistence` (painel via `getReservations`)
- `createReservation`: se o adapter expõe `listReservationSlots`, **ignora** `existingSlots` do client.
- Regra de domínio preservada (`timesOverlap` half-open `[start, end)`):
  - `10:00–12:00` ∩ `11:00–13:00` → conflito
  - `10:00–12:00` ∩ `12:00–14:00` → **não** conflita
- Status `cancelled` / `cancelada` excluídos da checagem.
- Cancelamento: `deleteReservation` com not-found → `NOT_FOUND` (não sucesso silencioso).

### DECISION REQUIRED → SQL CREATED / AWAITING REVIEW

Check-then-insert no aplicativo **não** garante “somente uma” sob concorrência real.

**SQL criada (NÃO aplicada):**

| Artefato | Caminho |
|----------|---------|
| Migration | `supabase/migrations/20260814210000_007_reservations_no_overlap.sql` |
| Rollback | `…007_reservations_no_overlap.rollback.sql` |
| Pré-check | `docs/evidence/M-G7C-RESERVATION-EXCLUSION-PRECHECK-LIVE.sql` |
| Evidência | `docs/evidence/results/SENTINELA-G7-C-CONSTRAINT-SQL-2026-08-14.txt` |

Constraint: `reservations_area_date_slot_excl`  
`EXCLUDE USING gist (area_id =, date =, tsrange(..., '[)') &&)`  
`WHERE status IN ('scheduled','active')` — valores do CHECK LIVE (`canceled`, não `cancelled`).

**Schema LIVE:** `condominium_id` **ABSENT** em `reservations` e `areas` — coluna **não** inventada. Isolamento cross-condo via `area_id` UUID distinto. Extensão `btree_gist` já presente.

```
G7-C = CLOSED / PASS (2026-08-15)
→ DEEP REVIEW APPROVED → PRE-CHECK PASS → APPLY PASS → CLOSEOUT PASS
  constraint reservations_area_date_slot_excl PRESENT (EXCLUDE, '[)', scheduled|active)
CLOSEOUT: DATABASE CHANGES THIS STEP = 0 · MIGRATIONS THIS STEP = 0 · WRITE = 0
```

Findings MEDIUM residuais (não bloqueiam CLOSEOUT; follow-up **G7-D** / hardening):
1. `start_time = end_time` (empty range) não exclui pares — CHECK/`end > start` futuro
2. API ainda não mapeia SQLSTATE `23P01` → `CONFLICT` (requisito **G7-D**)
3. Core filtra `cancelled`/`cancelada`; LIVE CHECK usa `canceled`

---

## 2. CREATE_PACKAGE

| Controle | Estado |
|----------|--------|
| Tenant | HMAC + AuthZ + adapter bound |
| Resident/unit | Core resolve via `residentsProvider` |
| Idempotência | claim / complete / fail (store persistente) |
| Retry mesma key+fingerprint | replay — sem segundo INSERT |
| Fingerprint diferente | `DUPLICATE_REQUEST` |
| Core | uma execução no first proceed |

---

## 3. PICKUP_PACKAGE

Fluxo: HMAC → tenant → AuthZ → confirmation create/consume → Core.

| Caso | Comportamento |
|------|----------------|
| Confirmação reutilizada | `CONFIRMATION_ALREADY_USED` |
| Pacote inexistente | `RESOURCE_NOT_FOUND` (antes do Core mutar) |
| Já retirado | Core `DUPLICATE` → API `CONFLICT` |
| Tenant incorreto | fail-closed na borda |

---

## 4. CANCEL_RESERVATION

Mesmo padrão SENSITIVE. Segunda execução após delete → `NOT_FOUND` / erro (sem mutação fantasma).

---

## 5. IDENTIFY_RESIDENT / IDENTIFY_UNIT

Telefone (cenário WhatsApp futuro):

| Caso | Resultado |
|------|-----------|
| Inexistente | `NOT_FOUND` (não cai para name/unit) |
| Único | identificação automática |
| Ambíguo | `CLARIFICATION_REQUIRED` → API `NEEDS_CONFIRMATION` |
| Cross-tenant | sem fallback; catalog via provider do tenant autenticado |

`residentsProvider` production: `createSupabaseResidentsProvider` (lista `residents`).  
**Residual M5:** tabela operacional sem `organization_id`/`condominium_id` — isolamento linha ainda incompleto.

---

## 6. GET_BOLETO

- Canal `system`: exige `boletoId` **ou** `residentId` **ou** `unit` (sem dump global).
- Resposta system: omite `pdf_original_path` / `checksum_pdf`.
- Select server: não lê paths internos desnecessários.
- Tenant: borda HMAC/AuthZ; sem bucket/policy change.

---

## 7. Transações (documentação — sem Event Store)

| Operação | Etapas multi | Risco | Transação futura? |
|----------|--------------|-------|-------------------|
| `create_package` | INSERT packages + package_items + (notify opcional) | itens órfãos / pacote sem itens | **SIM** (DB tx) |
| `create_reservation` | list slots + INSERT | race concorrente | exclusion + opcional SERIALIZABLE |
| `pickup_package` | update status + evento em memória | evento perdido OK (sem store) | update atômico já; Event Store depois |
| `cancel_reservation` | DELETE + evento memória | idempotente via not-found | OK curto prazo |
| WRITE + idempotency | claim → Core → complete/fail | crash entre claim e complete | reclaim R1 já; outbox depois |

**Não** foi criado mecanismo compensatório improvisado.  
**Não** Event Store nesta etapa.

---

## 8. Duplicação de regras

API **não** reimplementa overlap / pickup status / identify phone.  
Conflito de reserva e regras de pacote permanecem no Operational Core.

---

## 9. Testes

Arquivo: `api/v1/_lib/execution/g7c.integrity.test.ts` (A–P).

Suíte completa: **156 passed**.  
Build: **PASS**.

---

## 10. Fronteiras

| Item | Valor |
|------|-------|
| migrations | 0 |
| database changes | 0 |
| n8n | 0 |
| WhatsApp | 0 |
| Event Store | 0 |
| M1–M4 | intactos |
| G6-1 / G6-2 | intactos |

---

## 11. STOP

- **Não** iniciar G7-D automaticamente.
- **Não** criar/aplicar exclusion constraint sem autorização.
- **Não** n8n / WhatsApp / Event Store.

Próximo passo humano: **review** da migration `007_reservations_no_overlap` → autorização APPLY (separada). G7-D / n8n / WhatsApp / Event Store permanecem parados.
