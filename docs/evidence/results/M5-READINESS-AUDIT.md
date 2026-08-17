# M5 Readiness Audit

**Migration lógica:** `005_residents_condo_id`  
**Data (UTC):** 2026-08-17  
**Projeto:** `zaemlxjwhzrfmowbckmk`  
**Modo:** SOMENTE LEITURA / AUDITORIA  
**Migration criada nesta tarefa:** NO  
**DDL/DML nesta tarefa:** NO  

```text
M5 READINESS = NOT READY
MIGRATION EXECUTED: NO
DATABASE MODIFIED: NO
```

---

## 1. Objetivo

Auditar readiness de M5: adicionar `residents.condominium_id` nullable → backfill piloto → `NOT NULL` + FK `residents.condominium_id` → `condominiums.id`.

Não implementar. Não criar `005_residents_condo_id.sql`.

---

## 2. Escopo

IN: leitura de docs, evidências M1–M4 / G6–G7, dumps locais, SELECT via PostgREST (role `anon`).  
OUT: ALTER/CREATE/DROP/INSERT/UPDATE/DELETE, policies, frontend, backend, nova migration.

---

## 3. Regra de somente leitura

Nesta execução:

* nenhum SQL mutável;
* `psql` direto **não autenticado** (sem `PGPASSWORD` / `pgpass`); tentativa abortada;
* REST usado apenas para SELECT;
* dumps inspecionados só com `pg_restore -l` (TOC), sem restore.

---

## 4. Evidências consultadas

### Encontradas

| Artefato | Caminho |
|----------|---------|
| Plano M5 | `docs/FASE-1-MIGRATION-PLAN.md` § M5 |
| Arquitetura | `docs/FASE-1-ARQUITETURA-MULTITENANT.md` §4, §8, §14 |
| Addendum | `docs/OPERAUT-ARCHITECTURE-ADDENDUM.md` |
| M1 APPLY/CLOSEOUT | `docs/evidence/results/M1-APPLY-2026-08-13.txt`, `M1-CLOSEOUT-2026-08-13.txt` |
| M2 APPLY/CLOSEOUT/DECISIONS | `M2-APPLY`, `M2-CLOSEOUT`, `M2-DECISIONS`, `M2-READINESS-AUDIT.md` |
| M3 APPLY/CLOSEOUT/DECISIONS | `M3-APPLY`, `M3-CLOSEOUT`, `M3-DECISIONS` |
| M4 APPLY/DECISIONS/PRECHECK | `M4-APPLY-2026-08-14.txt`, `M4-DECISIONS-2026-08-14.txt`, `M4-PRECHECK-LIVE-2026-08-14.txt` |
| Seed SQL | `supabase/migrations/20260814180000_004_seed_pilot.sql` |
| G6 live org/condo counts | `SENTINELA-G6-1-CLOSEOUT`, `SENTINELA-G6-2-CLOSEOUT` |
| G7-K (tabelas M1–M3 intactas) | `SENTINELA-G7-K-RBAC-APPLY-2026-08-16.txt` |
| RLS histórico residents | `D2-STORAGE-LIVE-2026-08-12.txt` |
| RLS flag org/condo | `M1-APPLY`, `M2-CLOSEOUT` (`relrowsecurity=true`, 0 policies) |
| Dumps | `docs/evidence/backups/backup-pre-m4-*.dump`, `backup-pre-g7c-*.dump`, `backup-pre-g7j-*.dump`, `backup-pre-g7k-*.dump` |

### Não encontradas

| Artefato | Status |
|----------|--------|
| `M5-READINESS-REVIEW` / `M5-DECISIONS` / `M5-CLOSEOUT` | AUSENTE |
| `005_residents_condo_id.sql` | AUSENTE (esperado) |
| `M4-CLOSEOUT` | AUSENTE |
| `backup-post-m4-*.dump` | AUSENTE |
| Connection string / `PGPASSWORD` nesta sessão | AUSENTE |

`20260814190000_005_api_idempotency_keys.sql` **não** é o M5 do plano (é G6-1).

---

## 5. Schema live

### 5.1 Limitação desta sessão

| Canal | Resultado |
|-------|-----------|
| PostgreSQL `postgres` / `information_schema` / `pg_catalog` | **NOT VERIFIED** — sem senha DB |
| PostgREST role `anon` | **VERIFIED** (SELECT) |
| Última evidência `psql` postgres-role (org/condo counts) | 2026-08-14 G6-2 CLOSEOUT (histórico) |

### 5.2 Por que REST devolveu `count = 0` / `rows = []` em organizations e condominiums

**Não significa “não existem registros”.**

Diagnóstico desta sessão (SELECT REST):

