# SENTINELA AUT — G7-J-W-LIVE

**Gate:** G7-J-W-LIVE  
**Data:** 2026-08-15  
**Status:** PASS  
**Pré-requisito:** G7-J-W = PASS · G7-J = CLOSED

## Método

Piloto controlado: handlers reais da API (HMAC → Tenant → AuthZ → Core path) com stores de domínio **in-memory** (evita poluir `packages` LIVE), e persistent sink gravando em **LIVE** `public.api_domain_events`.

Script: `scripts/n8n-harness/live-event-store-pilot.ts`

Eventos nascem somente de `safeEmit` dos handlers — sem INSERT manual fabricado.

## Tenant piloto

| Campo | Valor |
|-------|--------|
| organization_id | `0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928` |
| condominium_id | `3f383313-5ec0-4d21-97c7-1b2500c933be` |
| client_id | `n8n-pilot-test` |
| Secret | **não registrado** |

## Resultados

Ver evidência: `docs/evidence/results/SENTINELA-G7-J-W-LIVE-2026-08-15.txt`

## STOP

Sem WhatsApp, n8n prod, endpoint `events.view`, purge.
