# R2A-MIN — Pós-execução LIVE (2026-08-13)

**Classificação:** **R2A-MIN = PASS** · **D5 = PASS** · **D2 (Storage boletos) = PASS**  
**Project ref:** `zaemlxjwhzrfmowbckmk`  
**Executor:** operador — SQL Editor  
**UTC arquivamento:** 2026-08-13T13:48:00Z  
**R2A-MIN SQL:** `Success. No rows returned.`

Esta tarefa: **somente documentação**. Banco/Storage/RLS/código **não** alterados pelo agente.

Históricos **preservados:** `D2/D5/D1/R1 *-2026-08-12*`.

---

## Distinção `public.boletos` vs `storage.objects`

| Objeto | O que é | R2A-MIN |
|--------|---------|---------|
| **`storage.objects`** + bucket `boletos` | Arquivos PDF | **Corrigido** (SELECT público removido; bucket privado) |
| **`public.boletos`** | Tabela de metadados | **Não tocada.** Policies `{public}` de CRUD **não** são leitura pública do Storage |

Não interpretar `Allow read boletos` na tabela como `boletos_read_all` do Storage.  
Não abrir remediação da tabela nesta etapa.

---

## Bucket

| Momento | `boletos.public` | Fonte |
|---------|------------------|--------|
| Antes | **true** | D5 2026-08-12 |
| Depois | **false** | D5 2026-08-13 (operador) |

---

## Policies `storage.objects` (boletos)

| Policy | Antes (D2-12) | Depois (D2-13) |
|--------|----------------|----------------|
| `boletos_read_all` SELECT `{public}` | presente | **AUSENTE** |
| `boletos_select_authenticated` SELECT `{authenticated}` | ausente | **presente** `bucket_id='boletos'` |
| `boletos_insert_authenticated` INSERT `{authenticated}` | presente | **presente** (preservado) |
| `boletos_update_authenticated` UPDATE `{authenticated}` | presente | **presente** (preservado) |

---

## R1 packages

R2A-MIN **não** altera `public.packages`.  
Última prova: `R1-PACKAGES-POST-2026-08-12.txt` — Allow all **ausente**.  
**R1 continua válida (PASS).**

---

## O que este PASS **não** é

| Item | Estado |
|------|--------|
| RBAC Storage tenant-aware / membership | **NÃO** — SELECT autenticado no bucket inteiro; OWNERSHIP C |
| staff_invites | **REVIEW REQUIRED** |
| Backup verificável | **PENDING** |
| M1 | **BLOCKED** (sem autorização de execução) |

INSERT/UPDATE Storage continuam “qualquer authenticated” + `bucket_id` — esperado na R2A-MIN; aperto = M12+.

---

## Artefatos 2026-08-13

- `results/R2A-MIN-LIVE-2026-08-13.txt`
- `results/D2-STORAGE-LIVE-2026-08-13.txt`
- `results/D5-STORAGE-EVIDENCE-2026-08-13.txt`
- este documento