| Probe | HTTP | Interpretação |
|-------|------|----------------|
| `GET /rest/v1/this_table_does_not_exist` | **404** `PGRST205` | Tabela inexistente |
| `GET /rest/v1/organizations?select=id,slug` | **200** `content-range: */0` | Tabela **existe**; zero linhas **visíveis ao anon** |
| `GET /rest/v1/organizations?select=vertical` | **400** `42703` column does not exist | Parser PostgreSQL alcançou `public.organizations` (existência física) |
| `GET /rest/v1/condominiums?select=id,slug,organization_id,vertical` | **200** `*/0` | Tabela **existe**; `vertical` é coluna válida; zero linhas visíveis ao anon |
| `GET /rest/v1/condominiums?slug=eq.qualivida-club-residence` | **200** `*/0` | Filtro de slug **não prova ausência**; RLS oculta a linha |
| `GET /rest/v1/residents?select=id,unit` | **200** `0-3/4` | Mesmo projeto; anon **vê** 4 rows (policies permissivas) |

Mecanismo documentado (M1 APPLY / M2 CLOSEOUT):

```text
pg_class.relrowsecurity organizations = true
pg_class.relrowsecurity condominiums  = true
pg_policies nas tabelas M1            = 0
```

Com RLS ligado e **nenhuma policy**, o PostgreSQL nega visibilidade a papéis sem `BYPASSRLS` (inclui `anon` do PostgREST). Resultado: **HTTP 200 + array vazio**, não 404.

`units` e `tenant_memberships` também retornaram `*/0` nesta sessão. Isso **não prova** COUNT(*)=0: o mesmo padrão RLS (flag ON, 0 policies M2/M3) se aplica. Counts reais dessas tabelas = **NOT VERIFIED** nesta sessão via postgres. Evidência histórica postgres-role: ambas com 0 rows no M4 APPLY.

### 5.3 `public.residents` (REST — VERIFIED)

Tabela existe. `content-range: 0-3/4`.

**M5 target column = ABSENT** (`42703` em `select=condominium_id`). Esperado para M5 ainda não aplicada. **Não é FAIL isolado.**

Colunas **confirmadas por SELECT** nesta sessão:

| Coluna | REST |
|--------|------|
| `id` | presente |
| `unit` | presente (text / string) |
| `name` | presente |
| `email` | presente |
| `phone` | presente |
| `whatsapp` | presente |
| `extra_data` | presente |
| `auth_user_id` | presente |
| `password_hash` | presente (valores **não** registrados aqui) |
| `created_at` | presente |
| `updated_at` | presente |
| `condominium_id` | **ABSENT** (`42703`) |
| `organization_id` | **ABSENT** (`42703`) |
| `unit_id` | **ABSENT** (`42703`; hint: `residents.unit`) |
| `site_id` / `tenant_id` | **ABSENT** (`42703`) |

Tipos PostgreSQL exatos, PK nome, FKs, CHECKs, índices, triggers, `relrowsecurity` de `residents`: **NOT VERIFIED** nesta sessão (requer `pg_catalog`).

Histórico (não revalidado agora):

* FASE-0: `id` uuid; `unit` string; sem tabela `units` na época.
* M3: `residents.id` uuid confirmado para FK `tenant_memberships.resident_id` ON DELETE RESTRICT.
* D2 2026-08-12: policies `Allow all operations on residents` (`USING true`) + SELECT anon `USING true`.
* Script legado: possível `idx_residents_unit_upper` / `UNIQUE(auth_user_id)` — **NOT VERIFIED** live.

---

## 6. Condominiums

| Item | Esta sessão (anon REST) | Última evidência postgres-role |
|------|-------------------------|--------------------------------|
| Existência física | **VERIFIED** (200, não 404; coluna `vertical` aceita) | EXISTS |
| COUNT(*) real | **NOT VERIFIED** (`*/0` = RLS, não COUNT) | 1 (G6-2 CLOSEOUT 2026-08-14) |
| slug piloto visível ao anon | 0 rows | `qualivida-club-residence` = 1 |
| `vertical` | coluna existe (select não deu 42703) | `'condominium'` no M4 APPLY |
| PK/FK/índices | **NOT VERIFIED** | PK `id`; FK `organization_id` → `organizations(id)` ON DELETE RESTRICT; UNIQUE `(organization_id, slug)` |

---

## 7. Organization

| Item | Esta sessão (anon REST) | Última evidência postgres-role |
|------|-------------------------|--------------------------------|
| Existência física | **VERIFIED** (200 + `42703` em `vertical`) | EXISTS |
| COUNT(*) real | **NOT VERIFIED** | 1 (G6-2 CLOSEOUT) |
| slug piloto visível ao anon | 0 rows | `qualivida-admin` = 1 |
| `organizations.vertical` | **ABSENT** (correto: vertical é do site) | N/A |

---

## 8. Residentes

**Quantidade live (anon REST, 2026-08-17): 4 — VERIFIED**

Confirma o piloto documental (4). Não assume; medido.

`unit` **não** é FK. Valores observados (identificadores de apto, não de site):

