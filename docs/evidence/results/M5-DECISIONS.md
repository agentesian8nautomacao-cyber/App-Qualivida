# M5 DECISIONS — Fechamento documental

**Data:** 2026-08-17  
**Projeto:** `zaemlxjwhzrfmowbckmk`  
**Modo:** SOMENTE ANÁLISE / FECHAMENTO DOCUMENTAL  

```text
M5 READINESS = NOT READY
M5-DECISIONS = PROPOSED / PENDING APPROVAL
MIGRATION CREATED = NO
DATABASE MODIFIED = NO
CODE MODIFIED = NO
FASE-1-MIGRATION-PLAN MODIFIED = NO
```

**Fontes:**

* `docs/FASE-1-ARQUITETURA-MULTITENANT.md`
* `docs/OPERAUT-ARCHITECTURE-ADDENDUM.md`
* `docs/FASE-1-MIGRATION-PLAN.md` (**lido; não alterado**)
* `docs/evidence/results/M5-READINESS-AUDIT.md`
* `docs/evidence/results/M5-APPLICATION-BINDING-DESIGN.md`

Nenhuma recomendação deste arquivo foi aplicada. Nenhuma linha da matriz é `APPROVED` (não houve aceite humano nesta etapa).

---

## 1. Contexto

M5 planejado (`005_residents_condo_id`) pretendia, num único passo:

```text
coluna condominium_id nullable → backfill piloto → NOT NULL + FK
```

A auditoria comprovou:

* schema/backfill de **dados** ainda com evidência live incompleta;
* **todos** os CREATEs de `residents` sem site (`registerResident`, `saveResident` CREATE, import, `accept-resident-invite`);
* `NOT NULL` hoje = **BLOCKED**.

O design de binding definiu o contrato (membership / invite / fail-closed) **sem implementar**.

Esta etapa **fecha recomendações técnicas explícitas** para as decisões abertas. Não autoriza SQL, app nem mudança do plano M1–M16.

---

## 2. Princípios

1. **User ≠ Condominium.** Identidade Auth é global; o site vem de membership, convite scoped ou token resolvido no servidor.
2. **`condominium_id` não é campo de formulário.** Cliente pode apresentar; servidor liga ou recusa.
3. **Fail-closed.** Sem contexto autorizado → não inserir. Sem DEFAULT silencioso para o piloto em multi-tenant.
4. **Isolamento = site.** `residents → condominiums → organizations`. Não duplicar `organization_id` em residents.
5. **M5 = schema isolation. M13 = RLS.** Não misturar. NOT NULL sem binding não substitui policy; policy com NULL não fecha isolamento.
6. **Recomendação ≠ aprovação.** Status máximo nesta etapa: `PROPOSED`.
7. **Não inventar escopo de migration.** M8 é o que o plano escreve, não o que gates G6/G7 fizeram à parte.

---

## 3. D2 — Auto-register

**Fluxo atual:** `ResidentRegister` público → `registerResident` INSERT sem site. Unicidade de `unit` global. Sem membership, sem token de site.

### Opções

| Opção | Descrição | Segurança | Isolamento | Spoofing | UX | Implementação | Membership | RLS (M13) | M5 |
|-------|-----------|-----------|------------|----------|----|---------------|------------|-----------|-----|
| **A** | Manter auto-register público **unscoped** | baixa | **quebra** (CREATE órfão / site errado) | alto (`unit` livre; futuro UUID livre) | a mais simples hoje | já existe | incompatível (ator anônimo sem membership) | INSERT anônimo fura WITH CHECK de site | **bloqueia NOT NULL** |
| **B** | Link/URL scoped ao site (`/c/{slug}/register`) | média–alta **se** o servidor resolve slug→id e o cliente não é autoridade do UUID | boa | médio (slug enumerável); baixo se só slugs intencionais + rate limit | boa | média (rota + resolução server-side) | o cadastro **cria** membership depois; não usa membership de staff | precisa policy/token específica para INSERT anônimo scoped | desbloqueia INSERT **depois** do binding |
| **C** | Auto-register via **convite** (token já existente) | **alta** (token opaco, expiry, one-time) | boa se invite carregar site (D4/M8) | baixo | boa (e-mail/WhatsApp) | reutiliza `resident_invites` + accept | staff membership na **emissão**; morador membership no **pós-accept** | accept já é service_role; deve gravar site do convite, não do body | alinhado a M5-B invite |
| **D** | **Desligar** cadastro público; exigir convite | **alta** | boa (mesmo contrato C) | baixo | muda UX (some o self-serve aberto) | baixa no app (esconder rota); média no processo operacional | igual C | igual C | remove o CREATE unscoped — o pior blocker de M5-B |
| **E** | Outro mecanismo **já comprovado** na arquitetura | HMAC G2 vale para **integração**, não para humano anônimo. Membership exige login. Branding ≠ UUID. **Não há** mecanismo extra comprovado para este fluxo. | — | — | — | — | — | — | **não resolve** |

