# FASE 0 — Diagnóstico de produção (baseline pré-SaaS)

**Data:** 2026-08-08  
**Escopo:** diagnóstico e preparação — **sem** alteração de banco, RLS, Storage, frontend ou fluxos críticos.  
**Projeto Supabase consultado (via app):** `zaemlxjwhzrfmowbckmk.supabase.co` (credenciais em `.env.localnet` no repositório).

> **Atenção — qual é “produção”?**  
> O repositório traz `.env.production` **apenas com placeholders**. O build local usou dependências do repo; a conexão live foi feita com `.env.localnet`. **É obrigatório confirmar no painel Vercel** se `VITE_SUPABASE_URL` aponta para o **mesmo** project ref antes da Fase 1.  
> Contagens abaixo usam a **chave anon** (sem sessão autenticada): refletem o que o PostgREST expõe sob RLS anon, **não necessariamente** o total real visível para staff autenticado ou via SQL `service_role`.

---

## 1. Estado do banco

| Item | Observação |
|------|------------|
| **Instância consultada** | `https://zaemlxjwhzrfmowbckmk.supabase.co` |
| **Método de inventário live** | Cliente `@supabase/supabase-js` (anon), contagens `count: 'exact'`, amostra de 1 linha/colunas |
| **Export SQL completo (pg_catalog)** | **Não executado** — exige SQL Editor (role postgres) ou `service_role` / connection string |
| **Auth (`auth.users`)** | Contagem **não obtida** via anon (Admin API) |
| **Indícios de migrations aplicadas** | Colunas de `migrations/006_packages_*` **presentes** em `packages`; tabelas `admin_audit_logs`, `staff_invites`, `resident_invites`, `app_config` **existem** |
| **Indícios de migrations NÃO aplicadas** | `roles`, `permissions`, `role_permissions` com **0 registros** (RBAC `supabase/migrations/20250301*` provavelmente **não aplicado** ou tabela truncada) |
| **Escala vs. operação real (252 unidades)** | Contagens anon (**4** moradores, **4** unidades distintas na amostra) sugerem **ambiente de teste/staging** ou **outro projeto** na Vercel — **validar antes da Fase 1** |

---

## 2. Tabelas

Legenda colunas amostra: obtidas de **1 linha** (ou vazio). PK/FK/índices/triggers/policies detalhados: ver **Anexo A** (SQL a rodar no Supabase).

### 2.1 Tabela resumo (contagens via anon — 2026-08-08)

| Tabela | Registros (anon) | Colunas detectadas (amostra) | Notas |
|--------|------------------|------------------------------|--------|
| `residents` | 4 | id, name, unit, email, phone, whatsapp, password_hash, extra_data, auth_user_id, created_at, updated_at | Sem entidade `units` separada |
| `packages` | 9 | recipient_id, recipient_name, unit, status, qr_code_data, image_url, received_by_name, data_recebimento, oculta_para_morador, … | Migration 006 refletida no schema |
| `package_items` | 0 | — | Tabela existe |
| `visitors` | 2 | morador_id, resident_id, unit, nome_visitante, status, … | Dupla referência morador |
| `occurrences` | 0 | — | Tabela existe |
| `notices` | 0 | — | Tabela existe |
| `notice_reads` | 0 | — | Tabela existe |
| `notifications` | 1 | morador_id, type, related_id, read, image_url, … | |
| `reservations` | 0 | — | Tabela existe |
| `areas` | 2 | name, capacity, rules, is_active, … | |
| `staff` | 1 | auth_user_id, role, shift, status, … | |
| `users` | 4 | username, role, auth_user_id, **auth_id**, email, … | 2 SINDICO, 2 PORTEIRO (roles) |
| `boletos` | 0 | — | Tabela existe |
| `chat_messages` | 0 | — | Tabela existe |
| `roles` | 0 | — | RBAC vazio |
| `permissions` | 0 | — | RBAC vazio |
| `role_permissions` | 0 | — | RBAC vazio |
| `staff_invites` | 0 | — | Tabela existe |
| `resident_invites` | 0 | — | Tabela existe |
| `admin_audit_logs` | 0 | — | Tabela existe |
| `app_config` | 1 | condominium_name, theme, whatsapp_template_*, ai_* | Config server-side (paralela ao localStorage) |
| `notes` | 0 | — | Tabela existe |
| `crm_issues` | 0 | — | Tabela existe |
| `crm_units` | 0 | — | Tabela existe |
| `password_reset_tokens` | 0 | — | Tabela existe |

