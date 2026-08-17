# n8n harness local (G7-F + G7-H-B + G7-L)

Simula / pilota o orquestrador externo **sem** WhatsApp.

## G7-L — primeiro workflow real (inactive)

Contrato: `docs/SENTINELA-AUT-G7-L-N8N-WORKFLOW-CONTRACT.md`  
Workflow: `workflows/SENTINELA-G7-L-FIRST-REAL-WORKFLOW.json` (**active=false**)

```bash
# Importar no n8n local (UI → Import from File). NÃO ativar.
# Cenários via env:
#   SENTINELA_G7L_SCENARIO=identify_resident|create_package|health|unknown
#   SENTINELA_G7L_EXTERNAL_MESSAGE_ID=g7l-pilot-msg-001
npm run test:run -- api/v1/_lib/execution/g7l.n8n-workflow.test.ts
```

## G7-H-B — piloto

Ver `G7-H-B-PILOT.md`.

```bash
npm run pilot:api    # API HTTP local :3099 (fake stores)
npm run pilot:http   # cenários HMAC→API (mesmo contrato do workflow n8n)
```

Importar no n8n local: `workflows/SENTINELA-G7-H-B-API-PILOT.json`

## Assinatura avulsa

```bash
node scripts/n8n-harness/sign.mjs \
  --method POST \
  --path /api/v1/operations/packages \
  --body scripts/n8n-harness/fixtures/create_package_text.json \
  --idempotency-key harness-pkg-text-1

npm run test:run -- api/v1/_lib/execution/g7f.n8n-readiness.test.ts
```

Variáveis (somente local/test — **não** produção / **não** VITE_*):

```
SENTINELA_HARNESS_SECRET=test-secret-do-not-use-in-prod
SENTINELA_HARNESS_CLIENT_ID=n8n-pilot-test
SENTINELA_HARNESS_ORG=0e5a5c4b-4cc6-48ee-8c1b-08d5015ab928
SENTINELA_HARNESS_CONDO=3f383313-5ec0-4d21-97c7-1b2500c933be
```

Proibido: node PostgreSQL, service-role, WhatsApp, secrets no git.
