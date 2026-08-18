# Vercel Hobby — Otimização de Serverless Functions

**Data:** 2026-08-17  
**Objetivo:** Reduzir Serverless Functions detectadas pelo Vercel para ≤ 12 (Hobby plan)  
**Restrições respeitadas:** sem migration, sem alteração Supabase, Master Fase C preservado, M5 = NOT READY

---

## 1. Quantidade inicial de Functions

**Contagem estimada pelo Vercel (pré-consolidação): 24**

Cada arquivo `.ts` em `api/` com export default (fora de pastas `_lib`) era contado como Function separada.

| # | Function (URL) | Arquivo | Consumidor | Método | Necessária? | Pode consolidar? |
|---|----------------|---------|------------|--------|-------------|------------------|
| 1 | `/api/accept-resident-invite` | `api/accept-resident-invite.ts` | *(órfão — acesso morador removido)* | POST | **Não** | Remover |
| 2 | `/api/resident-invite` | `api/resident-invite.ts` | *(órfão)* | GET | **Não** | Remover |
| 3 | `/api/accept-staff-invite` | `api/accept-staff-invite.ts` | `AcceptStaffInvitePage.tsx` | POST | Sim | Sim |
| 4 | `/api/staff-invite` | `api/staff-invite.ts` | `AcceptStaffInvitePage.tsx` | GET | Sim | Sim |
| 5 | `/api/send-invite-email` | `api/send-invite-email.ts` | `ActionModals.tsx` | POST | Sim | Sim |
| 6 | `/api/create-auth-user` | `api/create-auth-user.ts` | `dataService.ts` | POST | Sim | Sim |
| 7 | `/api/master/session` | `api/master/session.ts` | `services/masterApi.ts` | GET | Sim | Sim |
| 8 | `/api/master/dashboard` | `api/master/dashboard.ts` | `services/masterApi.ts` | GET | Sim | Sim |
| 9 | `/api/master/organizations` | `api/master/organizations.ts` | `services/masterApi.ts` | GET | Sim | Sim |
| 10 | `/api/master/organizations/:id` | `api/master/organizations/[id].ts` | `services/masterApi.ts` | GET/PATCH | Sim | Sim |
| 11 | `/api/v1/health` | `api/v1/health.ts` | n8n, probes, dev-api | GET | Sim | Sim |
| 12 | `/api/v1/events` | `api/v1/events.ts` | API v1 / observability | GET | Sim | Sim |
| 13 | `/api/v1/boletos` | `api/v1/boletos.ts` | API v1 | GET | Sim | Sim |
| 14 | `/api/v1/authz-probe` | `api/v1/authz-probe.ts` | probes G3 | GET | Sim | Sim |
| 15 | `/api/v1/confirmation-probe` | `api/v1/confirmation-probe.ts` | probes G4 | GET/POST | Sim | Sim |
| 16 | `/api/v1/protected-probe` | `api/v1/protected-probe.ts` | probes G2 | GET | Sim | Sim |
| 17 | `/api/v1/residents/identify` | `api/v1/residents/identify.ts` | API v1 / n8n | GET | Sim | Sim |
| 18 | `/api/v1/units/identify` | `api/v1/units/identify.ts` | API v1 | GET | Sim | Sim |
| 19 | `/api/v1/operations/occurrences` | `api/v1/operations/occurrences.ts` | API v1 | POST | Sim | Sim |
| 20 | `/api/v1/operations/occurrences/update` | `api/v1/operations/occurrences/update.ts` | API v1 | PATCH | Sim | Sim |
| 21 | `/api/v1/operations/packages` | `api/v1/operations/packages/index.ts` | API v1 | POST | Sim | Sim |
| 22 | `/api/v1/operations/packages/pickup` | `api/v1/operations/packages/pickup.ts` | API v1 | POST | Sim | Sim |
| 23 | `/api/v1/operations/reservations` | `api/v1/operations/reservations/index.ts` | API v1 | POST | Sim | Sim |
| 24 | `/api/v1/operations/reservations/cancel` | `api/v1/operations/reservations/cancel.ts` | API v1 | POST | Sim | Sim |

**Nota:** Arquivos em pastas `_lib/` (ex.: `api/v1/_lib/**`, `api/master/_lib/**`) **não** são expostos como rotas pelo Vercel (prefixo `_`).

---

## 2. APIs legadas de morador

| Arquivo | Consumidores restantes | Decisão |
|---------|------------------------|---------|
| `api/accept-resident-invite.ts` | Nenhum (UI removida) | **Removido** (já ausente no deploy) |
| `api/resident-invite.ts` | Nenhum | **Removido** |
| `components/AcceptResidentInvitePage.tsx` | Nenhum | **Removido** |

**Preservado:** `public.residents`, `ResidentsView`, CRUD operacional, dados de moradores.

---

## 3. Consolidação implementada