### 2.2 Tabelas documentadas no repo e não listadas acima

Scripts mencionam `resident` (singular), `funcionarios`, `chat_messages`, etc. No project ref consultado, **`residents` (plural)** respondeu; **`resident` singular** não foi probeada nesta fase. Executar Anexo A para listar **todas** as relations em `public`.

### 2.3 Staff / papéis (agregado, sem PII)

| Origem | Distribuição |
|--------|----------------|
| `users.role` | SINDICO: 2, PORTEIRO: 2 |
| `staff.role` | Porteiro: 1 |
| Unidades distintas em `residents.unit` (amostra completa anon) | **4** |

---

## 3. Policies (RLS)

### 3.1 Limitação da Fase 0

As **policies reais** (texto `USING` / `WITH CHECK`) **não foram exportadas** do catálogo PostgreSQL nesta execução (falta connection string / service role no ambiente de diagnóstico).  
A classificação abaixo combina:

1. **Comportamento observado** com anon (leitura de `users`, `packages`, `residents`, etc.).  
2. **Scripts versionados** no repositório (estado *esperado* se aplicados manualmente).  

**Antes da Fase 1:** executar **Anexo A** no SQL Editor e anexar resultado ao controle de versão (ou cofre ops).

### 3.2 Classificação por tabela (prioritárias)

| Tabela | RLS (repo / inferido) | Classificação | Resumo |
|--------|------------------------|---------------|--------|
| `packages` | `migrations/006` — staff via `is_staff_from_auth()`, morador por `recipient_id` | 🟡 | Melhor isolamento por **papel**, não por tenant; staff limitado a PORTEIRO/SINDICO em `users` |
| `notifications` | `supabase_notifications.sql` — `USING (true)` / `WITH CHECK (true)` | 🔴 | Comentários indicam modo dev |
| `occurrences` | `migrations/009` — SELECT/INSERT/UPDATE/DELETE `true` | 🔴 | |
| `boletos` | `supabase_create_boletos_table.sql` — CRUD `true` | 🔴 | |
| `notices` | `supabase_notices_rls_visibility.sql` — all roles `true` | 🔴 | |
| `users` | `supabase_create_users_table.sql` — SELECT `true` | 🔴 | |
| `residents` | *(vários scripts; não consolidado)* | 🟡 | Anon leu 4 linhas — política permissiva ou dados públicos parciais |
| `admin_audit_logs` | `migrations/008` — insert own, select admins amplos | 🟡 | Sem tenant; select inclui porteiro |
| **Storage `boletos`** | `supabase_storage_boletos_policies.sql` — read **public**, insert authenticated no bucket | 🔴 | Sem path por unidade/tenant |

### 3.3 Matriz policy × operação (preencher após Anexo A)

| Tabela | RLS ON? | SELECT | INSERT | UPDATE | DELETE |
|--------|---------|--------|--------|--------|--------|
| *Todas prioritárias* | **Pendente export SQL** | — | — | — | — |

---

## 4. Storage

| Bucket | Detectado | Acesso anon (probe) | Policies (repo) | Uso no app |
|--------|-----------|------------------------|-----------------|------------|
| `boletos` | Sim | Listagem **1 objeto** (amostra) | Leitura pública; upload autenticado | `uploadBoletoOriginalPdf` → path `original/{boletoId}.pdf` |
| `packages` | Probe OK, 0 objetos | List vazia | *Não documentado na raiz* | Encomendas usam **`packages.image_url`** (URL/base64 no row) |
| `avatars` | Probe OK, 0 objetos | — | — | Não mapeado na Fase 0 |
| `documents` | Probe OK, 0 objetos | — | — | Não mapeado na Fase 0 |

`listBuckets()` via anon retornou **lista vazia** (API admin); buckets confirmados por `storage.from(name).list`.

**Tamanho total Storage:** não medido (requer dashboard ou service role).

---

## 5. Migrations

### 5.1 Trilhas no repositório