### Recomendação arquitetural (não APPROVED)

```text
A = INCOMPATÍVEL com multi-tenant.
E = NÃO EXISTE como substituto para humano anônimo.
C + D = caminho proposto:
  desligar register público unscoped;
  criar resident público somente via convite (token).
B = complemento de UX futuro, não autoridade de tenant
    (slug resolvido no servidor; nunca UUID do form).
```

Não foi escolhido por facilidade: A seria o mais fácil e é o único **rejeitado como modelo**. C/D exigem D4 (`resident_invites.condominium_id`) e binding no accept.

**Status D2:** `PROPOSED`  
**Aguardando:** aceite humano entre C+D (estrito) vs B+C (URL scoped + convite).

---

## 4. D8 — M5-A / M5-B

O M5 original junta schema e isolamento rígido. O app **não** está pronto para o segundo.

### M5-A (schema + backfill) — não executar agora

* `residents.condominium_id` **nullable**
* FK → `condominiums.id`
* índice `(condominium_id)` (não unique composto)
* backfill piloto **somente se** COUNT live de site = 1 for revalidado
* **sem** NOT NULL
* **sem** correção de fluxos

### M5-B (binding + NOT NULL) — não executar agora

* contexto de membership no servidor (D1/D5)
* CREATE staff / import / invite / register conforme contrato
* stamp/replay offline (D6)
* testes de spoofing DENY
* **somente depois** `ALTER … SET NOT NULL`

### Deve M5 ser dividido?

**Recomendação: SIM**, como **estratégia provisória** — sem reescrever `FASE-1-MIGRATION-PLAN.md` nesta etapa.

| Pergunta | Resposta proposta |
|----------|-------------------|
| Por quê? | NOT NULL hoje quebra CREATE. Schema nullable permite backfill piloto sem fingir READY. |
| Dependências M5-A | M4; live COUNT/snapshot; D10 ON DELETE aceite |
| Dependências M5-B | M5-A; D1–D6; memberships utilizáveis (M11); invites com site (M8 — ver §6); register unscoped desligado (D2) |
| Impacto M6–M13 | Ver §13. M6/M7 podem seguir o **padrão A** (nullable+backfill) independentemente do NOT NULL de residents. M11 usa M5-A nos 4 piloto. M13 fica **fraco** enquanto houver NULL. |
| Risco de NULL temporário | CREATEs novos continuam NULL; RLS M13 não fecha furo; M11 não gera membership correta para órfãos. Mitigação: não declarar M5 READY; não aplicar M13 como isolamento completo até M5-B. |

**Status D8:** `PROPOSED`  
**D9 (momento do NOT NULL):** somente M5-B, após evidência — `PROPOSED`

---

## 5. D10 — ON DELETE

FK futura: `residents.condominium_id → condominiums.id`

| Opção | Efeito | Integridade | Exclusão de site | Auditoria / histórico | Perda em cascata | Alinhamento M1–M4 |
|-------|--------|-------------|------------------|----------------------|------------------|-------------------|
| **RESTRICT** | DELETE do site **falha** se existir resident | alta | operador deve realocar/arquivar antes | preserva moradores | nenhuma | **padrão** orgs→condos, units, memberships, G6 |
| **CASCADE** | DELETE do site apaga moradores | aparente | “limpo” demais | apaga fato operacional | **alta** (auth_user, boletos transitivos, histórico) | contrário ao padrão tenant |
| **SET NULL** | site some, resident fica sem site | quebra o objetivo NOT NULL | fácil | órfãos | dados soltos | incompatível com M5-B NOT NULL |