### Arquitetura final: **1 Serverless Function**

```
api/[...path].ts          ← única Function detectada pelo Vercel
├── /api/master/*         → handleLiveMasterRequest (api/master/_lib/live.ts)
├── /api/v1/*             → routeV1Request (api/v1/_lib/router.ts)
└── /api/* (legacy)       → routeLegacyApiRequest (api/_lib/legacyRouter.ts)
```

### Handlers movidos (não contam como Functions)

| Grupo | Destino |
|-------|---------|
| Legacy staff/auth | `api/_lib/handlers/legacy/` |
| API v1 | `api/v1/_lib/handlers/` |
| Master (lógica) | `api/master/_lib/` *(inalterado)* |
| Resend helper | `api/_lib/resend.ts` |

### URLs HTTP preservadas

Nenhuma URL consumida pelo frontend ou integrações foi alterada:

- `/api/staff-invite`, `/api/accept-staff-invite`, `/api/send-invite-email`, `/api/create-auth-user`
- `/api/master/session`, `/api/master/dashboard`, `/api/master/organizations`, `/api/master/organizations/:id`
- Todas as rotas `/api/v1/*` existentes

---

## 4. Functions removidas

| Arquivo removido | Motivo |
|------------------|--------|
| `api/accept-resident-invite.ts` | Obsoleto — acesso morador removido |
| `api/resident-invite.ts` | Obsoleto |
| `api/master/session.ts` | Consolidado em catch-all |
| `api/master/dashboard.ts` | Consolidado |
| `api/master/organizations.ts` | Consolidado |
| `api/master/organizations/[id].ts` | Consolidado |
| `api/v1/health.ts` (+ 13 rotas v1) | Movidos para `_lib/handlers/` |
| `api/staff-invite.ts` (+ 3 legacy) | Movidos para `_lib/handlers/legacy/` |

---

## 5. Quantidade final de Functions

| Métrica | Valor |
|---------|-------|
| **Functions finais (local)** | **1** (`api/[...path].ts`) |
| Margem Hobby (limite 12) | **11 Functions livres** |
| Confirmação Vercel deploy | Pendente próximo deploy (CLI local sem project settings) |

---

## 6. APIs preservadas

- Login operacional (Supabase Auth frontend)
- Convites staff: GET/POST staff-invite, accept-staff-invite, send-invite-email
- create-auth-user (server-only, service_role)
- Master: session, dashboard, organizations, organization detail (401/403/200)
- API v1 completa: health, events, boletos, probes, operations, residents/units identify

---

## 7. APIs removidas

- `POST /api/accept-resident-invite`
- `GET /api/resident-invite`

---

## 8. Testes

```
npm run test:run
Test Files  23 passed (23)
Tests       333 passed (333)
```

Inclui:
- `api/master/_lib/fase-c.master-authz.test.ts` — authz Master (401, 403, 200, audit)
- `api/v1/_lib/foundation.test.ts` e suites G2–G7

---

## 9. Build

```
npm run build
✓ built in 3m 3s
```

```
npx vercel build
→ No Project Settings found locally (requer vercel pull / VERCEL_TOKEN)
```

Contagem final de Functions será confirmada no próximo deploy Vercel Hobby.

---

## 10. Impacto no Master

| Aspecto | Status |
|---------|--------|
| Autenticação JWT user-scoped | **Preservado** (`live.ts`) |
| `is_platform_admin()` / RLS | **Preservado** |
| `authorizeMasterAction` server-side | **Preservado** |
| 401 sem token | **Preservado** (testes) |
| 403 non-master / suspended | **Preservado** (testes) |
| Audit events | **Preservado** |
| URLs `/api/master/*` | **Inalteradas** |
| Arquitetura Fase C | **Não alterada** — apenas entry point consolidado |

---

## 11. Impacto no Supabase

| Item | Alteração |
|------|-----------|
| Migrations | **Nenhuma** |
| Tabelas | **Nenhuma** |
| RLS / policies | **Nenhuma** |
| service_role no frontend | **Não** — permanece server-only |

---

## 12. Confirmações finais

- [x] Nenhuma migration executada
- [x] M5 = NOT READY (sem alteração)
- [x] Morador continua sem acesso
- [x] `vercel.json` — sem rewrites para mascarar contagem
- [x] ≤ 12 Functions (meta: 1)
- [x] Build PASS
- [x] Tests PASS

---

## 13. Arquivos-chave pós-otimização

| Arquivo | Papel |
|---------|-------|
| `api/[...path].ts` | Única Serverless Function — dispatcher |
| `api/_lib/legacyRouter.ts` | Roteamento legacy staff/auth |
| `api/v1/_lib/router.ts` | Roteamento API v1 |
| `api/master/_lib/live.ts` | Auth + handler Master live |
| `api/master/_lib/handler.ts` | Lógica Master (authz, audit) |
