# PRE-M1 GATE AUDIT — 2026-08-12

**Tipo:** Gate 0 — auditoria e preparação pré-M1 (READ-ONLY)  
**Data/hora da auditoria:** 2026-08-12 17:03:20 -03:00 (`2026-08-12T20:03:20Z`)  
**Commit inspecionado:** `7ee0131` (`chore: protect local environment secrets`)  
**Baseline tag:** `pre-multitenant-baseline` → `f630726` (**intacta**)  
**Escopo:** preparação para evidências D1/D2/D5 + backup — **sem** execução de DDL/DML, sem migrations, sem alteração de RLS/Storage/código

**Classificações:** PASS | FAIL | PENDING | NOT APPLICABLE

---

## Resumo executivo

| Área | Status |
|------|--------|
| Project ref de produção identificado | **PASS** (`zaemlxjwhzrfmowbckmk`) |
| Scripts D1/D2/D5 prontos (read-only) | **PASS** |
| Evidências D1/D2/D5 **executadas** | **PENDING** |
| Backup verificável **comprovado** | **PENDING** |
| Pasta `docs/evidence/results/` | **PENDING** (ausente) |
| Risco de projeto errado | **PASS** com mitigação (há refs legadas em docs antigos) |
| Pronto para **executar** D1/D2/D5 manualmente? | **SIM** (feito pelo operador) |
| Pronto para **aprovar** gates / liberar M1? | **NÃO** (D2/D5 FAIL; backup PENDING) |

---

## 1. Project ref de produção

| Campo | Valor |
|-------|-------|
| **Classificação** | **PASS** |
| **Evidência** | Bundle de produção `https://qualivida-club-residence.vercel.app/assets/index-BrROEMGa.js` (LEN≈3.2MB) contém host `zaemlxjwhzrfmowbckmk` e **não** contém `asfcttxrrfwqunljorvm` (verificação HTTP read-only nesta auditoria, 2026-08-12T20:03Z) |
| **Origem** | Deploy Vercel ativo + cruzamento com `.env.localnet` (URL host = `zaemlxjwhzrfmowbckmk`) + `docs/FASE-0-DIAGNOSTICO-PRODUCAO.md` |
| **Data/hora** | Reconfirmação: 2026-08-12; evidência Fase 0: 2026-08-08 (mesmo asset `index-BrROEMGa.js`) |
| **Project ref** | `zaemlxjwhzrfmowbckmk` |
| **Risco** | Baixo para identificação; médio se operador abrir SQL Editor em outro projeto |
| **Ação necessária** | Antes de D1/D2/D5: no Dashboard Supabase, confirmar URL do projeto = `https://zaemlxjwhzrfmowbckmk.supabase.co` |

### Notas de comparação (não invalidam o PASS)

| Fonte | Ref observada | Papel |
|-------|---------------|-------|
| Bundle Vercel produção | `zaemlxjwhzrfmowbckmk` | **Produção real** |
| `.env.localnet` (local) | `zaemlxjwhzrfmowbckmk` | Ambiente local alinhado à prod |
| `.env.production` (repo) | placeholder / não é a fonte do bundle | **Não** usar como prova de produção |
| Docs legados (`CORRIGIR_URL_SUPABASE.md`, `URGENTE_VERCEL_FIX.md`) | mencionam `asfcttxrrfwqunljorvm` | **Histórico/desatualizado** — risco de confusão humana |

---

## 2. Inventário `docs/evidence/`

