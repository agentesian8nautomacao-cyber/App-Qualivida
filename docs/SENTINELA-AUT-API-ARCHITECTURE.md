# SENTINELA AUT. — Arquitetura da API do Operational Core

**Status:** Etapa 3 Design + Decisions CLOSED · **Etapa 4 / G1 foundation implemented** (ops ainda GATE_PENDING)  
**Data:** 2026-08-14  
**Pré-requisitos:** Etapa 1 (Core) CLOSED/PASS · Etapa 2 (Painel) CLOSED/PASS · M1–M4 CLOSED/PASS  

**Confirmação Etapa 4 / G1:**

```
DATABASE CHANGES = 0
MIGRATIONS EXECUTED = 0
WHATSAPP = 0
N8N = 0
PUBLIC OPERATIONS = 0   (health apenas; ops = 501 GATE_PENDING)
G2 = NOT STARTED
```

**Código fundação:** `api/v1/` — ver `docs/evidence/results/SENTINELA-ETAPA-4-G1-FOUNDATION-2026-08-14.txt`  
**G2 auth/tenant:** CLOSED / PASS — `docs/evidence/results/SENTINELA-ETAPA-4-G2-AUTH-TENANT-2026-08-14.txt`  
**G3 authz:** CLOSED / PASS — `docs/evidence/results/SENTINELA-ETAPA-5-G3-AUTHZ-2026-08-14.txt`  
**G4 confirmation:** CLOSED / PASS — `docs/evidence/results/SENTINELA-ETAPA-6-G4-CONFIRMATION-2026-08-14.txt`  
**G5:** NOT STARTED

---

## 7A. Protocolo HMAC implementado (Etapa 4 / G2)

### Headers obrigatórios (rotas protegidas)

| Header | Função |
|--------|--------|
| `X-Sentinela-Client-Id` | Identifica a integration credential |
| `X-Sentinela-Timestamp` | Unix seconds (não ms) |
| `X-Sentinela-Signature` | HMAC-SHA256 hex lowercase |
| `X-Organization-Id` | Tenant org |
| `X-Condominium-Id` | Tenant site |
| `Idempotency-Key` | Opcional no G2 (incluído no canonical se presente) |

### Canonical string (determinística, LF, sem newline final extra)

```
v1
{timestamp}
{METHOD}
{path_with_query}
{body_sha256_hex}
{organization_id}
{condominium_id}
{idempotency_key_or_empty}
```

`body_sha256_hex` = SHA-256 do body bruto (string vazia se GET sem body), hex lowercase.  
`Signature = hex(HMAC-SHA256(secret, canonical))` — comparação com `crypto.timingSafeEqual`.

### Credenciais (server-only)

Env `SENTINELA_API_CREDENTIALS` (JSON array). Cada item: `client_id`, `secret`, opcional `secret_previous`, `organization_id`, `condominium_id`.  
**Nunca** `VITE_*` / frontend / git.  
Tabela de credentials = **FUTURE MIGRATION**.

### Timestamp / anti-replay

Janela default **300s** (`SENTINELA_API_TIMESTAMP_WINDOW_SECONDS`).  
Fora da janela → `TIMESTAMP_EXPIRED`.  
Replay completo com nonce/Idempotency store = **FUTURE MIGRATION / G3+** (sem store inseguro em memória de processo).

### Tenant fail-closed

1. Headers org+condo obrigatórios → senão `TENANT_REQUIRED`  
2. Credential scoped deve bater com headers → senão `TENANT_MISMATCH`  
3. Org existe; condo existe; `condo.organization_id === org.id` → senão `TENANT_NOT_FOUND` / `TENANT_MISMATCH`  
4. Sem fallback global / sem `withPilotTenantDefaults` na API  
5. Diretório: `SENTINELA_TENANT_CATALOG` (piloto/test) ou SELECT Supabase `organizations`/`condominiums` (M1/M4, read-only)

### Endpoints

| Rota | Auth | Comportamento G2 |
|------|------|------------------|
| `GET /api/v1/health` | público | status + gates |
| `GET /api/v1/protected-probe` | HMAC+tenant | ecoa contexto não sensível |
| ops de negócio | HMAC+tenant | **501 GATE_PENDING** (authz/ops = G3) |

