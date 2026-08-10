# 🔧 Corrigir URL do Supabase no Vercel

## ⚠️ Problema Identificado

O erro mostra que a URL está sem `https://`:
```
asfcttxrrfwqunljorvm.supabase.co/rest/v1/users...
```

Deveria ser:
```
https://asfcttxrrfwqunljorvm.supabase.co/rest/v1/users...
```

## ✅ Solução

### Passo 1: Verificar a Variável no Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Selecione seu projeto
3. Vá em **Settings** > **Environment Variables**
4. Encontre a variável `VITE_SUPABASE_URL`
5. **Verifique o valor:**

   ❌ **ERRADO:**
   ```
   asfcttxrrfwqunljorvm.supabase.co
   ```

   ✅ **CORRETO:**
   ```
   https://asfcttxrrfwqunljorvm.supabase.co
   ```

### Passo 2: Corrigir a Variável

Se a URL não começar com `https://`:

1. Clique em **Edit** (ou os três pontos) na variável `VITE_SUPABASE_URL`
2. **Adicione `https://` no início** se não estiver presente
3. O valor deve ser exatamente:
   ```
   https://asfcttxrrfwqunljorvm.supabase.co
   ```
4. Clique em **Save**

### Passo 3: Fazer Redeploy

**IMPORTANTE:** Após corrigir a variável, você DEVE fazer um novo deploy:

1. Vá em **Deployments**
2. Clique nos **três pontos (...)** do último deployment
3. Selecione **"Redeploy"**
4. ⚠️ **DESMARQUE** "Use existing Build Cache"
5. Clique em **"Redeploy"**

### Passo 4: Verificar

Após o redeploy:

1. Abra o console do navegador (F12)
2. Procure por erros
3. A URL nas requisições deve começar com `https://`

## 🔍 Verificação Rápida

No Vercel, a variável `VITE_SUPABASE_URL` deve estar assim:

```
┌──────────────────────┬──────────────────────────────────────────────┐
│ Key                  │ Value                                        │
├──────────────────────┼──────────────────────────────────────────────┤
│ VITE_SUPABASE_URL    │ https://asfcttxrrfwqunljorvm.supabase.co    │
└──────────────────────┴──────────────────────────────────────────────┘
```

## ⚡ Código Atualizado

O código agora adiciona automaticamente `https://` se estiver faltando, mas é melhor corrigir no Vercel para evitar problemas.

## 📝 Checklist

- [ ] Variável `VITE_SUPABASE_URL` começa com `https://`
- [ ] Variável não tem espaços extras
- [ ] Variável termina com `.supabase.co` (sem barra no final)
- [ ] Redeploy foi feito após corrigir
- [ ] Build foi concluído com sucesso