| Item | Classificação | Evidência | Origem | Data | Project ref | Risco | Ação |
|------|---------------|-----------|--------|------|-------------|-------|------|
| `D1-RLS-LIVE.sql` | **PASS** (script) | Existe; só `SELECT`; ref no header | evidence | 2026-08-12 | `zaemlxjwhzrfmowbckmk` | Baixo | Executar manualmente |
| `D2-STORAGE-LIVE.sql` | **PASS** (script) | Existe; só `SELECT` em `pg_policies` | evidence | 2026-08-12 | idem | Baixo | Executar manualmente |
| `D5-STORAGE-EVIDENCE.sql` | **PASS** (script) | Existe; só `SELECT` em `storage.buckets` | evidence | 2026-08-12 | idem | Baixo | Executar manualmente |
| `BACKUP-VERIFICAVEL.md` | **PASS** (procedimento) | Procedimento coerente Dashboard/`pg_dump`/manifesto | evidence | 2026-08-12 | idem | Médio (credenciais manuais) | Seguir manualmente; não automatizar aqui |
| `README.md` | **PASS** (mapa) | Declara D1/D2/D5/backup e status PENDENTE | evidence | 2026-08-12 | idem | Nenhum | Atualizar após coletar resultados |
| `PRE-M1-GATE-STATUS.md` | **PASS** (status doc) | Espelha gates pendentes | evidence | 2026-08-12 | — | Nenhum | Atualizar após evidências |
| `results/` | **PENDING** | Pasta **inexistente** | — | — | — | Alto p/ aprovação | Criar ao arquivar saídas |
| Resultados D1/D2/D5 `*.txt` | **PENDING** | COUNT = 0 | — | — | — | Bloqueia PASS dos gates | Gerar na execução manual |
| `BACKUP-MANIFEST-*` | **PENDING** | COUNT = 0 | — | — | — | Bloqueia backup PASS | Coletar snapshot/dump + manifesto |

**Importante:** scripts = **CONFIGURADO**. Resultados = **ainda não COMPROVADO**.

---

## 3. Prontidão dos scripts D1 / D2 / D5

| Critério | D1 | D2 | D5 |
|----------|----|----|-----|
| Arquivo presente | PASS | PASS | PASS |
| Somente leitura (sem CREATE/ALTER/DROP/INSERT/UPDATE/DELETE/GRANT/REVOKE no corpo) | **PASS** | **PASS** | **PASS** |
| Project ref no header | PASS | PASS | PASS |
| Instruções de export | PASS | PASS | PASS |
| Resultado arquivado | **PENDING** | **PENDING** | **PENDING** |
| **Pronto para execução manual** | **SIM** | **SIM** | **SIM** |

### Cobertura vs domínio (documentação / código)

| Tabela usada no app (amostra `services/*`) | Em D1/D2? | Nota |
|--------------------------------------------|-----------|------|
| `users`, `staff`, `residents`, `packages`, `package_items`, `occurrences`, `notifications`, `roles`, `permissions`, `role_permissions`, `boletos`, … | SIM | OK para gate mínimo |
| `visitors` | **NÃO** | Usada em `dataService.ts` — lacuna de cobertura (não impede executar D1; recomenda extensão futura) |
| `chat_messages`, `notes`, `crm_*` | **NÃO** | Citadas no plano M8; fora do script atual |

| Campo | Valor |
|-------|-------|
| **Classificação cobertura** | **PASS** para gate mínimo Anexo D; **PENDING**/melhoria para inventário completo |
| **Risco** | Médio se confiar só em D1 para “todo o schema” — D1 é lista prioritária, não dump completo |
| **Ação** | Executar D1/D2/D5 como estão; opcionalmente complementar com visitors depois |

---

## 4. Procedimento de backup

| Campo | Valor |
|-------|-------|
| **Classificação (documento)** | **PASS** — coerente com objetivo pré-M1 |
| **Classificação (execução comprovada)** | **PENDING** |
| **Evidência** | `BACKUP-VERIFICAVEL.md`: schema+dados+policies+funções+Storage; restore só em ambiente separado; manifesto com hash/ID |
| **Origem** | `docs/evidence/BACKUP-VERIFICAVEL.md` |
| **Data** | 2026-08-12 |
| **Project ref** | `zaemlxjwhzrfmowbckmk` |
| **Risco** | Alto se M1 sem backup; médio se Dashboard PITR existir mas sem manifesto arquivado |
| **Ação necessária** | Operador: snapshot/`pg_dump` + `BACKUP-MANIFEST-YYYY-MM-DD.md`; restore test fora de prod |

**Não são evidência de backup de banco:** `ImportBoletosModal.tsx.backup`, `node_modules.bak`.

---

## 5. Evidência histórica reutilizável

