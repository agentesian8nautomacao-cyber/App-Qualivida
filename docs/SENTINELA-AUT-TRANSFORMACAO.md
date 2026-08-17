# SENTINELA AUT. — Transformação operacional

**Status:** Etapa 0–7/G5 + **G6 Audit** + **M-G6-1 SQL CREATED / AWAITING REVIEW**  
**Data:** 2026-08-14  
**Produto anterior:** Qualivida Residence / Qualivida Gestão  
**Produto novo:** SENTINELA AUT.  
**Plataforma documental alinhada:** Operaut (addendum) — vertical condomínio, piloto Qualivida Club Residence  

**Princípio:** O usuário informa. O Sentinela entende. A automação executa. O painel acompanha.  
**M-G6-1:** SQL `api_idempotency_keys` preparado — **sem APPLY / sem wiring**.

---

## Etapa 8 / G6 — Fundação de produção (Auditoria) (2026-08-14)

**Status:** AUDIT / READY FOR IMPLEMENTATION · **M-G6-1 SQL CREATED / AWAITING REVIEW**  
**Doc:** `docs/SENTINELA-AUT-G6-PRODUCAO.md`  
**Idempotency SQL:** `docs/SENTINELA-AUT-G6-IDEMPOTENCY.md`  
**Evidência audit:** `docs/evidence/results/SENTINELA-ETAPA-8-G6-AUDIT-2026-08-14.txt`  
**Evidência M-G6-1:** `docs/evidence/results/SENTINELA-G6-1-IDEMPOTENCY-SQL-CREATION-2026-08-14.txt`

### Entregue (somente docs + SQL preparado)
- Lacunas: Idempotency Store, Confirmation Store, Server Adapter, Event Store, conflito de reservas
- **M-G6-1 SQL criado (NÃO APPLY):** `005_api_idempotency_keys` + rollback + pre-check
- Confirmation / Event Store / M5+ / n8n / WhatsApp: **não** iniciados
- Wiring API: **não** iniciado

```
DATABASE CHANGES = 0 · MIGRATIONS EXECUTED = 0 · N8N = 0 · WHATSAPP = 0
M-G6-1 APPLY = BLOCKED (awaiting review)
M-G6-1 = **CLOSED / PASS**
  (evidência: SENTINELA-G6-1-CLOSEOUT-2026-08-14.txt)
  APPLY PASS + CLOSEOUT LIVE PASS · wiring/G6-2 ainda NÃO
```

**Stop:** não iniciar G6-2 / wiring / n8n / WhatsApp sem autorização explícita.

---

## G6-2 — Confirmation Store (2026-08-14)

**Status:** CLOSED / PASS  
**Doc:** `docs/SENTINELA-AUT-G6-CONFIRMATIONS.md`  
**Closeout:** `docs/evidence/results/SENTINELA-G6-2-CLOSEOUT-2026-08-14.txt`  
Tabela LIVE: `public.api_confirmations` · wiring API = NÃO

## G7 — Server Runtime Readiness (2026-08-14)

**Status:** READY FOR IMPLEMENTATION (audit) · **G7-A = PASS** · **G7-B = PASS**  
**Doc:** `docs/SENTINELA-AUT-G7-SERVER-RUNTIME.md`  
**Evidência audit:** `docs/evidence/results/SENTINELA-G7-SERVER-RUNTIME-AUDIT-2026-08-14.txt`  
**Evidência G7-A:** `docs/evidence/results/SENTINELA-G7-A-SERVER-ADAPTER-2026-08-14.txt`  
**Evidência G7-B:** `docs/evidence/results/SENTINELA-G7-B-SERVER-WIRING-2026-08-14.txt`

Server Adapter + Idempotency/Confirmation stores wired via composition root — **sem n8n/WhatsApp/Event Store**.

```
DATABASE CHANGES = 0 · MIGRATIONS = 0 · LIVE WRITE = 0 · N8N = 0 · WHATSAPP = 0
```

---

## Etapa 7 / G5 — Operational Core Execution (2026-08-14)

**Status:** CLOSED / PASS  
**Evidência:** `docs/evidence/results/SENTINELA-ETAPA-7-G5-CORE-EXECUTION-2026-08-14.txt`

