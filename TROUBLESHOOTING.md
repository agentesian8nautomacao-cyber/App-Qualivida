# 🔧 Troubleshooting - App Qualivida

## Problemas Comuns e Soluções

---

## ❌ Erro: `ERR_CONNECTION_RESET` ou `ERR_EMPTY_RESPONSE`

### Causa
O servidor de desenvolvimento não está rodando ou parou de responder.

### Solução

1. **Verifique se o servidor está rodando:**
   ```bash
   # Pare o servidor atual (Ctrl+C)
   # Depois inicie novamente:
   
   # Com npm
   npm run dev
   
   # Com yarn
   yarn dev
   ```

2. **Verifique se a porta 3007 está livre:**
   ```bash
   # Windows (PowerShell)
   netstat -ano | findstr :3007
   
   # Linux/Mac
   lsof -i :3007
   ```

3. **Se a porta estiver ocupada, altere no `vite.config.ts`:**
   ```typescript
   server: {
     port: 5173, // ou outra porta disponível
     host: '0.0.0.0',
   }
   ```

4. **Limpe o cache e reinstale:**
   ```bash
   # Remover node_modules e cache
   rm -rf node_modules
   rm -rf .vite
   rm package-lock.json  # ou yarn.lock
   
   # Reinstalar
   npm install  # ou yarn install
   
   # Iniciar novamente
   npm run dev  # ou yarn dev
   ```

---

## ⚠️ Aviso: Tailwind CSS via CDN

### Problema
```
cdn.tailwindcss.com should not be used in production
```

### Solução: Instalar Tailwind CSS Corretamente

1. **Instalar Tailwind CSS:**
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   # ou
   yarn add -D tailwindcss postcss autoprefixer
   ```

2. **Inicializar Tailwind:**
   ```bash
   npx tailwindcss init -p
   ```

3. **Configurar `tailwind.config.js`:**
   ```javascript
   /** @type {import('tailwindcss').Config} */
   export default {
     content: [
       "./index.html",
       "./*.{js,ts,jsx,tsx}",
       "./components/**/*.{js,ts,jsx,tsx}",
       "./contexts/**/*.{js,ts,jsx,tsx}",
       "./services/**/*.{js,ts,jsx,tsx}",
     ],
     theme: {
       extend: {},
     },
     plugins: [],
   }
   ```

4. **Atualizar `index.css`:**
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   
   /* Seus estilos customizados aqui */
   ```

5. **Remover o CDN do `index.html`:**
   ```html
   <!-- REMOVER ESTA LINHA -->
   <!-- <script src="https://cdn.tailwindcss.com"></script> -->
   ```

6. **Reiniciar o servidor:**
   ```bash
   npm run dev  # ou yarn dev
   ```

---

## ❌ Erro: `Failed to load resource: index.css`

### Causa
O arquivo `index.css` não existe ou não está sendo servido corretamente.

### Solução

1. **Verifique se o arquivo existe:**
   - O arquivo deve estar na raiz do projeto: `index.css`

2. **Se não existir, crie o arquivo:**
   ```bash
   touch index.css
   ```

3. **Adicione conteúdo básico:**
   ```css
   /* Estilos básicos */
   body {
     margin: 0;
     padding: 0;
   }
   ```

4. **Verifique o `index.html`:**
   - Deve ter: `<link rel="stylesheet" href="/index.css">`

---

## ❌ Erro: `404 (Not Found)` no favicon

### Solução

1. **Adicionar favicon ao projeto:**
   - Coloque um arquivo `favicon.ico` na pasta `public/`
   - Ou adicione no `index.html`:
   ```html
   <link rel="icon" type="image/x-icon" href="/favicon.ico">
   ```

2. **Ou ignore o erro (não é crítico):**
   - Este erro não impede o funcionamento da aplicação

---

## ❌ Erro: `Cannot find module` ou `Module not found`

### Solução

1. **Reinstalar dependências:**
   ```bash
   rm -rf node_modules
   npm install  # ou yarn install
   ```

2. **Verificar se todas as dependências estão no `package.json`**

3. **Limpar cache do Vite:**
   ```bash
   rm -rf .vite
   npm run dev  # ou yarn dev
   ```

---

## ❌ Erro: devDependencies não estão sendo instaladas (vite, typescript, etc.)

### Problema
O npm está em modo production, impedindo a instalação das devDependencies (como `vite`, `typescript`, `@vitejs/plugin-react`, etc.).

### Sintomas
- `vite` não encontrado ao executar `npm run dev`
- `Cannot find module 'vite'`
- `npm list vite` mostra que o pacote não está instalado
- Apenas `dependencies` são instaladas, não `devDependencies`

### Causa
O npm pode estar configurado para modo production através de:
- Variável de ambiente `NODE_ENV=production`
- Configuração do npm: `npm config set production true`
- Configuração `omit=dev` no npm

### Solução Completa (Execute na ordem)