| Item | Classificação | Pode reutilizar como PASS do gate? | Motivo |
|------|---------------|-------------------------------------|--------|
| Fase 0: conclusão Vercel = `zaemlxjwhzrfmowbckmk` | PASS (identidade) | **SIM** para project ref (reconfirmado hoje) | Bundle ainda `index-BrROEMGa.js` + HAS_ZAEM |
| Fase 0: “export `pg_policies` **Não executado**” | PENDING | **NÃO** | Explicitamente sem export live |
| Fase 0: listagem Storage via anon / bucket `boletos` | Histórico documental | **NÃO** para D2/D5 | Não é export `pg_policies` / `storage.buckets` SQL |
| Fase 0: contagens anon / RBAC | Histórico | **NÃO** para RLS live ON/OFF | Não substitui `relrowsecurity` |
| Scripts migrations repo (policies `USING (true)`) | CONFIGURADO no repo | **NÃO** | É schema versionado, não estado live |
| Addendum Operaut / M1–M16 | Spec | **NOT APPLICABLE** aos gates RLS/Storage/Backup | Não são evidência de execução |

---

## 6. Risco de executar no projeto errado

| Campo | Valor |
|-------|-------|
| **Classificação** | **PASS** (mitigado se checklist abaixo for seguida) / risco residual **FAIL** se ignorada |
| **Evidência** | Docs legados citam `asfcttxrrfwqunljorvm`; produção comprovada é `zaemlxjwhzrfmowbckmk` |
| **Origem** | Bundle Vercel 2026-08-12; `CORRIGIR_URL_SUPABASE.md` / `URGENTE_VERCEL_FIX.md` |
| **Risco** | **Alto** se SQL Editor aberto no projeto antigo/errado — evidências inválidas ou vazias |
| **Ação necessária (checklist operador)** | 1) Dashboard → projeto cujo ref = `zaemlxjwhzrfmowbckmk` 2) Conferir Settings → API → Project URL 3) Só então colar D1/D2/D5 4) Anotar ref no arquivo de resultado |

---

## 7. Comparação documentação × schema conhecido × código × evidência

| Dimensão | Achado | Classificação |
|----------|--------|---------------|
| Docs Fase 1 + Operaut | Isolamento site/`condominium_id`; M1 bloqueada; Operations Core fora M1–M16 | **PASS** (coerência documental) |
| Código `services/supabase.ts` | Client único via `VITE_SUPABASE_*` | **PASS** |
| Código domínio | Tabelas operacionais sem `condominium_id` ainda | **PASS** (esperado pré-M1) |
| Scripts evidence | Alinhados Anexo D; read-only | **PASS** |
| Resultados evidence | Ausentes | **PENDING** |
| Schema live | Desconhecido nesta auditoria (sem SQL executado) | **PENDING** |
| Policies live vs migrations repo | Possível divergência (Fase 0 já alertou) | **PENDING** até D1/D2 |

---

## 8. O que ainda impede PASS dos gates

| Gate | Status aprovação | Bloqueador concreto |
|------|------------------|---------------------|
| RLS live | **PENDING** | Sem arquivo de resultado D1 (e idealmente policies D2 public) |
| Storage live | **PENDING** | Sem resultados D2 (`storage.objects`) + D5 (`storage.buckets`) |
| Backup verificável | **PENDING** | Sem manifesto + snapshot/dump comprovável |
| M1 | **BLOQUEADA** | Gates acima + aceite Operaut + autorização explícita |

Nenhum item acima é **FAIL** por evidência negativa testada: são **PENDING** por **ausência de prova de execução**.

---

## Matriz consolidada de itens auditados