| resident_id | unit |
|-------------|------|
| `0ec3abfd-10c0-4507-8a04-298f937905af` | `01/002` |
| `e52fae67-7c14-4226-a5f4-822053f252ca` | `03/005` |
| `e4934501-3f74-45c8-895c-6176a9540e79` | `08/302` |
| `15166e78-8f76-4dde-8a92-fb05421c842e` | `08/402` |

PII (nome, e-mail, telefone, CPF, hashes) **omitida**.

`unit` **não** permite inferir o site: é código de unidade intra-condomínio; `public.units` não é consultável com certeza de COUNT nesta sessão e historicamente estava vazia (M4: units 0→0).

---

## 9. Simulação do backfill

**Nenhum UPDATE executado.**

SELECT conceitual (não rodado em postgres nesta sessão; REST não enxerga `condominiums`):

```sql
-- READ-ONLY simulation (NÃO executar como UPDATE)
SELECT
  r.id AS resident_id,
  r.unit,
  c.id AS condominium_id_candidate,
  CASE
    WHEN c.id IS NULL THEN 'ORPHAN'
    WHEN cnt.n = 1 THEN 'MATCH'
    WHEN cnt.n > 1 THEN 'AMBIGUOUS'
    ELSE 'UNRESOLVED'
  END AS status
FROM public.residents r
LEFT JOIN public.condominiums c
  ON c.slug = 'qualivida-club-residence'
CROSS JOIN LATERAL (
  SELECT COUNT(*)::int AS n FROM public.condominiums
) cnt;
```

Candidato histórico (M4 APPLY, postgres-role, 2026-08-14):

```text
condominium_id_candidate = 3f383313-5ec0-4d21-97c7-1b2500c933be
slug                     = qualivida-club-residence
organization_id          = 0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928
vertical                 = condominium
```

**Releitura desses UUIDs nesta sessão: NOT VERIFIED** (RLS no REST; sem `psql`).

Tabela de simulação (status honesto desta sessão):

| resident_id | unit | condominium_id_candidate | status |
|-------------|------|--------------------------|--------|
| `0ec3abfd-…7905af` | `01/002` | `3f383313-…c933be` (histórico M4) | **UNRESOLVED** |
| `e52fae67-…f252ca` | `03/005` | idem | **UNRESOLVED** |
| `e4934501-…540e79` | `08/302` | idem | **UNRESOLVED** |
| `15166e78-…c842e` | `08/402` | idem | **UNRESOLVED** |

Motivo UNRESOLVED (não ORPHAN):

* binding por `unit` é impossível (não é site-id);
* binding por “único site piloto” exige `COUNT(condominiums)=1` **postgres** nesta sessão — **NOT VERIFIED**;
* FASE-1 §14 diz que os 4 residents são o primeiro tenant — contrato documental, não prova live atual.

Se um operador fechar DR de backfill **e** um SELECT postgres confirmar 1 site piloto, os 4 passariam a **MATCH** determinístico. Isso **ainda não ocorreu**.

**Backfill determinístico nesta sessão: NÃO COMPROVADO.**

---

## 10. FK

Pretendida:

```text
residents.condominium_id  →  public.condominiums.id
```

| Check | Status |
|-------|--------|
| Destino PK `condominiums.id` uuid | Documentado M1; **NOT VERIFIED** pg_catalog nesta sessão |
| Coluna origem | **ABSENT** (a criar) |
| Compatibilidade de tipo | uuid → uuid (contrato M1/M4) |
| Órfãos hoje | N/A até existir a coluna |
| Padrão ON DELETE M1–M4 tenant FKs | **RESTRICT** (organizations→condominiums, units, memberships, G6 events/confirmations) |

FK **não criada**.

---

## 11. ON DELETE

```text
DECISION REQUIRED:
residents.condominium_id ON DELETE = ???
```

| Opção | Consequência |
|-------|----------------|
| **RESTRICT** | Impede DROP/DELETE do site com moradores. Alinha M1–M4. Recomendação técnica, **não fechada**. |
| **CASCADE** | Apagar condomínio apaga residents. Destrutivo; sem autorização documental. |
| **SET NULL** | Incompatível com `NOT NULL` final do plano M5. |

**NEEDS DECISION.** Não inferir PASS.

---

## 12. organization_id

`residents.organization_id` = **ABSENT** (`42703`).

| Pergunta | Resposta |
|----------|----------|
| Necessidade no M5? | Arquitetura: TENANT-OWNED via `condominium_id`; org é transitiva (`residents → condominiums → organizations`). |
| Precedente M1–M4 em legado operacional? | **Não** (memberships/events denormalizam org; residents não). |
| RLS M13 | Helpers por `condominium_id` / membership, não exigem coluna org em residents. |
| Risco de duas fontes | Alto se `organization_id` divergir de `condominiums.organization_id` (já residual DR7 M3). |

Recomendação: **não criar** `organization_id` em M5.  
Status: **NEEDS DECISION** (recomendação ≠ decisão fechada).