### Exemplo request (protected-probe)

```http
GET /api/v1/protected-probe HTTP/1.1
X-Sentinela-Client-Id: n8n-pilot
X-Sentinela-Timestamp: 1723650000
X-Organization-Id: 0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928
X-Condominium-Id: 3f383313-5ec0-4d21-97c7-1b2500c933be
X-Sentinela-Signature: <hmac_hex>
```

### Exemplo erro

```json
{
  "success": false,
  "request_id": "req_…",
  "api_version": "v1",
  "error": { "code": "INVALID_SIGNATURE", "message": "invalid signature" }
}
```

Bearer-only / secret fixo isolado = **rejeitado**. HMAC válido ≠ autorização de negócio (G3).

---

## 0. Princípio de camadas

| Camada | Papel | Pode conter regra de condomínio? |
|--------|-------|----------------------------------|
| WhatsApp | Canal | Não |
| n8n | Orquestração (normalizar, roteiar, retry de transporte) | **Não** |
| **Sentinela API** | Fronteira HTTP (authn, tenant, idempotência, rate limit, contrato) | Só validação de fronteira |
| **Operational Core** | Regras de negócio | **Sim — único dono** |
| dataService / adapters | Persistência | Não (execução técnica) |
| Database | Dados (fonte da verdade) | Constraints futuras ≠ lógica de produto |
| Painel | Observação / operação humana | Chama Core (hoje) ou API (futuro opcional) |

```
MORADOR → WhatsApp → n8n → SENTINELA API → OPERATIONAL CORE → adapters → DATABASE
PORTEIRO / SÍNDICO → PAINEL → OPERATIONAL CORE → adapters → DATABASE
```

**Proibido:** WhatsApp → n8n → PostgreSQL / Supabase client direto.

---

## 1. Arquitetura atual (discovery)

### 1.1 Stack

| Peça | Estado |
|------|--------|
| Frontend | React 19 + Vite 5 + TypeScript + Tailwind (SPA sem React Router) |
| Hosting | **Vercel** (`vercel.json`: SPA rewrite exclui `/api/*`) |
| Banco / Auth / Realtime | **Supabase** (Postgres + Auth + Realtime channels no `App.tsx`) |
| Backend existente | Pasta `api/*.ts` — **Vercel Serverless** (`export default { fetch }`, `runtime = 'nodejs'`) |
| Edge Functions Supabase | Pasta `supabase/functions/request-password-reset/` só README — **não usada** (reset via Auth) |
| Services | `services/dataService.ts`, `notificationService`, auth/permissions, offline |
| Core | `sentinela/core/` — operações + eventos em memória |
| Painel | `DashboardView` = Central da Portaria (Etapa 2) |
| Offline | Dexie + outbox (`offlineDataService` / `ConnectivityContext`) — **browser-only** |
| RBAC | `roles` / `permissions` / `role_permissions` + `AuthContext.hasPermission` |
| Tenant | M1–M4: `organizations`, `condominiums`, `units`, `tenant_memberships` (memberships ainda 0 rows) |
| Segredos server | `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_*` no Vercel (não no frontend) |

### 1.2 APIs já existentes (padrão a reutilizar)

| Rota | Função |
|------|--------|
| `GET /api/staff-invite` | Validar token de convite |
| `POST /api/accept-staff-invite` | Aceitar convite staff |
| `GET /api/resident-invite` | Validar convite morador |
| `POST /api/accept-resident-invite` | Aceitar convite morador |
| `POST /api/send-invite-email` | Resend |
| `POST /api/create-auth-user` | Criação auth (service role) |

Padrão: Node serverless, `Response.json`, códigos `code`, CORS liberado (`*`) nas rotas de convite, **service_role** no servidor.

Dev: Vite proxy `/api` → `dev:api` ou `VITE_API_BASE_URL`.

### 1.3 Como o Core é chamado hoje

```
App.tsx / UI
  → sentinela/core/operations/*
  → adapters/persistence.ts
  → dataService / notificationService
  → Supabase (anon + sessão do usuário)
```