### Entregue
- Cadeia: HMAC → tenant → AuthZ → classification → confirmation(SENSITIVE) → **Core** → adapter
- API **não** duplica regras: `executeCoreOperation` despacha para `sentinela/core`
- **READ liberadas:** `identify_resident`, `identify_unit`, `get_boleto`
- **WRITE (Core):** `create_package`, `create_occurrence`, `update_occurrence`, `create_reservation`
  - Exigem `Idempotency-Key`
  - Prod default sem store → `IDEMPOTENCY_STORE_UNAVAILABLE` (`core_executed=false`)
  - Memory idempotency = **TEST_ONLY**
- **SENSITIVE bloqueadas:** `pickup_package`, `cancel_reservation` → `CONFIRMATION_STORE_UNAVAILABLE` / `CONFIRMATION_REQUIRED`; `core_executed=false`
- Validação central de payload (strip/deny tenant override no body)
- Envelope `{ ok, success, request_id, operation, data|error }`
- 108 testes · build OK · `DATABASE CHANGES = 0` · `MIGRATIONS = 0`

### Explicitamente NÃO feito
Idempotency/Confirmation stores persistentes · Event Store · n8n · WhatsApp · migration · alteração M1–M4 · liberar pickup/cancel

### Limitações
- `gates.writes_enabled = false` (prod WRITE bloqueada sem store persistente)
- Adapter server de persistência = FUTURE wiring (testes usam memory)
- Conflito de reservas ainda client-supplied (`RESERVATION_CONFLICT_CLIENT_ONLY`)
- Eventos Core em memória ≠ auditoria persistente

---

## Etapa 6 / G4 — Confirmation & Sensitive Ops (2026-08-14)

**Status:** CLOSED / PASS  
**Docs:** `docs/SENTINELA-AUT-CONFIRMATIONS.md`  
**Evidência:** `docs/evidence/results/SENTINELA-ETAPA-6-G4-CONFIRMATION-2026-08-14.txt`

### Entregue
- Classificação central READ / WRITE / SENSITIVE
- `pickup_package` / `cancel_reservation` → `CONFIRMATION_REQUIRED` sem token
- Confirmação válida → ainda sem execução Core em G4; em G5 permanece bloqueada até store persistente
- Store prod = **unavailable** (fail-closed); memória = TEST_ONLY
- Persistent store = **FUTURE MIGRATION**
- 87 testes (baseline G4) · `DATABASE CHANGES = 0`

### Explicitamente NÃO feito (na época G4)
G5 Core execution · n8n · WhatsApp · migration · Event Store · UI

---

## Etapa 5 / G3 — Profile + Authorization (2026-08-14)

**Status:** CLOSED / PASS  
**Mapa:** `docs/evidence/results/SENTINELA-G3-AUTHZ-MAP-2026-08-14.txt`  
**Evidência:** `docs/evidence/results/SENTINELA-ETAPA-5-G3-AUTHZ-2026-08-14.txt`

### Entregue
- `authorizeOperation()` central (fail-closed, sem bypass SINDICO/PORTEIRO)
- Profile via credential: `role_name` / `permission_keys` (keys do RBAC existente)
- `GET /api/v1/authz-probe?operation=…`
- Ops: AuthZ → ainda `501 GATE_PENDING` (execução = G4+)
- `notify_resident` = **DECISION REQUIRED** (sem permission key) → DENY
- 68 testes · build OK · `DATABASE CHANGES = 0`

### Explicitamente NÃO feito
G4 · n8n · WhatsApp · migration · writes · alteração UI/M1–M4

---

## Etapa 4 / G1 — Fundação Sentinela API (2026-08-14)

**Status:** CLOSED / PASS  
**Evidência:** `docs/evidence/results/SENTINELA-ETAPA-4-G1-FOUNDATION-2026-08-14.txt`

### Entregue
- Libs: envelope, errors, gates, cors (sem `*`), request_id, Core probe
- `GET /api/v1/health` — status + probe do Operational Core (sem DB)
- Stubs de operações → `501 GATE_PENDING` (nenhuma mutação)
- 11 testes de fundação + Core 14 ainda passando · build OK

### Explicitamente NÃO feito
G2 (HMAC/tenant) · idempotency migration · writes · n8n · WhatsApp · alteração M1–M4

```
DATABASE CHANGES = 0 · MIGRATIONS = 0 · PUBLIC OPERATIONS = 0 · G2 = NOT STARTED (na época do G1)
```

