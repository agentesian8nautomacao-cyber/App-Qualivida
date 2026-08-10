# Correção Estrutural de Deploy (Vite + React + API + Vercel)

## Causa raiz identificada

- **ERR_CONNECTION_TIMED_OUT** pode ser causado por: (1) rewrite enviando rotas incorretas; (2) headers conflitantes ou malformados; (3) build/engines incompatíveis; (4) cold start das serverless functions.
- As alterações abaixo padronizam a configuração para SPA + API na Vercel e reduzem risco de timeout e de loop de rewrite.

---

## Arquivos alterados

### 1. `vercel.json`

- **Antes:** Vários headers (incluindo `source: "/(.*)"` com Cache-Control), um rewrite com regex `/((?!api/).*)`.
- **Depois:**
  - **Rewrites:** Mantido um único rewrite: `"source": "/((?!api/).*)", "destination": "/index.html"` — assim **apenas rotas que não começam com `/api/`** vão para o SPA; `/api/*` continua sendo atendido pelas serverless functions.
  - **Headers:** Removido o header genérico `"source": "/(.*)"` (Cache-Control) para evitar conflito. Mantidos apenas:
    - `/` e `/index.html` → `no-cache, no-store, must-revalidate`
    - `/assets/(.*)` → cache longo para assets com hash
    - `/manifest.json` → `Content-Type: application/manifest+json`
    - `*.mp4` → tipo e cache para vídeos
  - **Estrutura:** `framework`, `buildCommand` e `outputDirectory: "dist"` mantidos.

### 2. `package.json`

- **Script `build`:** De `"node scripts/run-build.cjs"` para **`"vite build"`** — build direto pelo Vite, sem script intermediário (o script apenas chamava `npx vite build`).
- **Engines:** De `"node": "24.x"` para **`"node": ">=18"`** — compatível com Vercel (18.x, 20.x, 22.x, 24.x) e evita fixar uma versão que possa não estar disponível em todos os ambientes.

### 3. `vite.config.ts`

- **Adicionado:** `ssr: false` — garante que o projeto seja tratado como SPA puro e evita que algum plugin ative SSR por engano.
- **Já corretos:** `base: '/'`, `build.outDir: 'dist'`, sem `base` personalizada e sem opções experimentais que quebrem o build.

---

## APIs (`/api`)

- **Formato:** Todas usam `export default { async fetch(request: Request): Promise<Response> }` (padrão suportado pela Vercel).
- **Tratamento de erro:** Todas possuem `try/catch` e retornam JSON de erro com status adequado.
- **Inicialização:** Nenhuma faz conexão de banco ou chamada bloqueante no escopo global; Supabase/Gemini/Resend são usados **dentro** do handler.
- **Variáveis de ambiente:** Validação de `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `GEMINI_API_KEY`/`VITE_GEMINI_LIVE_KEY`, `RESEND_API_KEY` antes do uso; retorno 500/503 com mensagem clara quando faltam.

Nenhuma alteração foi necessária nas APIs para evitar travamento; apenas conferido que não há init global bloqueante.

---

## Teste de isolamento (opcional)

Se o timeout persistir após o deploy:

1. Criar uma versão mínima: em `App.tsx` (ou rota principal), exibir apenas `<h1>App funcionando</h1>` e comentar chamadas a APIs e qualquer Service Worker.
2. Fazer deploy dessa versão.
3. Se a URL abrir → o problema está em alguma chamada API, SW ou CDN no app completo.
4. Se continuar timeout → verificar DNS, firewall, região do projeto na Vercel e logs do deployment.

---

## Validação de build local

Comandos executados:

```bash
npm install
npm run build
```

- **Resultado:** Build concluído com sucesso; pasta `dist/` gerada com `index.html` e `assets/`.
- **Aviso não crítico:** `dataService.ts` é importado de forma dinâmica e estática em vários arquivos; o Vite avisa que o dynamic import não moverá o módulo para outro chunk. Não impede o deploy.

---

## Deploy limpo

Recomendado:

```bash
vercel --force --prod
```

- Garantir que o deployment fique **Ready** e que a URL de produção retorne **HTTP 200**.
- Em **Vercel → Project → Settings → Environment Variables**, conferir que todas as variáveis usadas pelas APIs estão definidas (Supabase, Gemini, Resend, etc.).

---

## Resultado esperado

- URL de produção abre sem **ERR_CONNECTION_TIMED_OUT**.
- Sem loop de rewrite (rotas internas do SPA e `/api/*` funcionando).
- API routes respondendo corretamente quando as env vars estiverem configuradas.
- SPA (React Router) funcionando com navegação interna.

---

## Recomendações para evitar recorrência

1. **Não alterar o rewrite** para algo que capture `/api/*` (ex.: não usar apenas `"source": "/(.*)"` → `/index.html` sem excluir `/api`).
2. **Manter `build`** como `vite build` no `package.json`.
3. **Manter `ssr: false`** no `vite.config.ts` enquanto for SPA.
4. **Não adicionar** conexão de banco ou chamadas pesadas no escopo global dos arquivos em `/api`; manter toda lógica dentro do handler `fetch`.
5. **Service Worker (PWA):** O plugin VitePWA está comentado no `vite.config.ts`. Se reativar, testar o deploy e o carregamento da primeira tela para evitar timeout por SW antigo.
6. **Headers:** Evitar regras genéricas como `"source": "/(.*)"` para Cache-Control; preferir rotas específicas (`/`, `/index.html`, `/assets/(.*)`).

---

*Documento gerado após auditoria de configuração para correção de deploy (Vite + React + API + Vercel).*