---

## 13. unit / unit_id

| Campo | Status |
|-------|--------|
| `residents.unit` | string legado **VERIFIED**; manter no M5 |
| `residents.unit_id` | **ABSENT** |
| Arquitetura §4 | manter `residents.unit` até backfill `unit_id` posterior |

M5 resolve **isolamento por site**, não catálogo de unidades. Não criar `unit_id` neste M.

---

## 14. Índices

Índices live de `residents`: **NOT VERIFIED** (`pg_indexes` indisponível).

Recomendação (não criar agora):

| Índice | Necessário? | Motivo |
|--------|-------------|--------|
| `INDEX (condominium_id)` após a coluna existir | SIM (recomendado) | Lookup por site; padrão M3 `idx_tenant_memberships_condominium_id` |
| `UNIQUE (condominium_id, unit)` | **Não inventar** | Plano M5 não define; app hoje trata `unit` como único **global** (código) |

---

## 15. RLS

**M5 = schema isolation. M13 = authorization/RLS. Não misturar.**

| Item | Evidência |
|------|-----------|
| Policies residents (2026-08-12 D2) | `Allow all` + anon SELECT `USING true` |
| Esta sessão | anon lê 4 residents — **consistente** com policy permissiva ainda ativa |
| org/condo | RLS ON + 0 policies → anon não vê seed piloto |
| Alterar RLS no M5 | **PROIBIDO** / fora de escopo |

Bypass atual de isolamento tenant em `residents` é **pré-existente** (não introduzido pelo M5). Registrar para M13; não corrigir agora.

---

## 16. Login

Fluxo: `unit` string → `residents` (SELECT global) → e-mail → `signInWithPassword`. Sem `condominium_id`.

* ADD nullable: não quebra SELECT atual.  
* `NOT NULL` sem default: **quebra INSERT** em `registerResident`, `saveResident`, `api/accept-resident-invite.ts` (nenhum envia `condominium_id`).

Login dos 4 existentes, após backfill, deve continuar. Cadastro novo exige decisão (app coordenado vs DEFAULT vs adiar NOT NULL).

**NEEDS DECISION.** Código **não** alterado.

---

## 17. Bypasses (somente registro)

| ID | Achado | Severidade |
|----|--------|------------|
| B1 | `listResidents` / `getResidents` / login: SELECT global sem site | **HIGH** (pré-M13) |
| B2 | Unicidade de unidade só no app, global | **MEDIUM** |
| B3 | API HMAC tem `condominium_id` de credencial; residents provider ainda dump global | **HIGH** (`residentsProvider.ts`) |
| B4 | `condominium_id` do cliente em REST de domínio legado | **INFORMATIONAL** (coluna ainda ABSENT) |
| B5 | org/condo invisíveis ao anon; residents visíveis | **CRITICAL** (exposição PII via policy `true`; fora do M5 DDL) |

Não corrigido nesta etapa.

---

## 18. Backup

| Dump | SHA-256 | Bytes | Papel |
|------|---------|-------|-------|
| `backup-pre-m4-2026-08-14-130554.dump` | `060762A1…7BF11` | 515573 | **Pré-M4** (antes do seed). TOC contém TABLE DATA organizations/condominiums/residents. **Não** é pós-M4. |
| `backup-pre-g7c-007-2026-08-15-213436.dump` | `19EA0428…20933` | 534083 | Pós-M4 + G6; pré G7-C |
| `backup-pre-g7j-008-2026-08-15-225729.dump` | `48DD397A…576E76` | 534798 | Pós-M4 + G7-C |
| `backup-pre-g7k-009-2026-08-16-141917.dump` | `0135A7AC…B76C9` | 544406 | **Mais recente no disco** |

`backup-post-m4-*.dump`: **AUSENTE**.

**Recomendado como melhor snapshot pós-M4 / pré-M5 disponível:**  
`backup-pre-g7k-009-2026-08-16-141917.dump`

Limitações:

* não cobre APPLY G7-K (`events.view`) posterior ao dump;
* **não** é snapshot do live **deste** instante pré-M5.

**BLOCKER operacional para APPLY M5:** não há dump contemporâneo do estado atual. Esta auditoria **não** cria backup.

TOC `pg_restore -l` (pré-m4 e pré-g7k): `TABLE public organizations|condominiums|residents` + `TABLE DATA` presentes — dumps **não** estão vazios nessas relações.

---

## 19. Dependências M2–M4

| M | Status para dependência M5 |
|---|----------------------------|
| M1 | CLOSED / PASS (APPLY + CLOSEOUT) |
| M2 | CLOSED / PASS (APPLY + CLOSEOUT) |
| M3 | CLOSED / PASS (APPLY + CLOSEOUT) |
| M4 | **CLOSED / PASS para dependência** — APPLY PASS; seed piloto evidenciado; G6/G7 confirmam 1 org + 1 condo. **`M4-CLOSEOUT` ausente** (informativo, não invalida APPLY). |