| Local | Qtd. arquivos | Padrão de nome | Propósito |
|-------|---------------|----------------|-----------|
| `supabase/migrations/` | **11** | `YYYYMMDDHHMMSS_desc.sql` | RBAC, convites, retenção, pg_cron |
| `migrations/` | **18** (+ verify) | `NNN_desc.sql` | Auth, packages 006–007, occurrences, visitors, audit 008 |
| `scripts/migrations/` | **2** | auth_user_id enforce | Alternativa/overlap com `migrations/001` |
| Raiz `supabase_*.sql` | **42** | ad hoc | Fixes RLS, boletos, notifications, funções, seeds |
| `scripts/*.sql` | dezenas | operacional / boletos | Importação, diagnóstico |

### 5.2 Duplicatas e conflitos de nomenclatura

| Problema | Detalhe |
|----------|---------|
| **Auth user id duplicado** | `migrations/0001_add_auth_user_id.sql` vs `migrations/001_add_auth_user_id.sql` (abordagens diferentes: `resident` vs `residents`) |
| **Duas trilhas não unificadas** | `supabase/migrations/*` **não** inclui `006_packages_receipt_and_hide.sql` (está só em `migrations/`) |
| **RBAC** | Só em `supabase/migrations/20250301*` — **não** referenciado em `migrations/` |
| **Aplicação manual provável** | 42 scripts `supabase_*.sql` + SQL Editor → **schema drift** entre ambientes |
| **Estado live vs repo** | Colunas packages 006 ✅; RBAC seed ❌ (0 rows) → migrations **parcialmente** aplicadas |

### 5.3 Migrations provavelmente aplicadas (evidência live)

- `migrations/006_packages_receipt_and_hide.sql` (colunas + comportamento)  
- `migrations/008_admin_audit_logs.sql` (tabela existe)  
- `supabase/migrations/20250225*` / `20250226*` (tabelas invite existem)  
- Tabela `app_config` (server config)

### 5.4 Migrations provavelmente NÃO aplicadas (evidência live)

- `supabase/migrations/20250301120000_rbac_roles_permissions.sql` (+ seeds 500/700) — **0** roles/permissions  
- Conteúdo de `supabase_schema_complete.sql` — arquivo **vazio** no repo  

### 5.5 Ações **não** feitas (conforme regra Fase 0)

Nenhuma migration executada; nenhuma correção de drift.

---

## 6. Dados (contagens operacionais)

Contagens **via anon** — project `zaemlxjwhzrfmowbckmk`, 2026-08-08:

| Entidade | Quantidade |
|----------|------------|
| Moradores (`residents`) | 4 |
| Unidades distintas (campo `unit`) | 4 |
| Staff (`staff`) | 1 |
| Usuários staff (`users`) | 4 |
| Encomendas (`packages`) | 9 |
| Visitantes (`visitors`) | 2 |
| Ocorrências | 0 |
| Avisos / notice_reads | 0 |
| Notificações | 1 |
| Reservas | 0 |
| Boletos | 0 |
| Áreas comuns | 2 |
| Auth users | *não medido* |

**Sem exposição** de nomes, e-mails, CPF, tokens ou hashes no relatório.

---

## 7. Relacionamentos (modelo atual)

Diagrama lógico inferido do schema live + `services/dataService.ts`:

```
auth.users (Supabase Auth)
    ↑ auth_user_id / auth_id
    ├── public.users (PORTEIRO, SINDICO, …)
    ├── public.staff
    └── public.residents

public.residents
    ├── unit (string, desnormalizado — sem tabela units)
    └── id ← recipient_id em packages
              ← morador_id em notifications
              ← resident_id / morador_id em visitors
              ← resident_id em occurrences, boletos, reservations

public.packages
    ├── recipient_id → residents.id (opcional)
    ├── unit (string, redundante)
    └── image_url / qr_code_data (captura)

public.boletos
    ├── resident_id → residents.id
    └── unit (string); pdf em Storage boletos/original/{id}.pdf

public.notifications
    ├── morador_id → residents.id
    └── related_id → entidade (ex.: package.id)

public.app_config
    └── singleton operacional (condominium_name, templates) — paralelo ao localStorage
```

**Implicação SaaS:** hoje o “tenant” é **implicitamente** o whole database; vínculo morador↔unidade é **string `unit`**, não FK para `units(id)`.

---

## 8. Backup

Estratégia **documentada** (não executada nesta fase):

