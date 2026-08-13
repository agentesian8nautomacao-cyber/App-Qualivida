# SECURITY REMEDIATION PLAN — 2026-08-12

**Tipo:** diagnóstico + tracking de remediação (D2/D5 + staff_invites)  
**Project ref:** `zaemlxjwhzrfmowbckmk`  
**Fontes:** `docs/evidence/results/D1|D2|D5-*-2026-08-12*.txt`, migrations repo, código frontend/API  

### Tracking remediação (2026-08-12)

| Item | Status |
|------|--------|
| **R1** packages Allow all | **PASS** (executada; evidência `R1-PACKAGES-*`) |
| **R2.1** legado `pdf_url` | **PASS / LOW** (0 boletos live) |
| **R2.2** ownership boletos | **OWNERSHIP C** (insuficiente tenant/site) |
| **R2.3** Storage policies | SELECT **HIGH** / INSERT **MEDIUM** / UPDATE **MEDIUM** |
| **R2A** Storage boletos security | **PREPARED / NOT EXECUTED** — ver `R2A-STORAGE-BOLETOS-SECURITY-REMEDIATION.md` + migration `20260812230000_r2a_*` |
| M1 | **bloqueada** |
| staff_invites | REVIEW REQUIRED (não misturar com R2A) |

---

## Resumo executivo

| Gate | Status | Motivo curto |
|------|--------|--------------|
| D1 | PASS | RLS enabled em 19/19 tabelas prioritárias |
| D2 | **FAIL** (parcial) | R1 removeu packages Allow all; permanecem policies `{public}`/`true` em outras tabelas + Storage boletos até R2A |
| D5 | **FAIL** até R2A | Bucket `boletos` com `public=true` (R2A preparada, não executada) |
| staff_invites | REVIEW REQUIRED | Policies admin OK no desenho; sem tenant; token plaintext |

**Princípio Postgres RLS:** policies **PERMISSIVE** são combinadas com **OR**. Uma policy `USING (true)` para o mesmo comando **abre** o acesso mesmo que existam policies mais restritas.

---

## 1. PACKAGES — inventário LIVE

### 1.1 Todas as policies `public.packages` (D2)

| policyname | cmd | roles | permissive | USING (qual) | WITH CHECK |
|------------|-----|-------|------------|--------------|------------|
| **Allow all operations on packages** | **ALL** | **{public}** | PERMISSIVE | **true** | **true** |
| packages_resident_select | SELECT | {public} | PERMISSIVE | `(recipient_id = current_resident_id_from_auth()) AND (oculta_para_morador = false)` | null |
| packages_resident_update | UPDATE | {public} | PERMISSIVE | `recipient_id = current_resident_id_from_auth()` | `recipient_id = current_resident_id_from_auth()` |
| packages_staff_delete | DELETE | {public} | PERMISSIVE | `is_staff_from_auth()` | null |
| packages_staff_insert | INSERT | {public} | PERMISSIVE | null | `is_staff_from_auth()` |
| packages_staff_select | SELECT | {public} | PERMISSIVE | `is_staff_from_auth()` | null |
| packages_staff_update | UPDATE | {public} | PERMISSIVE | `is_staff_from_auth()` | `is_staff_from_auth()` |

Nenhuma policy **RESTRICTIVE** encontrada no live D2.

### 1.2 Qual anula as demais

**`Allow all operations on packages`** (`cmd=ALL`, `qual=true`, `with_check=true`, roles `{public}`).

Para qualquer papel efetivo coberto por `public` (inclui `anon` e `authenticated` no modelo Supabase), **ALL** com `true` concede SELECT/INSERT/UPDATE/DELETE sem checar staff/morador.

As policies `packages_staff_*` / `packages_resident_*` tornam-se **redundantes na prática** (ainda existem, mas não restringem).

### 1.3 Redundâncias