---

## Etapa 4 / G2 — Authn HMAC + Tenant fail-closed (2026-08-14)

**Status:** CLOSED / PASS  
**Evidência:** `docs/evidence/results/SENTINELA-ETAPA-4-G2-AUTH-TENANT-2026-08-14.txt`

### Entregue
- `client_id` + HMAC-SHA256 + timestamp window + tenant fail-closed
- `GET /api/v1/protected-probe` (técnico, sem DB write)
- Ops de negócio: auth obrigatória → ainda `501 GATE_PENDING` (sem liberar regra)
- 18 testes G2 + total 51 passed
- Credentials via `SENTINELA_API_CREDENTIALS` (server-only)

### Explicitamente NÃO feito
G3 authz/ops · n8n · WhatsApp · migration · writes · Idempotency store

```
DATABASE CHANGES = 0 · MIGRATIONS = 0 · G3 = NOT STARTED
```

---

## Etapa 3 — API Design (2026-08-14)

**Status:** CLOSED / PASS — discovery + **Decision Review CLOSED**  
**Docs:** `docs/SENTINELA-AUT-API-ARCHITECTURE.md`  
**Evidência design:** `docs/evidence/results/SENTINELA-ETAPA-3-API-DESIGN-2026-08-14.txt`  
**Evidência decisões:** `docs/evidence/results/SENTINELA-ETAPA-3-DECISIONS-2026-08-14.txt`

### Veredito
- **ETAPA 3 = READY FOR API IMPLEMENTATION** (arquitetura fechada).
- Local: Vercel `/api/v1/` · Authn: HMAC+credential · Tenant: fail-closed · Idempotência: Postgres (FUTURE MIGRATION).
- Gates G1–G7 obrigatórios antes de mutações/WhatsApp em produção.
- `DATABASE CHANGES = 0` · `PUBLIC API = 0` nesta review (sem código/migration).

### Não implementado (proposital)
Webhook WA · workflows n8n · endpoints novos · Event Store · tabelas · RLS · auth/RBAC changes.
---

## Etapa 2 — Painel operacional (2026-08-14)

### Resultado
- `DashboardView` evoluído para **Central da Portaria** (sem SPA paralela).
- Menu reordenado: operação primeiro; financeiro/admin abaixo; **nenhum item removido**.
- PORTEIRO e SÍNDICO usam o painel operacional; admins mantêm `SindicoDashboardView`.
- Login web do morador **preservado** (retirada = decisão futura).
- Evidência: `docs/evidence/results/SENTINELA-ETAPA-2-PAINEL-2026-08-14.txt`

### Arquitetura da interface
```
[PC Portaria]
  Layout (RBAC + menu operacional)
    → DashboardView (KPIs, ações rápidas, status, pendências)
         → modais/views existentes (encomenda, QR, ocorrência, reservas…)
         → Operational Core (Etapa 1) nas mutações
         → eventos em memória (subscribeDomainEvents)
         → ConnectivityContext (online / sync)
         → realtime Supabase já existente (sem polling novo)
```

### Componentes reutilizados
DashboardView, RecentEventsBar, NewPackageModal, CameraScanModal, views de encomendas/ocorrências/visitantes/reservas, dataService (via Core), RBAC, realtime, offline.

### Componentes modificados
| Arquivo | Mudança |
|---------|---------|
| `components/views/DashboardView.tsx` | Painel operacional |
| `App.tsx` | Contagens + ações rápidas; SINDICO no painel |
| `components/Layout.tsx` | Labels, ordem, grupos, subtítulo Sentinela Aut. |

### Funcionalidades ocultadas da navegação principal
**Nenhuma removida.** Financeiro e staff permaneceram, apenas **rebaixados** na ordem visual (grupo base/admin).

### Decisões de UX
1. Prioridade visual: status → KPIs → ações rápidas → busca → eventos → CTA encomenda → pendências/Core.
2. Desktop-first (1366×768+).
3. Boletos fora do foco da portaria.
4. Status WhatsApp/n8n explícitos como **não configurados** (sem simulação).
5. Sem nova paleta/logo (LOGO/PALETA ainda pendente).

### Riscos / limitações
- Eventos Core = sessão (sem Event Store).
- Offline + realtime: possível atraso visual até sync (camada única).
- Prioridade de ocorrência: **melhoria futura** (não existe no domínio).
- Conflito de reserva: regra atual documentada no Core Etapa 1.

