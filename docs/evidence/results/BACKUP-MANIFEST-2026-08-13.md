# BACKUP MANIFEST — 2026-08-13

**Gate:** 3 — Backup verificável pré-M1  
**Classificação:** **PENDING**  
**Project ref alvo (produção):** `zaemlxjwhzrfmowbckmk`  
**Ref proibido:** `asfcttxrrfwqunljorvm` (não usado)  
**Timestamp UTC desta tentativa:** 2026-08-13T13:13:48Z  
**Responsável (agente):** tentativa de coleta; **sem** dump/snapshot obtido  
**M1/M2/M3:** **NÃO EXECUTADAS**

Nenhum restore em produção. Nenhum `pg_dump` contra o ref alvo.

---

## 1. Mecanismos — o que foi possível determinar

Não assumir existência no plano do projeto Qualivida sem API/Dashboard nesse ref.

| Mecanismo | Disponível nesta sessão? | Prova |
|-----------|--------------------------|--------|
| **Supabase Dashboard backup/snapshot** | **UNKNOWN** para `zaemlxjwhzrfmowbckmk` | CLI autenticada **não** lista esse projeto. Sem `SUPABASE_ACCESS_TOKEN` no ambiente. Sem acesso ao Database → Backups do Qualivida. |
| **`pg_dump`** | Binário **SIM**; execução no alvo **NÃO** | `C:\Program Files\PostgreSQL\18\bin\pg_dump.exe` presente. `DATABASE_URL` / `PGPASSWORD` / connection string do ref alvo **ausentes**. `.env*` do repo **não** contém URL postgres (só anon em `.env.localnet`). |
| **PITR** | **UNKNOWN** | Exige plano/Dashboard do projeto alvo. Não consultável daqui. |
| **Management API backups** | **NÃO** | Sem token; `supabase projects list` só vê org distinta. |
| **Outro verificável** | **NÃO encontrado** | Sem `.dump` / snapshot ID / hash de produção no repo. |

### CLI Supabase (esta máquina)

| Campo | Valor |
|-------|--------|
| Versão | 2.109.1 |
| `supabase link` | **ausente** (não forçado para projeto errado) |
| Projetos visíveis | `horti-delivery-lite` (`ggtdnczmmoxagmbzopsf`), `comida caseira` (`cgwkbdhgefrkopufysgj`) — **INACTIVE**, **outra org** |
| `zaemlxjwhzrfmowbckmk` na lista | **NÃO** |

**Não** foi feito dump/restore desses outros projetos.

---

## 2. Prova necessária vs obtido

| Campo | Valor |
|-------|--------|
| ID ou caminho do backup | **AUSENTE** |
| Data/hora UTC do artefato | **N/A** (não há artefato) |
| Project ref do artefato | **N/A** |
| Tamanho | **N/A** |
| SHA-256 | **N/A** |
| Escopo (schema / dados / policies / Storage / Auth) | **NÃO PRODUZIDO** |
| Ambiente | pretendido: produção `zaemlxjwhzrfmowbckmk` |
| Responsável | agente — coleta **falhou** por falta de credencial privilegiada |

**Critério mínimo** (`BACKUP-VERIFICAVEL.md`: caminho/ID + tamanho > 0 + hash **ou** ID Dashboard): **não atendido**.

---

## 3. O que **não** conta

| Item | Motivo |
|------|--------|
| `components/modals/ImportBoletosModal.tsx.backup` | arquivo de código, não dump |
| `node_modules.bak` | dependências, não banco |
| Evidências D1/D2/D5/R1 | SELECT/documentação, não snapshot restaurável |
| Tag git `pre-multitenant-baseline` (`f630726`) | código, não PostgreSQL/Storage |
| Chave anon `.env.localnet` | não substitui dump |

---

## 4. Restore / smoke test

| Campo | Valor |
|-------|--------|
| Executado | **NÃO** |
| Ambiente de restore | **N/A** |
| Data | **N/A** |
| `pg_restore -l` | **N/A** (sem arquivo) |
| Integridade | **N/A** |
| Restore em produção | **NÃO** (proibido e não tentado) |

Sem dump, restore em ambiente separado é impossível nesta sessão.

---

## 5. Como o operador fecha o gate (PASS)

No Dashboard do projeto **`zaemlxjwhzrfmowbckmk`** (URL `https://zaemlxjwhzrfmowbckmk.supabase.co`):

### Opção A — snapshot/PITR

1. Database → Backups (ou Settings → Database).  
2. Registrar: ID/nome do snapshot, UTC, região, se PITR está ON.  
3. Colar neste manifesto (ou anexo): print + ID.

### Opção B — `pg_dump` (connection string do painel, **não** anon)

```text
pg_dump "<DATABASE_URL>" --no-owner --format=custom -f qualivida-pre-m1-2026-08-13.dump
Get-FileHash -Algorithm SHA256 .\qualivida-pre-m1-2026-08-13.dump
pg_restore -l .\qualivida-pre-m1-2026-08-13.dump
```

Arquivar o `.dump` **fora** do Git público. Atualizar este manifesto com caminho, bytes, SHA-256.

### Restore de teste

Somente projeto/local **não produtivo**. Nunca `zaemlxjwhzrfmowbckmk`.

---

## 6. Classificação Gate 3

# PENDING

Não há evidência verificável (sem ID Dashboard, sem arquivo, sem tamanho, sem SHA-256).

**PASS** exige artefato comprovável do ref `zaemlxjwhzrfmowbckmk`.

---

## Declaração

| Item | Valor |
|------|--------|
| Banco / Storage / RLS | **NÃO ALTERADO** |
| Dump criado | **NÃO** |
| Restore | **NÃO** |
| M1 / M2 / M3 / migrations multi-tenant | **NÃO** |