| Tipo | Itens |
|------|--------|
| Redundante (não efetiva restrição) | Todas as 6 policies staff/resident enquanto Allow all existir |
| Modelo desejado (migration `006_packages_receipt_and_hide.sql`) | Apenas as 6 policies staff/resident + funções `is_staff_from_auth` / `current_resident_id_from_auth` |
| Origem provável do Allow all | Policy legada de “dev aberto” coexistindo com migration 006 |

### 1.4 Perfis que dependem do comportamento atual vs desejado

| Perfil | Comportamento **atual** (Allow all) | Comportamento **desejado** (só 006) |
|--------|-------------------------------------|-------------------------------------|
| anon / cliente sem sessão | Pode ler/escrever packages se PostgREST permitir | Negado (exceto se policy explícita) |
| Staff (porteiro/síndico via `is_staff_from_auth`) | Funciona (aberto demais) | SELECT/INSERT/UPDATE/DELETE via staff policies |
| Morador (`current_resident_id_from_auth`) | Vê/altera tudo (aberto demais) | SELECT só recipient + não oculto; UPDATE limitado |
| UI (`App.tsx` `savePackage` / `getPackages`, Sentinela) | Opera sem depender do Allow all | Deve continuar via sessão staff/morador |

### 1.5 Pacote — proposta de correção (NÃO executar agora)

| Campo | Conteúdo |
|-------|----------|
| **Risco** | Alto — vazamento/alteração de encomendas; quebra isolamento futuro multi-tenant |
| **Causa** | PERMISSIVE OR + Allow all true |
| **Desejado** | Remover **somente** `Allow all operations on packages`; manter staff/resident |
| **Impacto funcional** | App autenticado staff/morador deve continuar; clientes anon deixam de acessar packages |
| **Testes** | Staff: CRUD encomenda; morador: vê só as suas; anon: SELECT/INSERT deny; regressão QR/foto/voz/outbox |
| **Rollback** | Recriar policy Allow all a partir deste documento / backup pré-change |
| **Dependências** | Backup verificável; janela de teste; confirmar `is_staff_from_auth()` live |

---

## 2. STORAGE (`storage.objects`) — boletos

### 2.1 Policies LIVE relacionadas a boletos

| policyname | cmd | roles | permissive | USING | WITH CHECK |
|------------|-----|-------|------------|-------|------------|
| **boletos_read_all** | **SELECT** | **{public}** | PERMISSIVE | `(bucket_id = 'boletos'::text)` | null |
| boletos_insert_authenticated | INSERT | {authenticated} | PERMISSIVE | null | `(bucket_id = 'boletos'::text)` |
| boletos_update_authenticated | UPDATE | {authenticated} | PERMISSIVE | `(bucket_id = 'boletos'::text)` | `(bucket_id = 'boletos'::text)` |

### 2.2 Por que `boletos_read_all` torna o acesso público

- Role `{public}` + `SELECT` + `USING (bucket_id = 'boletos')` sem checagem de `auth.uid()` / ownership / path por unidade.
- Qualquer cliente (incl. anon) que conheça ou enumere o path (`original/{uuid}.pdf`) pode ler o objeto via API Storage / URL pública do bucket.
- Combina com D5 `public=true` no bucket (URLs públicas estáveis).

### 2.3 Conflitos

Não há policy restritiva de SELECT conflitante; insert/update exigem authenticated (adequado para upload). O problema é **só leitura aberta**.

### 2.4 Storage — R2A (PREPARADA / NÃO EXECUTADA)

Detalhe completo: [`R2A-STORAGE-BOLETOS-SECURITY-REMEDIATION.md`](./R2A-STORAGE-BOLETOS-SECURITY-REMEDIATION.md).