| Ativo | Método recomendado | RPO / RTO (meta) | Responsável |
|-------|-------------------|------------------|-------------|
| **PostgreSQL** | Supabase Dashboard → **Backups** (Plano Pro: PITR); ou `pg_dump` via connection string | Definir com plano Supabase | Ops / administrador |
| **Schema + RLS** | Anexo A → salvar `.sql` + `pg_dump --schema-only` | Snapshot pré-Fase 1 | Engenharia |
| **Policies Storage** | Export SQL `storage.objects` policies + lista buckets | Idem schema | Engenharia |
| **Storage objetos** | Supabase CLI `storage cp` ou sync bucket `boletos` | Incluir PDFs de boletos | Ops |
| **Auth users** | Export Admin + procedimento de re-vínculo `auth_user_id` | Documentar mapeamento | Engenharia |
| **Código** | Tag git + artefato Vercel (`dist` de build baseline) | Rollback deploy | Engenharia |

**Critério de go/no-go Fase 1:** restore testado **ou** backup verificado disponível + export Anexo A arquivado.

---

## 9. Build

Comando | Resultado |
|---------|-----------|
| `node -v` | **v24.13.0** |
| `npm -v` | **11.7.0** |
| `npm install` | OK (289 prod); **`npm install --include=dev`** necessário (+380 pacotes) — **vite/vitest ausentes** só com prod |
| `npm run build` | **Sucesso** (vite **5.4.21**, config efetiva: `vite.config.mjs`) |
| `@supabase/supabase-js` (resolvido) | **2.94.0** (package.json: ^2.39.3) |

### Warnings relevantes do build

- Chunk principal **~3,27 MB** (> limite 3000 kB configurado em `vite.config.ts`; build usou `.mjs` simplificado).  
- Import dinâmico + estático de `dataService.ts` (code-splitting subótimo).  
- PWA desabilitado no `vite.config.ts` principal.

**Alterações de código:** nenhuma. **`node_modules` / lockfile:** ambiente local atualizado para diagnóstico (não commitado nesta pasta — repositório git não detectado no workspace).

---

## 10. Testes

| Comando | Resultado |
|---------|-----------|
| `npm run test:run` | **8/8 passou** (2 arquivos: `unitFormatter`, `geminiHelpers`) |

### Baseline funcional (checklist — **não** reexecutado E2E nesta fase)

Registro de **regressão obrigatória** antes/depois da Fase 1:

1. Login staff  
2. Login morador  
3. Encomenda manual  
4. Encomenda QR  
5. Encomenda foto  
6. Encomenda voz (Sentinela)  
7. Notificação encomenda  
8. Retirada encomenda  
9. Ocorrência  
10. Importação boleto  
11. Reserva  
12. Offline / outbox  
13. Realtime  
14. Sentinela  

*Nenhum fluxo acima foi alterado na Fase 0.*

---

## 11. Riscos

| # | Risco | Severidade |
|---|--------|------------|
| 1 | **Project ref incerto** — Vercel prod vs `.env.localnet` | Alta |
| 2 | Contagens anon **≠** produção real (RLS / ambiente errado) | Alta |
| 3 | **Schema drift** — 42 SQL ad hoc + 2 trilhas migration | Alta |
| 4 | RBAC no banco **vazio** vs UI de permissões | Média |
| 5 | RLS 🔴 em notifications, occurrences, boletos, notices | Alta (SaaS) |
| 6 | **Chave anon commitada** em `.env.localnet` | Alta (segurança repo) |
| 7 | Imagens encomenda em row (`image_url`) — crescimento DB | Média |
| 8 | Storage boletos leitura pública (script repo) | Alta |
| 9 | Build depende de **devDependencies** — CI deve usar `npm ci` completo | Média |
| 10 | Ausência export pg_catalog nesta fase — decisões Fase 1 com lacuna | Média |

---

## 12. Decisões necessárias para Fase 1

1. **Confirmar** project Supabase oficial (Vercel env = ref único) e obter **service role** / DB URL **apenas** em cofre (nunca commit).  
2. **Executar Anexo A**; arquivar JSON/SQL de policies, FKs, índices, triggers.  
3. **Recontar dados** com sessão **staff autenticada** ou SQL postgres (totais reais 252 unidades).  
4. **Unificar trilha migration** — decidir: só `supabase/migrations` + absorver `migrations/*.sql` históricos.  
5. **Congelar baseline git** (tag) + backup verificado.  
6. **Remover/rotação** anon key exposta em `.env.localnet` (processo segurança, fora do escopo structural).  
7. Só então: desenho `organizations → condominiums → units → memberships` com backfill **single tenant**.