- `OperationContext.organizationId` / `condominiumId` **opcionais** → warning `TENANT_CONTEXT_ABSENT` (legado).
- Eventos: memória (`publishDomainEvents`) — sem Event Store.
- Offline: mutações do **painel** podem entrar no outbox; **API futura n8n não deve usar Dexie**.

### 1.4 Realtime / auditoria

- Realtime: channels no `App.tsx` (ocorrências, avisos, chat, notifications).
- Sem tabela de auditoria de operações de API.
- Inbox `notifications` ≠ Event Store.

---

## 2. Arquitetura proposta (futura)

```
[WhatsApp Cloud]
      ↓ webhook (n8n — fora deste design de implementação)
[n8n]
  - parse intenção / mídia
  - monta payload estruturado
  - Idempotency-Key + tenant + assinatura
      ↓ HTTPS
[SENTINELA API]   ← Vercel Serverless /api/v1/...
  - autenticar caller (integração)
  - autorizar operação + tenant
  - exigir organization_id + condominium_id
  - idempotência / rate limit / request_id
  - mapear HTTP → 1 operação Core
      ↓
[OPERATIONAL CORE]   ← sentinela/core (mesmo código)
  - regras (sem if whatsapp / if n8n)
      ↓
[Server persistence adapter]
  - dataService-equivalente com service role OU client privilegiado
  - SEM offline Dexie
      ↓
[PostgreSQL / Supabase]
      ↓ (projeção)
[Painel via Realtime / refresh] + [n8n → WhatsApp reply]
```

Painel continua podendo chamar Core **in-process** (como hoje). Unificar painel→API é opcional e **DECISION REQUIRED** (não é pré-requisito do WhatsApp).

---

## 3. Onde colocar a futura API? (avaliação)

| Opção | Prós | Contras | Veredito |
|-------|------|---------|----------|
| **A. Vercel Serverless `api/`** | Já existe; mesma deploy; Node; service role já no Vercel; rewrite pronto; alinhado a convites | Cold start; adapter server sem Dexie; CORS das rotas atuais é aberto demais (corrigir na API Sentinela) | **RECOMENDADO** |
| B. Supabase Edge Functions | Perto do banco; Deno | Quase sem uso no projeto; stack diferente; duplicaria padrão; Core TS Node/browser atual | Não preferir agora |
| C. Novo servidor (Railway/Fly/VM) | Controle total | Novo ops, segredos, deploy, custo — **parar** | **DECISION REQUIRED** se Vercel for insuficiente |
| D. “API” só no n8n | Rápido | n8n vira dono de regra / ou grava no banco — **anti-padrão** | **Rejeitado** |
| E. Chamar Core só no browser via WA | Impossível (morador no WA) | — | — |

**Decisão de design (proposta, não implementada):**  
Fronteira = **`/api/v1/...` em Vercel Serverless**, na mesma app, importando `sentinela/core`.

**DECISION REQUIRED (pré-implementação):**

1. **Adapter de persistência server-side** — `dataService` atual acopla offline/browser; API não pode reutilizar Dexie/outbox.  
2. Se cold start / timeout / payload de mídia forem limitantes → reavaliar C (novo servidor) **sem** mudar o contrato Core.

---

## 4. Estilo de API: REST vs RPC

### 4.1 Candidatos

**REST por recurso (sugerido no briefing):**

```
POST   /api/v1/operations/packages
POST   /api/v1/operations/packages/{id}/pickup
POST   /api/v1/operations/occurrences
PATCH  /api/v1/operations/occurrences/{id}
POST   /api/v1/operations/reservations
POST   /api/v1/operations/reservations/{id}/cancel
GET    /api/v1/residents/identify
GET    /api/v1/units/identify
GET    /api/v1/boletos
POST   /api/v1/notifications/resident   # notify_resident
```

**RPC único:**

```
POST /api/v1/operations
{ "operation": "create_package", "input": { ... } }
```

### 4.2 Avaliação

| Critério | REST | RPC |
|----------|------|-----|
| 1 endpoint = 1 Core op | Sim (com mapeamento) | Sim (explícito) |
| Facilidade n8n | Boa (HTTP nodes por fluxo) | Excelente (um node) |
| Evolução / OpenAPI | Clássica | Menos discoverable |
| Risco de “God endpoint” | Baixo | Médio se não versionar `operation` |

