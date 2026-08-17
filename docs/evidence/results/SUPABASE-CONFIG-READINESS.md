# SUPABASE CONFIG READINESS

**Data:** 2026-08-17  
**Modo:** diagnóstico + correção mínima de env/Vite  
**Banco / RLS / migration / M5:** NÃO alterados  
**Secrets impressos:** NÃO  

```text
ROOT CAUSE = D (modo/env) + A (.env.local ausente)
FIX = Vite development fallback para VITE_* de .env.localnet
      + guard de placeholder em services/supabaseEnv.ts
```

---

## 1. Origem da mensagem

| Item | Valor |
|------|--------|
| Arquivo | `App.tsx` ~4437–4440 |
| Condição | `isSupabasePlaceholder === true` |
| Import | `services/supabase.ts` → agora `resolvePublicSupabaseConfig` |
| Variáveis consideradas | `import.meta.env.VITE_SUPABASE_URL`, `import.meta.env.VITE_SUPABASE_ANON_KEY` |

Banner âmbar no topo quando o cliente público não está configurado. A UI **não** crasha (cliente placeholder).

---

## 2. Cliente Supabase

| Item | Valor |
|------|--------|
| Arquivo | `services/supabase.ts` |
| API | `createClient` (`@supabase/supabase-js`) |
| Singleton | `export const supabase` |
| Guard | `export const isSupabasePlaceholder` |
| Esperado no frontend | **somente** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| Alternativas server-side | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` em `api/*` — **não** no client |

Não existe `VITE_SUPABASE_SERVICE_ROLE_KEY`.

---

## 3. Arquivos de ambiente (sem valores)

| Arquivo | `VITE_SUPABASE_URL` | `VITE_SUPABASE_ANON_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |
|---------|---------------------|--------------------------|------------------------------|
| `.env` | ABSENT (arquivo inexistente) | ABSENT | ABSENT |
| `.env.local` | ABSENT (arquivo inexistente) | ABSENT | ABSENT |
| `.env.localnet` | PRESENT (https, host `*.supabase.co`, len=40) | PRESENT (JWT `role=anon`, len=208) | ABSENT |
| `.env.example` | PLACEHOLDER | PLACEHOLDER | PLACEHOLDER (nome **sem** `VITE_`) |
| `.env.local.example` | PRESENT (http LAN exemplo) | PLACEHOLDER | ABSENT |
| `.env.production` | PLACEHOLDER (`xxxx.supabase.co`) | PLACEHOLDER (len=4) | ABSENT |

---

## 4. Vite / modo

| Comando | Mode | Porta | Env carregado pelo Vite |
|---------|------|-------|-------------------------|
| `npm run dev` | **development** | 3008 | `.env`, `.env.local`, `.env.development*` — **não** `.env.localnet` |
| `npm run dev:local` | localnet | 5173 | `.env.localnet` |
| `npm run build` | production | — | `.env.production` + `process.env` (Vercel) |

**`.env.localnet` NÃO é carregado automaticamente** em `npm run dev`.  
`loadEnv` no `vite.config.ts` servia proxy/API; **não** expunha sozinho as vars ao `import.meta.env`.

Causa classificada:

* **A** variável ausente no modo efetivo (`.env.local` inexistente)
* **D** modo `development` ≠ arquivo onde as keys reais estão
* **B** parcialmente: keys existem mas não eram expostas ao client nesse modo
* Não é C (nomes corretos), E, F (dev), G (`import.meta.env` no client)

---

## 5. `.env.local`

Ausente. Essa **é** a causa para `npm run dev`.

Valores corretos (URL cloud + anon JWT) já estavam em **`.env.localnet`** (gitignored).  
**Não** foram copiados para `.env.local` (regra: não copiar secrets automaticamente).

Arquivo local **recomendado** (docs/README): `.env.local` — carregado em **todos** os modos Vite.  
`.env.localnet` permanece o arquivo do modo `localnet` (`npm run dev:local`).

---

## 6–7. URL e anon key

`.env.localnet`: formato `https://<project-ref>.supabase.co` (cloud). Anon key JWT `role=anon`.  
Service role **não** está nesse arquivo e **não** foi promovida a `VITE_*`.

---

## 8. Guard / fallback

Antes: `isPlaceholder = !url || !key`, e a URL só era aceita se o host contivesse `.supabase.co` (quebraria Supabase LAN `http://192.168.x.x:54321`). Placeholders `xxxx` de `.env.production` passariam como “configurado”.

Depois: `services/supabaseEnv.ts` rejeita vazio, `xxxx`, `SEU-PROJETO`, keys curtas; aceita cloud https e http(s) local/LAN.

---

## 9. Vercel

`vercel.json`: `buildCommand: npm run build` (mode production).  
Esperado no painel (já documentado em README / `VERCEL_DEPLOY.md`):

* `VITE_SUPABASE_URL`
* `VITE_SUPABASE_ANON_KEY`

**Não** configurar `SUPABASE_SERVICE_ROLE_KEY` como `VITE_*`.  
Service role só no runtime server (`api/*`). Esta etapa **não** alterou o Vercel.

O fallback `.env.localnet` aplica-se **somente** a `mode === 'development'`. Build de produção local usa placeholders → banner controlado (sem crash). No Vercel, `process.env` do painel tem prioridade.

---

## 10. Desenvolvimento local

| Uso | Arquivo | Comando |
|-----|---------|---------|
| Padrão localhost | `.env.local` (recomendado) | `npm run dev` |
| Rede interna / localnet | `.env.localnet` | `npm run dev:local` |
| Fallback desta correção | lê `VITE_*` de `.env.localnet` **só** se development estiver sem keys | `npm run dev` |

Scripts de `package.json` **não** foram alterados.

---

## 11. Correção aplicada

1. `vite.config.ts` — se `development` e `VITE_SUPABASE_*` ausentes/placeholder, `loadEnv('localnet', …, 'VITE_')` e `define` só dessas duas chaves públicas.
2. `services/supabaseEnv.ts` + uso em `services/supabase.ts` — normalização e guard.
3. `services/supabaseEnv.test.ts` + include em `vitest.config.ts`.

**Não:** hardcode de URL/key, service role no frontend, cópia de `.env`, alteração de banco/RLS.

---

## 12. Validação

| Check | Resultado |
|-------|-----------|
| Vite log após restart | Fallback `.env.localnet` aplicado |
| Browser `http://localhost:3008/` | Banner **ausente**; login visível |
| `npm run test:run` | 22 files, **310 passed** |
| `npm run build` | PASS (placeholders de production → guard ativo no bundle) |
| Ausência de vars | cliente placeholder + banner; sem crash (comportamento mantido) |

---

## 13. Segurança (diff / dist)

| Check | Resultado |
|-------|-----------|
| `VITE_SUPABASE_SERVICE*` no dist | 0 |
| JWT `role=service_role` no dist | 0 |
| `SUPABASE_SERVICE_ROLE_KEY` no dist | 1 hit = **nome** da variável em mensagem de UI pré-existente (`AcceptStaffInvitePage`), não o secret |
| Fallback Vite prefix | `VITE_` only |
| `.env.localnet` copiado / commitado | NÃO |

---

## 14. Resultado

```text
ROOT CAUSE: npm run dev (mode=development) não carrega .env.localnet; .env.local inexistente.

FIX: fallback development → VITE_SUPABASE_* de .env.localnet + guard de placeholder.

LOCAL ENV: PASS (via fallback; .env.local continua ausente/recomendado)
VITE: PASS
SUPABASE CLIENT: PASS
BUILD: PASS
TESTS: PASS (310)
SERVICE ROLE EXPOSED: NO
```
