# R2A — Storage boletos: remediação de segurança (PREPARADA)

**Status:** **PREPARED / NOT EXECUTED**  
**Data:** 2026-08-12  
**Project ref:** `zaemlxjwhzrfmowbckmk`  
**M1:** continua **bloqueada**  
**OWNERSHIP:** **C** (R2.2) — esta remediação **não** inventa tenant/site

| Declaração | Valor |
|------------|--------|
| Migration executada | **NÃO** |
| Banco / Storage / código / deploy | **NÃO ALTERADO** |
| Rollback | **PREPARADO** (emergencial) |

---

## 1. Comportamento alvo

| Item | Alvo R2A |
|------|----------|
| `boletos.public` | **false** |
| SELECT | **não** público; compatibilidade autenticada sem ownership |
| INSERT | **não** “qualquer authenticated”; staff/admin helpers |
| UPDATE | **não** “qualquer authenticated”; staff/admin helpers (upsert) |
| `.download()` | continua com sessão Auth + SELECT compat |

---

## 2. Uso real no código (INSERT / UPDATE / SELECT)

| Operação | Onde | Quem na prática |
|----------|------|-----------------|
| **INSERT** (`.upload`, `upsert: true`) | `uploadBoletoOriginalPdf` → `ImportBoletosModal`, `boletoPdfImportService`, `addBoletoOriginalPdf` | Sessão Auth obrigatória no serviço; UI bloqueia `MORADOR`; App exige `boletos.create` |
| **UPDATE** Storage | implícito no `upsert: true` do upload | Mesmo perfil de importação |
| **SELECT** (`.download`) | `downloadBoletoOriginalPdf` → `BoletosView`, `App` (financeiro + morador) | Staff com `boletos.download` / view; **morador** também baixa PDF original |
| Path | `original/{boletoId}.pdf` | Sem prefixo de tenant |
| Signed URL | **não** usada no fluxo boletos | — |

**Perfis que precisam INSERT/UPDATE:** síndico / administradora / admin-like / (porteiro se RBAC `boletos.create`).  
**Morador:** SELECT (download), **não** upload.  
**Não assumido:** ownership por path ou site.

---

## 3. Decisão INSERT/UPDATE — sem falsa segurança

| Opção | Avaliação |
|-------|-----------|
| Manter `TO authenticated` + só `bucket_id` | Continua TOO_PERMISSIVE — **não** atinge alvo R2.4 |
| Ownership por `condominium_id` / path tenant | **Impossível agora** (OWNERSHIP C) — **não inventar** |
| `USING (true)` / `WITH CHECK (true)` | **Proibido** |
| `is_staff_from_auth() OR is_admin_for_staff_invites()` | **Opção mais segura compatível** com helpers já existentes (packages / staff_invites) |

**REVIEW REQUIRED (residual, pós-R2A):**

- Sem escopo de **site/tenant**.
- `is_staff_from_auth()` = só `PORTEIRO`/`SINDICO` em `users`.
- `is_admin_for_staff_invites()` = admin-like em `users`/`staff`.
- **CABO_TURMA** (e papéis só via RBAC sem estar nesses helpers) pode ser **negado** no Storage mesmo com `boletos.create` na UI → validar matriz live antes/depois.
- Path ownership ainda ausente (staff pode sobrescrever qualquer `original/{uuid}.pdf`).

Não há policy “segura multi-tenant” nesta etapa; R2A reduz superfície, não fecha isolamento Operaut.

---

## 4. SELECT

| Ação | Detalhe |
|------|---------|
| Remover | `boletos_read_all` (`{public}`) |
| Bucket | `public = false` |
| Criar | `boletos_select_auth_compat` |

Condição: `bucket_id = 'boletos'` **e** (`is_staff_from_auth()` **ou** `is_admin_for_staff_invites()` **ou** `current_resident_id_from_auth() IS NOT NULL`).

