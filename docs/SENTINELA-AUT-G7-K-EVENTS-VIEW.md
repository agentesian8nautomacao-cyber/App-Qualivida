# SENTINELA AUT — G7-K (API `events.view`)

**Data:** 2026-08-16  
**Status:** `G7-K = PASS`  
**Pré-requisito:** `G7-K-RBAC = CLOSED / PASS`

## Endpoint

`GET /api/v1/events`

Operação: `list_events` · Permission: `events.view` · Class: `READ` · Core: não

## Fluxo

HMAC → Tenant → AuthZ(`events.view`) → Event Store server adapter → resposta sanitizada

## Fronteiras

| Item | Valor |
|------|--------|
| DATABASE CHANGES | 0 |
| MIGRATIONS | 0 |
| Event Store schema | inalterado |
| WhatsApp / n8n prod | 0 |
| Dexie na API | 0 |

## Evidência

`docs/evidence/results/SENTINELA-G7-K-EVENTS-VIEW-2026-08-16.txt`