---

## Anexo A — SQL para export completo (rodar no Supabase SQL Editor)

**Não destrutivo.** Copiar resultados para arquivo seguro.

```sql
-- A1) Todas as tabelas public
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY 1;

-- A2) Contagens reais (postgres bypass RLS)
SELECT schemaname, relname AS table, n_live_tup AS approx_rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- A3) Colunas
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- A4) PKs e FKs
SELECT tc.table_name, tc.constraint_name, tc.constraint_type, kcu.column_name,
       ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
ORDER BY tc.table_name;

-- A5) Índices
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;

-- A6) Triggers
SELECT event_object_table AS table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY 1, 2;

-- A7) RLS habilitado
SELECT c.relname AS table, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY 1;

-- A8) Policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

-- A9) Storage buckets (metadados)
SELECT * FROM storage.buckets;
```

---

## Anexo B — Histórico `supabase/migrations` (ordem)

1. `20250225000000_staff_invites.sql`  
2. `20250226000000_staff_invites_rls_allow_adm_and_staff.sql`  
3. `20250226100000_resident_invites.sql`  
4. `20250301090000_enable_pg_cron.sql`  
5. `20250301100000_data_retention_cleanup_function.sql`  
6. `20250301120000_rbac_roles_permissions.sql`  
7. `20250301130000_rbac_role_permissions_allow_staff_admin.sql`  
8. `20250301140000_rbac_rpc_grant_revoke.sql`  
9. `20250301150000_rbac_grant_all_permissions_to_all_roles.sql`  
10. `20250301160000_rbac_rpc_normalize_role.sql`  
11. `20250301170000_rbac_permissions_granular_pages.sql`  

## Anexo C — Histórico `migrations/` (ordem numérica)

`0001`, `001`, `002`, `003`, `004`, `005`, `006`, `007`, `008`, `009`, `010`, `011`, `012`, `013`, `014` (+ `verify_occurrences_table.sql`).

---

## FECHAMENTO DA FASE 0

**Data do fechamento:** 2026-08-08  
**Regras respeitadas:** nenhuma alteração de banco, RLS, Storage, Auth ou código funcional da aplicação.

---

### Supabase oficial

| Fonte | Project ref | Domínio | Uso |
|-------|-------------|---------|-----|
| `.env.production` (repo) | `xxxx` (placeholder) | — | Template; **não** define produção no Git |
| `.env.local` | — | — | **Arquivo inexistente** no workspace |
| `.env.localnet` (repo) | `zaemlxjwhzrfmowbckmk` | `https://zaemlxjwhzrfmowbckmk.supabase.co` | Dev/build `localnet`; credencial anon versionada |
| `services/supabase.ts` | *(runtime)* | Lê `import.meta.env.VITE_SUPABASE_URL` | Único client do frontend |
| `vercel.json` | — | — | **Não** declara env; variáveis vêm do **painel Vercel** no build |
| **Deploy Vercel ativo** (`qualivida-club-residence.vercel.app`) | **`zaemlxjwhzrfmowbckmk`** | `https://zaemlxjwhzrfmowbckmk.supabase.co` | Evidência: bundle JS de produção (`/assets/index-*.js`) contém host `zaemlxjwhzrfmowbckmk.supabase.co` |
| `app-qualivida.vercel.app` (documentação legada) | — | — | HTTP **404** (não é deploy ativo) |

**Conclusão:**

# PRODUÇÃO VERCEL (`qualivida-club-residence.vercel.app`)  
# =  
# SUPABASE OFICIAL (`zaemlxjwhzrfmowbckmk`)

Não há inconsistência **detectável** entre o frontend publicado nessa URL e o project ref acima.  
**Recomendação operacional:** confirmar no painel Vercel que `VITE_SUPABASE_URL` aponta para o mesmo host (auditoria de configuração, não de código).  
**Supabase CLI** (`supabase link --project-ref zaemlxjwhzrfmowbckmk`): **falhou** — conta CLI logada **não** tem privilégio sobre esse projeto (export SQL/pg_dump via CLI indisponível neste ambiente).

---

### RLS real

#### Status do export `pg_policies`