**Recomendação inicial:** `ON DELETE RESTRICT`  
Não implementar. CASCADE e SET NULL **não** são recomendados.

**Status D10:** `PROPOSED`

---

## 6. M8 vs M5-B — `resident_invites.condominium_id`

### O que o plano **real** diz

`docs/FASE-1-MIGRATION-PLAN.md` § M8 `008_operational_rest`:

> Propagar `condominium_id` em occurrences, notices, visitors, boletos, reservations, chat, audit, **invites**, notes, crm_*.

Dependências M8 no plano: **M4–M7**.  
Cadeia: M5 → M6 → M7 → M8 (colunas site).  
Arquitetura §7 já classifica `resident_invites` como **TENANT-OWNED** com `condominium_id`.

M8 **não** é, no plano Fase 1, o módulo de API HMAC / idempotency. Esses contratos (G6-1, G6-2, G7) são gates **separados**, já tratados fora de M1–M16. **Não se atribui** idempotency/API a M8 neste fechamento.

### Opções

| Opção | Descrição | Duplica M8? | Ordem |
|-------|-----------|-------------|-------|
| **A** | Criar `resident_invites.condominium_id` **dentro de M5** | **SIM** — invade o objetivo explícito de M8 | M5 fica maior; M8 teria que skip/idempotente |
| **B** | Coluna em **M8**; **M5-B depende de M8** | NÃO | Nova aresta conceitual: `M5-A → … → M8 → M5-B(NOT NULL/invite)` |
| **C** | Migration preparatória nova (M5.5 / M8a) | inventa M fora do plano | fragmenta a cadeia |
| **D** | Outra (ex. site só no token JWT do invite, sem coluna) | foge da spec TENANT-OWNED; token opaco ainda precisa de persistência de site | não recomendado |

### Recomendação

```text
B — manter resident_invites.condominium_id em M8.
    M5-B (binding do accept + NOT NULL) depende dessa coluna.
    Não criar a coluna em M5.
    Não criar migration extra.
```

**Isto altera dependências conceituais** (não o arquivo do plano):

| Original (plano) | Com split proposto |
|------------------|--------------------|
| M5 completo (inclui NOT NULL) **antes** de M8 | **M5-A** antes de M8; **M5-B** **depois** de M8 (para o fluxo invite) |
| M5 → M8 | M5-A → M6/M7 → M8 → M5-B |

Staff CREATE/import no M5-B também exigem membership (M11) e sessão — outra dependência **de app**, não de coluna em invites.

`staff_invites` tem o mesmo buraco; o plano M8 diz “invites” (plural). Fora do escopo de **implementar** agora; apenas não tratar `resident_invites` como caso especial de M5.

**Status:** `PROPOSED` (ID **D11** na matriz)

---

## 7. Unit uniqueness

**Hoje:**

* `residents.unit` = string legado (apto), **não** FK, **não** `unit_id`.
* App (`registerResident`, import) trata unicidade **global** (`SELECT id, unit` + `compareUnits`).
* Índice legado possível `idx_residents_unit_upper` — **NOT VERIFIED** live; não é prova de UNIQUE constraint.
* UNIQUE conhecido no domínio residents: `auth_user_id` (scripts), não `(unit)`.
* Catálogo `units` (M2): `UNIQUE (condominium_id, code)` — padrão **por site**.
* Arquitetura §4: `units.code` único **por condomínio**; `residents.unit` permanece string até `unit_id` posterior.

**Perguntas**

| Pergunta | Recomendação |
|----------|----------------|
| Unicidade global de `unit`? | **Não** como contrato multi-tenant. Dois sites podem ter `03/005`. |
| Unicidade por condominium? | **Candidato** futuro: `(condominium_id, unit)` alinhado a M2. **Não** é decisão final de constraint. |
| Precisa existir alguma unicidade? | Sim, **operacionalmente** (login por unidade, import). O **enforcement DB** pode esperar. |
| Resolver em M5? | **Não.** M5-A não deve criar UNIQUE composto (coluna ainda nullable; plano M5 não define). M5-B corrige a **checagem de app** para o site ativo; constraint DB = migration **posterior** (após NOT NULL e normalização de `unit`). |
| Remover unique global se existir? | **Não nesta etapa.** Não criar, não dropar. |

