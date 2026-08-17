# M2 Readiness Audit

**Data (UTC):** 2026-08-17  
**Projeto:** SentinelaAUT / Operaut — Fase 1 multi-tenant  
**Modo desta tarefa:** SOMENTE LEITURA / ANÁLISE / DOCUMENTAÇÃO  
**Migration criada nesta tarefa:** NO  
**Migration executada nesta tarefa:** NO  
**Database modified:** NO  

---

## 1. Executive Summary

| Campo | Valor |
|-------|--------|
| **M2 READINESS** | **PASS** (contrato + DR1–DR6 fechados; schema M2 definido e historicamente aplicado) |
| **READY FOR IMPLEMENTATION** | **NO** — `public.units` **já existe** (M2 APPLY + CLOSEOUT PASS). Re-CREATE / nova migration M2 **não** deve ser autorizada. |
| **M2 STATUS (histórico)** | **CLOSED / PASS** |
| **Decisões estruturais abertas** | Nenhuma (DR1–DR7 CLOSED) |
| **Live recheck nesta sessão** | NÃO — sem credenciais DB no ambiente do agente (`.env` / `.env.local` ausentes). Estado live baseado em evidências APPLY/CLOSEOUT. |

**Veredito operacional:** a auditoria de readiness do **contrato M2** está completa e aprovada. A implementação DDL do M2 **já foi entregue**. Esta execução **PARA** sem criar migration, sem ALTER e sem DML.

---

## 2. Current M1 State

Fontes: `docs/evidence/results/M1-CLOSEOUT-2026-08-13.txt`, migration `20260813150000_001_platform_org_condo.sql`, closeouts posteriores (M2/M3/M4 readiness).

| Tabela | Estado (evidência) | PK | FK / constraints chave | RLS policies M1 |
|--------|--------------------|----|-------------------------|-----------------|
| `public.organizations` | EXISTS | `id` uuid | `UNIQUE(slug)`; `status` text DEFAULT `'active'`; timestamps `timestamptz` | 0 policies (flag RLS observada ON em closeouts posteriores) |
| `public.condominiums` | EXISTS | `id` uuid | `organization_id` → `organizations(id)` **ON DELETE RESTRICT**; `UNIQUE(organization_id, slug)`; `CHECK(vertical = 'condominium')` | 0 policies M1 |

**Relacionamento organizacional documentado:**

```text
organizations (1) → (N) condominiums
```

**Conclusão M1:** fundação suficiente para M2 (`condominiums.id` como alvo de FK). Dependência M1 = SATISFEITA.

---

## 3. M2 Contract

Fonte canônica: `docs/FASE-1-MIGRATION-PLAN.md` § **M2 — `002_units`**.

| Campo | Conteúdo documentado |
|-------|----------------------|
| **Objetivo** | Modelar **UNIT** com `condominium_id` (= site_id) e código único **por site**. |
| **Ajuste Operaut** | Documentar unit como espaço do site; sem mudar nome da tabela. |
| **Dependências** | M1. |
| **Tabela** | Nova: `units`. |
| **Rollback** | `DROP TABLE units;` se sem FKs M5+. |
| **Testes** | `UNIQUE (condominium_id, code)`. |
| **Critério de sucesso** | Catálogo por site; mapa `unitFormatter` → `code`. |
| **RLS no M2** | Fora de escopo (policies = M12+). |
| **DML / seed / backfill** | Fora de escopo M2. |

Detalhe de colunas: `docs/FASE-1-ARQUITETURA-MULTITENANT.md` §4 UNIT + decisões `M2-DECISIONS-2026-08-13.txt`.  
Addendum: `docs/OPERAUT-ARCHITECTURE-ADDENDUM.md` — UNIT = espaço físico/lógico do site; tabela `units`.

**Nome lógico migration:** `002_units`  
**Arquivo:** `supabase/migrations/20260813160000_002_units.sql`  
**Rollback:** `supabase/migrations/20260813160000_002_units.rollback.sql`

---

## 4. DR1

| Item | Conteúdo |
|------|----------|
| **Requisito** | Definir `created_at` / `updated_at` para `units`. |
| **Decisão documentada** | `timestamptz NOT NULL DEFAULT now()` para ambos; **sem** trigger de auto-update (igual M1). |
| **Evidência** | `M2-DECISIONS-2026-08-13.txt` DR1 = CLOSED; SQL L61–62; APPLY/CLOSEOUT PASS. |
| **Status** | **PASS** |

---

## 5. DR2

| Item | Conteúdo |
|------|----------|
| **Requisito** | Nullability / tipo de `block`. |
| **Decisão documentada** | `block text NULL` (bloco pode não existir em todos os condomínios). |
| **Evidência** | `M2-DECISIONS` DR2 = CLOSED; SQL L56; CLOSEOUT nullability PASS. |
| **Status** | **PASS** |