### DECISION REQUIRED (parado — não implementado)
Remover login morador · WhatsApp · n8n · alterar RBAC/RLS/auth/tenant · Event Store · identidade visual oficial.

### Banco
`DATABASE CHANGES = 0` · `MIGRATIONS EXECUTED = 0` · M1–M4 intocados.

---

## 1. Visão do produto

**Slogan operacional:**

> O usuário informa. O Sentinela entende. A automação executa. O painel acompanha.

SENTINELA AUT. deixa de ser um “sistema de gestão de condomínio com telas de cadastro” e passa a ser:

1. **Núcleo operacional** (regras de negócio + execução)  
2. **Painel de supervisão** (portaria / síndico — “o que está acontecendo agora?”)  
3. **Canal WhatsApp** (moradores; porteiro e síndico para operações rápidas)  
4. **Orquestração n8n** (entrada/saída de canais — **não** escreve no domínio direto)

O painel web **não** é o canal principal do morador.  
O banco permanece a **fonte da verdade**.  
O n8n permanece **orquestrador**.  
O Sentinela permanece o **único ponto que aplica regras**.

Cadeia futura (não implementar agora):

```
WHATSAPP → n8n → SENTINELA AUT. (Operational Core)
        → interpretação → validação → regras → execução
        → BANCO (fonte da verdade)
        → notificação / canais
        → PAINEL OPERACIONAL (supervisão)
```

**Proibido:** WhatsApp → n8n → banco.

---

## 2. Atores

| Ator | Acesso painel web | WhatsApp | Papel no banco |
|------|-------------------|----------|----------------|
| **Morador** | **Não** como usuário operacional (hoje ainda tem dashboard/login — ver §7) | Canal principal futuro | Permanecer em `residents` (identificação de unidade e operações) |
| **Porteiro** | Painel operacional (PC da portaria) | Operações rápidas (texto/voz/foto/QR) | `staff` + futuro `tenant_memberships` |
| **Síndico** | Painel de gestão/supervisão | Consultas e operações rápidas | `staff`/`users` + membership |
| **Administradora / cabo** | Painel (já existe via RBAC) | Fora do escopo imediato | Roles existentes |
| **Sistema / automação** | — | — | Ator de auditoria futuro (Operations Core) |

**Regra:** não remover moradores do banco. Não desligar telas de morador **nesta etapa**. A restrição de acesso web do morador é **fase posterior**, após o canal WhatsApp estar operacional.

---

## 3. Canais

| Canal | Estado atual | Destino |
|-------|----------------|---------|
| SPA web (React) | Canal único de operação | Painel operacional (porteiro/síndico) |
| WhatsApp `wa.me` + templates | Abre conversa manual; sem API | Substituir por Cloud API via n8n **depois** |
| E-mail (Resend) | Convites staff/morador | Manter para convites; não misturar com operações |
| Inbox in-app (`notifications`) | Existe | Canal de painel; **não** event store |
| Voz Gemini Live (Sentinela tab) | Interpreta e persiste encomenda/ocorrência/aviso | Entrada futura do Core (mesmas operações) |
| n8n | Somente spec Operaut | Orquestrador futuro |

Entradas previstas (futuro WhatsApp / painel):

`text` · `audio` · `image` · `qr` · `barcode`

---

## 4. Arquitetura operacional

### 4.1 Camadas

```
[Canais]
  WhatsApp | Painel | Voz | (futuro e-mail/push)
        ↓
[Orquestração]  n8n  — normaliza payload, autentica webhook, roteia
        ↓
[Sentinela Operational Core]  — único executor de domínio
        ↓
[Persistência]  PostgreSQL / Supabase Storage  — fonte da verdade
        ↓
[Projeção]
  Painel  |  Inbox  |  WhatsApp reply  |  Auditoria
```

### 4.2 Relação com o que já existe

| Peça | Já existe? | Papel futuro |
|------|------------|--------------|
| `services/dataService.ts` | Sim (monólito CRUD) | **Fonte** das regras a extrair para o Core — não duplicar |
| `App.tsx` | Sim (~orquestração UI) | Deve **chamar** o Core; hoje **é** o orquestrador |
| Tab Sentinela (`sentinela/`) | Sim (chat/voz + leftover Nutri) | Entrada de intenção; persistência via Core |
| M1–M4 | Aplicados | Isolation root (org/site/units/memberships) |
| Operaut Operations Core (docs) | Spec | Eventos/n8n — **depois** isolamento M5–M16 |