**Classificação explícita:**  
**compatibilidade temporária — ownership ainda pendente**  
(morador autenticado ainda pode ler qualquer objeto do bucket se conhecer o path.)

---

## 5. Arquivos preparados

| Arquivo | Função |
|---------|--------|
| `supabase/migrations/20260812230000_r2a_storage_boletos_security.sql` | Forward (NÃO EXECUTAR) |
| `supabase/migrations/20260812230000_r2a_storage_boletos_security.rollback.sql` | Rollback **EMERGENCIAL** |

---

## 6. Policies

### Removidas

| Nome | Motivo |
|------|--------|
| `boletos_read_all` | PUBLIC_EXPOSURE |
| `boletos_insert_authenticated` | qualquer authenticated |
| `boletos_update_authenticated` | qualquer authenticated |

### Criadas

| Nome | cmd | Condição (resumo) |
|------|-----|-------------------|
| `boletos_select_auth_compat` | SELECT | bucket + staff/admin/resident helper |
| `boletos_insert_staff_compat` | INSERT | bucket + staff/admin helper |
| `boletos_update_staff_compat` | UPDATE | bucket + staff/admin helper |

### Bucket esperado

`storage.buckets.id = 'boletos'` → **`public = false`**

---

## 7. Compatibilidade download / legado

| Item | Avaliação |
|------|-----------|
| `.download()` + bucket privado + SELECT auth compat | **OK** para fluxo atual |
| Fallback `pdfUrl` público | Quebra se URL `/object/public/boletos/...` |
| Legado dados (R2.1) | **0 boletos** → risco legado **LOW** |

---

## 8. Testes (quando autorizar execução)

### SQL — bucket / policies

- [ ] `public = false` para `boletos`
- [ ] Nenhuma policy SELECT com role `public` para boletos
- [ ] Presentes: `boletos_select_auth_compat`, `boletos_insert_staff_compat`, `boletos_update_staff_compat`
- [ ] Ausentes: `boletos_read_all`, `*_authenticated` antigas

### SELECT

- [ ] **anon:** GET/download objeto → DENY
- [ ] **staff/admin autenticado:** `.download()` path conhecido → ALLOW
- [ ] **morador autenticado:** `.download()` (fluxo UI) → ALLOW
- [ ] Ownership fino path: **N/A** (pendente) — não falhar o teste por isso; registrar limitação

### INSERT

- [ ] staff/síndico/administradora (helpers true): upload OK
- [ ] morador autenticado: upload → DENY
- [ ] anon: upload → DENY
- [ ] CABO_TURMA (se existir live): **REVIEW** — confirmar se helper cobre; se não, documentar bloqueio

### UPDATE

- [ ] staff/admin: upsert OK
- [ ] morador: UPDATE storage → DENY

### Funcional

- [ ] Import PDF (ImportBoletosModal)
- [ ] Anexar PDF (`addBoletoOriginalPdf`)
- [ ] Download UI staff + morador
- [ ] URL `/object/public/boletos/...` falha

### Segurança

- [ ] Sem policy `{public}` SELECT boletos
- [ ] Sem `USING (true)` / `WITH CHECK (true)` nas policies R2A
- [ ] Comentários/docs registram limitações temporárias

---

## 9. O que NÃO fazer agora

- `supabase db push` / `migration up` / SQL Editor apply  
- deploy / alterar código  
- inventar `condominium_id` / memberships  
- usar rollback como operação rotineira  

---

## 10. Encadeamento

| Item | Status |
|------|--------|
| R1 packages | **PASS** |
| R2.1 pdf_url legado | **PASS / LOW** (0 rows) |
| R2.2 ownership | **C** |
| R2.3 policy audit | SELECT **HIGH** / INSERT **MEDIUM** / UPDATE **MEDIUM** |
| **R2A** | **PREPARED / NOT EXECUTED** |

---

*Preparação only. Execução exige autorização explícita.*
