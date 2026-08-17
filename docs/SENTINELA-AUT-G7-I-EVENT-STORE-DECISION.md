# SENTINELA AUT — G7-I — Event Store Decision Gate

**Gate:** G7-I  
**Data:** 2026-08-15  
**Tipo:** DECISION GATE (sem implementação)  
**Pré-requisito:** G7-H-B = PASS  

```
DATABASE CHANGES    = 0
MIGRATIONS EXECUTED = 0
LIVE WRITE          = 0
N8N REAL            = 0   (sem novo workflow neste gate)
WHATSAPP            = 0
EVENT STORE         = 0   (não criado)
```

---

## 1. Decisão

### OPÇÃO B — `EVENT STORE = NECESSÁRIO`

**Justificativa:**

1. **Auditoria operacional** — automações (n8n → API) precisam de prova durável do que o Sentinela executou, com `request_id`, tenant, operação e resultado.
2. **Painel** — o produto promete “o painel acompanha”; logs de host (Vercel/Node, ring buffer 200) **não** permitem consulta fail-closed por `organization_id` + `condominium_id`.
3. **Troubleshooting** — correlacionar falhas de HMAC/AuthZ/idempotência/confirmação sem depender de retenção frágil de stdout.
4. **Segurança** — rejeições (`request.rejected` / `request.denied`) e desafios SENSITIVE merecem trilha consultável por perfil autorizado.
5. **Pronteza técnica** — G7-G/G7-H-A já entregaram envelope, redaction, wiring e semântica `core_executed`; falta só o sink persistente (gate futuro).

**O que NÃO é esta decisão:**

- Não autoriza criar migration agora.
- Não autoriza WhatsApp.
- Não substitui o domínio operacional (`packages`, `reservations`, etc.).
- Não autoriza n8n → PostgreSQL.

**Logs estruturados continuam obrigatórios** como sink de runtime e fallback; o Event Store é **complemento de auditoria**, não substituto imediato do console `[sentinela-obs]`.

---

## 2. Estado atual (auditoria)

### Sink

| Item | Valor |
|------|--------|
| Módulo | `api/v1/_lib/observability/` |
| Wiring | G7-H-A (`protectedHandler`, AuthZ, confirmation, `executeCore`, `withCoreExecution`) |
| Sink produção | `console.info('[sentinela-obs]', …)` + ring buffer **200** |
| Persistência | **Nenhuma** |
| Tabela `api_domain_events` | **Não existe** (confirmado em `supabase/`) |

### Envelope (já implementado)

Campos: `event_id`, `event_name`, `occurred_at`, `request_id`, `correlation_id`, `client_id`, `organization_id`, `condominium_id`, `operation`, `classification`, `status`, `http_status`, `error_code`, `retry_hint`, `retry_class`, `core_executed`, `duration_ms`, `external_ref`, `attributes` (redacted).

### Redaction

`redact.ts` bloqueia secret/HMAC/signature/token/service-role/mídia/WhatsApp bruto/SQL/stack/CPF/etc.  
`safeEmit` aborta emissão se `assertNoSensitiveLeak` detectar vazamento.

### Tenant

Modelo M1–M4/G6: `organization_id` + `condominium_id` (headers). Em rejeição pré-tenant confiável, org/condo **não** são gravados no evento (`trustTenant`).

---

## 3. Matriz de classificação

| Evento | Persistir no Event Store? | Motivo |
|--------|---------------------------|--------|
| `request.received` | **NÃO** (somente logs; sampling opcional futuro) | Alto volume; pouco valor sozinho no painel |
| `request.authorized` | **NÃO** (somente logs) | Intermediário; resultado final + AuthZ deny bastam |
| `request.rejected` | **SIM** | Auditoria de segurança (HMAC/tenant/timestamp) |
| `request.denied` | **SIM** | Auditoria AuthZ |
| `confirmation.required` | **SIM** | Operação SENSITIVE pendente; útil ao painel |
| `confirmation.consumed` | **SIM** | Prova de consumo one-shot (sem token) |
| `idempotency.replay` | **SIM** | Prova de não-duplicação WRITE |
| `idempotency.created` | **OPCIONAL** | Sobreposição com `operation.completed`; preferir omitir se volume alto |
| `core.started` | **NÃO** (somente logs) | Transitório |
| `core.completed` | **NÃO** (somente logs) | Redundante com `operation.completed` em sucesso |
| `core.failed` | **SIM** | Falha de domínio com `core_executed=true` |
| `operation.completed` | **SIM** | Fato operacional principal (sucesso / replay final) |
| `operation.failed` | **SIM** | Fato operacional principal (erro) |

