# R1 — Remediação packages: drop "Allow all operations on packages"

**Status:** **PASS** — executada em produção pelo operador  
**Data:** 2026-08-12  
**Project ref:** `zaemlxjwhzrfmowbckmk`  
**Evidência pós:** [results/R1-PACKAGES-POST-2026-08-12.txt](./results/R1-PACKAGES-POST-2026-08-12.txt)  
**Arquivos:**

- Forward: `supabase/migrations/20260812220000_r1_packages_drop_allow_all_policy.sql`
- Rollback: `supabase/migrations/20260812220000_r1_packages_drop_allow_all_policy.rollback.sql`

---

## 0. Resultado da execução (PASS)

| Item | Valor |
|------|--------|
| Timestamp UTC (arquivamento) | 2026-08-12T23:32:00Z |
| Executor | operador (SQL Editor) |
| Policy global removida | `"Allow all operations on packages"` — **ausente** |
| Policies restantes | exatamente as 6 da migration 006 |
| `relrowsecurity` | true |
| `relforcerowsecurity` | false |
| **Classificação R1** | **PASS** |

Policies pós-execução:

- packages_resident_select  
- packages_resident_update  
- packages_staff_delete  
- packages_staff_insert  
- packages_staff_select  
- packages_staff_update  

---

## 1. Confirmação pré-execução (operador)

Rodar no SQL Editor do projeto **correto** (somente leitura):

```sql
-- Nome exato da policy global
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'packages'
ORDER BY policyname;

-- RLS enabled
SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'packages';
```

### Critérios para autorizar R1

| Check | Esperado (D2 live 2026-08-12) |
|-------|-------------------------------|
| Policy global existe | `Allow all operations on packages` — ALL, `{public}`, qual/with_check `true` |
| 6 policies 006 existem | `packages_staff_select/insert/update/delete`, `packages_resident_select/update` |
| RLS enabled | `true` |

Se a global **não** existir mais: não aplicar (já remedido).  
Se alguma das 6 **faltar**: **NÃO** aplicar R1 até restaurar 006 — risco de lockout.

---

## 2. Policies ANTES (evidência D2)

| policyname | cmd | roles | permissive | USING | WITH CHECK |
|------------|-----|-------|------------|-------|------------|
| **Allow all operations on packages** | ALL | {public} | PERMISSIVE | true | true |
| packages_resident_select | SELECT | {public} | PERMISSIVE | recipient + not oculta | null |
| packages_resident_update | UPDATE | {public} | PERMISSIVE | recipient | recipient |
| packages_staff_delete | DELETE | {public} | PERMISSIVE | is_staff_from_auth() | null |
| packages_staff_insert | INSERT | {public} | PERMISSIVE | null | is_staff_from_auth() |
| packages_staff_select | SELECT | {public} | PERMISSIVE | is_staff_from_auth() | null |
| packages_staff_update | UPDATE | {public} | PERMISSIVE | is_staff_from_auth() | is_staff_from_auth() |

**Compatibilidade:** as 6 policies 006 são suficientes para staff/morador autenticados; a global é incompatível com restrição (PERMISSIVE OR). Remoção é a correção correta.

---

## 3. SQL da migration (forward)

```sql
BEGIN;
DROP POLICY IF EXISTS "Allow all operations on packages" ON public.packages;
COMMIT;
```

Idempotente via `IF EXISTS`. Não toca outras policies/tabelas.

---

## 4. Policies DEPOIS (esperadas)

| policyname | cmd |
|------------|-----|
| packages_resident_select | SELECT |
| packages_resident_update | UPDATE |
| packages_staff_delete | DELETE |
| packages_staff_insert | INSERT |
| packages_staff_select | SELECT |
| packages_staff_update | UPDATE |

**Ausente:** `Allow all operations on packages`  
**RLS:** permanece enabled.

---

## 5. Rollback

Arquivo: `20260812220000_r1_packages_drop_allow_all_policy.rollback.sql`

```sql
BEGIN;
DROP POLICY IF EXISTS "Allow all operations on packages" ON public.packages;
CREATE POLICY "Allow all operations on packages"
  ON public.packages
  AS PERMISSIVE
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
COMMIT;
```

Restaura postura **insegura** — só emergência.

---

## 6. Testes necessários (após autorização e execução)

### 6.1 Catálogo

```sql
SELECT policyname FROM pg_policies
WHERE schemaname='public' AND tablename='packages'
ORDER BY 1;
-- Esperado: exatamente as 6 nomes 006; sem "Allow all..."

SELECT relrowsecurity FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='packages';
-- Esperado: true
```

### 6.2 Papéis (PostgREST / app)

| Papel | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| anon (sem sessão) | DENY / vazio | DENY | DENY | DENY |
| staff (`is_staff_from_auth` true) | ALLOW | ALLOW | ALLOW | ALLOW |
| morador (recipient) | só suas não ocultas | DENY (sem staff insert) | ALLOW nas suas | DENY |
| morador (outra encomenda) | DENY | — | DENY | — |

### 6.3 Regressão funcional UI

- [ ] Portaria: criar encomenda (manual / QR / foto / voz se aplicável)  
- [ ] Portaria: listar / atualizar / entregar  
- [ ] Morador: ver só as suas; ocultar/baixa conforme fluxo  
- [ ] Outbox / offline sync de packages  
- [ ] Sentinela (se usa packages)

---

## 7. Procedimento de execução (quando autorizado)

1. Backup verificável confirmado  
2. Pré-check SQL (§1)  
3. Aplicar forward no SQL Editor **ou** pipeline de migration aprovado  
4. Pós-check + testes §6  
5. Arquivar evidência em `docs/evidence/results/R1-PACKAGES-AFTER-<data>.txt`  
6. Se falha crítica → rollback.sql ou restore backup  

**Estado atual:** R1 = **PASS** (produção). Evidência: `results/R1-PACKAGES-POST-2026-08-12.txt`. Testes de regressão UI (§6.3) ainda recomendados.

---

## 8. Fora de escopo R1

Storage `boletos_read_all`, bucket public, staff_invites, outras tabelas com Allow all — remediações futuras separadas.