**Recomendação:** REST versionado sob `/api/v1/`, com mapeamento rígido 1:1 para o Core (tabela §5).  
Não inventar endpoints CRUD genéricos (`GET /packages` lista completa, etc.) nesta API de operações — o painel já lista via Supabase/cliente.

`notify_resident` entra como `POST /api/v1/notifications/resident` (não misturar com create_package).

---

## 5. Mapa endpoint → operação Core

| Método + path | Operação Core | Notas |
|---------------|---------------|-------|
| `GET /api/v1/residents/identify` | `identify_resident` | Query: phone / unit / name hints + catalog strategy |
| `GET /api/v1/units/identify` | `identify_unit` | |
| `POST /api/v1/operations/packages` | `create_package` | Idempotency obrigatória |
| `POST /api/v1/operations/packages/{id}/pickup` | `pickup_package` | |
| `POST /api/v1/operations/occurrences` | `create_occurrence` | |
| `PATCH /api/v1/operations/occurrences/{id}` | `update_occurrence` | |
| `POST /api/v1/operations/reservations` | `create_reservation` | Conflito = regra Core |
| `POST /api/v1/operations/reservations/{id}/cancel` | `cancel_reservation` | Hoje = delete |
| `GET /api/v1/boletos` | `get_boleto` | Preferência de atendimento; não foco portaria |
| `POST /api/v1/notifications/resident` | `notify_resident` | Inbox; sem WhatsApp send |

**Regra:** a rota só traduz HTTP → `input` + `OperationContext` e devolve `OperationResult`. Zero regra de domínio na pasta `api/`.

`channel` no contexto: `whatsapp_future` (ou futuro `whatsapp`) / `system` — **nunca** ramificar Core com `if (channel === 'whatsapp')`.

---

## 6. Contratos de resposta

Alinhar ao `OperationResult` já existente, enriquecendo metadados de fronteira.

### 6.1 Sucesso

```json
{
  "success": true,
  "request_id": "req_…",
  "correlation_id": "cor_…",
  "operation": "create_package",
  "result_event": "package.created",
  "data": { },
  "events": [ ],
  "notifications": [ ],
  "warnings": [ ]
}
```

### 6.2 Erro

```json
{
  "success": false,
  "request_id": "req_…",
  "correlation_id": "cor_…",
  "operation": "create_package",
  "error": {
    "code": "RESIDENT_NOT_FOUND",
    "message": "…",
    "details": { }
  }
}
```

### 6.3 Códigos (fronteira + Core)

Mapear códigos Core atuais (`VALIDATION_ERROR`, `NOT_FOUND`, `AUTHORIZATION_ERROR`, `DUPLICATE`, `CONFLICT`, `OPERATIONAL_ERROR`, `CLARIFICATION_REQUIRED`, `TENANT_CONTEXT_ABSENT`) para códigos estáveis de API:

| Código API | Uso | HTTP sugerido |
|------------|-----|---------------|
| `VALIDATION_ERROR` | Input inválido | 400 |
| `RESIDENT_NOT_FOUND` | identify / resolve | 404 |
| `UNIT_NOT_FOUND` | identify unit | 404 |
| `PACKAGE_NOT_FOUND` | pickup | 404 |
| `PACKAGE_ALREADY_PICKED_UP` | pickup duplicado (Core `DUPLICATE`) | 409 |
| `OCCURRENCE_NOT_FOUND` | update | 404 |
| `RESERVATION_CONFLICT` | Core `CONFLICT` | 409 |
| `TENANT_REQUIRED` | API fail-closed | 400 |
| `TENANT_NOT_FOUND` / `TENANT_MISMATCH` | IDs inválidos / credencial ≠ tenant | 403 |
| `UNAUTHORIZED` | Authn falhou | 401 |
| `FORBIDDEN` | Authz falhou | 403 |
| `DUPLICATE_REQUEST` | Idempotency hit com mesmo resultado | 200 (replay) ou 409 se conflito de body |
| `RATE_LIMITED` | Limite | 429 |
| `INVALID_OPERATION` | Path/op desconhecida | 404 |
| `INTERNAL_ERROR` | Falha não classificada | 500 |

Não expandir catálogo sem necessidade. `TENANT_CONTEXT_ABSENT` **não** deve vazar como sucesso com warning na API externa — ver §8.

