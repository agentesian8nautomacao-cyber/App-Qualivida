# Evidências Pré-M1 (Gates)

**Última atualização documental:** 2026-08-12  
**Project ref esperado:** `zaemlxjwhzrfmowbckmk`  
**Regra:** não inventar resultados. Sem execução manual → status **PENDENTE**.

Esta pasta concentra scripts **somente leitura** e o registro de evidências necessárias para liberar M1.  
**Não** contém migrations multi-tenant. **Não** altera banco, RLS, Storage nem código funcional.

---

## Mapa dos artefatos

| Código | Significado | Script | Resultado esperado |
|--------|-------------|--------|--------------------|
| **D1** | RLS live (`relrowsecurity`) | [D1-RLS-LIVE.sql](./D1-RLS-LIVE.sql) | `results/D1-RLS-LIVE-<data>.txt` |
| **D2** | Storage live + policies (`pg_policies`, incl. `storage.objects`) | [D2-STORAGE-LIVE.sql](./D2-STORAGE-LIVE.sql) | `results/D2-STORAGE-LIVE-<data>.txt` |
| **D5** | Evidência complementar Storage (`storage.buckets`) | [D5-STORAGE-EVIDENCE.sql](./D5-STORAGE-EVIDENCE.sql) | `results/D5-STORAGE-EVIDENCE-<data>.txt` |
| **Backup** | Backup verificável | [BACKUP-VERIFICAVEL.md](./BACKUP-VERIFICAVEL.md) | `results/BACKUP-MANIFEST-<data>.md` (+ arquivo/snapshot) |

Pasta sugerida para saídas (criar ao coletar): `docs/evidence/results/`  
Se o export contiver dados sensíveis, arquivar **fora** do Git público e registrar só o manifesto.

---

## Metadados obrigatórios em cada coleta

Para cada evidência (D1, D2, D5, backup), registrar:

| Campo | Valor |
|-------|-------|
| Data/hora (UTC) | *PENDENTE — aguardando execução manual* |
| Ambiente (project ref) | *PENDENTE — aguardando execução manual* |
| Responsável pela execução | *PENDENTE — aguardando execução manual* |
| Arquivo de resultado | *PENDENTE — aguardando execução manual* |

---

## Status atual (sem inventar resultados)

| Gate / evidência | Status |
|------------------|--------|
| D1 — RLS live | **PENDENTE — aguardando execução manual** |
| D2 — Storage live (policies) | **PENDENTE — aguardando execução manual** |
| D5 — Storage buckets | **PENDENTE — aguardando execução manual** |
| Backup verificável | **PENDENTE — aguardando execução manual** |
| Git baseline `pre-multitenant-baseline` | **OK** (confirmado no repositório; ver status nos docs Fase 1) |

---

## Como executar (manual)

1. Abrir **SQL Editor** no projeto Supabase correto (`zaemlxjwhzrfmowbckmk`).
2. Executar **apenas** os scripts desta pasta (`D1`, `D2`, `D5`), um por vez.
3. Exportar resultados para `docs/evidence/results/` (ou local seguro).
4. Preencher data/hora, ambiente e responsável neste README (ou no manifesto).
5. Seguir [BACKUP-VERIFICAVEL.md](./BACKUP-VERIFICAVEL.md) para backup — **sem restore em produção**.

**Não executar** estes scripts automaticamente por CI/agente sem autorização explícita do operador.

---

## Critério para marcar gate OK

| Gate | Só OK se |
|------|----------|
| RLS live | Resultado D1 arquivado + metadados preenchidos |
| Storage live | Resultados D2 **e** D5 arquivados + metadados preenchidos |
| Backup verificável | Manifesto + arquivo/snapshot comprovável (hash ou ID Dashboard) |

Enquanto qualquer um estiver pendente: **M1 AUTORIZADA = NÃO**.