### 4.3 Hierarquia de tenant (já em produção)

```
organizations (M1+M4 seed: qualivida-admin)
  └── condominiums / site (M4: Qualivida Club Residence)
        ├── units (M2 schema; 0 rows)
        ├── tenant_memberships (M3 schema; 0 rows)
        └── domínio legado (residents, packages, …) — ainda sem condominium_id
```

---

## 5. Inventário do sistema atual

### 5.1 Frontend

- **Stack:** React 19 + Vite 5 + TypeScript + Tailwind 4 + Supabase JS. Sem React Router.
- **Shell:** `App.tsx` (~4300 linhas) + `components/Layout.tsx`.
- **Rotas URL:** `/`, `/accept-invite`, `/accept-resident-invite`, recovery via `Login`.
- **~16 tabs** internas: dashboard, notices, financeiro/boletos, reservas, moradores, ocorrências, encomendas, visitantes, staff, sentinela, settings, permissões, perfis.
- **3 dashboards:** `DashboardView` (porteiro), `SindicoDashboardView`, `MoradorDashboardView`.
- **Contextos:** Auth, AppConfig, Toast, Connectivity.
- **Hooks:** `useHasPermission`, `useCamera`, `useKeyboardShortcuts`, `useFinancialEntries`, `useLiveVoiceConversation`.
- **Offline:** Dexie + outbox (`offlineDb` / `offlineDataService`).

### 5.2 Serviços / APIs

- CRUD: `services/dataService.ts` (packages, residents, visitors, occurrences, boletos, notices, staff, areas, reservations, invites).
- Auth: `userAuth.ts`, `residentAuth.ts`.
- RBAC: `permissionsService.ts`.
- Inbox: `notificationService.ts`.
- Boletos PDF: `boletoPdfImportService.ts`, `pdfBoletoExtractor.ts` (+ `pdfProcessingService.ts` legado).
- Vercel `api/`: convites, create-auth-user, e-mail Resend.
- **Edge Functions deployáveis:** ausentes (só README de password-reset).
- **n8n / WhatsApp Business API:** ausentes.

### 5.3 Banco (somente inventário — sem alteração)

**Plataforma (M1–M4, prod `zaemlxjwhzrfmowbckmk`):**

| Tabela | Estado LIVE (pós-M4 APPLY) |
|--------|----------------------------|
| `organizations` | 1 row — `qualivida-admin` / `0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928` |
| `condominiums` | 1 row — `qualivida-club-residence` / `3f383313-5ec0-4d21-97c7-1b2500c933be` |
| `units` | EXISTS, 0 rows |
| `tenant_memberships` | EXISTS, 0 rows |

**Legado operacional (single-tenant implícito):**  
`residents`, `packages`, `package_items`, `occurrences`, `visitors`, `notices`, `notice_reads`, `notifications`, `reservations`, `areas`, `boletos`, `staff`, `users`, `roles`, `permissions`, `role_permissions`, `staff_invites`, `resident_invites`, `admin_audit_logs`, `app_config`, `chat_messages`, e outras (CRM/notes).

**RLS:** ligado em tabelas prioritárias; **não** é isolamento multi-tenant (policies ainda frouxas em vários pontos). M12–M14 futuros.

**Storage:** bucket `boletos` (`public=false` pós R2A-MIN).

### 5.4 RBAC

- Catálogo: `roles` (5: morador, porteiro, cabo_turma, administradora, sindico), `permissions`, `role_permissions`.
- UI: `AdminPermissionsView` + RPCs grant/revoke.
- **Bypass:** `SINDICO` = `ALL_PERMISSION_KEYS` no `AuthContext` (não lê DB).
- App ainda usa `users.role` / comparações `role === 'MORADOR'` além das permission keys.
- Membership (M3) **não** é usada pelo app ainda.

### 5.5 Identidade visual atual

