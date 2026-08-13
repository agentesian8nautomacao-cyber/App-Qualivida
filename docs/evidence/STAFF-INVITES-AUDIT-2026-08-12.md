# STAFF INVITES AUDIT — 2026-08-12

**Tipo:** Gate 0.1 — READ-ONLY  
**Data/hora:** 2026-08-12  
**Escopo:** origem, schema (migrations), uso no frontend/API, RLS documentada, risco multi-tenant e conteúdo do bundle.

**Nada alterado** (banco, RLS, policies, dados, código).  
**Policies live:** **UNKNOWN** até D2 (este audit usa **migrations versionadas** + código).

---

## Classificação geral

| Classificação | Aplicação |
|---------------|-----------|
| **SAFE** (para bloqueio imediato de D1/D2/D5) | Bundle **não** embute tokens de convite reais; apenas nomes de feature/tabela/API |
| **REVIEW REQUIRED** (segurança de produto / multi-tenant) | Coluna `token` em claro; SELECT admin global; **sem** `condominium_id` / tenant scope |
| **UNKNOWN** | Estado live de RLS/policies e se a tabela está populada em produção |
| **FAIL** | *Não atribuído* como bloqueio de execução D1/D2/D5 (sem evidência de vazamento de segredo no bundle) |

**Veredito Gate 0.1 (execução de evidências):** não bloqueia D1/D2/D5 por exposição de segredo no bundle.  
**Veredito arquitetural:** **REVIEW REQUIRED** antes de multi-tenant / M8+ em `staff_invites`.

---

## 1. Objeto no banco

| Campo | Evidência |
|-------|-----------|
| Objeto | Tabela `public.staff_invites` |
| Origem | `supabase/migrations/20250225000000_staff_invites.sql` |
| Propósito | Convites Portaria/ADM: link com token; aceite cria auth + staff + users |

---

## 2. Colunas (migration)

| Coluna | Tipo | Nota |
|--------|------|------|
| `id` | uuid PK | `gen_random_uuid()` |
| `email` | text NOT NULL | Destinatário |
| `role` | text NOT NULL | CHECK `PORTEIRO` \| `SINDICO` (código também envia outros roles — possível divergência) |
| `token` | text NOT NULL UNIQUE | **Segredo de capacidade** do link |
| `expires_at` | timestamptz NOT NULL | Expiração |
| `created_by` | text nullable | Auditoria leve |
| `created_at` | timestamptz | Default `now()` |
| `used_at` | timestamptz nullable | Marca uso |

Índices: `token`, `email`, `expires_at` (parcial unused).

**Não há** coluna `condominium_id` / `organization_id` na migration.

---

## 3. Tokens / secrets / hashes / credenciais

| Item | Presente? | Evidência |
|------|-----------|-----------|
| Token de convite | **SIM** — texto único | Coluna `token`; gerado por `generateInviteToken()` (32 bytes → hex 64 chars) em `services/dataService.ts` |
| Hash do token | **NÃO** no schema | Armazenado em claro |
| Senha do usuário | **NÃO** na tabela | Senha só no POST de aceite (API) → Auth |
| `service_role` | Só no **servidor** API | `api/staff-invite.ts`, `api/accept-staff-invite.ts` leem `SUPABASE_SERVICE_ROLE_KEY` do env de runtime — **não** no bundle analisado como valor embutido de convite |

---

## 4. O frontend recebe esses valores?

| Fluxo | O que o browser vê |
|-------|-------------------|
| **Criação** (`createStaffInvite`) | Admin autenticado faz `insert` com `token`; recebe de volta `inviteLink` contendo o token na query string (`/accept-invite?token=…`) |
| **Aceite** (`AcceptStaffInvitePage`) | Lê `token` da **URL**; chama API; recebe JSON `{ email, role, expiresAt }` — **não** lista de tokens do banco |
| **API GET** | Compara token; **não** devolve o campo `token` na resposta |

---

## 5. Rotas / componentes / API

| Peça | Papel |
|------|-------|
| `App.tsx` | Rota path `/accept-invite` → `AcceptStaffInvitePage` |
| `components/AcceptStaffInvitePage.tsx` | UI de aceite |
| `components/modals/ActionModals.tsx` | Chama `createStaffInvite` |
| `services/dataService.ts` | `createStaffInvite` → insert client Supabase |
| `api/staff-invite.ts` | `GET /api/staff-invite?token=` |
| `api/accept-staff-invite.ts` | `POST /api/accept-staff-invite` |
| `scripts/dev-api-staff-invite.mjs` | Dev local das mesmas rotas |