**Resumo:** persistir a **espinha dorsal** (outcomes + segurança + confirmation + replay + core.failed). Manter intermediários só em logs.

---

## 4. Modelo conceitual futuro — `api_domain_events`

> Especificação **somente documental**. Sem SQL. Sem migration neste gate.

### Propósito

Append-only **auditoria**. Nunca fonte de verdade de domínio. Nunca usada pelo Core para decidir regras de negócio.

### Colunas propostas

| Coluna | Tipo conceitual | Notas |
|--------|-----------------|--------|
| `event_id` | text PK | `evt_…` |
| `occurred_at` | timestamptz | UTC |
| `request_id` | text | Correlação |
| `organization_id` | uuid NOT NULL* | Isolamento (*nullable só se política explícita para rejeições pré-tenant — preferir **não** persistir esses, ou linha sem tenant consultável só por admin global) |
| `condominium_id` | uuid NOT NULL* | Mesmo modelo M1–M4 |
| `client_id` | text | Integração |
| `correlation_id` | text null | Conversa / n8n |
| `operation` | text null | Nome da op |
| `event_type` | text | = `event_name` |
| `status` | text | Vocabulário operacional |
| `source` | text | ex. `api.v1` |
| `classification` | text null | READ/WRITE/SENSITIVE |
| `http_status` | int null | |
| `error_code` | text null | |
| `retry_class` | text null | |
| `core_executed` | boolean | |
| `duration_ms` | int null | |
| `external_ref` | text null | Hash/truncado — nunca body WhatsApp |
| `confirmation_id` | text null | **id** apenas; **nunca** token |
| `idempotency_key_hash` | text null | Hash one-way da key se necessário correlacionar; **não** plaintext se key carregar PII |
| `attributes` | jsonb null | Já redacted; whitelist curta |
| `created_at` | timestamptz | Insert time |

### Índices futuros (sugestão)

- `(organization_id, condominium_id, occurred_at DESC)`
- `(request_id)`
- `(organization_id, condominium_id, event_type, occurred_at DESC)`
- `(organization_id, condominium_id, operation, status)` onde útil ao painel

### Isolamento (fail-closed)

- Toda query de painel/API admin: **obrigatório** filtro `organization_id` + `condominium_id` do contexto autenticado.
- RLS (futuro) alinhado ao padrão G6: sem bypass; sem cross-tenant.
- n8n **nunca** lê esta tabela via SQL.
- Core **nunca** lê Event Store para executar regras.

### Arquitetura

```
API → AuthN/Tenant/AuthZ → Core → Adapter → Domain DB   (fonte de verdade)

API/handlers → Observability emit → [logs] + [futuro: Event Store]   (auditoria)
```

---

## 5. Quem consulta

| Ator | Acesso |
|------|--------|
| Porteiro / operador (painel) | Feed filtrado: outcomes, confirmation_required, falhas de automação — **via API admin futura**, nunca SQL direto |
| Admin / síndico (perfil elevado) | Mesmo feed + rejeições AuthZ/HMAC agregadas do **próprio** tenant |
| n8n | **Sem** acesso ao store; só response HTTP da operação. Futuro: endpoint read-only autorizado se necessário |
| Desenvolvedor | Logs + (futuro) API admin com AuthZ |

Permissão futura sugerida (catálogo AuthZ): algo como `sentinela.events.view` — **não** implementar agora.

---

## 6. Retenção

| Classe | Retenção proposta | Justificativa |
|--------|-------------------|---------------|
| **Operacional** (outcomes, confirmation, replay) | **90 dias** | Suficiente para suporte de automação e painel “atividade recente” |
| **Auditoria de segurança** (`rejected` / `denied`) | **180 dias** | Investigação de abuse/misconfig sem reter anos de PII |
| Logs host | Conforme plataforma (efêmero) | Continuam para debug imediato |

**Não** recomendado nesta fase: 30 dias (curto demais para automação) nem 365 dias default (custo + LGPD sem necessidade comprovada).

Limpeza: gate futuro (job/cron); **não** neste G7-I.

---

## 7. Segurança / LGPD