M4 **não** populou `residents.condominium_id` (coluna inexistente) nem units (0→0).

---

## 20. DR / decision matrix

| ID | Tema | Classificação |
|----|------|----------------|
| DR-LIVE-PG | COUNT(*) org/condo via postgres nesta sessão | **NOT VERIFIED** |
| DR-RLS-REST | `count=0` REST = RLS, não ausência | **PASS** (esclarecido) |
| DR-COL | `condominium_id` ABSENT | **PASS** (esperado) |
| DR-PILOT-ID | UUID piloto relido live postgres **nesta sessão** | **NOT VERIFIED** |
| DR-BACKFILL | 4 residents → um site, determinístico live | **NOT VERIFIED** |
| DR-ONDELETE | ON DELETE FK | **NEEDS DECISION** (recomendação: RESTRICT) |
| DR-ORGCOL | `organization_id` em residents | **RECOMMENDATION = DO NOT CREATE** (não operador-fechado) |
| DR-NOTNULL | NOT NULL vs INSERTs do app | **BLOCKED** |
| DR-APP-INSERT | INSERT residents sem condominium_id | **BLOCKED** |
| DR-UNITID | não criar `unit_id` no M5 | **PASS** documental |
| DR-BACKUP | POST-M4 PRE-M5 snapshot alinhado | **NOT VERIFIED** |
| DR-M4 | dependência M4 | **PASS** (APPLY + gates postgres-role) |

---

## 21. Blockers

Permanecem (detalhe na §24).

---

## 22. Recomendação

Não criar SQL M5 até SELECT postgres live + decisões ON DELETE / NOT NULL + snapshot pré-APPLY.  
`organization_id` / `unit_id`: não criar no M5.

---

## 23. Classificação final

```text
M5 READINESS = NOT READY
```

---

## 24. M5 BLOCKER RESOLUTION — 2026-08-17

Fonte admin nesta sessão:

| Item | available |
|------|-----------|
| `VITE_SUPABASE_ANON_KEY` em `.env.localnet` | YES (não admin; RLS oculta org/condo) |
| `SUPABASE_SERVICE_ROLE_KEY` em `.env*` do workspace | NO (só placeholder em `.env.example`) |
| `DATABASE_URL` / `DIRECT_URL` | NO |
| `PGPASSWORD` no processo | NO |
| `pgpass` | NO |
| `.env.local` | NO |

Gates anteriores usaram `psql` + `PGPASSWORD` de **sessão** (limpo após o gate; ver M2 CLOSEOUT / G7-J-W-LIVE). Essa credencial **não** está no repositório.

Nenhuma policy foi criada para “ver” org/condo. REST anon **não** foi usado como prova de COUNT.

### Blocker 1 — COUNT real `organizations`

**BLOCKER:** COUNT(*) live nesta sessão.  
**EVIDENCE:** G6-2 PRECHECK LIVE 2026-08-14T20:17Z `psql` postgres: `organizations_rows = 1`. G6-2 CLOSEOUT: `organizations EXISTS rows=1 pilot(qualivida-admin)=1`. G6-1 APPLY/CLOSEOUT iguais. Nenhuma migration posterior faz `INSERT INTO public.organizations` (único INSERT = M4 seed).  
**STATUS:** histórico postgres-role **VERIFIED (2026-08-14)**; live **2026-08-17 NOT VERIFIED**.  
**REMAINING ACTION:** SELECT postgres `COUNT(*) FROM public.organizations`.

### Blocker 2 — COUNT real `condominiums`

**BLOCKER:** COUNT(*) live nesta sessão.  
**EVIDENCE:** G6-2 PRECHECK: `condominiums_rows = 1`, `condo_pilot_rows (slug=qualivida-club-residence) = 1`. CLOSEOUT G6-2: `rows=1 pilot(qualivida-club-residence)=1`. Único INSERT em `public.condominiums` no repo = M4.  
**STATUS:** histórico **VERIFIED (2026-08-14)**; live 2026-08-17 **NOT VERIFIED**.  
**REMAINING ACTION:** SELECT postgres `COUNT(*) FROM public.condominiums`.

### Blocker 3 — piloto `qualivida-club-residence` live

**BLOCKER:** slug não relido nesta sessão.  
**EVIDENCE:** M4 SQL insere `slug='qualivida-club-residence'`, `vertical='condominium'`, `name='Qualivida Club Residence'`. G6-2 PRECHECK `condo_pilot_rows = 1`.  
**STATUS:** seed + last postgres COUNT **VERIFIED historically**; live **NOT VERIFIED**.  
**REMAINING ACTION:** `SELECT id, slug, organization_id, vertical FROM condominiums WHERE slug = 'qualivida-club-residence'`.

### Blocker 4 — UUID histórico

**BLOCKER:** UUIDs não relidos via postgres nesta sessão.  
**EVIDENCE:** M4 APPLY NOTICE + pós-APPLY:

