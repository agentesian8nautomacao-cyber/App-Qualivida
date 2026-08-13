# PROJECT REF AUDIT — 2026-08-12

**Tipo:** Gate 0.1 — READ-ONLY  
**Data/hora:** 2026-08-12 (complemento ao Gate 0)  
**Objetivo:** provar qual project ref deve receber D1/D2/D5 e mapear risco de execução no projeto errado.

**Nada alterado** (banco, RLS, Storage, código, `.env`, deploy).

---

## Respostas diretas

| # | Pergunta | Resposta |
|---|----------|----------|
| 1 | Project ref do frontend de **produção**? | **`zaemlxjwhzrfmowbckmk`** |
| 2 | Project ref dos scripts de evidência D1/D2/D5? | **`zaemlxjwhzrfmowbckmk`** (header dos `.sql` + `docs/evidence/README.md`) |
| 3 | `.env` / config ativa apontando para o antigo? | **NÃO** (entre arquivos `.env*` presentes) |
| 4 | Migrations/scripts de código apontando para o antigo? | **NÃO** |
| 5 | Referências antigas que podem induzir erro humano? | **SIM** — 4–5 markdowns legados na raiz |
| 6 | Arquivos por referência? | Tabelas abaixo |

---

## Evidência de produção atual

| Evidência | Resultado | Classificação |
|-----------|-----------|---------------|
| Bundle `https://qualivida-club-residence.vercel.app/assets/index-BrROEMGa.js` | Contém `zaemlxjwhzrfmowbckmk`; **não** contém `asfcttxrrfwqunljorvm` | **produção atual** / **bundle** |
| `.env.localnet` | URL host = `zaemlxjwhzrfmowbckmk` | **variável de ambiente** (local alinhada à prod) |
| `.env.production` | Sem `zaem…` nem `asfc…` (placeholder / não é fonte do bundle) | **arquivo de exemplo/config fraca** — não usar como verdade |
| Scripts evidence | Header `ref: zaemlxjwhzrfmowbckmk` | **evidência** |

---

## Inventário `asfcttxrrfwqunljorvm` (projeto antigo)

| Arquivo | Classificação | Nota |
|---------|---------------|------|
| `CORRIGIR_URL_SUPABASE.md` | **documentação histórica** / **referência obsoleta** | Instrui Vercel com URL antiga |
| `URGENTE_VERCEL_FIX.md` | **documentação histórica** / **referência obsoleta** | Idem; “recrie com valor” antigo |
| `VERCEL_DEPLOY.md` | **documentação histórica** / **referência obsoleta** | Exemplo de tabela Vercel com ref antigo |
| `SOLUCAO_VERCEL.md` | **documentação histórica** / **referência obsoleta** | “Exemplo correto” com ref antigo |
| `ATUALIZAR_VARIAVEL_VERCEL.md` | **documentação histórica** (mista) | Usa **`zaemlxjwhzrfmowbckmk`** como correto e cita `asfct…` como **projeto antigo a evitar** |

**Não encontrado em:** `migrations/`, `supabase/`, `scripts/`, `api/` (git grep).

---

## Inventário `zaemlxjwhzrfmowbckmk` (amostra por tipo)

| Tipo | Exemplos |
|------|----------|
| **produção atual / bundle** | `qualivida-club-residence.vercel.app` → `index-BrROEMGa.js` |
| **variável de ambiente** | `.env.localnet` |
| **evidência** | `docs/evidence/D1-RLS-LIVE.sql`, `D2-…`, `D5-…`, `README.md`, `BACKUP-VERIFICAVEL.md`, `PRE-M1-GATE-AUDIT-2026-08-12.md` |
| **documentação atual** | `docs/FASE-0-*.md`, `docs/FASE-1-*.md`, `DEPLOY_FINAL.md`, `ATUALIZAR_VARIAVEL_VERCEL.md` |
| **código / scripts** | `scripts/create_portaria_auth.js`, `set_portaria_password.js`, `test_*.js`, fallbacks `VITE_SUPABASE_URL \|\| https://zaem…` |
| **migration** | *(nenhuma migration embute o ref como URL; schema é independente do host)* |

---

## Risco de executar D1/D2/D5 no projeto errado

| Fator | Avaliação |
|-------|-----------|
| Configuração **ativa** (env presente / bundle) apontando para `asfct…` | **Ausente** |
| Documentação obsoleta induzindo operador | **Presente** — risco **humano** |
| Mitigação | Abrir SQL Editor só após confirmar Project URL = `https://zaemlxjwhzrfmowbckmk.supabase.co`; **ignorar** docs `CORRIGIR_*` / `URGENTE_*` / `VERCEL_DEPLOY` / `SOLUCAO_VERCEL` para escolha de projeto |

**Conclusão Parte 1:** scripts D1/D2/D5 estão **inequivocamente** direcionados a `zaemlxjwhzrfmowbckmk`. Não há configuração ativa no workspace apontando para o projeto antigo. Há **referências obsoletas em markdown** que exigem disciplina do operador.

---

## Esclarecimento sobre “D1_CONTAINS_staff_invites”

O flag `D1_CONTAINS_staff_invites=True` do Gate 0 **não** veio do bundle de produção.  
Foi um check local: o **script** `docs/evidence/D1-RLS-LIVE.sql` lista a tabela `'staff_invites'` no `IN (...)`.

O bundle de produção **também** contém a string `staff_invites` / `staff-invite` como **código de feature** (nome de tabela/rota), o que é esperado — ver `STAFF-INVITES-AUDIT-2026-08-12.md`.

---

*READ-ONLY. Sem correções aplicadas.*