---

## 6. DR3

| Item | Conteúdo |
|------|----------|
| **Requisito** | Tipo / nullability de `number`. |
| **Decisão documentada** | `number text NULL` (alfanumérico: 101, 101A, etc.; **não** integer). |
| **Evidência** | `M2-DECISIONS` DR3 = CLOSED; SQL L57. |
| **Status** | **PASS** |

---

## 7. DR4

| Item | Conteúdo |
|------|----------|
| **Requisito** | Tipo / nullability de `label`. |
| **Decisão documentada** | `label text NULL` (auxiliar de apresentação). |
| **Evidência** | `M2-DECISIONS` DR4 = CLOSED; SQL L58. |
| **Status** | **PASS** |

---

## 8. DR5

| Item | Conteúdo |
|------|----------|
| **Requisito** | Campo `status` de unit. |
| **Decisão documentada** | `status text NOT NULL DEFAULT 'active'`; **sem** ENUM; **sem** CHECK. |
| **Nota** | Prosa §4 cita exemplos occupied/vacant/maintenance; decisão aprovada adota `'active'` + text livre (padrão M1). |
| **Evidência** | `M2-DECISIONS` DR5 = CLOSED; SQL L59; CLOSEOUT default `'active'` PASS. |
| **Status** | **PASS** |

---

## 9. DR6

| Item | Conteúdo |
|------|----------|
| **Requisito** | FK `units.condominium_id` → `condominiums` e comportamento ON DELETE. |
| **Decisão documentada** | `FOREIGN KEY (condominium_id) REFERENCES public.condominiums(id) ON DELETE RESTRICT`. |
| **Evidência** | `M2-DECISIONS` DR6 = CLOSED; SQL L63–66; APPLY/CLOSEOUT ON DELETE RESTRICT PASS. |
| **Status** | **PASS** |

**DR7 (metadata, documentado fora da numeração 1–6):** `metadata jsonb NULL` sem DEFAULT — CLOSED. Incluído no schema aplicado.

---

## 10. Proposed Units Schema

Schema **aprovado e aplicado** (não proposta futura):

```text
public.units
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid()
  condominium_id  uuid NOT NULL
  code            text NOT NULL
  block           text NULL
  number          text NULL
  label           text NULL
  status          text NOT NULL DEFAULT 'active'
  metadata        jsonb NULL
  created_at      timestamptz NOT NULL DEFAULT now()
  updated_at      timestamptz NOT NULL DEFAULT now()
  CONSTRAINT units_condominium_id_fkey
    FOREIGN KEY (condominium_id) REFERENCES public.condominiums(id) ON DELETE RESTRICT
  CONSTRAINT units_condominium_id_code_key UNIQUE (condominium_id, code)
```

**Modelo hierárquico:**

```text
organizations
    └── condominiums
            └── units
```

`organization_id` **não** é coluna de `units` (isolamento transitivo via `condominiums`).

---

## 11. Foreign Keys

| FK | Definição | Status |
|----|-----------|--------|
| `units_condominium_id_fkey` | `condominium_id` → `public.condominiums(id)` | Definida / aplicada |
| Org direta | — | **NÃO** (intencional) |

---

## 12. ON DELETE

| Aresta | Comportamento documentado | Status |
|--------|---------------------------|--------|
| `organizations` → `condominiums` | **RESTRICT** (M1) | PASS |
| `condominiums` → `units` | **RESTRICT** (DR6) | PASS |

CASCADE / SET NULL **não** adotados. Motivo documentado: integridade; sem exclusão silenciosa em cascata.

---

## 13. Constraints

| Constraint | Tipo | Status |
|------------|------|--------|
| `units_pkey` | PRIMARY KEY `(id)` | PASS |
| `units_condominium_id_fkey` | FK + RESTRICT | PASS |
| `units_condominium_id_code_key` | UNIQUE `(condominium_id, code)` | PASS |
| UNIQUE global `(code)` | — | **AUSENTE** (correto) |
| CHECK status | — | **AUSENTE** (DR5) |

Unicidade: mesmo `code` (ex. `101`) **permitido** em condomínios diferentes; **proibido** duplicar no mesmo `condominium_id`.

---

## 14. Indexes

| Índice | Necessário? | Motivo |
|--------|-------------|--------|
| `units_pkey` | SIM | PK |
| `units_condominium_id_code_key` | SIM | Unicidade composta + cobre lookup por `condominium_id` (prefixo esquerdo) |
| `CREATE INDEX (condominium_id)` separado | NÃO | Redundante com UNIQUE composta |
| `CREATE INDEX (status)` | NÃO | Plano M2 não justifica consultas independentes por status |
| GIN `(metadata)` | NÃO | Fora de escopo M2 |