- Marca ainda **Qualivida** (`manifest.json` “Qualivida Gestão”, `x-client-info: gestao-qualivida-residence`).
- Paleta atual (não inventar nova): `--highlight-card` / theme `#0b7a4b`; fundo dark `#0c1a13`; accent `#7fcf6b`.
- Favicon/PWA: `public/1024.png`.
- Sidebar: ícone Lucide `ShieldCheck`, não a PNG.
- Temas: `default` / `alternative` em `AppConfigContext`.

**LOGO/PALETA PENDENTE** para SENTINELA AUT. — não definir cores novas nesta etapa.

---

## 6. Funcionalidades reutilizáveis

(Detalhe tabular em `SENTINELA-AUT-FUNCIONALIDADES-REUTILIZAVEIS.md`.)

Síntese: encomendas (CRUD, QR, foto, voz→persist, pickup, notificação, export), moradores (CRUD, auth, convites, unidade string, telefone), ocorrências (CRUD, status, chat, anexo, voz), reservas (áreas + conflito **no client**), boletos (import PDF + storage), inbox, visitantes, staff/invites, RBAC catálogo, dashboards existentes, Realtime em packages/visitors/occurrences/notices, offline outbox.

---

## 7. Funcionalidades que precisam refatoração

| Item | Por quê |
|------|---------|
| `App.tsx` como orquestrador de domínio | Regras de encomenda/ocorrência/reserva/voz/WhatsApp concentradas na UI |
| `dataService.ts` monólito | Um arquivo = todos os bounded contexts |
| Morador no painel web | Contraria o novo modelo; **não desligar agora** |
| RBAC bypass SINDICO + `users.role` | Isolamento/autorização futuros exigem membership + DB |
| `residents.unit` string vs `units` (M2) | Precisa backfill (M5+ / plano Fase 1) — **não agora** |
| WhatsApp `wa.me` | Não é canal automatizado |
| Tab Sentinela + leftover Nutri (~14 views) | Mistura wellness legado com concierge operacional |
| Tipos `Reservation` vs `ReservationRow` | Divergência UI/DB |
| `geminiService` triplicado | `services/`, `components/`, `sentinela/services/` |
| Extractors de boleto duplicados | `pdfProcessingService` legado |
| Conflito de reserva só no client | Sem exclusão no Postgres |
| Foto encomenda em base64 vs Storage | Consistência/auditoria |

---

## 8. Funcionalidades ausentes (não implementar agora)

- Operational Core como API/serviço único
- Event store / outbox de domínio (Operaut)
- n8n + webhooks assinados
- WhatsApp Cloud API / fila de canais
- Barcode de encomendas (barcode existe só em boletos)
- Prioridade em ocorrências
- Aprovação formal de reservas + constraint de conflito no DB
- Geração bancária de boletos
- Painel “situação da portaria agora” (há dashboards, mas não o contrato novo)
- `condominium_id` nas tabelas operacionais (M5–M8)
- Backfill `tenant_memberships` (M11)
- RLS tenant-aware (M12–M14)
- Edge functions operacionais
- Auditoria operacional unificada (além de `admin_audit_logs`)

---

## 9. Arquitetura do Operational Core

**Não implementar nesta etapa.** Extrair depois a partir de `dataService` + handlers de `App.tsx`.

Contrato conceitual:

```
execute(operation, context) → Result
context = {
  channel, actor, auth_user_id, membership?,
  organization_id, condominium_id / site_id,
  input: text|audio|image|qr|barcode|structured
}
Result = success | clarification_required | validation_error
       | authorization_error | operational_error
```

Operações iniciais: ver `SENTINELA-AUT-OPERATIONS.md`.

**Regra:** cada operação já existente (ex. `savePackage`) vira **um** comando do Core — não `savePackageV2`.

Painel e n8n chamam o **mesmo** Core.

---

## 10. Arquitetura futura WhatsApp / n8n

```
WhatsApp Cloud
    → n8n (webhook, normalização, retry, idempotência de entrega)
        → POST Sentinela Core /operations
            → regras + DB
        ← { status, message, data }
    → resposta WhatsApp
    → (opcional) evento para painel/realtime
```

Identificação do remetente (futuro):

1. Telefone normalizado (`utils/phoneNormalizer.ts` já existe)  
2. Match `residents.whatsapp` / `phone` **no site ativo**  
3. Staff: match telefone/`users` + membership  
4. Sem match → `clarification_required` (não criar morador silencioso)