| Item | Status |
|------|--------|
| Query `pg_policies` / `pg_class.relrowsecurity` | **Não executado** no catálogo PostgreSQL (sem connection string postgres nem `service_role` no ambiente de diagnóstico; link CLI negado) |
| SQL para operador | **Anexo A** (seções A7–A8) + **Anexo D** abaixo |

#### Evidências indiretas (cliente anon, project `zaemlxjwhzrfmowbckmk`)

| Evidência | Implicação |
|-----------|------------|
| `SELECT`/count em `users`, `residents`, `packages` **funciona** sem sessão Auth | RLS **ausente**, **desligado**, ou policies **muito permissivas** para role `anon` — **diverge** do modelo restritivo de `migrations/006` (staff/morador) se essa migration estiver plenamente aplicada |
| `INSERT` em `occurrences` com anon falhou por **`occurrences_status_check`**, não por RLS | PostgREST **aceitou** a operação até constraint — compatível com policies tipo `WITH CHECK (true)` (`migrations/009`) |
| Função `rpc_grant_role_permission` **existe** e responde (`P0001` “Apenas Síndico…”) | Migrations RBAC **≥ 202503011400** aplicadas ao menos para **funções** |

#### Matriz por tabela (policies **live** = pendente export SQL)

Legenda: **Live** = preencher após Anexo D. **Repo** = script versionado mais específico encontrado. **Class.** = expectativa se repo aplicado.

| Tabela | RLS ON? (live) | SELECT | INSERT | UPDATE | DELETE | Class. (repo) |
|--------|----------------|--------|--------|--------|--------|---------------|
| `users` | *pendente* | Repo: `Users can view all data` → `USING (true)` | *não no script base* | *—* | *—* | 🔴 |
| `staff` | *pendente* | *sem policy dedicada no repo* | *—* | *—* | *—* | 🟡/🔴 |
| `residents` | *pendente* | *sem policy consolidada no repo* | *—* | *—* | *—* | 🟡/🔴 |
| `packages` | *pendente* | Repo: `packages_staff_select` → `is_staff_from_auth()`; morador por `recipient_id` | staff `WITH CHECK is_staff()` | staff / morador (update limitado) | staff delete | 🟡 (se 006 ativo) |
| `package_items` | *pendente* | *—* | *—* | *—* | *—* | ? |
| `occurrences` | *pendente* | Repo: `occurrences_select_all` → `true` | `insert_all` → `true` | `update_all` → `true` | `delete_all` → `true` | 🔴 |
| `notices` | *pendente* | Repo: `notices_*_all_roles` → `true` | `true` | `true` | `true` | 🔴 |
| `notice_reads` | *pendente* | `true` | `true` | *—* | `true` | 🔴 |
| `notifications` | *pendente* | Repo: `USING (true)` (dev) | `WITH CHECK (true)` | `true` | delete `true` | 🔴 |
| `reservations` | *pendente* | *trigger* `enforce_reservation_resident_from_auth` (003) | *—* | *—* | *—* | 🟡 |
| `areas` | *pendente* | *—* | *—* | *—* | *—* | ? |
| `boletos` | *pendente* | Repo: CRUD `USING (true)` | `true` | `true` | `true` | 🔴 |
| `roles` | *pendente* | Repo: authenticated SELECT `true` | admin RPC | — | admin | 🟡 |
| `permissions` | *pendente* | idem | — | — | — | 🟡 |
| `role_permissions` | *pendente* | authenticated SELECT | insert/delete admin | — | — | 🟡 |
| `staff_invites` | *pendente* | `is_admin_for_staff_invites()` | idem | — | — | 🟡 |
| `resident_invites` | *pendente* | admin policies (261000) | admin | — | — | 🟡 |
| `admin_audit_logs` | *pendente* | Repo 008: admins | insert own | — | — | 🟡 |
| `app_config` | *pendente* | *—* | *—* | *—* | *—* | ? |

#### Funções SECURITY DEFINER (autorização — repo + live parcial)

| Função | Origem | Live |
|--------|--------|------|
| `is_staff_from_auth()` | `migrations/006` | *não testada com sessão staff nesta fase* |
| `current_resident_id_from_auth()` | `006` | idem |
| `prevent_package_edit_by_resident()` (trigger) | `006` | *pendente export triggers* |
| `is_admin_for_staff_invites()` | `20250226000000` | *pendente* |
| `rpc_grant_role_permission` / `rpc_revoke_role_permission` | `202503011400+` | **Confirmada** (chamada anon retorna erro de negócio) |
| `run_data_retention_cleanup()` | `20250301100000` | *pendente* |
| `seed_*` RBAC (drop após seed) | migrations RBAC | *pendente* |