- organization `0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928` slug `qualivida-admin`
- condominium `3f383313-5ec0-4d21-97c7-1b2500c933be` org FK = org acima, vertical `condominium`, slug `qualivida-club-residence`

Reuso posterior (não é COUNT; IDs de tenant do piloto): G7-J-W-LIVE 2026-08-15, G7-H-B, `sentinela/core/context.ts`, harness n8n.  
**STATUS:** captura M4 **VERIFIED**; revalidação live **NOT VERIFIED**.  
**REMAINING ACTION:** SELECT por `id` igual aos UUIDs M4.

### Blocker 5 — backfill 4 residents

**BLOCKER:** mapeamento live não determinístico sem COUNT=1 relido.  
**EVIDENCE:**

- M4 **não** faz UPDATE/INSERT em `residents` (SQL: “NÃO faz … users/staff/residents”).
- Arquitetura §14: 4 residents = dados do primeiro tenant.
- M4 APPLY: `residents: 4 → 4`.
- REST 2026-08-17: **4** residents (id+unit) — VERIFIED.
- Contrato: se ainda existir **exatamente 1** condominium piloto, os 4 recebem o mesmo `condominium_id`.

**BACKFILL = NOT VERIFIED** (não PASS).  
**STATUS:** UNRESOLVED até COUNT live.  
**REMAINING ACTION:** SELECT postgres COUNT condo=1 + JOIN simulado.

### Blocker 6 — ON DELETE

**BLOCKER:** decisão não fechada por operador.  
**EVIDENCE:** FKs tenant M1–M3 e G6: `ON DELETE RESTRICT`. CASCADE apagaria moradores com o site. SET NULL conflita com NOT NULL do plano M5.  
**RECOMMENDATION = RESTRICT**  
**STATUS:** **NEEDS DECISION**  
**REMAINING ACTION:** aceite explícito RESTRICT.

### Blocker 7 — NOT NULL vs app

**BLOCKER:** INSERT legítimo sem `condominium_id`.  
**EVIDENCE (somente mapa, sem correção):**

| Caminho | Operação | `condominium_id` |
|---------|----------|------------------|
| `services/residentAuth.ts` `registerResident` | `.insert({ name, unit, email, … })` | ausente |
| `services/dataService.ts` `saveResident` → `createData('residents')` | insert novo | ausente |
| `App.tsx` modal salvar / `handleImportResidents` | `saveResident` | ausente |
| `api/accept-resident-invite.ts` | `.insert({ name, unit, email, … })` | ausente |

```text
APP INSERT COMPATIBILITY = BLOCKED
NOT NULL = BLOCKED
```

**STATUS:** **BLOCKED**  
**REMAINING ACTION:** adiar NOT NULL, DEFAULT piloto (arriscado), ou alterar app (fora desta auditoria).

### Blocker 8 — backup pós-M4 / pré-M5

**BLOCKER:** snapshot alinhado ausente.  
**EVIDENCE:** `backup-pre-m4` é **pré-seed**. `backup-pre-g7k-009` é o mais recente, mas é pré-G7-K APPLY (não cobre `events.view`) e não se chama pós-M4. Nenhum `backup-post-m4-*.dump`.  

```text
POST-M4 PRE-M5 SNAPSHOT = NOT VERIFIED
```

Melhor dump **disponível** (não equivalente a alinhado): `backup-pre-g7k-009-2026-08-16-141917.dump`.  
**STATUS:** **NOT VERIFIED**  
**REMAINING ACTION:** dump postgres imediato pré-APPLY M5 (não nesta etapa).

### organization_id (não era blocker de COUNT)

```text
RECOMMENDATION = DO NOT CREATE
```

Isolamento Operaut de residents = `condominium_id` (transitivo org via `condominiums`). Coluna org duplicada = risco DR7 M3. Sem necessidade técnica comprovada no M5.

### M4 seed (contrato)

| Campo | Valor |
|-------|--------|
| org name | Empresa/Administradora piloto |
| org slug | `qualivida-admin` |
| condo name | Qualivida Club Residence |
| condo slug | `qualivida-club-residence` |
| vertical | `condominium` |
| residents no seed | **nenhum** (legado 4 permanece; associação = M5) |
| relação | org 1 → condo 1; residents ainda sem FK site |

---

## 25. Resident Creation/Import Compatibility

**Data:** 2026-08-17  
**Modo:** somente leitura de código. Nenhuma correção.

`types.Resident` **não** possui `condominium_id` / `organization_id`.  
Sessão UI (`App.tsx` / sessionStorage) guarda `currentResident` e `role`; **não** guarda site.

### 25.1 Inventário de fluxos

