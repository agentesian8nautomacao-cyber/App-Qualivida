# Operaut — Architecture Addendum (pré-M1)

**Status:** especificação conceitual — **NÃO AUTORIZA** implementação de M1 nem DDL  
**Data:** 2026-08-12  
**Posição na cadeia documental:**

```
FASE-1-ARQUITETURA-MULTITENANT.md
             +
FASE-1-MIGRATION-PLAN.md
             ↓
OPERAUT-ARCHITECTURE-ADDENDUM.md   ← este documento
             ↓
M1–M16 revisados (mesmo plano, contratos ajustados)
             ↓
(fase futura) Operaut Operations Core
```

**Produto:** Operaut — Sistema Operacional para Operações.  
**Primeira vertical:** Condomínios (piloto Qualivida Club Residence).  
**Escopo deste addendum:** alinhar multi-tenant existente à visão de plataforma (eventos, automações, canais, auditoria, multi-vertical) **sem** implementar código, migrations ou banco.

---

## 1. Princípios Operaut

1. **Condomínio é a primeira vertical**, não o núcleo eterno do produto.
2. **Isolamento multi-tenant** (Organization + Site + Membership + RBAC) permanece a base.
3. **Fatos operacionais** viram **eventos**; notificações e n8n são **consumidores**, não a fonte da verdade.
4. **Automações** orquestram canais (WhatsApp, e-mail, push, webhooks); o domínio não chama n8n diretamente.
5. **Auditoria operacional** cobre ator, tenant, evento, automação, ação e resultado.
6. **Central de Operações** consome eventos, runs, alertas e KPIs — não apenas CRUDs de tabelas.
7. **Não reescrever** o app legado de uma vez: isolamento primeiro; Operations Core depois.

---

## 2. Hierarquia canônica revisada

### Espacial / produto

```
PLATFORM
    ↓
ORGANIZATION              (cliente B2B — administradora / empresa)
    ↓
VERTICAL                  (condominium | enterprise | hotel | school | …)
    ↓
OPERATIONAL_SITE          (tenant operacional; 1ª impl. = condominium)
    ↓
UNIT                      (espaço físico/lógico do site)
    ↓
DOMAIN ACTORS             (resident, staff, guest… conforme vertical)
```

### Identidade / autorização

```
USER (auth.users)
    ↓
TENANT_MEMBERSHIP
    ↓
OPERATIONAL_SITE (+ ORGANIZATION)
    ↓
ROLE → PERMISSION
```

### Mapeamento com a spec multi-tenant atual

| Spec atual (Fase 1) | Operaut (addendum) | Nota |
|---------------------|--------------------|------|
| `organizations` | `organizations` | Inalterado |
| `condominiums` | **primeira implementação** de `OPERATIONAL_SITE` na vertical `condominium` | Manter tabela `condominiums` no piloto; tratar semanticamente como site |
| `condominium_id` | **alias operacional** de `site_id` na vertical condomínio | Em docs/helpers: `current_site_id()` ≡ `current_condominium_id()` no piloto |
| `units` | units do site | Genérico o suficiente para hotéis/escolas depois |
| `tenant_memberships` | memberships no **site** (+ org) | Preparar membership org-scoped (admin multi-site) no futuro |
| `roles` / `permissions` | catálogo global reutilizado | Estender keys Operaut depois — sem segundo RBAC |

**Anti-padrão:** modelar o núcleo só como “app de condomínio” e depois forçar outras verticais com nomes `condominium_*`.

---

## 3. Contrato de isolamento (piloto)

Para M1–M16 da vertical condomínio:

| Campo físico (piloto) | Contrato Operaut |
|-----------------------|------------------|
| `organizations.id` | Organization |
| `condominiums.id` | Operational Site (`vertical = 'condominium'`) |
| `condominiums.organization_id` | FK org |
| Coluna `condominium_id` em tabelas de domínio | Site scope da vertical condomínio |
| `tenant_memberships.condominium_id` | Membership no site |

**Regra de documentação:** em novos textos, preferir “site (condominium)” e “`condominium_id` (= site_id do piloto)”. Renomeação física para `operational_sites` / `site_id` fica **fora** de M1–M16, salvo decisão explícita futura.

**M1 deve incluir** (conceitualmente, no schema de `condominiums` ou metadado):

- `vertical` fixo `'condominium'` **ou** coluna/`check` equivalente documentada
- `slug`, `status`, timestamps
- Comentário SQL / doc: “Operational Site — vertical condominium”

---

## 4. Camada de eventos (Operations Core — pós isolamento)

### Pipeline

```
Domínio (packages, visitors, …)
    → emit operational_event (após commit)
        → event bus / outbox
            → consumidores:
               Central de Operações | regras | n8n | KPIs | auditoria
```

### Envelope canônico (conceitual)

| Campo | Descrição |
|-------|-----------|
| `id` | uuid |
| `organization_id` | org |
| `site_id` | = `condominium_id` no piloto |
| `vertical` | ex.: `condominium` |
| `type` | ex.: `package.registered`, `visitor.arrived` |
| `aggregate_type` / `aggregate_id` | entidade de domínio |
| `actor_user_id` / `actor_membership_id` | quem gerou |
| `payload` | jsonb versionado |
| `occurred_at` | instante do fato |
| `correlation_id` | rastreio ponta a ponta |

### Exemplos de tipos (vertical condomínio)