---

## 7. Autenticação (authn)

### 7.1 O que **não** aceitar

- Bearer com **único segredo estático** compartilhado n8n↔API, sem tenant, sem expiração, sem assinatura de body.
- Credenciais no frontend Vite (`VITE_*`).
- Service role no n8n apontando ao Supabase.

### 7.2 Modelo proposto (combinação)

**Caller de integração (n8n):**

1. **Credential de integração** por condomínio (ou por org), identificada por `client_id` (não secreta).  
2. **HMAC-SHA256** sobre canonical request:  
   `timestamp + method + path + sha256(body) + Idempotency-Key + organization_id + condominium_id`  
   Header: `X-Sentinela-Signature`, `X-Sentinela-Timestamp`, `X-Sentinela-Client-Id`.  
3. Janela anti-replay: timestamp ± 5 min (+ nonce/`Idempotency-Key`).  
4. Segredo da credential: só Vercel env / secret manager + vault n8n — **rotação** documentada (dois segredos ativos durante overlap).

**Opcional futuro (painel / usuário humano via API):**

- JWT Supabase Auth (`Authorization: Bearer <access_token>`) + mesmo enforcement de tenant/RBAC.  
- Não misturar service_role do usuário final.

**Supabase Auth sozinho para n8n:** possível (service user), mas pior UX de rotação e risco de JWT longo sem binding de tenant no token → só se memberships/JWT claims estiverem prontos (**DECISION** pós M5–M11).

### 7.3 Autorização (authz) ≠ autenticação

n8n autenticado **não** implica “pode tudo”.

Checagens futuras na fronteira:

| Check | Fonte |
|-------|-------|
| Quem chama | `client_id` / subject |
| Qual condomínio | headers/body `organization_id` + `condominium_id` **obrigatórios** e iguais ao escopo da credential |
| Qual operação | path → permission key |
| Qual papel | mapear credential → role/membership **ou** permission grant da integração |

**Reutilizar RBAC existente** (`packages.create`, `packages.update`, `occurrences.create`, …) — **não** criar segundo catálogo.

**LIMITATION atual:** `tenant_memberships` = 0 rows; bypass SINDICO no frontend documentado.  
Para API de integração: grants explícitos por credential → permission keys (tabela ou config) = **DECISION REQUIRED** (pode exigir migration).

Até lá: **não implementar** API pública.

---

## 8. Tenant isolation

### 8.1 Contrato obrigatório (API)

Toda request:

```
organization_id: uuid
condominium_id: uuid
```

(Headers preferidos: `X-Organization-Id`, `X-Condominium-Id` — ou body; um só canônico.)

Validar:

1. Presentes → senão `TENANT_REQUIRED`.  
2. Existem e estão ligados (condo ∈ org) → senão `TENANT_NOT_FOUND`.  
3. Credential autorizada para esse par → senão `TENANT_MISMATCH` / `FORBIDDEN`.  
4. Passar ao Core em `OperationContext` **sempre preenchido**.

### 8.2 Core legado vs API

| Caller | Tenant ausente |
|--------|----------------|
| Painel legado (hoje) | Warning `TENANT_CONTEXT_ABSENT` |
| **API externa** | **Fail-closed** na fronteira (nunca chegar ao Core sem tenant) |

Mudar o Core para fail-closed global = **DECISION REQUIRED** (quebra painel até App enviar IDs M4).  
Recomendação de design:  
- Fronteira API: fail-closed agora (quando implementar).  
- Core: flag/`requireTenant: true` por chamada API **ou** endurecer Core só após App wirear IDs piloto.

IDs piloto M4 (referência):

- org `0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928`  
- condo `3f383313-5ec0-4d21-97c7-1b2500c933be`

---

## 9. Idempotência e retry (crítico)

### 9.1 Problema

n8n / WhatsApp reenviam. Sem idempotência → duas encomendas.

### 9.2 Estratégia proposta (design)

| Conceito | Papel |
|----------|-------|
| `Idempotency-Key` | Obrigatório em **POST/PATCH** mutáveis; UUID/ULID gerado pelo n8n por intenção de negócio |
| `request_id` | Gerado pela API por tentativa HTTP (log) |
| `correlation_id` | Opcional; propaga conversa WhatsApp / execução n8n |
| `event_id` | Só se houver Event Store futuro — **não nesta etapa** |

