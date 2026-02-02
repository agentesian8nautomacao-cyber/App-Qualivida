# 🚀 Guia de Deploy no Vercel

## ✅ Configuração de Build (vercel.json)

O projeto está configurado para Vite + React com:

- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Framework:** Vite (detectado automaticamente)

Não use **now.json**; use apenas **vercel.json**. Se aparecer erro "Missing public directory", confira no dashboard da Vercel: **Settings > General > Build & Output** deve ter **Output Directory:** `dist`.

### Relink do projeto (CLI)

Se precisar religar o projeto à Vercel:

1. Remova a pasta `.vercel` (se existir): `Remove-Item -Recurse -Force .vercel`
2. Execute: `vercel` (ou `npx vercel`) e siga o fluxo para linkar ao projeto existente ou criar um novo.

---

## ⚠️ Problema Comum: ERR_NAME_NOT_RESOLVED

Se você está vendo o erro `ERR_NAME_NOT_RESOLVED` após o deploy no Vercel, significa que as **variáveis de ambiente não estão configuradas**.

## 📋 Passo a Passo para Configurar Variáveis no Vercel

### 1. Acesse o Painel do Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Faça login na sua conta
3. Selecione seu projeto

### 2. Configure as Variáveis de Ambiente

1. No menu do projeto, clique em **Settings**
2. No menu lateral, clique em **Environment Variables**
3. Adicione as seguintes variáveis:

#### Variável 1: `VITE_SUPABASE_URL`
- **Key:** `VITE_SUPABASE_URL`
- **Value:** `https://seu-projeto-id.supabase.co`
  - Substitua `seu-projeto-id` pelo ID do seu projeto Supabase
  - Exemplo: `https://asfcttxrrfwqunljorvm.supabase.co`
- **Environment:** Selecione todas as opções:
  - ✅ Production
  - ✅ Preview
  - ✅ Development

#### Variável 2: `VITE_SUPABASE_ANON_KEY`
- **Key:** `VITE_SUPABASE_ANON_KEY`
- **Value:** Sua chave anon pública do Supabase
  - Para encontrar: Supabase Dashboard > Settings > API > anon public key
- **Environment:** Selecione todas as opções:
  - ✅ Production
  - ✅ Preview
  - ✅ Development

### 3. Onde Encontrar as Credenciais do Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Faça login e selecione seu projeto
3. Vá em **Settings** (ícone de engrenagem no menu lateral)
4. Clique em **API**
5. Você verá:
   - **Project URL:** Use para `VITE_SUPABASE_URL`
   - **anon public key:** Use para `VITE_SUPABASE_ANON_KEY`

### 4. Após Adicionar as Variáveis

1. **IMPORTANTE:** Após adicionar/modificar as variáveis, você **DEVE** fazer um **novo deploy**
2. Vá em **Deployments**
3. Clique nos três pontos (...) do último deployment
4. Selecione **Redeploy**
5. Ou faça um novo commit e push para trigger automático

### 5. ⚠️ Se as Variáveis Já Estão Configuradas mas Ainda Não Funciona

Se você já configurou as variáveis mas ainda vê o erro `ERR_NAME_NOT_RESOLVED`:

1. **Limpar Cache do Build:**
   - Settings > General > Scroll até "Build Cache"
   - Clique em **"Clear Build Cache"**
   - Confirme a ação

2. **Fazer Redeploy Completo:**
   - Deployments > Clique nos três pontos (...) do último deployment
   - Selecione **"Redeploy"**
   - ⚠️ **IMPORTANTE:** Marque a opção **"Use existing Build Cache"** como **DESMARCADA** (não usar cache)
   - Clique em **"Redeploy"**

3. **Verificar se as Variáveis Estão Corretas:**
   - Settings > Environment Variables
   - Verifique se `VITE_SUPABASE_URL` começa com `https://` e termina com `.supabase.co`
   - Verifique se `VITE_SUPABASE_ANON_KEY` não tem espaços extras no início ou fim
   - Verifique se ambas estão habilitadas para **Production**

4. **Verificar o Build Log:**
   - Deployments > Clique no último deployment
   - Abra a aba **"Build Logs"**
   - Procure por erros relacionados a variáveis de ambiente
   - Verifique se o build foi bem-sucedido

5. **Se Ainda Não Funcionar:**
   - Tente deletar e recriar as variáveis de ambiente
   - Ou adicione um espaço e depois remova para forçar atualização
   - Faça um novo redeploy após isso

## 🔍 Verificando se Está Funcionando

Após o redeploy, verifique:

1. Abra o console do navegador (F12)
2. Procure por erros relacionados ao Supabase
3. Se ainda houver erro `ERR_NAME_NOT_RESOLVED`, verifique:
   - ✅ As variáveis estão com os nomes corretos (`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`)
   - ✅ Os valores estão corretos (sem espaços extras)
   - ✅ As variáveis estão habilitadas para o ambiente correto (Production)
   - ✅ Você fez um novo deploy após adicionar as variáveis

## 📝 Exemplo de Configuração

No painel do Vercel, você deve ter algo assim:

```
Environment Variables:
┌─────────────────────────┬──────────────────────────────────────────────┬─────────────┐
│ Name                    │ Value                                        │ Environment │
├─────────────────────────┼──────────────────────────────────────────────┼─────────────┤
│ VITE_SUPABASE_URL       │ https://asfcttxrrfwqunljorvm.supabase.co     │ All         │
│ VITE_SUPABASE_ANON_KEY  │ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...       │ All         │
└─────────────────────────┴──────────────────────────────────────────────┴─────────────┘
```

## ⚡ Solução Rápida

Se você já configurou as variáveis mas ainda não funciona:

1. **Limpe o cache do Vercel:**
   - Settings > General > Clear Build Cache
   - Clique em "Clear"

2. **Faça um novo deploy:**
   - Deployments > ... > Redeploy

3. **Verifique o build log:**
   - Deployments > Clique no último deployment
   - Verifique se há erros durante o build

## 🐛 Troubleshooting

### Erro: "Variáveis não encontradas no build"

**Solução:** Certifique-se de que as variáveis começam com `VITE_` (isso é obrigatório para o Vite expor variáveis no cliente).

### Erro: "URL do Supabase inválida"

**Solução:** 
- Verifique se a URL não tem espaços extras
- Verifique se começa com `https://`
- Verifique se termina com `.supabase.co` (sem barra no final)

### Erro: "Chave anon inválida"

**Solução:**
- Use a chave **anon public**, não a service_role key
- A chave anon deve começar com `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9`

## 📚 Recursos Adicionais

- [Documentação do Vercel sobre Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Documentação do Vite sobre Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