- `package.registered` / `package.delivered`
- `visitor.arrived` / `visitor.left`
- `occurrence.created` / `occurrence.resolved`
- `reservation.created`
- `boleto.overdue` / `payment.received`

**Proibição:** domínio → HTTP direto n8n. n8n consome eventos (ou fila derivada).

---

## 5. Automações e n8n

```
Operaut (evento)
  → regra (por site/org)
    → automação
      → webhook assinado / bus → n8n
        → ação externa (WhatsApp, e-mail, ERP…)
          → callback → automation_run (status/resultado)
            → Operaut (log + UI)
```

Entidades conceituais (fase futura, **não** M1–M16):

- `automation_rules` — quando disparar
- `automations` — definição / workflow ref n8n
- `automation_runs` — execução, tentativas, resultado
- `integration_endpoints` — webhooks, secrets (fora do Git)

---

## 6. Notificações vs eventos

| Camada | Papel | Hoje no produto |
|--------|-------|-----------------|
| Evento | Fato operacional | Ausente (só tabelas) |
| Regra | Se/então por tenant | Ausente |
| Automação | Orquestração | Ausente |
| Canal | WhatsApp / e-mail / push / inbox | Parcial (`notifications`) |
| Entrega | Tentativa de envio | Parcial |
| Resultado | success/fail/retry | Fraco |

**Regra:** `notifications` = **canal inbox**, não substituto do event store.

---

## 7. Auditoria operacional

Além de `admin_audit_logs`, o Operaut precisa responder:

| Pergunta | Fonte futura |
|----------|--------------|
| Quem? | actor no evento + membership |
| Quando? | `occurred_at` + timestamps do run |
| Qual tenant? | `organization_id` + `site_id` |
| Qual operação? | `event.type` + aggregate |
| Qual automação? | `automation_id` / workflow |
| Qual ação? | steps do run |
| Qual resultado? | status + response |

---

## 8. RBAC — extensão futura (não alterar agora)

Reutilizar `roles` / `permissions` / `role_permissions`. Acrescentar keys depois, por exemplo:

- `operations.view` / `operations.act`
- `automations.view` / `automations.manage`
- `integrations.manage`
- `audit.view`
- `ai.manage`
- `tenant.admin`

Sem segundo RBAC. Sem remover legado nesta fase.

---

## 9. Central de Operações (visão)

Home alimentada por:

- feed de `operational_events` (site ativo)
- alertas / exceções (SLA, falhas de entrega)
- automations runs
- KPIs derivados de eventos
- atalhos para domínio (encomendas, ocorrências…) **como ações**, não como único conteúdo

Realtime: além de tabelas de domínio, canal `site:{id}:events` (futuro).

---

## 10. Storage / Realtime (contrato)

| Área | Piloto (M15–M16) | Direção Operaut |
|------|------------------|-----------------|
| Paths | `organizations/{org}/condominiums/{condo}/…` | Documentar como `…/sites/{site}/…` com condo = site |
| Realtime | `condo:{id}:…` | Alias `site:{id}:…`; depois `…:events` |

---

## 11. Verticais futuras

| Vertical | Site | Unit (exemplo) |
|----------|------|----------------|
| Condomínios | Prédio / condomínio | Apto |
| Empresas | Filial / planta | Setor / posto |
| Hotéis | Propriedade | Quarto |
| Escolas | Campus / unidade | Sala / turma |

Núcleo compartilha: org, site, membership, events, automations, channels, audit, KPIs.  
Domínio específico fica em módulos por vertical.

---

## 12. Impacto em M1–M16 (resumo)

Detalhe normativo: **[FASE-1-MIGRATION-PLAN.md](./FASE-1-MIGRATION-PLAN.md)** (revisão Operaut).

| Faixa | Ação |
|-------|------|
| M1–M3 | **Ajuste de contrato** (vertical/site nos docs + metadado M1) |
| M4, M9–M11, M13–M14 | **Continua** no essencial |
| M5–M8, M12, M15–M16 | **Ajuste documental** (site alias; helpers; paths/canais) |
| Pós M16 | **Operations Core** (eventos, regras, n8n, canais, audit ops) — novo bloco, não misturar em M1 |

---

## 13. O que este addendum NÃO autoriza

- Executar M1–M16  
- CREATE/ALTER/DROP, policies, Storage, backfill  
- Implementar n8n, WhatsApp, IA, Central de Operações  
- Rotação automática de chaves  
- Reescrever baseline Git  

**Pré-requisitos para M1 (inalterados + este addendum):**

1. Gates: RLS live, Storage live, backup verificável  
2. Este addendum **aceito** pela equipe  
3. Plano M1–M16 revisado (contratos) **aceito**  
4. Autorização explícita de implementação  

---

## 14. Decisões registradas

| # | Decisão |
|---|----------|
| D1 | Operaut = SO de operações; condomínio = 1ª vertical |
| D2 | `condominiums` no piloto = Operational Site (`vertical=condominium`) |
| D3 | `condominium_id` permanece nas migrations M5–M8; semanticamente = `site_id` |
| D4 | Eventos/automações/canais **não** entram em M1–M16 |
| D5 | n8n é consumer via bus/webhook; nunca acoplamento direto do domínio |
| D6 | RBAC existente estendido depois; sem RBAC paralelo |
| D7 | M1 bloqueada até gates + aceite deste addendum + autorização explícita |

---

*Addendum Operaut. Spec only. Implementação não autorizada.*