| Fluxo | Arquivo | Função | Linhas (aprox.) | Origem dos dados | Tabela | Operação |
|-------|---------|--------|-----------------|------------------|--------|----------|
| Auto-cadastro | `components/ResidentRegister.tsx` → `services/residentAuth.ts` | `handleRegister` → `registerResident` | 43–130 / 12–111 | Formulário público (não autenticado) | `public.residents` | **INSERT** (após `auth.signUp`) |
| CRUD staff | `App.tsx` → `services/dataService.ts` → `offlineDataService.ts` | `handleSaveResident` → `saveResident` → `createData` / `updateData` | 2046–2077 / 388–437 / 150–181 | Modal autenticado (síndico/portaria) | `public.residents` | **INSERT** se `id` vazio/`temp-*`; senão **UPDATE** |
| Import arquivo | `ImportResidentsModal.processImportFile` → `App.handleImportResidents` → `saveResident` | CSV/JSON/PDF parse + loop | 64+ / 2107–2116 | Arquivo (csv/json/pdf) | `public.residents` | **INSERT** (ids `temp-*`) |
| Convite | `createResidentInvite` → `AcceptResidentInvitePage` → `api/accept-resident-invite.ts` | insert invite; POST accept | `dataService.ts` 1840–1874; page ~96; API 90–179 | Staff cria invite (e-mail); morador envia name/unit/password | `resident_invites` + `residents` | Invite **INSERT**; resident **INSERT** (fallback **UPDATE** se 23505) |

Não há RPC nem Edge Function de domínio para criar resident. API de convite = handler Node (`runtime: nodejs`) com **service_role**.

---

### 25.2 registerResident — BLOCKED FOR NOT NULL

**Quem chama:** `ResidentRegister` (tela pública; `App.tsx` ~3985 quando `showResidentRegister`).  
**Condomínio:** **não existe** no fluxo. Não vem do usuário, sessão, parâmetro nem inferência. Unicidade checada por `unit` **global** (`select id, unit` de toda a tabela).

| FIELD | SOURCE | REQUIRED | CURRENTLY SENT | M5 IMPACT |
|-------|--------|----------|----------------|-----------|
| `name` | form | sim | sim | — |
| `unit` | form (normalizeUnit) | sim | sim | não é site-id |
| `email` | form | sim | sim | — |
| `phone` / `whatsapp` | form | não | sim | — |
| `extra_data` | form (cpf, veículo) | cpf na UI | sim | — |
| `auth_user_id` | `signUp` | sim (fluxo) | sim | — |
| `id` | default DB | — | não | — |
| **`condominium_id`** | **nenhum** | **M5 NOT NULL exigiria** | **não** | **INSERT falha se NOT NULL sem default** |
| `organization_id` | nenhum | não (M5 rec. omitir) | não | — |

**Classificação:** `BLOCKED FOR NOT NULL` / **BLOCKED FOR M5**

---

### 25.3 saveResident / import — BLOCKED FOR NOT NULL

**CREATE (modal):** `handleSaveResident` monta `Resident` só com name/unit/email/phone/whatsapp/extraData; id `temp-*` se novo.  
**CREATE (import):** `processImportFile` lê `nome`/`unidade`/`email` (csv/json/pdf); **sem** campo condomínio. Loop chama `saveResident` com `temp-` id → INSERT.  
**UPDATE:** perfil morador (`App.tsx` ~516) e edição no modal — UPDATE dos mesmos campos; ainda **sem** `condominium_id`. UPDATE de linha já backfillada sobreviveria a NOT NULL; **CREATE não**.

| Caminho | CREATE/UPDATE | SOURCE OF CONDOMINIUM | CAN BE NULL? | M5 COMPATIBILITY |
|---------|---------------|----------------------|--------------|------------------|
| Modal novo morador | CREATE | nenhum | sim (campo inexistente) | BLOCKED FOR NOT NULL |
| Import CSV/JSON/PDF | CREATE (bulk) | nenhum | sim | BLOCKED FOR NOT NULL |
| Modal/perfil edição | UPDATE | nenhum | n/a se row já tiver valor | UPDATE ok **após** backfill; CREATE permanece bloqueado |
| Outbox offline `createData` | INSERT enfileirado | payload sem site | sim | mesmo blocker |

**Há caminho que cria resident sem site?** **SIM** — todos os CREATEs acima.

**Classificação:** `BLOCKED FOR NOT NULL` / **BLOCKED FOR M5**

---

### 25.4 accept-resident-invite — BLOCKED FOR NOT NULL

**Geração do convite:** `createResidentInvite` / `createResidentInvitesBulk` (`dataService.ts`). INSERT em `resident_invites`: `email`, `token`, `expires_at`, `created_by`.  
**Schema** (`20250226100000_resident_invites.sql`): **sem** `condominium_id`, **sem** `organization_id`.

**Aceite:** `AcceptResidentInvitePage` POST `{ token, name, unit, password }` — `unit` e `name` vêm do **cliente**. E-mail vem do convite (servidor).  
**Criação:** `admin.createUser` + `residents.insert({ name, unit, email, phone: null, whatsapp: null, auth_user_id })`. Sem site. Fallback UPDATE por `auth_user_id` também **não** seta condomínio.