---

## 15. Timestamps

| Coluna | Tipo | Default | TZ | Trigger auto-update |
|--------|------|---------|----|---------------------|
| `created_at` | `timestamptz` | `now()` | sim | NÃO |
| `updated_at` | `timestamptz` | `now()` | sim | NÃO |

Consistente com M1 (`organizations` / `condominiums`).

---

## 16. Status

| Item | Valor |
|------|-------|
| Nome | `status` |
| Tipo | `text` |
| Nullability | NOT NULL |
| Default | `'active'` |
| ENUM / CHECK | NÃO |
| Valores de domínio | Text livre no M2; exemplos de ocupação na prosa §4 **não** travados em SQL |

---

## 17. RLS Strategy

**Escopo M2 (documentado):** NÃO criar policies; NÃO ENABLE deliberado no SQL M2.

**Estratégia esperada (M12–M14 / pós-M2):**

```text
organizations
     ↓
condominiums
     ↓
units   ← isolamento por condominium_id (= site_id)
```

Princípio obrigatório: **Tenant A NÃO acessa Units do Tenant B.**

| Regra | Detalhe |
|-------|---------|
| Isolamento | Policies filtrando por `condominium_id` via membership / contexto de tenant |
| Transitivo org | Via join `units → condominiums.organization_id` quando necessário |
| Proibido | `USING (true)` / allow-all em `units` |
| Observação live (CLOSEOUT) | `relrowsecurity units = true` com **0 policies** — flag típica Supabase pós-CREATE; **esperado** no M2; policies = fase posterior |

**Nesta auditoria:** nenhuma policy criada ou alterada.

---

## 18. RBAC Impact

| Achado | Evidência |
|--------|-----------|
| Sem permissão `units.view` / `units.*` no catálogo atual | `api/v1/_lib/authz/catalog.ts` — lista sem keys `units.*` |
| `identify_unit` usa `residents.view` | `api/v1/_lib/authz/operations.ts` |
| Migrations RBAC | Sem grant específico para tabela `units` |

**Impacto futuro (registrar, não implementar):** possível evolução RBAC (`units.view` etc.) quando o catálogo for consumido pela API/UI. **Fora do M2 DDL.**

---

## 19. Frontend/Backend Impact

### Tabela `public.units`

- Migration + evidências APPLY/CLOSEOUT.
- **Nenhuma** query `.from('units')` encontrada na API de composição / serviços app neste audit.

### Modelo legado (string `unit`) — coexistência documentada

| Área | Uso |
|------|-----|
| `residents.unit`, `packages.unit`, `occurrences.unit`, `boletos.unit`, visitors | string operacional |
| `utils/unitFormatter.ts` | normalize / format / validate |
| `services/residentAuth.ts`, `dataService.ts`, views, modals | confiam em string legado |
| `api/v1/units/identify.ts` + `sentinela/core/operations/identifyUnit.ts` | formatação / validação; `knownUnitCodes` opcional — **não** lê `public.units` automaticamente |
| Frontend | labels “unidade” / busca operacional; **sem** CRUD da tabela `units` |

**Conflito estrutural:** NÃO — legado string e catálogo `units` foram projetados para coexistir até backfill `unit_id` (M5+ / pós-M4).  
**Risco de confusão:** dual-write futuro se app passar a misturar `units.code` e strings sem normalização.

---

## 20. Multi-Tenant Bypass Findings

Registrados **sem correção** nesta fase:

| ID | Achado | Severidade | Nota |
|----|--------|------------|------|
| B1 | App legado consulta `residents` / packages etc. por `unit` string **sem** `condominium_id` | MEDIUM | Pré-M5; isolamento tenant ainda incompleto no domínio legado |
| B2 | `identify_unit` aceita `unit` do cliente e não valida contra `public.units` nem tenant | MEDIUM | Por design atual (formatter); catalog check só se `knownUnitCodes` for passado |
| B3 | API operacional pode receber códigos de unidade sem escopo de site no payload | MEDIUM | AuthZ atual = permissão + HMAC; binding tenant fino = membership/RLS posteriores |
| B4 | `units` com RLS ON e **0 policies** | HIGH se cliente PostgREST expuser a tabela; LOW no escopo M2 se acesso só via service role / não exposto | Policies M12+ obrigatórias antes de exposição client-side |
| B5 | Policies `USING (true)` existem em catálogos RBAC (`roles`/`permissions` select) | LOW para M2 | Não são policies de `units`; padrão SHARED/REFERENCE |

**Nenhum** `.from('units')` client-side encontrado nesta auditoria → bypass direto da tabela M2 **não observado** no código app atual.