### Persistir

- Identificadores de correlação (`request_id`, `correlation_id`, `client_id`)
- Tenant (`organization_id`, `condominium_id`)
- Operação, status, `error_code`, `core_executed`, `duration_ms`
- `confirmation_id` (não token)
- `external_ref` hasheado/truncado

### Nunca persistir

- HMAC secret / signature  
- service-role / senhas  
- `confirmation_token` plaintext ou hash se desnecessário  
- Body bruto WhatsApp, áudio, foto, PDF de boleto  
- CPF/documento, mensagem completa  
- SQL / stack  
- Nome de morador / unidade **como campos de primeira classe** no Event Store (se necessário ao troubleshooting, preferir só no domínio; no evento no máximo referência opaca a `resource_id` já existente)

Regra: **provar o que aconteceu, não regravar o conteúdo da conversa.**

---

## 8. Relação com o Painel Operacional (futuro — sem UI agora)

| Necessidade do porteiro | Eventos úteis | Fonte de verdade de negócio |
|-------------------------|---------------|------------------------------|
| Última operação / atividade Sentinela | `operation.completed` / `failed` | Event Store (feed) |
| Encomenda criada | outcome `create_package` | Tabela `packages` + link por request |
| Ocorrência / reserva | outcomes correspondentes | Domínio |
| Aguardando confirmação | `confirmation.required` | Confirmation store + evento |
| Replay idempotente | `idempotency.replay` (+ completed) | Evento |
| Falha de automação | `operation.failed` / `request.rejected` | Evento |
| Listar encomendas do dia | — | **Domínio**, não Event Store |

Eventos técnicos intermediários (`received`, `authorized`, `core.started`) **não** devem poluir a UI do porteiro.

---

## 9. Relação com n8n

```
n8n → API v1 (HMAC) → Core → Domain DB
                 ↘ Observability → logs (+ futuro Event Store)
```

- n8n = **orquestrador**, não database client.  
- Se um dia precisar “listar falhas recentes”, criar **API read** com AuthZ — nunca node PostgreSQL / service-role.  
- Piloto G7-H-B permanece intacto; sem workflow novo neste gate.

---

## 10. Migration futura (especificação — NÃO criar / NÃO executar)

Nome sugerido (quando gate de implementação for autorizado):

`00X_api_domain_events.sql` (número após a sequência vigente)

Conteúdo conceitual:

1. `CREATE TABLE api_domain_events (…)` append-only  
2. Índices tenant + tempo + request_id  
3. RLS fail-closed por org+condo (padrão G6)  
4. **Sem** FKs que acoplam regras de negócio ao store  
5. **Sem** triggers que alterem `packages`/`reservations`  
6. Grants: service-role da API apenas; **zero** grant a clients n8n  

Implementação = **próximo gate autorizado** (ex. G7-J), não G7-I.

---

## 11. Riscos

| Risco | Mitigação |
|-------|-----------|
| Virar segundo domínio | Proibir Core de ler Event Store; painel usa domínio para entidades |
| Volume alto | Persistência seletiva (matriz §3); sem `request.received` |
| PII leakage | Redaction obrigatória antes do insert; testes de leak |
| Cross-tenant | RLS + AuthZ na API de leitura |
| Atraso WhatsApp | Event Store **não** bloqueia WhatsApp; WhatsApp é gate separado |

---

## 12. Problemas encontrados (documentados — sem correção automática)

1. Sink atual limitado a ring **200** + logs de host → inadequado para painel/auditoria (motivo da Opção B).  
2. Docs G7-G ainda apontam “próximo gate G7-H-B” no rodapé histórico — estado real: G7-H-B = PASS; este doc é G7-I.  
3. Não existe `docs/SENTINELA-AUT-G7-F-N8N-READINESS.md`; evidência F está em `docs/evidence/results/SENTINELA-G7-F-N8N-READINESS*.txt`.

---

## 13. STOP

G7-I = **DECISION GATE COMPLETE**

- NÃO criar migration  
- NÃO aplicar migration  
- NÃO criar Event Store  
- NÃO iniciar WhatsApp  
- NÃO alterar workflow piloto  

**Próximo gate recomendado:** G7-J — implementação controlada do sink persistente `api_domain_events` (migration + writer fail-safe + API read mínima AuthZ), **ou** gate WhatsApp se o produto priorizar canal antes da auditoria durável.