**Vínculo prévio com condominium?** **Não** no convite.  
**User autenticado determina o site?** **Não** — aceite é público via token; staff `created_by` é texto, não FK de site.  
**Condomínio determinístico pelo código atual?** **Não**.

**Classificação:** `BLOCKED FOR NOT NULL` / **BLOCKED FOR M5**

---

### 25.5 Tabela de compatibilidade

| Fluxo | Determina site hoje? | Cria sem condominium_id? | READY / BLOCKED |
|-------|----------------------|---------------------------|-----------------|
| registerResident | não | sim (INSERT) | **BLOCKED FOR M5** |
| saveResident CREATE / import | não | sim (INSERT) | **BLOCKED FOR M5** |
| saveResident UPDATE | não | n/a (não insere) | não desbloqueia NOT NULL |
| accept-resident-invite | não | sim (INSERT) | **BLOCKED FOR M5** |

```text
NOT NULL FEASIBILITY = BLOCKED
```

---

### 25.6 Bypasses / spoofing (sem correção)

```text
CLIENT-CONTROLLED TENANT CONTEXT = NOT FOUND
```

Nenhum desses INSERTs envia `condominium_id` hoje (tipo e payloads não incluem o campo).

Riscos relacionados (não são `condominium_id` do cliente):

* `unit` é **controlado pelo cliente** em register, import, invite accept e modal.
* register é **não autenticado** + SELECT global de `residents`.
* Invite accept usa **service_role** (bypassa RLS) e grava `unit` do body.
* API v1 HMAC **não** é usada nestes fluxos de cadastro de morador.

Se no futuro o app passar a aceitar `condominium_id` no body sem binding de membership, isso seria spoofing — **não implementado agora**.

---

### 25.7 Opções arquiteturais (não escolhidas / não implementadas)

| Opção | Segurança | Multi-tenant | Spoofing | Frontend | Backend | M5 |
|-------|-----------|--------------|----------|----------|---------|-----|
| **A** contexto do usuário (membership ativa) | alta se membership M11+ | boa | baixo se servidor resolve | precisa sessão/site | AuthZ + lookup | INSERT pode preencher; **app ainda não tem membership no login morador** |
| **B** `condominium_id` explícito no cliente | baixa se não validar | aparente | **alto** | mudar forms/import | validar vs membership | desbloqueia NOT NULL só com validação |
| **C** derivar org→site | média | só se 1 site/org | médio | pouco | JOIN | falha com multi-site |
| **D** gravar `condominium_id` no `resident_invites` na criação (staff) | alta se staff scoped | boa para convite | baixo no accept | criar convite precisa site | ALTER invites (fora M5) | convite READY; register/import **não** |
| **E** DEFAULT SQL = piloto | baixa pós-piloto | **quebra** isolamento | n/a | nenhum | DEFAULT perigoso | desbloqueia INSERT no piloto só |
| **F** M5 só nullable; NOT NULL depois do app | n/a | adia isolamento rígido | n/a | nenhum agora | migration em duas fases | **alinha ao blocker atual** sem fingir READY |

Nenhuma opção aplicada. Nenhuma escolhida automaticamente.

---

### 25.8 Conclusão §25

Possível solução futura **não** torna M5 READY.

```text
REGISTER RESIDENT = BLOCKED
SAVE RESIDENT/IMPORT = BLOCKED
ACCEPT RESIDENT INVITE = BLOCKED
NOT NULL FEASIBILITY = BLOCKED
M5 READINESS = NOT READY
```

---

## Consultas executadas nesta sessão (somente SELECT / TOC)

```text
REST GET /rest/v1/this_table_does_not_exist          → 404 PGRST205
REST GET /rest/v1/organizations?select=id,slug       → 200 */0
REST GET /rest/v1/organizations?slug=eq.qualivida-admin → 200 */0
REST GET /rest/v1/organizations?select=vertical      → 400 42703
REST GET /rest/v1/condominiums?select=id,slug,organization_id,vertical → 200 */0
REST GET /rest/v1/condominiums?slug=eq.qualivida-club-residence → 200 */0
REST GET /rest/v1/residents?select=id,unit           → 200 0-3/4
REST GET /rest/v1/residents?select=condominium_id    → 400 42703
REST GET /rest/v1/residents?select=organization_id   → 400 42703
REST GET /rest/v1/residents?select=unit_id           → 400 42703
REST GET /rest/v1/units?select=id,code,condominium_id → 200 */0
REST GET /rest/v1/tenant_memberships?select=id,condominium_id → 200 */0
pg_restore -l backup-pre-m4-*.dump
pg_restore -l backup-pre-g7k-009-*.dump
psql postgres@db…  → ABORTADO (sem senha; processo encerrado)
```

Nenhum INSERT/UPDATE/DELETE/ALTER/CREATE/DROP.