```bash
# 1. Verificar variável de ambiente NODE_ENV
# Windows PowerShell:
$env:NODE_ENV
# Se retornar "production", limpe:
$env:NODE_ENV = ""

# Linux/Mac:
echo $NODE_ENV
# Se retornar "production", limpe:
unset NODE_ENV

# 2. Verificar configuração do npm para production
npm config get production

# 3. Se production estiver como true, desative
npm config set production false

# 4. Verificar se há configuração omit=dev
npm config get omit

# 5. Se omit contiver "dev", remova
npm config delete omit

# 6. Instalar explicitamente incluindo devDependencies (IMPORTANTE)
npm install --include=dev

# 7. Verificar se o vite foi instalado agora
npm list vite

# 8. Tentar executar
npm run dev
```

### Solução Rápida (PowerShell)

```powershell
# Limpar NODE_ENV
$env:NODE_ENV = ""

# Desabilitar modo production
npm config set production false

# Remover omit=dev se existir
npm config delete omit

# Instalar com devDependencies
npm install --include=dev

# Verificar instalação
npm list vite
```

### Verificação

Após seguir os passos acima, verifique se as devDependencies foram instaladas:

```bash
# Verificar vite
npm list vite

# Verificar todas as devDependencies
npm list --depth=0 | findstr "devDependencies"
```

### Prevenção

Para evitar esse problema no futuro:

1. **Não defina `NODE_ENV=production` durante desenvolvimento:**
   ```bash
   # Evite isso durante dev:
   $env:NODE_ENV="production"  # ❌
   npm install
   ```

2. **Use scripts do package.json para builds:**
   ```json
   {
     "scripts": {
       "dev": "vite",
       "build": "vite build"  // NODE_ENV será production automaticamente
     }
   }
   ```

3. **Verifique a configuração do npm periodicamente:**
   ```bash
   npm config list
   ```

---

## ❌ Erro: Porta já em uso

### Solução

1. **Encontrar processo usando a porta:**
   ```bash
   # Windows
   netstat -ano | findstr :3007
   
   # Linux/Mac
   lsof -i :3007
   ```

2. **Matar o processo:**
   ```bash
   # Windows (substitua PID pelo número encontrado)
   taskkill /PID <PID> /F
   
   # Linux/Mac
   kill -9 <PID>
   ```

3. **Ou altere a porta no `vite.config.ts`**

---

## ❌ Erro: Variáveis de ambiente não funcionam

### Solução

1. **Criar arquivo `.env` na raiz:**
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-aqui
   GEMINI_API_KEY=sua-chave-gemini
   ```

2. **Reiniciar o servidor após criar/editar `.env`**

3. **Verificar se as variáveis começam com `VITE_`** (para Vite)

---

## 🔄 Servidor não inicia

### Checklist

1. ✅ Node.js instalado (versão 18+)
   ```bash
   node --version
   ```

2. ✅ Dependências instaladas
   ```bash
   npm install  # ou yarn install
   ```

3. ✅ Porta disponível
   ```bash
   # Verificar porta
   netstat -ano | findstr :3007
   ```

4. ✅ Arquivo `vite.config.ts` correto

5. ✅ Sem erros de sintaxe nos arquivos

### Solução Completa

```bash
# 1. Limpar tudo
rm -rf node_modules
rm -rf .vite
rm package-lock.json  # ou yarn.lock

# 2. Reinstalar
npm install  # ou yarn install

# 3. Iniciar
npm run dev  # ou yarn dev
```

---

## 🐛 Erros no Console do Navegador

### Limpar Cache do Navegador

1. **Chrome/Edge:**
   - `Ctrl+Shift+Delete` (Windows) ou `Cmd+Shift+Delete` (Mac)
   - Selecione "Imagens e arquivos em cache"
   - Clique em "Limpar dados"

2. **Firefox:**
   - `Ctrl+Shift+Delete` (Windows) ou `Cmd+Shift+Delete` (Mac)
   - Selecione "Cache"
   - Clique em "Limpar agora"

3. **Ou use modo anônimo/privado** para testar

---

## 📝 Checklist Rápido

Antes de pedir ajuda, verifique:

- [ ] Servidor está rodando (`npm run dev` ou `yarn dev`)
- [ ] Porta está correta (verifique no terminal)
- [ ] Dependências instaladas (`node_modules` existe)
- [ ] Arquivo `.env` existe e está configurado
- [ ] Cache do navegador limpo
- [ ] Sem erros no terminal
- [ ] Node.js versão 18 ou superior

---

## 🆘 Ainda com Problemas?

1. **Verifique os logs:**
   - Terminal onde o servidor está rodando
   - Console do navegador (F12)

2. **Informações para compartilhar:**
   - Mensagem de erro completa
   - Versão do Node.js (`node --version`)
   - Sistema operacional
   - Comandos executados

3. **Tente em outro ambiente:**
   - Outro navegador
   - Outro computador
   - Modo anônimo/privado

---

**Última atualização:** 2024

