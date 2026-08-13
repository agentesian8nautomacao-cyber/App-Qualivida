# R2A-MIN — Revisão final pré-execução

**Classificação:** **READY FOR EXECUTION**  
**Data:** 2026-08-13  
**Project ref:** `zaemlxjwhzrfmowbckmk`  
**Modo:** READ-ONLY — migration **não** executada; arquivos **não** alterados  

| Declaração | Valor |
|------------|--------|
| Banco / RLS / Storage / código | **NÃO ALTERADO** |
| Migration R2A-MIN | **NÃO EXECUTADA** |
| Migration R2A completa | **NÃO EXECUTADA** (fora desta revisão de execução) |

**Arquivos revisados (sem edição):**

- `supabase/migrations/20260813090000_r2a_min_remove_public_exposure.sql`
- `supabase/migrations/20260813090000_r2a_min_remove_public_exposure.rollback.sql`
- Plano: `docs/evidence/R2A-MIN-PLAN-2026-08-13.md`
- LIVE Storage: D2 + D5 (`2026-08-12T20:49:00Z`) + R2.3

---

## 1. Bucket

Comando na migration (linhas 57–59):

```sql
UPDATE storage.buckets
SET public = false
WHERE id = 'boletos';
```

| Check | Resultado |
|-------|-----------|
| Alvo | `storage.buckets` |
| Coluna | `public = false` |
| Filtro | `WHERE id = 'boletos'` |
| Outros buckets | **não** afetados (predicate por `id`) |
| LIVE D5 | `id = boletos`, `name = boletos`, `public = true` — filtro coincide |

**PASS**

---

## 2. Policy `boletos_read_all`

### LIVE (D2 / R2.3)

| Campo | Valor |
|-------|--------|
| Nome | `boletos_read_all` |
| Tabela | `storage.objects` |
| Operação | **SELECT** |
| Roles | `{public}` |
| USING | `bucket_id = 'boletos'` (D2/R2.3: `(bucket_id = 'boletos'::text)`) |
| WITH CHECK | null |
| Bucket efetivo | somente objetos com `bucket_id = 'boletos'` |

### O que a migration faz

```sql
DROP POLICY IF EXISTS "boletos_read_all" ON storage.objects;
```

Substituição (não é RBAC; restrição de role):

```sql
CREATE POLICY "boletos_select_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'boletos');
```

| Campo | Valor proposto |
|-------|----------------|
| Operação | SELECT |
| Tabela | `storage.objects` |
| Role | `authenticated` (não `public` / não anon) |
| USING | `bucket_id = 'boletos'` |
| WITH CHECK | n/a (SELECT) |

### Impacto

| Quem | Antes | Depois |
|------|-------|--------|
| anon / URL `/object/public/boletos/...` | ALLOW | **DENY** |
| authenticated `.download()` | ALLOW (via `{public}`) | **ALLOW** (via nova policy) |
| INSERT/UPDATE | inalterados | inalterados |

**PASS** — remove exposição pública; preserva download autenticado.

---

## 3. INSERT / UPDATE / DELETE

Comandos DDL/DML efetivos da forward (exceto comentários):

| Comando | Alvo |
|---------|------|
| `DROP POLICY` | `boletos_read_all` |
| `DROP POLICY` | `boletos_select_authenticated` (idempotência; não existe LIVE) |
| `CREATE POLICY` | `boletos_select_authenticated` **SELECT** |
| `COMMENT ON POLICY` | mesma policy SELECT |
| `UPDATE` | `storage.buckets` `public` |

**Ausente** na forward:

- `boletos_insert_authenticated`
- `boletos_update_authenticated`
- qualquer `FOR INSERT` / `FOR UPDATE` / `FOR DELETE`
- `DROP`/`ALTER` dessas policies

DELETE LIVE: **não existe** policy de delete para boletos (R2.3). Migration **não** cria uma.

**PASS** — INSERT/UPDATE permanecem exatamente as LIVE.

---

## 4. Rollback

Arquivo: `20260813090000_r2a_min_remove_public_exposure.rollback.sql`

| Restaura | Como | vs LIVE D2/D5 |
|----------|------|----------------|
| Remove R2A-MIN | `DROP POLICY IF EXISTS "boletos_select_authenticated"` | OK |
| `boletos_read_all` | SELECT TO `public` USING `bucket_id = 'boletos'` | **equivalente funcional** a D2 (`::text` implícito) |
| `public=true` | `UPDATE … WHERE id = 'boletos'` | **EXATO** D5 |
| INSERT/UPDATE | não tocados no forward nem no rollback | permanecem LIVE |

**Classificação rollback:** **EXATO** (funcional).  
Não é fluxo normal; reabre exposição pública HIGH.

**PASS**

---

## 5. Idempotência e destruição

| Aspecto | Avaliação |
|---------|-----------|
| `DROP POLICY IF EXISTS` | reexecução não falha se policy já ausente |
| Recreate SELECT autenticado | DROP + CREATE da policy nova — reexecução segura |
| `UPDATE public=false WHERE id='boletos'` | reexecução = no-op efetivo se já false |
| `BEGIN`/`COMMIT` | falha em CREATE/COMMENT desfaz o DROP |
| `DROP TABLE` / `TRUNCATE` / `DELETE` de dados | **ausente** |
| Outros buckets / tabelas | **ausente** |

Destrutivo **esperado e único:** remover SELECT `{public}` no bucket boletos.

Não executar duas migrations concorrentes (R2A completa vs R2A-MIN): nomes de policy SELECT diferem (`boletos_select_auth_compat` vs `boletos_select_authenticated`). R2A completa permanece **não aprovada**.

**PASS**

---

## 6. Escopo

Referências a `packages`, helpers, `has_permission`, `is_member`, `condominium_id`, `site_id`, memberships aparecem **somente em comentários** (lista do que **não** fazer).

| Superfície | Alterada? |
|------------|-----------|
| `staff_invites` | **NÃO** |
| `packages` | **NÃO** |
| RBAC (`roles` / `permissions` / `role_permissions`) | **NÃO** |
| memberships | **NÃO** |
| frontend / código app | **NÃO** |
| `public.boletos` e demais tabelas | **NÃO** |
| outros buckets | **NÃO** (`WHERE id = 'boletos'`) |
| helpers | **NÃO** |

**PASS**

---

## Limitações residuais (não bloqueiam esta execução)

- SELECT autenticado no bucket inteiro: **não** é tenant/RBAC (OWNERSHIP C; REQUIRES M1/M12).
- INSERT/UPDATE continuam TOO_PERMISSIVE (proposital).
- Legado `pdfUrl`: 0 rows (R2.1) → LOW.

Nenhum destes viola o objetivo declarado da R2A-MIN.

---

## Decisão

# READY FOR EXECUTION

Aguardar **autorização explícita**. Esta revisão **não** executa a migration.

| Item | Valor |
|------|--------|
| Banco alterado | **NÃO** |
| Storage alterado | **NÃO** |
| RLS alterado | **NÃO** |
| Código alterado | **NÃO** |
| Migration alterada nesta revisão | **NÃO** |
| Migration executada | **NÃO** |
| Deploy | **NÃO** |