| Campo | Conteúdo |
|-------|----------|
| **Risco atual** | SELECT HIGH (público); INSERT/UPDATE MEDIUM (qualquer authenticated) |
| **Causa** | Policy pública de SELECT + bucket público + write sem papel |
| **R2A preparada** | `public=false`; drop `boletos_read_all`; SELECT/INSERT/UPDATE via helpers staff/admin/(resident no SELECT) |
| **Arquivos** | `supabase/migrations/20260812230000_r2a_storage_boletos_security.sql` (+ `.rollback.sql`) |
| **Limitação** | OWNERSHIP C — sem tenant/path; SELECT = compatibilidade temporária |
| **REVIEW REQUIRED** | CABO_TURMA / papéis só-RBAC fora dos helpers; isolamento site fica para multi-tenant |
| **Impacto** | `.download()` auth OK; URLs públicas quebram; legado pdf_url LOW (0 rows) |
| **Rollback** | Emergencial restaura D2/D5 (`public=true` + 3 policies antigas) |
| **Status** | **PREPARED / NOT EXECUTED** |

---

## 3. BUCKET BOLETOS (D5)

| Campo | Valor LIVE |
|-------|------------|
| id | `boletos` |
| name | `boletos` |
| public | **true** |
| file_size_limit | null |
| allowed_mime_types | null |
| created_at | 2026-02-03 01:23:00.853485+00 |

### O frontend precisa que o bucket seja público?

**Provavelmente NÃO** para o fluxo principal de PDF original:

| Evidência | Uso |
|-----------|-----|
| `uploadBoletoOriginalPdf` | `storage.from(bucket).upload(...)` com **sessão Auth** obrigatória |
| `downloadBoletoOriginalPdf` | `storage.from(...).download(path)` (API autenticada / policy), **não** `getPublicUrl` |
| `documentosService.getDocumentoPublicUrl` | Usa `getPublicUrl` no bucket **`documentos`**, não `boletos` |

Conclusão diagnóstica: tornar `boletos` **privado** + remover `boletos_read_all` é alinhado ao código de upload/download atual, **desde que** não existam consumidores externos de URL pública `/storage/v1/object/public/boletos/...`. Validar `pdf_url` / links compartilhados antes da mudança.

### D5 — proposta

| Campo | Conteúdo |
|-------|----------|
| **Desejado** | `public=false` no bucket `boletos` |
| **Impacto** | Quebra URLs públicas existentes; download via cliente autenticado deve permanecer |
| **Testes** | Import PDF; download na BoletosView/App; morador se aplicável; URL pública antiga 403 |
| **Rollback** | `public=true` + policy read_all |
| **Dependências** | Remediação §2 na mesma janela |

---

## 4. STAFF_INVITES

### 4.1 Policies LIVE (D2)

| policyname | cmd | roles | USING / WITH CHECK |
|------------|-----|-------|--------------------|
| staff_invites_insert_admin | INSERT | {authenticated} | WITH CHECK `is_admin_for_staff_invites()` |
| staff_invites_select_admin | SELECT | {authenticated} | USING `is_admin_for_staff_invites()` |

Sem UPDATE/DELETE via client (accept usa service_role na API).

### 4.2 Função

`public.is_admin_for_staff_invites()` — SECURITY DEFINER; true se `users`/`staff` do `auth.uid()` tem role admin-like (SINDICO/ADMIN/…).

### 4.3 Tabela / colunas (migration)

`id`, `email`, `role`, `token` (plaintext UNIQUE), `expires_at`, `created_by`, `created_at`, `used_at` — **sem** `condominium_id`.

### 4.4 Fluxo

| Etapa | Quem | Como |
|-------|------|------|
| Cria | Admin UI (`ActionModals` → `createStaffInvite`) | INSERT client + token na URL do link |
| Consulta lista | Admin (PostgREST SELECT se policy) | Pode ler linhas incl. `token` se selected |
| Valida link | Convidado | `GET /api/staff-invite?token=` (service_role; devolve email/role/expires, **não** reenvia token) |
| Aceita | Convidado | `POST /api/accept-staff-invite` com token + senha; marca `used_at` |

### 4.5 Token no frontend?

- **Sim** no link de convite (`/accept-invite?token=…`) — by design (segredo de capacidade).
- **Não** na resposta JSON da API de validação.
- **Risco adicional:** admin SELECT pode listar todos os tokens do projeto.

### 4.6 Cross-tenant

Hoje single-tenant implícito. Pós multi-site: admin de um site poderia ver convites de outro (**sem** filtro de site) → **REVIEW REQUIRED**.