| # | Item | Classificação |
|---|------|---------------|
| A1 | Project ref produção = `zaemlxjwhzrfmowbckmk` | **PASS** |
| A2 | `.env.production` como fonte de verdade prod | **FAIL** (não confiável / placeholder) — usar bundle/Dashboard |
| A3 | Scripts D1/D2/D5 existem | **PASS** |
| A4 | Scripts D1/D2/D5 são read-only | **PASS** |
| A5 | Resultados D1/D2/D5 existem | **PENDING** |
| A6 | Backup procedimento documentado | **PASS** |
| A7 | Backup executado/verificado | **PENDING** |
| A8 | Evidência histórica substitui D1/D2/D5 | **FAIL** (não substitui) |
| A9 | Risco projeto errado documentado | **PASS** (alerta) |
| A10 | Cobertura D1 inclui 100% tabelas do app | **PENDING** / parcial (`visitors` ausente) |
| A11 | Git baseline intacto | **PASS** |
| A12 | Alterações destrutivas nesta auditoria | **NOT APPLICABLE** / NÃO ocorreram |
| A13 | Pronto para **rodar** D1/D2/D5 | **PASS** (preparação) |
| A14 | Pronto para **aprovar** gates | **FAIL** / **PENDING** (sem resultados) → gates **não aprovados** |

---

## Conclusão — prontidão para executar D1/D2/D5

**SIM — estamos prontos para a execução manual dos scripts de evidência**, desde que:

1. SQL Editor no projeto **`zaemlxjwhzrfmowbckmk`** (não `asfcttxrrfwqunljorvm`);
2. Executar **somente** `D1-RLS-LIVE.sql`, `D2-STORAGE-LIVE.sql`, `D5-STORAGE-EVIDENCE.sql`;
3. Arquivar saídas em `docs/evidence/results/` com UTC + responsável + project ref;
4. Em paralelo (ou em seguida), seguir backup verificável.

**NÃO** estamos prontos para marcar gates como PASS nem para autorizar M1.

---

## Gate 0.1 — complemento (2026-08-12)

Auditorias: [PROJECT-REF-AUDIT-2026-08-12.md](./PROJECT-REF-AUDIT-2026-08-12.md) · [STAFF-INVITES-AUDIT-2026-08-12.md](./STAFF-INVITES-AUDIT-2026-08-12.md)

### Achados — project ref

| Item | Classificação | Evidência |
|------|---------------|-----------|
| Produção = `zaemlxjwhzrfmowbckmk` | **PASS** | Bundle `index-BrROEMGa.js` HAS_ZAEM=True, HAS_ASFC=False |
| Scripts D1/D2/D5 → `zaem…` | **PASS** | Headers + README evidence |
| Config **ativa** → `asfct…` | **PASS** (ausente) | `.env*` presentes sem old ref; migrations/scripts/api sem old ref |
| Docs legados com `asfct…` | **PENDING** risco humano | `CORRIGIR_URL_SUPABASE.md`, `URGENTE_VERCEL_FIX.md`, `VERCEL_DEPLOY.md`, `SOLUCAO_VERCEL.md` |
| `.env.production` como verdade | **FAIL** | Não contém ref de produção confiável |

### Achados — staff_invites

| Item | Classificação | Evidência |
|------|---------------|-----------|
| Esclarecimento `D1_CONTAINS_staff_invites` | **PASS** | Flag do Gate 0 = lista do **script D1**, não “segredo no bundle” |
| Bundle contém nome `staff_invites` / `staff-invite` | **SAFE** | Feature/código; sem evidência de tokens reais embutidos |
| Schema + token plaintext + RLS admin global | **REVIEW REQUIRED** | Migrations + `dataService` / API |
| Tenant-scoped | **REVIEW REQUIRED** / ausente | Sem `condominium_id` |
| Policies **live** | **UNKNOWN** | Aguarda D2 — **status D2 permanece PENDING** |

### Decisão formal Gate 0.1

Critérios:

1. Project ref inequivocamente confirmado → **SIM**  
2. Sem configuração ativa no projeto errado → **SIM**  
3. `staff_invites` classificado → **SIM** (SAFE bundle / REVIEW REQUIRED desenho)  
4. Sem evidência de segredo/token exposto exigindo bloqueio imediato → **SIM**

### `READY FOR D1/D2/D5`

Preparação para execução manual: **SIM** (Gate 0.1).  
Coleta live pelo agente (2026-08-12T20:35:21Z): **bloqueada** — ver seção seguinte.

**Gates D1/D2/D5 como aprovação de conteúdo live:** **PENDING** (sem linhas de `pg_class` / `pg_policies` / `storage.buckets`).  
**M1:** continua **BLOQUEADA**.

---

