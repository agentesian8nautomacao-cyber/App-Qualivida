# R2A.1 — Pre-flight final Storage boletos

**Status:** **R2A.1 = BLOCKED**  
**Data:** 2026-08-12  
**Project ref:** `zaemlxjwhzrfmowbckmk`  
**Modo:** READ-ONLY — migration **não** executada  

| Declaração | Valor |
|------------|--------|
| Banco alterado | **NÃO** |
| Storage alterado | **NÃO** |
| Código alterado | **NÃO** |
| Migration executada | **NÃO** |
| Deploy | **NÃO** |

**Artefatos sob revisão:**

- Forward: `supabase/migrations/20260812230000_r2a_storage_boletos_security.sql`
- Rollback: `supabase/migrations/20260812230000_r2a_storage_boletos_security.rollback.sql`
- LIVE: `docs/evidence/results/D2-STORAGE-LIVE-2026-08-12.txt`, `D5-STORAGE-EVIDENCE-2026-08-12.txt`
- Helpers (repo): `migrations/006_packages_receipt_and_hide.sql`, `supabase/migrations/20250226000000_staff_invites_rls_allow_adm_and_staff.sql`

---

## 1. LIVE atual (evidências arquivadas)

| Item | Evidência | Valor |
|------|-----------|--------|
| Coleta | D2/D5 | 2026-08-12T20:49:00Z |
| Bucket `boletos` | D5 | **existe** (`id=boletos`, `name=boletos`) |
| `public` | D5 | **true** |
| Storage policies boletos | D2 | exatamente **3** (abaixo) |
| R1 packages | pós-R1 | **não** altera Storage; D2 Storage permanece válido |

Nenhuma consulta destrutiva nesta R2A.1. Helpers confirmados indiretamente no LIVE D2 (policies `packages_*` / `staff_invites_*` / `resident_invites_*` referenciam `is_staff_from_auth` e `is_admin_for_staff_invites`). Definição de `current_resident_id_from_auth` no repo (006); usada pelas policies packages resident.

---

## 2. Policies atuais (LIVE)

| policyname | cmd | roles | USING | WITH CHECK |
|------------|-----|-------|-------|------------|
| **boletos_read_all** | SELECT | **{public}** | `bucket_id = 'boletos'` | null |
| **boletos_insert_authenticated** | INSERT | {authenticated} | null | `bucket_id = 'boletos'` |
| **boletos_update_authenticated** | UPDATE | {authenticated} | `bucket_id = 'boletos'` | `bucket_id = 'boletos'` |

Confirmações pedidas:

| Pergunta | Resposta |
|----------|----------|
| `boletos_read_all` existe? | **SIM** |
| `boletos_insert_authenticated` existe? | **SIM** |
| `boletos_update_authenticated` existe? | **SIM** |
| bucket `boletos` existe? | **SIM** |
| `public=true`? | **SIM** |

---

## 3. Policies propostas (R2A)

| policyname | cmd | roles | Condição |
|------------|-----|-------|----------|
| `boletos_select_auth_compat` | SELECT | authenticated | `bucket_id='boletos'` **e** (`is_staff_from_auth()` **ou** `is_admin_for_staff_invites()` **ou** `current_resident_id_from_auth() IS NOT NULL`) |
| `boletos_insert_staff_compat` | INSERT | authenticated | `bucket_id='boletos'` **e** (`is_staff_from_auth()` **ou** `is_admin_for_staff_invites()`) |
| `boletos_update_staff_compat` | UPDATE | authenticated | idem INSERT (USING + WITH CHECK) |

Bucket: `UPDATE … SET public=false WHERE id='boletos'`.

DROP previsto: as três policies LIVE listadas na §2.

---

## 4. Roles afetados (helpers — sem inferir além do código SQL)

### Definições exatas (repo)

**`is_staff_from_auth()`** (`migrations/006`):

- `auth.uid()` em `public.users.auth_user_id`
- `upper(role) IN ('PORTEIRO','SINDICO')`
- `is_active` true (coalesce)

**`is_admin_for_staff_invites()`** (`20250226000000`):