#### Views / grants

Export completo via Anexo D (`information_schema`, `pg_policies`, `storage.policies`). **Não alterado** nesta fase.

---

### Storage

Inspeção via API Storage (anon), **sem modificar** buckets:

| Bucket | Acessível (list) | Objetos (amostra) | Público/privado (live) | Policies (repo) | Finalidade |
|--------|------------------|-------------------|-------------------------|-----------------|------------|
| `boletos` | Sim | ≥ 1 | *pendente* (`storage.buckets`) | `boletos_read_all` → **public** SELECT; insert/update **authenticated** | PDFs originais `original/{boletoId}.pdf` |
| `packages` | Sim | 0 | *pendente* | *não versionado na raiz* | Probe OK; app usa sobretudo **`packages.image_url`** no Postgres |
| `package-images` | Sim | 0 | *pendente* | — | Possível bucket preparado |
| `package_images` | Sim | 0 | *pendente* | — | Variante de nome |
| `residents` | Sim | 0 | *pendente* | — | Fotos morador (potencial) |
| `avatars` | Sim | 0 | *pendente* | — | Avatares |
| `documents` | Sim | 0 | *pendente* | — | Documentos gerais |
| `encomendas` / `images` | Sim | 0 | *pendente* | — | Legado/alternativo |

`listBuckets()` via anon retornou **[]** (API admin); buckets confirmados por `storage.from(name).list`.

**Imagens de encomendas:** fluxo principal = coluna **`packages.image_url`** (URL ou base64), não Storage obrigatório.

---

### RBAC

#### Por que `roles` / `permissions` / `role_permissions` estão vazias?

| Hipótese | Evidência |
|----------|-----------|
| Seed RBAC nunca rodou ou foi truncado | 0 linhas; tabelas **existem** e respondem |
| Migrations de **estrutura** aplicadas | `rpc_grant_role_permission` **existe** |
| Seed “todos com tudo” (`202503011500`) não persistiu dados | 0 em `role_permissions` |

#### Onde permissões são armazenadas hoje?

| Camada | Mecanismo |
|--------|-----------|
| **Banco (canônico RBAC)** | Tabelas `roles`, `permissions`, `role_permissions` — **vazias** |
| **Frontend — hardcode** | `AuthContext`: SINDICO recebe `ALL_PERMISSION_KEYS` **sem** consultar banco |
| **Frontend — dinâmico** | Demais roles: `getPermissionsByRoleName()` → join nas tabelas RBAC → **lista vazia** se seed ausente |
| **Frontend — menu** | `Layout.tsx`: `roles` + `hasPermission(key)` → porteiro **sem** keys granulares **perde** itens de menu |
| **Papel legado** | Campo `users.role` / `staff.role` (PORTEIRO, SINDICO, …) — login e fluxos |
| **Config condomínio** | `app_config` (1 row) + `localStorage` `app_config` |

#### Onde são verificadas?

| Local | Tipo |
|-------|------|
| `hooks/useHasPermission.ts` | UI |
| `Layout.tsx`, `App.tsx` (rotas/abas) | UI |
| `AdminPermissionsView` + `permissionsService` | UI + RPC |
| **PostgreSQL RLS** | Dados — **predominantemente fraco/permissivo** (ver RLS) |

#### Autorização real no banco?

**Parcial e inconsistente:** `packages` (se 006 ativo), convites, audit logs, RBAC RPCs; muitas tabelas com scripts **`USING (true)`**. Evidência anon lendo dados reforça **gap** de enforcement.

#### Proteção contra cliente não autorizado?

| Vetor | Proteção atual |
|-------|----------------|
| UI escondida | Sim (perm./role) — **contornável** |
| PostgREST direto (anon/authenticated) | **Insuficiente** em várias tabelas |
| Storage | Upload autenticado (repo); leitura boletos **public** (repo) |

**Não corrigido nesta fase** — apenas diagnosticado.

---

### Backup

