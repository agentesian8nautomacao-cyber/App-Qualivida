# FINAL PRE-M1 CHECKPOINT — 2026-08-13

**Modo:** READ-ONLY  
**Project ref:** `zaemlxjwhzrfmowbckmk`  
**HEAD:** `7ee0131`  
**M1:** **não executada** · **não autorizada nesta etapa**

# Decisão: BLOCKED

Não usar a frase “M1 aprovada”.  
Não solicitar execução até as pendências abaixo fecharem com evidência.

---

## Checklist

### Segurança

| Item | Estado |
|------|--------|
| D1 RLS PASS | **[x]** PASS — `results/D1-RLS-LIVE-2026-08-12.txt` (19/19 `rls_enabled=true`) |
| D2 Storage PASS | **[ ]** **FAIL** (2026-08-12) + **PENDING** (2026-08-13 sem `pg_policies`) |
| D5 Storage PASS | **[ ]** **FAIL** (2026-08-12 `public=true`) + **PENDING** (2026-08-13 sem `storage.buckets`) |
| Backup verificável PASS | **[ ]** **PENDING** — `BACKUP-MANIFEST-2026-08-13.md` sem artefato/SHA/ID |

### Arquitetura

| Item | Estado |
|------|--------|
| FASE-1-ARQUITETURA-MULTITENANT revisada | **[x]** disco (worktree; **não** no HEAD) |
| FASE-1-MIGRATION-PLAN revisado | **[x]** disco (worktree; **não** no HEAD) |
| OPERAUT-ARCHITECTURE-ADDENDUM revisado | **[x]** disco (untracked) |
| Vertical/Site definido | **[x]** addendum PLATFORM → ORG → VERTICAL → OPERATIONAL_SITE → UNIT |
| condominium = operational site no piloto | **[x]** `condominiums` = site `vertical=condominium` |
| condominium_id ≡ site_id documentado | **[x]** FASE-1 + addendum |

### RBAC

| Item | Estado |
|------|--------|
| Membership → Role → Permission confirmado | **[x]** como **fonte de verdade alvo** (R2A.2). **Não** implementado live (sem memberships) |
| Não existe segundo RBAC | **[x]** R2A completa **não** aplicada (helpers não viraram Storage RBAC) |
| R2A completa adiada para M1/M12 | **[x]** `20260812230000_r2a_*` PREPARADA / NÃO EXECUTAR |

### Storage

| Item | Estado |
|------|--------|
| boletos privado | **[ ]** **não comprovado** (`public=false` sem SQL 2026-08-13) |
| exposição pública fechada | **[ ]** **não comprovado** (`boletos_read_all` ainda no D2-12; probe anon list 200) |
| INSERT/UPDATE preservados | **[ ]** **intenção R2A-MIN sim**; **LIVE pós-R2A-MIN não certificado** |
| tenant-aware definitivo adiado | **[x]** REQUIRES M1/M12 (decisão R2A.2) |

### Evidências (arquivadas no disco; pasta untracked)

| Item | Estado |
|------|--------|
| D1 arquivado | **[x]** `results/D1-RLS-LIVE-2026-08-12.txt` |
| D2 arquivado | **[x]** `…-2026-08-12.txt` (FAIL); `…-2026-08-13.txt` (PENDING, não é SQL) |
| D5 arquivado | **[x]** idem |
| R1 arquivado | **[x]** PASS — Allow all packages removida |
| R2A-MIN arquivado | **[x]** plano + migration + pre-exec; LIVE agente **não aplicada**; SQL pós **ausente** |
| Backup manifest arquivado | **[x]** arquivo existe; conteúdo **PENDING** |

### Git

| Item | Estado |
|------|--------|
| baseline identificada | **[x]** tag `pre-multitenant-baseline` = `f630726`; HEAD = `7ee0131` |
| commit SHA registrado | **[x]** `7ee0131d0e58f39f4a36d0e0125b7000ae760904` |
| working tree revisado | **[x]** **BLOCKED — WORKTREE NOT CLEAN** (`PRE-M1-GIT-BASELINE-2026-08-13.md`) |

---

## Pendências exatas (bloqueiam READY FOR M1 AUTHORIZATION)

1. **D2 ≠ PASS** — policies `{public}`/`true` no live 2026-08-12; recoleta 2026-08-13 sem `pg_policies`.  
2. **D5 ≠ PASS** — último SQL: `boletos.public=true`; `public=false` não comprovado.  
3. **Backup verificável ≠ PASS** — sem ID/snapshot/`pg_dump`/tamanho/SHA-256 do ref `zaemlxjwhzrfmowbckmk`.  
4. **Storage boletos privado / SELECT público fechado** — não certificados (R2A-MIN NOT CERTIFIED).  
5. **INSERT/UPDATE Storage** — preservação LIVE não relida pós-R2A-MIN.  
6. **Git worktree suja** — evidências, Operaut, SQL R1/R2A fora do HEAD; tag `pre-m1-checkpoint` **não** criada.  
7. **PRE-BACKUP** — review **BLOCKED** até D2/D5 2026-08-13 reais.

Não bloqueiam sozinhos (dívida, não gate de “docs prontos”):

- staff_invites REVIEW REQUIRED (adiado);  
- OWNERSHIP C;  
- D2 residual em outras tabelas (`USING true`) — **ainda é FAIL de RLS efetivo**, alinhado ao plano (isolamento vem M13+, não M1 DDL).

**Nota:** M1 no plano é CREATE org/condo, não “consertar D2 inteiro”. Mesmo assim os gates escritos (D2 Storage PASS, D5 PASS, backup PASS) **não** estão fechados. Sem isso não há `READY FOR M1 AUTHORIZATION`.

---

## O que já está fechado (não basta)

- D1 PASS  
- R1 PASS (packages Allow all)  
- Arquitetura Operaut documentada  
- R2A completa **não** executada (correto)  
- Project ref produção identificado  

---

## Próximos passos (sem executar M1)

1. SQL Editor `zaemlxjwhzrfmowbckmk`: D2 + D5 reais → substituir só o conteúdo PENDING `*-2026-08-13.txt`.  
2. Se Storage ainda público: executar R2A-MIN com evidência, depois re-D2/D5.  
3. Backup verificável (Dashboard/`pg_dump`) + manifesto PASS.  
4. Commit explícito da evidência + tag `pre-m1-checkpoint`.  
5. Só então: etapa separada de **autorização** de M1.

---

| Item | Valor |
|------|--------|
| Banco / RLS / Storage | **NÃO ALTERADO** |
| Migration M1 | **NÃO CRIADA / NÃO EXECUTADA** |
| Frase “M1 aprovada” | **não usada** |
