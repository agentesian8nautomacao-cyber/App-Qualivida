# 🔧 Solução Rápida: ERR_NAME_NOT_RESOLVED no Vercel

## ✅ Suas Variáveis Já Estão Configuradas

Você já tem as variáveis configuradas no Vercel:
- ✅ `VITE_SUPABASE_URL`
- ✅ `VITE_SUPABASE_ANON_KEY`
- ✅ `GEMINI_API_KEY`

---

## 🟡 Assistente IA: GEMINI_API_KEY só no servidor

A IA roda no **backend** (`/api/ai`). A chave **não** é exposta no frontend. Se o assistente retornar erro de "chave não configurada" ou "assistente indisponível":

1. **Confirme no Vercel:** **Settings** → **Environment Variables** → variável **`GEMINI_API_KEY`** (valor da chave).
2. **Ambiente:** marque **Production** (e Preview se usar).
3. **Redeploy** (opcional: desmarque "Use existing Build Cache") para a função serverless enxergar a variável.
4. Para testar localmente com a API: use `vercel dev` (a API `/api/ai` só existe em produção na Vercel ou ao rodar `vercel dev`).

---

## 🎯 O Problema

O erro `ERR_NAME_NOT_RESOLVED` geralmente acontece porque:
1. O build foi feito **antes** de adicionar as variáveis
2. O cache do build está usando uma versão antiga
3. As variáveis não foram incluídas no build de produção

## 🚀 Solução (Execute na Ordem)

### Passo 1: Limpar Cache do Build

1. Acesse seu projeto no Vercel
2. Vá em **Settings** > **General**
3. Role até a seção **"Build Cache"**
4. Clique em **"Clear Build Cache"**
5. Confirme a ação

### Passo 2: Fazer Redeploy SEM Cache

1. Vá em **Deployments**
2. Clique nos **três pontos (...)** do último deployment
3. Selecione **"Redeploy"**
4. ⚠️ **IMPORTANTE:** Na tela de confirmação, **DESMARQUE** a opção:
   - ❌ "Use existing Build Cache" (NÃO usar cache)
5. Clique em **"Redeploy"**

### Passo 3: Aguardar o Build

- O build pode levar 2-5 minutos
- Aguarde até ver "Ready" no deployment
- Não interrompa o processo

### Passo 4: Testar

1. Acesse sua aplicação no Vercel
2. Abra o console do navegador (F12)
3. Verifique se ainda há o erro `ERR_NAME_NOT_RESOLVED`
4. Tente fazer login

## 🔍 Verificação Adicional

Se ainda não funcionar após o redeploy:

### Verificar se as Variáveis Estão Corretas

1. **Settings** > **Environment Variables**
2. Verifique `VITE_SUPABASE_URL`:
   - ✅ Deve começar com `https://`
   - ✅ Deve terminar com `.supabase.co`
   - ✅ Não deve ter espaços extras
   - ✅ Exemplo correto: `https://asfcttxrrfwqunljorvm.supabase.co`

3. Verifique `VITE_SUPABASE_ANON_KEY`:
   - ✅ Não deve ter espaços no início ou fim
   - ✅ Deve começar com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`

4. Verifique os ambientes:
   - ✅ Ambas devem estar habilitadas para **Production**
   - ✅ Ambas devem estar habilitadas para **Preview**
   - ✅ Ambas devem estar habilitadas para **Development**

### Forçar Atualização das Variáveis

1. Edite uma das variáveis (adicione um espaço no final)
2. Salve
3. Edite novamente (remova o espaço)
4. Salve
5. Faça um novo redeploy (sem cache)

## 📊 Verificar Build Logs

1. **Deployments** > Clique no último deployment
2. Abra a aba **"Build Logs"**
3. Procure por:
   - ✅ "Environment variables loaded"
   - ✅ "VITE_SUPABASE_URL" (deve aparecer no log)
   - ❌ Erros relacionados a variáveis

## 🆘 Se Nada Funcionar

1. **Deletar e Recriar as Variáveis:**
   - Delete `VITE_SUPABASE_URL`
   - Delete `VITE_SUPABASE_ANON_KEY`
   - Recrie ambas com os mesmos valores
   - Faça redeploy sem cache

2. **Verificar Build Command:**
   - Settings > General > Build & Development Settings
   - Build Command deve ser: `npm run build` ou `vite build`
   - Output Directory deve ser: `dist`

3. **Contatar Suporte:**
   - Se ainda não funcionar, pode ser um problema do Vercel
   - Verifique o status do Vercel: https://www.vercel-status.com

## ✅ Checklist Final

Antes de testar, confirme:

- [ ] Cache do build foi limpo
- [ ] Redeploy foi feito SEM usar cache
- [ ] Build foi concluído com sucesso
- [ ] Variáveis estão corretas (sem espaços extras)
- [ ] Variáveis estão habilitadas para Production
- [ ] Aguardou o build terminar completamente

## 🎉 Após o Redeploy

Se tudo estiver correto, você deve conseguir:
- ✅ Fazer login com `desenvolvedor` / `dev`
- ✅ Fazer login com `admin` / `admin123`
- ✅ Fazer login com `portaria` / `123456`
- ✅ Não ver mais o erro `ERR_NAME_NOT_RESOLVED`