---

## 21. Risks

| Nível | Risco | Mitigação |
|-------|-------|-----------|
| HIGH (se re-APPLY) | Guard `units already exists` — APPLY novo falharia / conflito | **Não** reaplicar M2; não criar segunda migration CREATE |
| MEDIUM | Dual modelo string vs `units.code` | Manter escopo: backfill só em fase autorizada |
| MEDIUM | RLS ON sem policies | Não expor `units` ao anon/authenticated até M12+ |
| LOW | Divergência prosa §4 (occupied/…) vs DR5 (`active`) | Já decidida; app pode evoluir valores depois |
| LOW | Live schema não revalidado nesta sessão | Revalidar read-only antes de qualquer trabalho DDL futuro |

---

## 22. Open Decisions

**Nenhuma decisão estrutural aberta para o DDL M2.**

Itens **fora** do M2 (não bloqueiam readiness do contrato M2, mas bloqueiam “produto completo units”):

- Policies RLS de `units` (M12+)
- População / backfill de units
- `unit_id` em tabelas legadas
- Permissões RBAC `units.*`
- Integração API que leia `public.units`

---

## 23. Readiness Gate

### Critérios PASS (contrato M2)

| Critério | Resultado |
|----------|-----------|
| DR1 = PASS | SIM |
| DR2 = PASS | SIM |
| DR3 = PASS | SIM |
| DR4 = PASS | SIM |
| DR5 = PASS | SIM |
| DR6 = PASS | SIM |
| Sem decisão estrutural pendente | SIM |
| Sem conflito doc ↔ schema SQL M2 | SIM (divergências §4 resolvidas por DR fechados) |
| FK definida | SIM |
| ON DELETE definida | SIM |
| Constraints definidas | SIM |
| Timestamps definidos | SIM |
| Status definido | SIM |
| Estratégia RLS definida (mesmo que deferred) | SIM |
| Risco isolamento conhecido mitigável no plano | SIM (policies posteriores; sem allow-all no M2) |

### Classificação

```text
M2 READINESS: PASS
```

### Gate de implementação (DDL CREATE)

```text
READY FOR IMPLEMENTATION: NO
```

**Motivo:** M2 já está **CLOSED / PASS** com `public.units` EXISTS (evidências `M2-APPLY-2026-08-13.txt`, `M2-CLOSEOUT-2026-08-14.txt`; confirmado em closeouts M3/M4).  
Pré-check histórico: se `units` EXISTS → **STOP / BLOCKED** para novo CREATE.

### Ações **proibidas** após este relatório (até nova autorização explícita e escopo distinto)

- Criar nova migration M2
- Re-aplicar `002_units`
- ALTER / DROP / DML em `units`
- Criar policies RLS agora
- Alterar RBAC / frontend / APIs “para aproveitar”

### Confirmação desta execução

```text
MIGRATION EXECUTED: NO
DATABASE MODIFIED: NO
Migration created: NO
Database modified: NO
```

---

## Fontes consultadas

- `docs/FASE-1-MIGRATION-PLAN.md`
- `docs/FASE-1-ARQUITETURA-MULTITENANT.md`
- `docs/OPERAUT-ARCHITECTURE-ADDENDUM.md`
- `docs/evidence/results/M2-READINESS-REVIEW-2026-08-13.txt`
- `docs/evidence/results/M2-DECISIONS-2026-08-13.txt`
- `docs/evidence/results/M2-SQL-CREATION-REVIEW-2026-08-13.txt`
- `docs/evidence/results/M2-APPLY-2026-08-13.txt`
- `docs/evidence/results/M2-CLOSEOUT-2026-08-14.txt`
- `docs/evidence/results/M1-CLOSEOUT-2026-08-13.txt`
- `supabase/migrations/20260813150000_001_platform_org_condo.sql`
- `supabase/migrations/20260813160000_002_units.sql` (+ rollback)
- Código: `api/v1/units/identify.ts`, `sentinela/core/operations/identifyUnit.ts`, `api/v1/_lib/authz/*`, frontend/services com campo `unit` string

---

## Resultado final (auditoria)

```text
M2 READINESS: PASS

DR1: PASS
DR2: PASS
DR3: PASS
DR4: PASS
DR5: PASS
DR6: PASS

READY FOR IMPLEMENTATION: NO
  (M2 DDL já aplicado / CLOSED — não reimplementar)

MIGRATION EXECUTED: NO
DATABASE MODIFIED: NO

Pending structural decisions: NENHUMA
Next authorized step: aguardar instrução humana para escopo pós-M2
  (ex.: RLS units, backfill, unit_id, RBAC) — NÃO CREATE TABLE units
```