PostgreSQL UNIQUE com `condominium_id` NULL **não** impede duplicatas de `unit` entre órfãos. Por isso constraint composta só faz sentido **depois** de M5-B (NOT NULL).

**Não assumir** `(condominium_id, unit)` como fechado: `unit` ainda é string livre; o destino canônico pode ser `unit_id` → `units.code`.

**Status D12:** `PROPOSED` (deferir constraint; contrato alvo = scoped por site, forma exata aberta)

---

## 8. organization_id

```text
residents.organization_id = DO NOT CREATE
```

**Justificativa:** isolamento operacional é o site. Org é transitiva:

```text
residents → condominiums → organizations
```

Duplicar org em residents reproduz o residual **DR7** de M3 (org da linha pode divergir da org do site). Eventos/auditoria leem org via JOIN no condominium. Membership já tem `organization_id` onde a identidade User↔Org↔Site precisa dela.

**Status D7:** `PROPOSED`

---

## 9. Membership

```text
MEMBERSHIP CONTEXT = ABSENT IN APP
```

Evidência: `tenant_memberships` existe (M3); app/AuthContext **não** carregam `active_condominium_id` / `active_membership_id`; REST recente viu 0 rows (e/ou RLS deny — COUNT live **NOT VERIFIED**). Login usa `users.role` legado.

**Não resolver agora.**

**Requisito de M5-B (staff CREATE / import):**

```text
O servidor determina o site autorizado a partir da membership ativa.
NÃO confiar em condominium_id enviado pelo cliente.
Se presented ≠ membership.condominium_id → DENY.
```

Dependência de dados: M11 (backfill memberships). Dependência de app: sessão de tenant (fora do DDL M5-A).

**Status:** blocker de **implementação M5-B**, não de documentação. Matriz: **D1** `PROPOSED`.

---

## 10. Offline

```text
OFFLINE TENANT STAMP = ABSENT
```

`offlineDataService` / Dexie: cache e outbox **sem** `condominium_id`; `syncOutbox` replaya INSERT sem checar site ativo.

**Requisito de M5-B:**

```text
Toda criação/replay offline de resident deve carregar contexto de site
verificável no enqueue.
Replay: se outbox.site ≠ sessão/membership → NÃO enviar.
Servidor revalida; payload local não é autoridade.
Troca de user/site: não replay automático cross-tenant.
```

Não implementar nesta etapa.

**Status D6:** `PROPOSED`

---

## 11. Live evidence

```text
LIVE COUNT / SNAPSHOT = NOT VERIFIED
```

Evidência **histórica** (G6-2 / M4 APPLY, postgres-role, 2026-08-14): 1 org, 1 condo piloto, 4 residents.  
Evidência **desta linha de auditoria (2026-08-17):** REST anon 0 rows em org/condo por RLS; 4 residents visíveis; coluna `condominium_id` ausente (`42703`); snapshot pós-M4/pré-M5 **não** verificado.

**Não** converter histórico em live. **Não** alterar RLS para “conseguir ler”.

M5-A permanece **BLOCKED** para APPLY até SELECT postgres COUNT + dump alinhado — independentemente das decisões PROPOSED abaixo.

---

## 12. Decision matrix

