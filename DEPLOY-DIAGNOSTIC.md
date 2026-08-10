# Diagnóstico e correção – Deploy Vercel (ERR_CONNECTION_TIMED_OUT)

**Projeto:** QualiVida Club Residence  
**URL afetada:** https://qualivida-club-residence.vercel.app/  
**Data:** 25/02/2025  

---

## 1. Causa raiz identificada

### 1.1 Build falhando na Vercel (principal)

- **Problema:** O script de build (`node scripts/run-build.cjs`) usava `vite build --config vite.config.mjs`. Em ambiente ESM/Node (incluindo Vercel), o carregamento do config a partir de caminho absoluto gerava **ERR_MODULE_NOT_FOUND** para o pacote `vite`, pois a resolução de módulos ocorria a partir do arquivo temporário do config.
- **Efeito:** Se o build falha na Vercel, o deploy não gera artefatos válidos. A aplicação pode ficar inacessível ou dar timeout (página em branco ou conexão que não completa).

### 1.2 Dependências de build (devDependencies)

- **Vite** e outras ferramentas de build estão em `devDependencies`.
- Se na Vercel estiver definido **NODE_ENV=production** nas variáveis de ambiente do projeto, o `npm install` pode rodar em modo produção e **não instalar devDependencies**, levando a “vite not found” e build quebrado.

### 1.3 Rewrite SPA e rotas /api

- O `vercel.json` usava `"source": "/:path*"` para enviar tudo para `/index.html`.
- Em algumas interpretações/versões, isso pode afetar rotas que deveriam ser tratadas pelas serverless functions em `/api`. Foi aplicado um rewrite que **exclui explicitamente** `/api`, garantindo que as rotas da API não sejam reescritas para o SPA.

### 1.4 Conectividade

- Em teste, a URL de produção chegou a responder com o HTML da aplicação (título “Qualivida Gestão”, etc.), indicando que o timeout pode ser **intermitente** (cold start, região, ou build anteriormente quebrado).

---

## 2. Arquivos alterados

| Arquivo | Alteração |
|--------|-----------|
| `scripts/run-build.cjs` | Removido `--config vite.config.mjs`; o build passa a usar `npx vite build` sem config explícito, deixando o Vite resolver o config na raiz (evita ERR_MODULE_NOT_FOUND). |
| `vercel.json` | Rewrite ajustado de `"/:path*"` para `"/((?!api/).*)"` para que **apenas rotas que não começam com /api** sejam enviadas para `/index.html`. Formatação do JSON ajustada para leitura. |
| `package.json` | Adicionado `"engines": { "node": ">=18" }` para alinhar com o runtime recomendado na Vercel (Node 18+). |

---

## 3. Correções aplicadas

1. **Build script**  
   - Build passa a ser apenas `npx vite build` no diretório raiz.  
   - Evita resolução incorreta de `vite` quando o config é carregado por caminho absoluto.

2. **vercel.json**  
   - Rewrite SPA: só rotas que **não** são `/api/*` vão para `/index.html`.  
   - Rotas `/api/*` continuam sendo tratadas pelas serverless functions em `api/`.

3. **Node**  
   - `engines.node": ">=18"` no `package.json` para compatibilidade com a Vercel.

4. **Validação local**  
   - `npm install --include=dev` e `npm run build` executados com sucesso; saída em `dist/` gerada corretamente.

---

## 4. Recomendações para evitar recorrência

### 4.1 Variáveis de ambiente na Vercel

- **Não defina NODE_ENV=production** nas variáveis de ambiente do projeto na Vercel (ou remova se já existir).  
- Se for obrigatório manter, em **Build & Development Settings** defina o comando de instalação como:  
  `npm install --production=false`  
  Assim as **devDependencies** (vite, typescript, etc.) serão instaladas e o build continuará funcionando.

### 4.2 Build na Vercel

- **Build Command:** `npm run build` (já configurado no `vercel.json`).  
- **Output Directory:** `dist`.  
- **Framework Preset:** Vite (já indicado no `vercel.json`).

### 4.3 Variáveis obrigatórias para as API routes

- Para as funções em `api/` (ex.: `create-auth-user.ts`, `accept-staff-invite.ts`, etc.), garanta no projeto Vercel:
  - `SUPABASE_URL` ou `VITE_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY` (para criar usuários/admin)
  - Outras variáveis que cada rota exigir (e-mail, etc.).

### 4.4 Após o próximo deploy

- Acessar: https://qualivida-club-residence.vercel.app/
- Verificar:
  - Página carrega sem ERR_CONNECTION_TIMED_OUT.
  - Não há 500 nas rotas críticas.
  - Em **Deployments** na Vercel, o último build deve ter concluído com sucesso (Build Logs sem erro de “vite” ou “module not found”).

---

## 5. Resumo

- **Causa raiz:** Build falhando (config do Vite + resolução de módulo) e risco de devDependencies não instaladas; rewrite SPA poderia interferir em `/api`.
- **Correções:** Ajuste do script de build, rewrite em `vercel.json` excluindo `/api`, e `engines.node` no `package.json`.
- **Resultado esperado:** Build estável na Vercel, aplicação acessível na URL acima, sem timeout e com logs de build limpos.  
- **Próximo passo:** Fazer um novo deploy (push ou “Redeploy” no dashboard da Vercel) e validar a URL e as APIs conforme o item 4.4.