---

## 6. Queries que acessam a tabela

| Local | Operação | Colunas |
|-------|----------|---------|
| `dataService.createStaffInvite` | INSERT | email, role, token, expires_at, created_by |
| `api/staff-invite.ts` | SELECT | email, role, expires_at, used_at **WHERE token=** |
| `api/accept-staff-invite.ts` | SELECT id,email,role,expires_at,used_at; depois UPDATE `used_at` | service_role |
| Retention | DELETE expirados/usados | `20250301100000_data_retention_cleanup_function.sql`, scripts SQL |

---

## 7. Policies RLS (repo — não live)

| Policy / função | Comportamento (migration) |
|-----------------|---------------------------|
| RLS ENABLED | Sim |
| `staff_invites_insert_admin` | INSERT se `is_admin_for_staff_invites()` |
| `staff_invites_select_admin` | SELECT se mesma função |
| `is_admin_for_staff_invites()` | SECURITY DEFINER: admin em `users` ou `staff` por role |
| UPDATE/DELETE client | Comentário: via service_role na API |

**Live:** **UNKNOWN** até executar D2.

---

## 8. Tenant-scoped?

| Critério | Resultado |
|----------|-----------|
| Coluna de site/condo | **NÃO** (migration) |
| Policy por condominium/membership | **NÃO** |
| Isolamento atual | **Global por projeto** — qualquer admin que passe a policy vê/insere convites do **mesmo** banco |

No piloto single-tenant isso é coerente com o app atual. Para Operaut multi-site: **REVIEW REQUIRED** (risco futuro de cross-site).

---

## 9. Risco cross-tenant/site

| Cenário | Avaliação |
|---------|-----------|
| Hoje (1 site implícito) | Cross-tenant **N/A** na prática; admins do mesmo projeto compartilham a tabela |
| Pós M1–M8 sem ajuste | Admin do site A poderia, em tese, listar tokens de convites do site B se ambos no mesmo DB sem filtro — **REVIEW REQUIRED** |
| Classificação | **REVIEW REQUIRED** (não SAFE para multi-tenant) |

---

## 10. Bundle de produção

| Check (2026-08-12, `index-BrROEMGa.js`) | Resultado |
|----------------------------------------|-----------|
| String `staff_invites` | **SIM** — nome de feature/tabela no JS |
| String `staff-invite` | **SIM** — path/API |
| Project ref antigo `asfct…` | **NÃO** |
| Project ref `zaem…` | **SIM** |
| Tokens de convite hardcoded | **Sem evidência** nesta auditoria (não há dump de valores de convite; presença do **nome** da tabela ≠ dados sensíveis) |

**Classificação bundle:** **SAFE** quanto a “segredo de convite embutido”; conteúdo = código de feature.

### Relação com D1

`staff_invites` aparece em D1 porque a lista prioritária do Anexo D inclui a tabela — **correto e intencional**. Não indica vazamento no bundle.

---

## Matriz de classificações por pergunta

| # | Pergunta | Classificação | Evidência |
|---|----------|---------------|-----------|
| 1 | Objeto | **SAFE** (identificado) | Migration CREATE TABLE |
| 2 | Colunas | **SAFE** (schema repo) | Migration |
| 3 | Secrets na tabela | **REVIEW REQUIRED** | `token` plaintext |
| 4 | Frontend recebe | **REVIEW REQUIRED** | Link com token; admin insert |
| 5 | Rotas | **SAFE** (mapeadas) | App/API/modals |
| 6 | Queries | **SAFE** (mapeadas) | dataService + api |
| 7 | RLS | **UNKNOWN** live / **REVIEW REQUIRED** desenho | Migrations; D2 pendente |
| 8 | Tenant-scoped | **FAIL** como isolamento multi-site (ausente) — no piloto single-tenant = **REVIEW REQUIRED** | Sem condo_id |
| 9 | Cross-site | **REVIEW REQUIRED** | Sem filtro de site |
| 10 | Bundle sensível | **SAFE** | Só nomes de feature |

---

## Ações recomendadas (NÃO executadas nesta tarefa)

1. Incluir `staff_invites` em D2 e arquivar policies live.  
2. Em fase multi-tenant: `condominium_id` + RLS por membership; evitar SELECT amplo de `token`.  
3. Considerar hash de token at-rest (futuro).  
4. Não bloquear D1/D2/D5 por este item, salvo se D2 live revelar policy `USING (true)` para anon — aí reavaliar.

---

*READ-ONLY. Sem correções aplicadas.*