Fluxo:

1. n8n gera `Idempotency-Key` estável para a mesma mensagem WA (`wa_message_id` hash).  
2. API: lookup key + tenant + operation.  
3. Se hit e body hash igual → devolver **mesma** resposta success (HTTP 200).  
4. Se hit e body hash diferente → `DUPLICATE_REQUEST` 409.  
5. Se miss → executar Core; persistir registro idempotente **antes ou em transação** com o efeito.

Retry n8n: backoff exponencial; só reutiliza a **mesma** Idempotency-Key.

### 9.3 Persistência da idempotência — DECISION REQUIRED

Sem tabela / Redis:

| Opção | Precisa |
|-------|---------|
| Tabela `api_idempotency_keys` (tenant, key, op, body_hash, response, expires_at) | **Migration** |
| Upstash Redis / KV Vercel | Infra nova + segredo |
| Só memória de processo | **Inseguro** em serverless multi-instância |

**Nesta etapa:** documentar apenas.  
**Não criar** tabela. Marcar **DECISION REQUIRED** antes de qualquer implementação de mutações via API.

Mitigação parcial sem store (insuficiente sozinha): `pickup` já é naturalmente idempotente no Core (`DUPLICATE`); `create_package` **não**.

---

## 10. Observabilidade

Campos mínimos por request (log estruturado / Sentry já existe no front):

```
request_id, correlation_id, client_id, actor,
source (panel|whatsapp|n8n|system),
operation, organization_id, condominium_id,
timestamp, duration_ms, http_status, result (success|error_code)
```

- Sem Event Store nesta etapa.  
- Reutilizar eventos em memória do Core só no painel da sessão.  
- Futuro: emitir os mesmos `DomainEvent` para bus/outbox — pós isolamento.

---

## 11. Rate limiting (design)

Sugestão inicial (por `client_id` + `condominium_id`):

| Classe | Limite inicial (ordem de grandeza) |
|--------|-------------------------------------|
| identify_* | 60/min |
| create_package / pickup | 30/min |
| occurrences | 20/min |
| reservations | 20/min |
| get_boleto | 30/min |
| notify_resident | 20/min |

Implementação: edge middleware / KV / tabela — **DECISION REQUIRED**.  
Resposta: `429` + `Retry-After`.

---

## 12. Versionamento

- Prefixo **`/api/v1/`**.  
- Breaking change → `/api/v2/`.  
- Campos novos opcionais = minor compatível.  
- Header opcional `X-API-Version: 1` (secundário ao path).

Rotas atuais `/api/staff-invite` etc. **permanecem** fora de `/v1` (legado de convites).

---

## 13. CORS

- API Sentinela é **server-to-server** (n8n → Vercel): CORS **não** é o controle principal.  
- Política proposta: **não** usar `Access-Control-Allow-Origin: *` (padrão atual dos convites — risco documentado).  
- Allowlist vazia ou só origem do painel se o browser chamar a API.  
- n8n não precisa de CORS.

---

## 14. Segredos

| Segredo | Onde vive | Não vive |
|---------|-----------|----------|
| HMAC / integration secret | Vercel env + n8n credentials | Frontend, git, Core |
| `SUPABASE_SERVICE_ROLE_KEY` | Só Vercel `api/` | n8n, browser, WhatsApp |
| WhatsApp Cloud tokens | n8n / Meta | Frontend, Core |
| `RESEND_API_KEY` | Vercel (já) | — |
| Anon key | Frontend (já) | Não basta para API ops |

---

## 15. Boundaries n8n e WhatsApp

### n8n pode

- Receber webhook Meta.  
- Extrair texto/áudio/imagem.  
- Chamar identify → create_package na Sentinela API.  
- Formatar reply WhatsApp.  
- Retry de transporte com mesma Idempotency-Key.

### n8n não pode

- SQL / Supabase dashboard client com service role para domínio.  
- Decidir “pode reservar?” / conflito / pickup rules.  
- Gravar `packages` direto.

### WhatsApp / Core