## Coleta D1/D2/D5 — LIVE arquivada (operador) 2026-08-12

| Item | Valor |
|------|-------|
| Project ref | `zaemlxjwhzrfmowbckmk` |
| Fonte | SQL Editor (operador) — resultados colados e arquivados no repo |
| Timestamp UTC (arquivamento) | 2026-08-12T20:49:00Z |
| Artefatos | `results/D1-RLS-LIVE-2026-08-12.txt` · `D2-STORAGE-LIVE-2026-08-12.txt` · `D2-STORAGE-LIVE-2026-08-12-RAW.txt` · `D5-STORAGE-EVIDENCE-2026-08-12.txt` |

### Classificação (conteúdo live)

| Gate | Status | Motivo |
|------|--------|--------|
| **D1 RLS** | **PASS** | 19/19 tabelas prioritárias com `rls_enabled=true` (`rls_forced=false`) |
| **D2 Storage/Policies** | **FAIL** | Policies `{public}` com `qual/with_check = true` em massa (users, staff, residents, packages Allow all, boletos, notices, notifications, occurrences, areas, app_config, reservations, package_items); `packages` Allow all anula policies staff/resident (PERMISSIVE OR); `storage.objects` `boletos_read_all` para `{public}`; sem tenant scope |
| **D5 Storage/Buckets** | **FAIL** | Único bucket retornado `boletos` com `public=true` |

### Staff Invites (LIVE — D2)

| Campo | Valor |
|-------|-------|
| Policy LIVE | `staff_invites_insert_admin` / `staff_invites_select_admin` → `is_admin_for_staff_invites()` (authenticated) |
| Tenant scope | **AUSENTE** |
| Risco | **REVIEW REQUIRED** — SELECT admin global de convites (token plaintext no schema); não corrigido nesta etapa |

### Gate agregado pré-M1 (RLS/Storage)

| Gate agregado | Status |
|---------------|--------|
| RLS live (flag ON) | **PASS** (D1) |
| RLS efetivo / policies | **FAIL** (D2) |
| Storage live | **FAIL** (D2 + D5) |
| Backup verificável | **PENDING** |
| M1 autorizada | **NÃO** |

### Próximo bloqueio

1. **Backup verificável** ainda PENDING (obrigatório antes de M1).  
2. D2/D5 em **FAIL** = postura de segurança inadequada para multi-tenant; **não** corrigir RLS/Storage nesta etapa de gates — registrar como dívida / bloqueio de go-live multi-tenant.  
3. Decisão de negócio: se M1 (só CREATE org/condo sem apertar RLS) pode seguir após backup, ou se exige plano de remediação RLS **antes** de M1 — **fora do escopo desta coleta**; M1 permanece não autorizada até gates + autorização explícita.  
4. Não executar M1, migrations, nem correção de `staff_invites` agora.

---

## Declaração de alterações (arquivamento live)

| Item | Valor |
|------|-------|
| **Arquivos** | Resultados D1/D2/D5 + atualização deste audit |
| **Banco alterado** | **NÃO** |
| **Migrations** | **NÃO** |
| **RLS alterado** | **NÃO** |
| **Storage alterado** | **NÃO** |
| **Código funcional** | **NÃO** |
| **Deploy** | **NÃO** |

---

*Evidências live arquivadas. Correções NÃO aplicadas. Parar aqui.*

---

## POST-R2A-MIN — 2026-08-13

**Tipo:** reauditoria READ-ONLY D2/D5 após alegada execução da R2A-MIN  
**Project ref:** `zaemlxjwhzrfmowbckmk`  
**Nada alterado nesta seção** (banco, Storage, RLS, migrations, código, M1)

Arquivos históricos **preservados** (não substituídos):

- `results/D1-RLS-LIVE-2026-08-12.txt`
- `results/D2-STORAGE-LIVE-2026-08-12.txt` (+ RAW)
- `results/D5-STORAGE-EVIDENCE-2026-08-12.txt`
- `results/R1-PACKAGES-POST-2026-08-12.txt`

Novos artefatos (coleta 2026-08-13 **sem** SQL Editor):