### 4.7 Proposta (fase posterior — NÃO agora)

| Campo | Conteúdo |
|-------|----------|
| **Desejado** | `condominium_id` + RLS por membership; hash do token at-rest; SELECT sem expor token (view/RPC); accept só via API |
| **Dependências** | M3/M8/M11+; Operations não bloqueia remediação D2 packages/boletos |
| **Prioridade** | Após fechar Allow all packages + Storage boletos; antes de multi-tenant go-live |

---

## 5. Demais findings D2 (contexto remediação)

Além de packages/Storage, D2 FAIL também por policies `{public}` `true` em:  
`app_config`, `areas`, `boletos` (tabela), `notices`, `notice_reads`, `notifications`, `occurrences` (+ Allow all), `package_items`, `reservations`, `residents`, `staff`, `users` (+ anon SELECT login).

**Ordem sugerida de remediação:**

1. Backup verificável  
2. `packages` — drop Allow all — **R1 = PASS**  
3. Storage boletos — **R2A = PREPARED / NOT EXECUTED** (autorizar execução)  
4. Tabela `boletos` CRUD public true  
5. `residents` / `users` / `staff` Allow all (+ anon login mínimo documentado)  
6. Demais `USING (true)` operacionais  
7. staff_invites tenant + token hygiene  
8. Ownership Storage/path multi-tenant (pós M1+)  

---

## 6. Matriz risco / causa / desejado / correção / impacto / testes / rollback

### A) packages Allow all

| | |
|--|--|
| Risco | Encomendas abertas a anon/authenticated sem filtro |
| Causa | PERMISSIVE OR com `ALL/true` |
| Atual | Aberto |
| Desejado | Só staff/resident (006) |
| Correção | `DROP POLICY "Allow all operations on packages" ON public.packages;` |
| Impacto | Anon perde acesso; staff/morador OK se funções OK |
| Testes | Matriz staff/morador/anon; fluxos críticos encomenda |
| Rollback | Recriar Allow all |
| Deps | Backup; validar `is_staff_from_auth` |

### B) storage boletos_read_all + bucket public

| | |
|--|--|
| Risco | PDF financeiro público |
| Causa | SELECT public + bucket public |
| Atual | Qualquer um com path/URL lê |
| Desejado | Privado + auth/signed |
| Correção | Drop `boletos_read_all`; `update storage.buckets set public=false where id='boletos'`; policy SELECT authenticated (e/ou signed) |
| Impacto | URLs públicas quebram; `download()` auth deve ok |
| Testes | Upload/download UI; anon 403 |
| Rollback | D2/D5 snapshot |
| Deps | Auditar `pdf_url` públicos |

### C) staff_invites

| | |
|--|--|
| Risco | Tokens listáveis por qualquer admin; sem site scope |
| Causa | Schema + SELECT admin global |
| Atual | Funcional single-tenant |
| Desejado | Site-scoped + token hashed / não listável |
| Correção | Fase multi-tenant (não misturar com hotfix packages) |
| Impacto | Convites e API accept |
| Testes | Criar/aceitar convite; admin B não vê site A |
| Rollback | Migration down |
| Deps | condominium_id / membership |

---

## 7. O que NÃO fazer nesta etapa

- Não executar R2A sem autorização explícita  
- Não migrar staff_invites junto com R2A  
- Não executar M1 como “compensação” de RLS fraco  
- Não inventar `condominium_id` / memberships na R2A  

---

## 8. Critério para executar R2A

- [ ] Backup verificável PASS  
- [ ] Revisão da migration `20260812230000_r2a_storage_boletos_security.sql`  
- [ ] Confirmar helpers live: `is_staff_from_auth`, `is_admin_for_staff_invites`, `current_resident_id_from_auth`  
- [ ] Plano de teste §8 em `R2A-STORAGE-BOLETOS-SECURITY-REMEDIATION.md`  
- [ ] Autorização explícita para alterar Storage  

---

*R1 executada. R2A apenas preparada — execução não autorizada neste documento.*
