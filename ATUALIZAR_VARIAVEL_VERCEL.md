# 🔄 Atualizar Variável no Vercel

## ⚠️ IMPORTANTE: URL do Supabase Atualizada

A URL correta do seu Supabase é:
```
https://zaemlxjwhzrfmowbckmk.supabase.co
```

## ✅ Passo a Passo para Atualizar no Vercel

### 1. Acesse o Vercel

1. Vá em [vercel.com](https://vercel.com)
2. Faça login
3. Selecione seu projeto

### 2. Atualize a Variável `VITE_SUPABASE_URL`

1. Vá em **Settings** > **Environment Variables**
2. Encontre a variável `VITE_SUPABASE_URL`
3. Clique em **Edit** (ou nos três pontos)
4. **Altere o valor para:**
   ```
   https://zaemlxjwhzrfmowbckmk.supabase.co
   ```
5. ⚠️ **IMPORTANTE:** Certifique-se de que:
   - Começa com `https://`
   - Não tem espaços extras
   - Termina com `.supabase.co` (sem barra `/` no final)
6. Clique em **Save**

### 3. Verifique a Chave `VITE_SUPABASE_ANON_KEY`

1. Ainda em **Environment Variables**
2. Verifique se `VITE_SUPABASE_ANON_KEY` está correta
3. A chave deve corresponder ao projeto `zaemlxjwhzrfmowbckmk`
4. Para verificar:
   - Acesse [supabase.com](https://supabase.com)
   - Selecione o projeto `zaemlxjwhzrfmowbckmk`
   - Vá em **Settings** > **API**
   - Copie a **anon public key**
   - Compare com a variável no Vercel

### 4. Limpar Cache e Redeploy

**IMPORTANTE:** Após atualizar a variável, você DEVE fazer um novo deploy:

1. **Settings** > **General** > Role até **"Build Cache"**
2. Clique em **"Clear Build Cache"**
3. Vá em **Deployments**
4. Clique nos **três pontos (...)** do último deployment
5. Selecione **"Redeploy"**
6. ⚠️ **DESMARQUE** "Use existing Build Cache"
7. Clique em **"Redeploy"**
8. Aguarde o build terminar (2-5 minutos)

### 5. Verificar

Após o deploy:

1. Acesse sua aplicação no Vercel
2. Abra o console (F12)
3. Procure por:
   ```
   [Supabase Config] URL processada: https://zaemlxjwhzrfmowbckmk.supabase.co
   ```
4. Tente fazer login

## 📋 Checklist

Antes de testar, confirme:

- [ ] `VITE_SUPABASE_URL` = `https://zaemlxjwhzrfmowbckmk.supabase.co`
- [ ] `VITE_SUPABASE_ANON_KEY` corresponde ao projeto correto
- [ ] Ambas as variáveis estão habilitadas para **Production**
- [ ] Cache do build foi limpo
- [ ] Redeploy foi feito SEM usar cache
- [ ] Build foi concluído com sucesso

## 🔍 Verificação no Console

Após o deploy, no console do navegador você deve ver:

```
[Supabase Config] Mode: production
[Supabase Config] URL original: https://zaemlxjwhzrfmowbckmk.supabase.co
[Supabase Config] URL processada: https://zaemlxjwhzrfmowbckmk.supabase.co
[Supabase Config] Key: ✅ Configurada
```

## ⚠️ Se Ainda Não Funcionar

1. **Verifique se a chave anon está correta:**
   - Deve corresponder ao projeto `zaemlxjwhzrfmowbckmk`
   - Não pode ser a chave do projeto antigo `asfcttxrrfwqunljorvm`

2. **Verifique os Build Logs:**
   - Deployments > Último deployment > Build Logs
   - Procure por `VITE_SUPABASE_URL`
   - Verifique se aparece a URL correta

3. **Deletar e Recriar:**
   - Delete ambas as variáveis
   - Recrie com os valores corretos
   - Faça redeploy sem cache

## ✅ Após Atualizar

Você deve conseguir fazer login com:
- `desenvolvedor` / `dev`
- `admin` / `admin123`
- `portaria` / `123456`