- `users`: `SINDICO`, `ADMIN`, `ADMINISTRADOR`, `ADMINISTRADORA`, `ADM` (+ active)
- **ou** `staff`: `SÍNDICO`/`SINDICO`/`ADM`/`ADMIN`/`ADMINISTRADOR`/`ADMINISTRADORA` **ou** role ILIKE `%ndico%` / `%dmin%`

**`current_resident_id_from_auth()`** (`006`):

- retorna `residents.id` onde `auth_user_id = auth.uid()` (senão NULL)

### Quem terá cada operação pós-R2A

| Operação | Quem passa no helper | Quem **não** passa (exemplos explícitos no código) |
|----------|----------------------|-----------------------------------------------------|
| **SELECT** | PORTEIRO, SINDICO; ADMIN/ADMINISTRADOR/ADMINISTRADORA/ADM; qualquer usuário com linha em `residents.auth_user_id` | anon; authenticated sem users staff/admin e sem resident; **CABO_TURMA** (salvo se também for residente — improvável) |
| **INSERT** | PORTEIRO, SINDICO; admin-like acima | MORADOR; **CABO_TURMA**; RONDISTA; authenticated genérico |
| **UPDATE** | igual INSERT | igual INSERT |

**Não inventado:** isolamento por path/boleto/tenant.

---

## 5. Análise CABO_TURMA

| Fonte | Evidência |
|-------|-----------|
| Role de app | `types.ts`, `Layout.tsx`, `App.tsx` — `CABO_TURMA` tratado como **staff** |
| RBAC legado | seed `cabo_turma` inclui **`manage_boletos`** (`20250301120000`) |
| RBAC granular | `20250301170000` faz `roles` ⨯ permissions incl. `boletos.view/create/update/delete/download` → **cabo_turma recebe chaves de boletos** no seed |
| Convite staff | `StaffInviteRole` inclui `CABO_TURMA` |
| Helpers R2A | **CABO_TURMA ausente** de `is_staff_from_auth` e de `is_admin_for_staff_invites` |

### Classificação

**REGRESSION RISK**

Se um usuário live com `users.role = 'CABO_TURMA'` tiver `boletos.view` / `boletos.create` / `boletos.download` (seed + UI), após R2A:

- upload / upsert Storage → **DENY**
- `.download()` Storage → **DENY** (não é staff/admin helper nem resident)

Isso é **bloqueio inesperado** frente ao fluxo atual (Storage hoje = qualquer authenticated). Critério de aprovação R2A.1 exige que CABO_TURMA **não** apresente bloqueio inesperado → **falha**.

Outros papéis no fluxo boletos:

| Perfil | SELECT pós-R2A | INSERT/UPDATE pós-R2A | Nota |
|--------|----------------|---------------------------|------|
| SINDICO | OK | OK | ambos helpers |
| PORTEIRO | OK | OK | `is_staff_from_auth` |
| ADMIN / ADMINISTRADOR / ADMINISTRADORA | OK | OK | `is_admin_for_staff_invites` |
| MORADOR | OK se `residents.auth_user_id` | DENY (esperado; UI já bloqueia import) | download UI |
| CABO_TURMA | **DENY** (típico) | **DENY** | **REGRESSION RISK** |
| RONDISTA | DENY tipicamente | DENY | invite role; fora dos helpers |

---

## 6. Fluxo upload / download (código — read-only)

| Operação | Função / tela | Auth no serviço | Storage API |
|----------|---------------|-----------------|-------------|
| Upload | `uploadBoletoOriginalPdf` ← `ImportBoletosModal`, `boletoPdfImportService`, `addBoletoOriginalPdf` (`BoletosView`, `BoletoPDFModal`) | exige sessão | `.from('boletos').upload(..., { upsert: true })` |
| Download | `downloadBoletoOriginalPdf` ← `BoletosView`, `App` (financeiro + morador) | sessão implícita no client | `.from('boletos').download(path)` |
| Update objeto | implícito no upsert | — | precisa policy UPDATE |
| Metadados | `pdf_original_path`, `checksum_pdf`; limpa `pdf_url` no attach | tabela `boletos` | — |
| Fallback URL pública | `boleto.pdfUrl` / `pdf_url` se sem `pdf_original_path` | — | pode apontar `/object/public/...` |
| Legado dados | R2.1 | **0 boletos** | risco legado **LOW** |

