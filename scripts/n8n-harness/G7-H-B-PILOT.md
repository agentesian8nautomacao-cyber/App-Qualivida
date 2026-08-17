# G7-H-B — Piloto n8n local → API v1

## Pré-requisitos

1. API piloto local (fake stores — **sem LIVE write**):

```bash
npx vite-node scripts/n8n-harness/local-api-pilot.ts
# http://127.0.0.1:3099
```

2. Variáveis no ambiente do **n8n** (Credentials / Environment — **não** no frontend / **não** no JSON versionado):

```
N8N_BLOCK_ENV_ACCESS_IN_NODE=false
NODE_FUNCTION_ALLOW_BUILTIN=crypto
SENTINELA_PILOT_BASE=http://127.0.0.1:3099
SENTINELA_HARNESS_SECRET=<segredo local de teste>
SENTINELA_HARNESS_CLIENT_ID=n8n-pilot-test
SENTINELA_HARNESS_ORG=0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928
SENTINELA_HARNESS_CONDO=3f383313-5ec0-4d21-97c7-1b2500c933be
```

(Aliases `SENTINELA_N8N_*` também aceitos no Code node.)

Opcional CLI: `SENTINELA_PILOT_SCENARIO=health|probe|identify|package|pickup`

3. Importar workflow:

```bash
n8n import:workflow --input=scripts/n8n-harness/workflows/SENTINELA-G7-H-B-API-PILOT.json
```

No pinData do Manual Trigger (ou `SENTINELA_PILOT_SCENARIO`), use: `health` | `probe` | `identify` | `package` | `pickup`.

## Runner HTTP automatizado (mesmo contrato do n8n)

```bash
# terminal 1
npx vite-node scripts/n8n-harness/local-api-pilot.ts

# terminal 2
node scripts/n8n-harness/pilot-http.mjs
```

## Proibições

- Sem node PostgreSQL  
- Sem WhatsApp / webhook  
- Sem service-role  
- Sem secrets no git / VITE_*  

## Fluxo do workflow

Manual Trigger → Build Test Request → Generate HMAC → HTTP Request → Validate Response → Structured Result