- Core **não conhece** WhatsApp.  
- Sem `if (whatsapp)` no Core.  
- Canal = metadado de contexto + observabilidade.

### Webhooks (futuro — não criar agora)

```
WhatsApp → n8n (webhook Meta)
n8n → Sentinela API (HTTPS assinado)
Sentinela → n8n callback (opcional; preferir resposta síncrona HTTP na mesma chamada)
```

Callback assíncrono só se mídia/OCR longo — **DECISION** posterior.

---

## 16. Offline vs API

| Superfície | Offline |
|------------|---------|
| Painel PC portaria | Dexie/outbox preservado |
| API n8n | Sempre online; sem segunda camada offline |

Risco: painel offline cria encomenda; n8n cria outra para o mesmo WA — mitigar com Idempotency-Key + regras de negócio / reconcile futuro. Documentar; não resolver aqui.

---

## 17. Riscos

| Nível | Risco |
|-------|--------|
| HIGH | Implementar API sem store de idempotência → duplicatas |
| HIGH | Tenant warning legado vazar para canal WA |
| HIGH | n8n com service_role no Supabase |
| HIGH | Credential única global sem escopo de condomínio |
| MEDIUM | dataService browser no serverless |
| MEDIUM | memberships vazios / RBAC bypass síndico |
| MEDIUM | CORS `*` nas rotas atuais como “precedente” |
| LOW | Cold start Vercel em picos WA |

---

## 18. Decisões arquiteturais — FECHADAS (Decision Review 2026-08-14)

**Evidência:** `docs/evidence/results/SENTINELA-ETAPA-3-DECISIONS-2026-08-14.txt`  
**Veredito:** `ETAPA 3 = READY FOR API IMPLEMENTATION` (com gates de produção)

| # | Tema | Status | Decisão resumida |
|---|------|--------|------------------|
| DR1 | Host API | CLOSED | Vercel `/api/v1/` |
| DR2 | Adapter server | CLOSED | Sem Dexie; service adapter |
| DR3 | Idempotência | CLOSED | Key + fingerprint; store **Postgres** = FUTURE MIGRATION |
| DR4 | Authn | CLOSED | client_id + HMAC + timestamp + tenant (não Bearer-only) |
| DR5 | Tenant | CLOSED | API fail-closed; Core dual-mode; sem fallback global |
| DR6 | Authz | CLOSED | RBAC keys existentes; profile scoped por condo (env v1) |
| DR7 | Identidade morador | CLOSED | telefone→resident→unit→tenant; ambíguo = NEEDS_CONFIRMATION |
| DR8–9 | Ops + confirmação | CLOSED | READ/WRITE/SENSITIVE; pickup/cancel WA com confirmação |
| DR10–15 | Audit/n8n/WA/erros/obs/rate | CLOSED | Contrato sem Event Store |
| DR16 | Painel | CLOSED | Continua Core in-process |
| DR17–18 | Version/CORS/secrets/riscos | CLOSED | Ver evidência |

**Gates produção (mutações / WA):** G1 idempotency migration · G2 HMAC+tenant · G3 profile · G4 confirmação · G5 testes · G6 n8n sem SQL · G7 M1–M4 intactos.

Enquanto a API não for implementada e os gates não forem cumpridos: **PUBLIC API = 0**.

---

## 19. Resultado esperado (clareza da cadeia)

```
n8n
  → HTTPS assinado + tenant + Idempotency-Key
SENTINELA API  (/api/v1/... na Vercel)
  → authn/authz/tenant/idempotency
OPERATIONAL CORE  (sentinela/core)
  → uma operação
adapters (server)
  → dataService-equivalente
DATABASE
```

Nenhuma dessas integrações externas está implementada nesta Etapa 3.

---

## 20. Ponte documental

- `docs/SENTINELA-AUT-OPERATIONS.md` — catálogo Core  
- `docs/SENTINELA-AUT-TRANSFORMACAO.md` — Etapas 0–2  
- `docs/FASE-0-RBAC-ATUAL.md` — permissões  
- `docs/FASE-1-MIGRATION-PLAN.md` — M5+ isolamento  
- Evidência: `docs/evidence/results/SENTINELA-ETAPA-3-API-DESIGN-2026-08-14.txt`
