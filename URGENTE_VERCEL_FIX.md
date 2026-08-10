# 🚨 URGENTE: Corrigir Login no Vercel

## ⚠️ Problema Atual

- ✅ Login funciona **localmente**
- ❌ Login **NÃO funciona** no Vercel
- Erro: `ERR_NAME_NOT_RESOLVED` com URL sem `https://`

## 🎯 Causa Raiz

A variável `VITE_SUPABASE_URL` no Vercel provavelmente está **sem o `https://`** ou o build não está pegando a variável corretamente.

## ✅ SOLUÇÃO IMEDIATA (Execute Agora)

### Passo 1: Verificar e Corrigir a Variável no Vercel

1. Acesse: https://vercel.com
2. Selecione seu projeto
3. Vá em **Settings** > **Environment Variables**
4. Encontre `VITE_SUPABASE_URL`
5. **Clique para editar**
6. **Verifique o valor:**

   Se estiver assim (ERRADO):
   ```
   asfcttxrrfwqunljorvm.supabase.co
   ```

   Deve estar assim (CORRETO):
   ```
   https://asfcttxrrfwqunljorvm.supabase.co
   ```

7. Se estiver sem `https://`, **adicione agora**
8. Clique em **Save**

### Passo 2: Limpar Cache e Redeploy

1. **Settings** > **General** > Role até **"Build Cache"**
2. Clique em **"Clear Build Cache"**
3. Vá em **Deployments**
4. Clique nos **três pontos (...)** do último deployment
5. Selecione **"Redeploy"**
6. ⚠️ **DESMARQUE** "Use existing Build Cache"
7. Clique em **"Redeploy"**
8. Aguarde o build terminar (2-5 minutos)

### Passo 3: Verificar

1. Após o build terminar, acesse sua aplicação
2. Abra o console (F12)
3. Procure por: `[Supabase Config]`
4. Deve mostrar a URL com `https://`
5. Tente fazer login

## 🔍 Verificação Detalhada

### No Console do Navegador (F12)

Após o redeploy, você deve ver:

```
[Supabase Config] Mode: production
[Supabase Config] URL original: https://asfcttxrrfwqunljorvm.supabase.co
[Supabase Config] URL processada: https://asfcttxrrfwqunljorvm.supabase.co
[Supabase Config] Key: ✅ Configurada
```

Se aparecer:
- `URL original: NÃO DEFINIDA` → Variável não está configurada
- `URL original: asfcttxrrfwqunljorvm.supabase.co` (sem https) → Variável está incorreta
- `URL processada: https://...` → Correção automática funcionou

## 📋 Checklist Completo

Antes de testar, confirme:

- [ ] Variável `VITE_SUPABASE_URL` no Vercel começa com `https://`
- [ ] Variável não tem espaços extras
- [ ] Variável termina com `.supabase.co` (sem barra `/`)
- [ ] Cache do build foi limpo
- [ ] Redeploy foi feito SEM usar cache
- [ ] Build foi concluído com sucesso
- [ ] Console mostra `[Supabase Config]` com URL correta

## 🆘 Se Ainda Não Funcionar

### Opção 1: Deletar e Recriar a Variável

1. Delete `VITE_SUPABASE_URL`
2. Recrie com valor: `https://asfcttxrrfwqunljorvm.supabase.co`
3. Faça redeploy sem cache

### Opção 2: Verificar Build Logs

1. **Deployments** > Clique no último deployment
2. Abra **"Build Logs"**
3. Procure por:
   - `VITE_SUPABASE_URL`
   - Erros relacionados a variáveis
   - Se a variável aparece no log

### Opção 3: Verificar se Variável Está Habilitada

1. **Settings** > **Environment Variables**
2. Verifique se `VITE_SUPABASE_URL` está habilitada para:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

## 💡 Nota Importante

O código agora tem **correção automática** que adiciona `https://` se estiver faltando. Mas é melhor corrigir no Vercel para garantir que funcione corretamente.

## ✅ Após Corrigir

Você deve conseguir fazer login com:
- `desenvolvedor` / `dev`
- `admin` / `admin123`
- `portaria` / `123456`