Intenções iniciais: `PACKAGE_REGISTER`, `PACKAGE_PICKUP`, `OCCURRENCE_CREATE`, `RESERVATION_CREATE`, `BOLETO_REQUEST`, `STATUS_QUERY`.

**Dependência de isolamento:** n8n só depois de membership + `condominium_id` operacional (M5–M11 no mínimo; RLS M12–M14 recomendado). Alinhado ao addendum Operaut.

---

## 11. Arquitetura do Painel Operacional

**Não implementar agora.** Reusar views existentes como blocos.

Prioridade de superfície:

1. Situação atual da portaria (`DashboardView` + `RecentEventsBar` — evoluir, não recriar)  
2. Encomendas (`PackagesView`)  
3. Ocorrências (`OccurrencesView`)  
4. Visitantes (`VisitorsView`)  
5. Reservas (`ReservationsView`)  
6. Pendências (derivar de encomendas pendentes + ocorrências abertas — **não** tabela nova agora)  
7. Notificações (inbox existente)  
8. Atividades recentes (Realtime já parcialmente ligado)  
9. Exceções (falhas de automação — **ausente**; precisa Core)  
10. Automações (Central Operaut — **ausente**)

Perguntas do porteiro:

- O que está acontecendo agora? → dashboard + realtime  
- O que precisa da minha intervenção? → pendentes / exceções  

Síndico: reusar `SindicoDashboardView` + módulos de gestão já existentes.

Morador web: **fase posterior** de desativação; até lá, `MoradorDashboardView` permanece.

---

## 12. Fluxo de encomendas (atual → futuro)

**Atual**

```
Porteiro (modal / QR jsQR / foto / voz Sentinela / import)
  → App.tsx / savePackage
  → packages (+ package_items)
  → notification inbox (type package)
  → opcional openWhatsApp(template)
  → pickup: updatePackage (recebida / data_recebimento)
  → morador: hidePackageForResident
```

**Futuro (mesmo domínio)**

```
entrada (painel | WA | voz | QR | barcode)
  → Core.create_package / receive_package / pickup_package
  → packages (fonte da verdade)
  → evento package.registered (Operaut, depois)
  → n8n notifica morador
  → painel projeta estado
```

Barcode de encomenda: **ausente** — operação nova no Core, UI reusa `CameraScanModal`.

---

## 13. Fluxo de ocorrências

**Atual:** `saveOccurrence` / status Aberto → Em Andamento → Resolvido; chat; `image_url`; notificação ao resolver; voz `logEvent`.

**Futuro:** `create_occurrence` / `update_occurrence` no Core; prioridade e multi-anexo = extensão **depois**, sem segundo módulo.

---

## 14. Fluxo de reservas

**Atual:** `areas` + `reservations`; conflito `hasTimeConflict` no client; status scheduled/active/completed; cancel ≈ delete; trigger `enforce_reservation_resident_from_auth`.

**Futuro:** `create_reservation` / `cancel_reservation` no Core; conflito **no banco** e aprovação formal = refactor, não módulo paralelo.

---

## 15. Fluxo de boletos

**Atual:** import PDF → extração → `boletos` + Storage `boletos/` (privado); associação `resident_id`; consulta no Financeiro.

**Futuro:** `get_boleto` / `notify_boleto` no Core; **não** gerar boleto bancário nesta transformação. WhatsApp entrega o PDF já existente.

---

## 16. Fluxo de notificações

**Atual:** tabela `notifications` (inbox). OPERAUT: inbox ≠ fonte da verdade.

**Futuro:**

```
fato no domínio → evento → (inbox painel) + (WhatsApp via n8n) + (auditoria)
```

Não criar `notifications_v2`. Evoluir o inbox como **um** consumidor.

---

## 17. Modelo de identificação do morador

**Hoje**

- Unidade: string `residents.unit` (`unitFormatter`)
- Telefone / WhatsApp nos campos do residente
- Auth: `auth_user_id` + `residentAuth`
- QR encomenda: match unidade → morador (`CameraScanModal`)
- Voz: interpretação livre → persistência se o fluxo Sentinela resolver destinatário

**Apoio M1–M4 (ainda não ligado ao app)**

- Site piloto: `condominiums.id = 3f383313-5ec0-4d21-97c7-1b2500c933be`
- `units` vazia — identificação por catálogo de unidades **ainda não** substitui a string

