# 🔧 Resolver Problema de Bloqueio EBUSY

## Problema
```
npm error EBUSY: resource busy or locked
npm error path ...\esbuild.exe
```

O arquivo `esbuild.exe` está sendo usado por outro processo, impedindo a instalação.

## ✅ Solução Passo a Passo

### 1. Fechar todos os processos Node.js/npm

**Windows PowerShell:**
```powershell
# Ver processos Node
Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force

# Ver processos npm
Get-Process | Where-Object {$_.ProcessName -like "*npm*"} | Stop-Process -Force
```

**Ou use o Gerenciador de Tarefas:**
1. Pressione `Ctrl + Shift + Esc`
2. Procure por processos:
   - `node.exe`
   - `npm.cmd`
   - Qualquer coisa com "vite" ou "esbuild"
3. Finalize esses processos

### 2. Fechar o terminal/IDE

- Feche todos os terminais abertos
- Se estiver usando VS Code, feche e abra novamente
- Certifique-se de que não há servidor rodando (`npm run dev`)

### 3. Aguardar alguns segundos

Aguarde 5-10 segundos para garantir que os processos foram finalizados.

### 4. Limpar e reinstalar

```powershell
# Navegar para o diretório do projeto
cd "D:\App Qualivida"

# Limpar NODE_ENV
$env:NODE_ENV = ""

# Limpar configurações do npm
npm config set omit ""

# Remover node_modules (pode dar erro se ainda houver processos)
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue

# Se der erro, tente manualmente:
# 1. Feche todos os programas
# 2. Reinicie o computador (último recurso)
# 3. Depois tente novamente

# Remover package-lock.json
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

# Reinstalar dependências
npm install
```

### 5. Se ainda der erro, use yarn (alternativa)

```powershell
# Instalar yarn globalmente (se não tiver)
npm install -g yarn

# Usar yarn ao invés de npm
yarn install

# Executar com yarn
yarn dev
```

### 6. Verificar instalação

```powershell
# Verificar se vite foi instalado
npm list vite

# Se estiver instalado, tentar executar
npm run dev
```

## 🚨 Se Nada Funcionar

1. **Reiniciar o computador** (libera todos os processos)
2. Após reiniciar, execute:
   ```powershell
   cd "D:\App Qualivida"
   $env:NODE_ENV = ""
   npm config set omit ""
   npm install
   npm run dev
   ```

## 📝 Prevenção

- Sempre feche servidores com `Ctrl+C` antes de reinstalar
- Feche editores/IDEs antes de remover `node_modules`
- Não deixe múltiplos terminais rodando o mesmo servidor