| Ativo | Ferramenta no repo | Procedimento recomendado pré-Fase 1 |
|-------|-------------------|-------------------------------------|
| Schema + RLS | **Anexo A/D** (SQL Editor) | Exportar resultado de A7–A8, A5–A6; salvar `.sql` datado |
| Dados | *sem script dedicado* | Supabase Dashboard → **Backups** / `pg_dump` com connection string (Settings → Database) |
| Auth | *—* | Export usuários + plano re-vínculo `auth_user_id` |
| Storage | *—* | CLI `supabase storage cp` ou sync bucket `boletos` (+ demais com objetos) |
| Código | *—* | Tag Git `pre-multitenant-baseline` (quando repo Git existir) |

**Backup destrutivo / restore test:** **não executado** nesta fase.

---

### Baseline Git

| Item | Resultado |
|------|-----------|
| Repositório `.git` no workspace | **Não detectado** |
| Tag `pre-multitenant-baseline` | **Não criada** — documentar baseline por **cópia do tree** + hash do bundle Vercel (`index-BrROEMGa.js` em 2026-08-08) + este documento |

---

### Bloqueadores restantes

| # | Bloqueador | Status |
|---|------------|--------|
| 1 | Confirmar Supabase produção Vercel | **Fechado** (bundle `qualivida-club-residence.vercel.app` = `zaemlxjwhzrfmowbckmk`) |
| 2 | Export **live** `pg_policies` + RLS ON por tabela | **Aberto** — operador com acesso ao projeto Supabase deve rodar **Anexo D** |
| 3 | Metadados Storage (`storage.buckets`, policies `storage.objects`) | **Aberto** — Anexo D |
| 4 | Backup verificado (restore test ou snapshot confirmado) | **Aberto** |
| 5 | Baseline Git tag | **Aberto** (sem Git) |
| 6 | Contagens reais de dados (252 unidades) vs. anon | **Aberto** — recontar com SQL postgres ou sessão staff |

---

## Anexo D — SQL único para fechar bloqueador RLS/Storage (operador)

Executar no **SQL Editor** do project `zaemlxjwhzrfmowbckmk`. Copiar resultado para arquivo seguro. **Somente leitura.**

```sql
-- D1) RLS por tabela prioritária
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'users','staff','residents','packages','package_items','occurrences',
    'notices','notice_reads','notifications','reservations','areas','boletos',
    'roles','permissions','role_permissions','staff_invites','resident_invites',
    'admin_audit_logs','app_config'
  )
ORDER BY 1;

-- D2) Policies detalhadas (mesmas tabelas + storage)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN (
    'users','staff','residents','packages','package_items','occurrences',
    'notices','notice_reads','notifications','reservations','areas','boletos',
    'roles','permissions','role_permissions','staff_invites','resident_invites',
    'admin_audit_logs','app_config'
  ))
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, policyname;

-- D3) Funções SECURITY DEFINER (autorização)
SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND (p.proname ILIKE '%auth%' OR p.proname ILIKE '%staff%' OR p.proname ILIKE '%resident%'
       OR p.proname ILIKE '%grant%' OR p.proname ILIKE '%revoke%' OR p.proname ILIKE '%admin%'
       OR p.proname ILIKE '%package%')
ORDER BY 1;

-- D4) Triggers em tabelas prioritárias
SELECT event_object_table AS table_name, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
    'packages','occurrences','reservations','residents','users','staff'
  )
ORDER BY 1, 2;

-- D5) Buckets
SELECT id, name, public, file_size_limit, allowed_mime_types, created_at
FROM storage.buckets
ORDER BY name;

-- D6) Contagens reais (bypass RLS como postgres)
SELECT 'residents' AS tbl, count(*) FROM public.residents
UNION ALL SELECT 'packages', count(*) FROM public.packages
UNION ALL SELECT 'users', count(*) FROM public.users
UNION ALL SELECT 'staff', count(*) FROM public.staff
UNION ALL SELECT 'boletos', count(*) FROM public.boletos
UNION ALL SELECT 'occurrences', count(*) FROM public.occurrences
UNION ALL SELECT 'notifications', count(*) FROM public.notifications
UNION ALL SELECT 'roles', count(*) FROM public.roles
UNION ALL SELECT 'permissions', count(*) FROM public.permissions
UNION ALL SELECT 'role_permissions', count(*) FROM public.role_permissions;
```

---

*Documento atualizado no fechamento da Fase 0. Aguardar autorização explícita para Fase 1.*