- `results/D2-STORAGE-LIVE-2026-08-13.txt`
- `results/D5-STORAGE-EVIDENCE-2026-08-13.txt`
- `results/R2A-MIN-LIVE-2026-08-13.txt` (tentativa de execução do agente: **não aplicada**)

### Esperado se R2A-MIN tivesse sido aplicada e verificada via SQL

| Check | Esperado |
|-------|----------|
| `storage.buckets` `boletos.public` | `false` |
| `boletos_read_all` | **ausente** |
| SELECT Storage boletos | `boletos_select_authenticated` / `{authenticated}` / `bucket_id='boletos'` |
| INSERT | `boletos_insert_authenticated` inalterada |
| UPDATE | `boletos_update_authenticated` inalterada |

### O que foi possível medir

| Fonte | Resultado |
|-------|-----------|
| `D2-STORAGE-LIVE.sql` (`pg_policies`) | **não executado** — sem postgres no ref alvo |
| `D5-STORAGE-EVIDENCE.sql` (`storage.buckets`) | **não executado** |
| Probe anon `POST /storage/v1/object/list/boletos` | HTTP **200**, prefixo `original` — **não** substitui D2/D5; sinal incompatível com SELECT só autenticado |

### Classificação (2026-08-13)

| Gate | Status | Motivo |
|------|--------|--------|
| **D2** | **PENDING** | Sem linhas live de `pg_policies`. Não declarar PASS. |
| **D5** | **PENDING** | Sem coluna `public` live. Não declarar PASS. |
| Staff invites | **REVIEW REQUIRED** (inalterado; último SQL = D2 2026-08-12) | Sem recoleta |
| Backup verificável | **PENDING** | Sem manifesto novo |
| **M1** | **NÃO** | Gates incompletos + autorização M1 ausente |

D1 2026-08-12 permanece **PASS** (19/19 RLS ON) — não reexecutado nesta reauditoria.

### Como fechar PENDING → PASS/FAIL real

No SQL Editor de `zaemlxjwhzrfmowbckmk`, executar somente:

1. `docs/evidence/D2-STORAGE-LIVE.sql`
2. `docs/evidence/D5-STORAGE-EVIDENCE.sql`

Colar a saída integral nos arquivos `*-2026-08-13.txt` (substituir o conteúdo PENDING deste agente, **sem** apagar os `*-2026-08-12.txt`).

---

## Declaração de alterações (reauditoria 2026-08-13)

| Item | Valor |
|------|--------|
| Banco alterado | **NÃO** |
| Storage alterado | **NÃO** |
| RLS alterado | **NÃO** |
| Migrations | **NÃO** |
| Código / deploy / M1 | **NÃO** |

---

## POST-R2A-MIN — LIVE OPERADOR 2026-08-13T13:48:00Z

**Fonte:** SQL Editor `zaemlxjwhzrfmowbckmk` (operador).  
**Doc:** [R2A-MIN-POST-LIVE-2026-08-13.md](./R2A-MIN-POST-LIVE-2026-08-13.md)  
Arquivos `*-2026-08-12.txt` **não** apagados.

| Check | Resultado LIVE |
|-------|----------------|
| R2A-MIN | `Success. No rows returned.` → **PASS** |
| D5 `boletos.public` | **false** → **PASS** |
| `boletos_read_all` | **ausente** |
| SELECT Storage | `boletos_select_authenticated` `{authenticated}` |
| INSERT / UPDATE Storage | `*_authenticated` presentes (preservados) |
| `public.boletos` (tabela) | **não** confundir com Storage; `{public}` na tabela **fora** deste PASS |

### Classificação atualizada (Storage / R2A-MIN)

| Gate | Status |
|------|--------|
| **D2** (Storage objects boletos) | **PASS** |
| **D5** | **PASS** |
| **R2A-MIN** | **PASS** |
| D1 | **PASS** (2026-08-12) |
| R1 packages | **PASS** (não tocada pela R2A-MIN) |
| Staff invites | **REVIEW REQUIRED** |
| Backup verificável | **PENDING** |
| **M1** | **BLOCKED** — sem autorização de execução |

D2/D5 PASS **não** autorizam M1, não fecham backup, não implementam RBAC tenant-aware.