Quem “deve” upload na UI: não-`MORADOR` + `boletos.create` (inclui **CABO_TURMA** se permissão RBAC).  
Quem download: staff com `boletos.download` **e** morador no dashboard/App.

Signed URLs: **não** usadas no fluxo boletos.

---

## 7. Análise da migration (escopo)

| Check | Resultado |
|-------|-----------|
| Remove só as 3 policies LIVE previstas | **OK** (`read_all`, `insert_authenticated`, `update_authenticated`) |
| Cria só as 3 policies R2A | **OK** (`select_auth_compat`, `insert_staff_compat`, `update_staff_compat`) |
| Altera só bucket `boletos` | **OK** (`WHERE id = 'boletos'`) |
| Modifica tabelas `public.*` | **NÃO** |
| Modifica RLS outras tabelas | **NÃO** |
| Cria `condominium_id` / `site_id` | **NÃO** |
| Tenta ownership multi-tenant | **NÃO** |
| Operação fora de escopo Storage boletos | **Nenhuma** detectada |

Migration **coerente com LIVE** e **escopo limitado**. O bloqueio R2A.1 **não** é por escopo SQL — é por **regressão de papel**.

---

## 8. Análise do rollback

Rollback recria:

| Item | Expressão rollback | LIVE D2/D5 | Match |
|------|--------------------|------------|-------|
| `boletos_read_all` | SELECT TO `public` USING `bucket_id = 'boletos'` | igual | **EXATO** |
| `boletos_insert_authenticated` | INSERT TO `authenticated` WITH CHECK `bucket_id = 'boletos'` | igual | **EXATO** |
| `boletos_update_authenticated` | UPDATE TO `authenticated` USING/CHECK `bucket_id = 'boletos'` | igual | **EXATO** |
| `public=true` | `UPDATE … SET public=true WHERE id='boletos'` | D5 true | **EXATO** |
| Drop policies R2A | select/insert/update `*_compat` | — | **OK** |

**Classificação rollback:** **EXATO**

---

## 9. Riscos

| Risco | Nível | Nota |
|-------|-------|------|
| Executar R2A agora com CABO_TURMA | **HIGH (funcional)** | upload/download Storage quebram para esse perfil |
| Exposição pública atual (não executar) | **HIGH (segurança)** | permanece até remediação |
| Morador SELECT amplo (path conhecido) | MEDIUM residual | ownership C — aceito como limitação R2A, não bloqueia sozinho |
| Legado `pdf_url` | LOW | 0 rows |
| Helpers ausentes em produção | LOW | D2 referencia helpers em policies ativas |

---

## 10. Decisão final

### Critérios

| Critério | Status |
|----------|--------|
| Migration coerente com LIVE | PASS |
| Rollback coerente (**EXATO**) | PASS |
| Escopo limitado a boletos | PASS |
| Nenhuma regressão conhecida | **FAIL** — CABO_TURMA |
| CABO_TURMA sem bloqueio inesperado | **FAIL** — **REGRESSION RISK** |

### Decisão

# R2A.1 = BLOCKED

**Motivo:** a migration proposta exclui **CABO_TURMA** dos helpers de SELECT/INSERT/UPDATE, mas o app e o seed RBAC tratam esse perfil como staff com acesso a boletos (`manage_boletos` / `boletos.*`). Executar R2A neste estado causaria regressão funcional previsível.

**Não executar** até ajustar a policy (incluir CABO_TURMA de forma explícita e auditável) **ou** confirmar LIVE que nenhum usuário `CABO_TURMA` usa Financeiro/upload/download Storage.

---

## Declaração final

| Item | Valor |
|------|--------|
| Banco alterado | **NÃO** |
| Storage alterado | **NÃO** |
| Código alterado | **NÃO** |
| Migration executada | **NÃO** |
| Deploy | **NÃO** |

*R2A permanece PREPARADA; execução continua não autorizada por este pre-flight.*