| DECISION | RECOMMENDATION | STATUS | DEPENDENCY |
|----------|----------------|--------|------------|
| **D1** Staff site context | Membership ativa da sessão; servidor revalida; role/org isolados rejeitados como fonte | PROPOSED | M11 + sessão app; M5-B |
| **D2** Auto-register | Unscoped (**A**) incompatível. Proposto: **desligar público** + cadastro via **convite (C+D)**. URL scoped (**B**) só com resolução server-side. **E** não existe | PROPOSED | D4/D11; M5-B |
| **D3** Import | Site = membership do importador; arquivo não escolhe tenant; lote = um site | PROPOSED | D1; M5-B |
| **D4** Invite carrega site | `resident_invites.condominium_id` definido na criação; accept usa o convite, não o body | PROPOSED | D11 (coluna em M8); M5-B |
| **D5** Validação server-side | presented ≠ authorized → DENY | PROPOSED | M5-B; M12/M13 depois |
| **D6** Offline tenant stamp | Stamp no enqueue; replay fail-closed; wipe na troca | PROPOSED | M5-B |
| **D7** `residents.organization_id` | **DO NOT CREATE** | PROPOSED | — |
| **D8** Split M5-A / M5-B | Aceitar como estratégia **provisória**. Plano M1–M16 **não** alterado nesta etapa | PROPOSED | aceite humano; depois M5-A gates |
| **D9** Momento do NOT NULL | Somente M5-B, após evidência de todos os CREATEs | PROPOSED | D8; D1–D6; D11 |
| **D10** ON DELETE | **RESTRICT** | PROPOSED | M5-A (quando autorizado) |
| **D11** M8 vs M5-B | Coluna de invite **em M8**, não em M5. M5-B **depende** de M8. Sem migration extra | PROPOSED | plano M8 intacto; aceite humano da aresta |
| **D12** Unit uniqueness | Global incompatível. Candidato futuro scoped por site; **não** criar/dropar UNIQUE no M5 | PROPOSED | pós M5-B / `unit_id` |
| **Live COUNT / snapshot** | Revalidar postgres + dump pré-APPLY | BLOCKED | credencial admin/postgres |
| **M5 READY** | — | BLOCKED | D8 aceite + live + M5-A + M5-B evidência |

Nenhuma célula `APPROVED`. Nenhuma célula `REJECTED` na matriz (opção D2-A é **recomendada incompatível**, à espera de aceite para rejeitar formalmente).

---

## 13. Dependências

```text
M4 (CLOSED)
  → M5-A schema+backfill nullable     [PROPOSED; APPLY ainda BLOCKED por live/snapshot/D10]
       → M6 / M7 (padrão análogo, independentes do NOT NULL de residents)
            → M8 operational rest (inclui invites.condominium_id)   [plano atual]
                 → M5-B binding + NOT NULL                         [aresta conceitual NOVA; plano arquivo NÃO mudou]
  → M11 memberships backfill (precisa M5-A para os 4 piloto)
       → M12 helpers
            → M13 RLS core (isolamento residents incompleto enquanto NULL existir)
```

**Aresta nova (só documental):** `M8 → M5-B` para o fluxo invite.  
**Aresta original preservada no arquivo do plano:** `M5 → M8`. Com split, isso lê-se como **M5-A → M8**.

Não alterar `docs/FASE-1-MIGRATION-PLAN.md` até aceite humano de D8 e D11.

---

## 14. Blockers

```text
NOT NULL / APP INSERT = BLOCKED
MEMBERSHIP CONTEXT = ABSENT IN APP
RESIDENT_INVITES SITE CONTEXT = ABSENT
OFFLINE TENANT STAMP = ABSENT
LIVE COUNT / SNAPSHOT = NOT VERIFIED
ON DELETE = NEEDS DECISION   (recomendação RESTRICT = PROPOSED)
D2 / D8 / D11 = PROPOSED / PENDING APPROVAL
```

Decisões PROPOSED **não** removem blockers. Só aceite humano + evidência live + implementação posterior (fora desta etapa) podem fazê-lo.

---

## 15. Próximo gate

1. **Aceite humano** da matriz (especialmente D2, D8, D10, D11).  
2. Sem aceite: **não** criar `005_*.sql`, **não** mudar o plano, **não** alterar app.  
3. Após aceite de D8/D10: gate de **evidência live** (COUNT org/condo/piloto + snapshot) **antes** de qualquer M5-A APPLY.  
4. M5-A, se um dia autorizado, **não** inclui NOT NULL, **não** inclui `resident_invites.condominium_id`, **não** inclui UNIQUE `(condominium_id, unit)`.  
5. M5-B só depois de membership no app, M8 invites, D2 (register unscoped off), D6 offline, testes de spoofing.

```text
M5 = NOT READY
M5-DECISIONS = PROPOSED / PENDING APPROVAL
PRÓXIMO GATE = HUMAN APPROVAL OF D2, D8, D10, D11
               + LIVE EVIDENCE
               (ainda sem SQL)
```
