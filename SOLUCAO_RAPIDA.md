# ⚡ Solução Rápida - Erros de Conexão

## 🔴 Problema Atual

Você está vendo estes erros:
- `ERR_CONNECTION_RESET`
- `ERR_EMPTY_RESPONSE`
- Aviso sobre Tailwind CDN
- 404 no favicon

## ✅ Solução Passo a Passo

### 1. Parar o Servidor Atual

No terminal onde o servidor está rodando, pressione:
```
Ctrl + C
```

### 2. Limpar Cache e Reinstalar

Execute estes comandos **na ordem**:

```bash
# Limpar node_modules e cache
rm -rf node_modules
rm -rf .vite
rm package-lock.json

# Windows PowerShell: Limpar NODE_ENV se estiver em production
$env:NODE_ENV = ""

# Desabilitar modo production do npm
npm config set production false

# Reinstalar dependências (incluindo devDependencies)
npm install --include=dev

# OU se usar yarn:
# rm yarn.lock
# yarn install
```

**⚠️ IMPORTANTE:** Se o `vite` não estiver instalado, use `npm install --include=dev` para garantir que devDependencies sejam instaladas.

### 3. Iniciar o Servidor Novamente

```bash
npm run dev
# ou
yarn dev
```

### 4. Verificar a URL

O terminal deve mostrar algo como:
```
➜  Local:   http://localhost:3007/
```

**Abra essa URL no navegador.**

---

## ⚠️ Sobre o Aviso do Tailwind

O aviso sobre Tailwind CDN **não impede o funcionamento**, mas é recomendado instalar corretamente:

### Opção 1: Ignorar por enquanto (funciona)
- O app funciona normalmente com o CDN
- Você pode corrigir depois

### Opção 2: Instalar Tailwind (recomendado)

```bash
# Instalar Tailwind
npm install -D tailwindcss postcss autoprefixer

# Inicializar
npx tailwindcss init -p
```

Depois edite `tailwind.config.js`:
```javascript
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

E adicione no início do `index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Remova a linha do CDN do `index.html`:
```html
<!-- REMOVER: <script src="https://cdn.tailwindcss.com"></script> -->
```

---

## 🔍 Se Ainda Não Funcionar

### Verificar se a porta está ocupada:

```bash
# Windows PowerShell
netstat -ano | findstr :3007

# Se encontrar algo, mate o processo:
# taskkill /PID <número> /F
```

### Ou mude a porta no `vite.config.ts`:

```typescript
server: {
  port: 5173, // ou outra porta
  host: '0.0.0.0',
}
```

---

## 📋 Checklist Rápido

- [ ] Servidor parado (Ctrl+C)
- [ ] Cache limpo (node_modules removido)
- [ ] Dependências reinstaladas (npm install)
- [ ] Servidor iniciado (npm run dev)
- [ ] URL correta no navegador (http://localhost:3007)

---

## 🆘 Ainda com Problemas?

1. **Feche todos os terminais e abra um novo**
2. **Feche o navegador completamente e abra novamente**
3. **Tente em modo anônimo/privado**
4. **Verifique se o Node.js está instalado:**
   ```bash
   node --version
   # Deve ser 18 ou superior
   ```

---

**Na maioria dos casos, os passos 1-3 resolvem o problema!** 🎯

