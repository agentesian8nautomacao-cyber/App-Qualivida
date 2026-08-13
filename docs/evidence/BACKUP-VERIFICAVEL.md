# Backup verificável — pré-M1

**Status:** **PENDING** — tentativa Gate 3 em 2026-08-13 sem artefato  
**Data desta orientação:** 2026-08-12 (procedimento); coleta 2026-08-13  
**Ambiente-alvo:** Supabase project ref `zaemlxjwhzrfmowbckmk` (produção alinhada ao deploy Vercel)  
**Manifesto:** [results/BACKUP-MANIFEST-2026-08-13.md](./results/BACKUP-MANIFEST-2026-08-13.md)

Nenhuma credencial privilegiada do projeto alvo estava disponível ao agente. Nenhum dump/snapshot foi gerado. **Não** PASS.

---

## O que precisa ser feito

| Ativo | Obrigatório pré-M1 | Formato recomendado |
|-------|--------------------|---------------------|
| Schema PostgreSQL | Sim | `pg_dump --schema-only` **ou** snapshot Dashboard |
| Dados | Sim | `pg_dump --data-only` **ou** dump completo / PITR |
| Policies / RLS | Sim | Incluído no dump de schema **+** resultados D1/D2 |
| Funções / triggers | Sim | Incluídos no dump de schema **+** opcional Anexo D D3/D4 |
| Storage (objetos + metadados) | Sim, quando possível | Sync/copia dos buckets com objetos (ex.: `boletos`) + D5 |
| Auth users | Recomendado | Export/documentação de contas + vínculos `auth_user_id` |

---

## Ambiente

- **Produção (origem do backup):** projeto `zaemlxjwhzrfmowbckmk`
- **Restore de teste:** ambiente **separado** (projeto Supabase de staging/local) — **nunca** restaurar em produção nesta etapa

---

## Como obter (manual)

### Opção A — Dashboard Supabase

1. Abrir projeto → **Database → Backups** (ou **Settings → Database** conforme plano).
2. Confirmar existência de snapshot/PITR com data/hora.
3. Registrar evidência: print + nome do snapshot + horário UTC + responsável.
4. Se o plano permitir download/export, arquivar fora do Git público.

### Opção B — `pg_dump` (connection string do painel)

Somente com connection string de quem tem acesso privilegiado. Exemplo de intenção (não executar aqui):

```text
pg_dump "<DATABASE_URL>" --no-owner --format=custom -f qualivida-pre-m1-YYYYMMDD.dump
```

Variantes úteis:

```text
pg_dump "<DATABASE_URL>" --schema-only -f schema-pre-m1-YYYYMMDD.sql
pg_dump "<DATABASE_URL>" --data-only  -f data-pre-m1-YYYYMMDD.sql
```

### Storage

- Listar buckets via D5.
- Copiar objetos dos buckets com conteúdo (mínimo: `boletos`) para arquivo/local seguro.
- Não alterar policies nem apagar objetos.

---

## Como verificar que o arquivo existe

Criar (fora do Git se contiver dados sensíveis) um manifesto, por exemplo:

`docs/evidence/results/BACKUP-MANIFEST-<YYYY-MM-DD>.md`

Com campos:

| Campo | Exemplo |
|-------|---------|
| Ambiente | `zaemlxjwhzrfmowbckmk` |
| Tipo | Dashboard snapshot / `pg_dump` custom / schema+data |
| Caminho do arquivo | `\\backup\...` ou ID do snapshot |
| Tamanho | bytes |
| SHA-256 | hash do arquivo |
| Data/hora UTC | ISO-8601 |
| Responsável | nome |
| Contém schema | sim/não |
| Contém dados | sim/não |
| Contém Storage | sim/não/parcial |

**Critério mínimo de “arquivo existe”:** caminho/ID acessível + tamanho > 0 + hash registrado.

---

## Como verificar integridade

1. Calcular hash (ex.: `Get-FileHash -Algorithm SHA256`).
2. Conferir que o dump abre / lista TOC (`pg_restore -l arquivo.dump`) sem erro.
3. Conferir que schema-only contém policies (`CREATE POLICY` / `ENABLE ROW LEVEL SECURITY`) ou que D1/D2 foram arquivados na mesma data.
4. Não abrir/restaurar em produção.

---

## Restore de teste (ambiente separado)

1. Provisionar projeto/local **não produtivo**.
2. Restaurar dump **somente** nesse ambiente.
3. Validar smoke: contagens básicas (`residents`, `packages`, `users`, RBAC) e existência de policies.
4. Registrar resultado no manifesto.
5. **NÃO** restaurar em produção.

---

## Quando marcar BACKUP = OK

Somente quando existir evidência concreta (manifesto + arquivo/snapshot + hash ou ID Dashboard) e, preferencialmente, restore de teste em ambiente separado documentado.

Até lá: **BACKUP VERIFICÁVEL: PENDENTE**