**Futuro (sem DDL agora)**

1. Resolver site (membership do operador ou condo piloto único)  
2. Resolver unidade (`units.code` após backfill; até lá, string legado)  
3. Resolver resident (nome + unidade + telefone)  
4. Ambiguidade → `clarification_required`

---

## 18. Estratégia de auditoria

**Hoje:** `admin_audit_logs` + `adminAudit.ts` (ações admin). Packages/ocorrências têm timestamps e atores parciais.

**Futuro (Operaut):** ator (`auth_user_id` / membership), tenant (`condominium_id`), operação, input channel, resultado. **Não criar tabelas nesta etapa.** Reusar `admin_audit_logs` até o Operations Core.

---

## 19. Estratégia de permissões

1. **Reusar** catálogo `roles` / `permissions` / `role_permissions` — sem segundo RBAC.  
2. **Escopo** futuro = `tenant_memberships` (M3 já existe, vazio até M11).  
3. Remover gradualmente bypass SINDICO e `users.role` como única fonte (já documentado em Fase 1).  
4. Morador: autorização operacional via identidade + unidade, **não** via painel.  
5. Policies Postgres tenant-aware = M12–M14 — **fora desta etapa**.

---

## 20. Riscos

| Nível | Risco |
|-------|--------|
| HIGH | App ainda single-tenant; Core WhatsApp sem `condominium_id` vazaria dados |
| HIGH | Desligar login morador cedo demais (canal WA inexistente) |
| HIGH | n8n gravar no banco (anti-padrão Operaut) |
| MEDIUM | Duplicar encomendas/reservas “v2” em vez de extrair `dataService` |
| MEDIUM | Tab Sentinela Nutri confundida com núcleo operacional |
| MEDIUM | Memberships=0: operadores ainda não estão no modelo tenant |
| LOW | Naming Qualivida vs SENTINELA AUT. (visual pendente) |
| LOW | LOGO/PALETA PENDENTE — reformulação visual prematura |

---

## 21. Dependências

| Destino | Depende de |
|---------|------------|
| Operational Core (código) | Inventário desta etapa + autorização de implementação |
| Painel operacional | Core mínimo **ou** adapters sobre `dataService` existente |
| WhatsApp/n8n | Core + identificação + **isolamento** (M5–M11; RLS recomendado) |
| Isolamento completo | Plano M5–M16 já especificado — **não reabrir M1–M4** |
| Identidade visual SENTINELA AUT. | Logo/paleta oficial (pendente) |
| Desativar web do morador | Canal WhatsApp estável + paridade de operações |

---

## 22. Fases futuras de implementação (somente após autorização)

| Fase | Conteúdo | Banco |
|------|----------|--------|
| **Etapa 0** | Este documento (inventário) | ZERO |
| **Etapa 1** | Extrair Operational Core das funções **já existentes** (packages/occurrences/…) sem UI nova | ZERO — **DONE** |
| **Etapa 2** | Adaptar dashboards existentes ao contrato “agora / intervenção” | ZERO — **DONE** |
| **Etapa 3a** | Discovery/design da Sentinela API (este doc + API-ARCHITECTURE) | ZERO — **DONE (design)** |
| **Etapa 3b** | Implementar API (só após decisões §18) | ZERO estrutural preferível; store idempotência = DECISION |
| **Etapa 4** | n8n + WhatsApp no contrato desta spec | Eventos/canais = Operations Core (pós isolamento) |
| **Etapa 5** | Restringir web do morador | Sem DROP de `residents` |
| **Etapa 6** | Identidade visual com logo oficial | ZERO estrutural |

**Não avançar de etapa sem autorização explícita após revisão destes documentos.**

---

## Ponte com documentos existentes

- `docs/FASE-1-ARQUITETURA-MULTITENANT.md` — isolamento  
- `docs/FASE-1-MIGRATION-PLAN.md` — M1–M16 (M1–M4 CLOSED)  
- `docs/OPERAUT-ARCHITECTURE-ADDENDUM.md` — eventos/n8n **depois** do isolamento  
- Evidências M4: `docs/evidence/results/M4-APPLY-2026-08-14.txt`

SENTINELA AUT. é o **nome de produto** desta transformação.  
Operaut permanece o **nome de plataforma** na cadeia documental multi-tenant.  
Não criar um terceiro modelo de tenant.
