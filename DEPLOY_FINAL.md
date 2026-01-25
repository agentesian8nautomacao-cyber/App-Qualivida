# ✅ Variáveis Corretas - Fazer Deploy Final

## ✅ Status das Variáveis

Suas variáveis no Vercel estão **CORRETAS**:
- ✅ `VITE_SUPABASE_URL` = `https://zaemlxjwhzrfmowbckmk.supabase.co`
- ✅ `VITE_SUPABASE_ANON_KEY` = Chave correta (ref: zaemlxjwhzrfmowbckmk)

## 🚀 Próximos Passos (Execute Agora)

### Passo 1: Fazer Commit e Push do Código Atualizado

O código foi atualizado com correções. Você precisa fazer commit:

```bash
git add .
git commit -m "Fix: Correção automática de URL Supabase e suporte para senhas plain:"
git push
```

Isso vai triggerar um novo deploy automático no Vercel.

### Passo 2: Limpar Cache e Redeploy Manual (Alternativa)

Se preferir fazer deploy manual:

1. **Vercel** → **Settings** → **General**
2. Role até **"Build Cache"**
3. Clique em **"Clear Build Cache"**
4. Vá em **Deployments**
5. Clique nos **três pontos (...)** do último deployment
6. Selecione **"Redeploy"**
7. ⚠️ **DESMARQUE** "Use existing Build Cache"
8. Clique em **"Redeploy"**
9. Aguarde o build terminar (2-5 minutos)

### Passo 3: Verificar o Deploy

Após o build terminar:

1. Acesse sua aplicação no Vercel
2. Abra o console do navegador (F12)
3. Procure por estas mensagens:

```
[Supabase Config] Mode: production
[Supabase Config] URL original: https://zaemlxjwhzrfmowbckmk.supabase.co
[Supabase Config] URL processada: https://zaemlxjwhzrfmowbckmk.supabase.co
[Supabase Config] Key: ✅ Configurada
```

### Passo 4: Testar Login

Tente fazer login com:
- **Usuário:** `desenvolvedor` | **Senha:** `dev` (Síndico)
- **Usuário:** `admin` | **Senha:** `admin123` (Síndico)
- **Usuário:** `portaria` | **Senha:** `123456` (Porteiro)

## 🔍 O Que Foi Corrigido no Código

1. ✅ **Correção automática de URL:** Adiciona `https://` se estiver faltando
2. ✅ **Suporte para senhas `plain:`:** Agora funciona com senhas no formato `plain:senha`
3. ✅ **Logs de debug:** Sempre mostra a configuração no console
4. ✅ **Normalização de URL:** Remove barras extras e normaliza

## ⚠️ Importante

- As variáveis foram atualizadas **agora** e há **4 minutos**
- O build antigo ainda pode estar em cache
- **É necessário fazer um novo deploy** para usar as variáveis atualizadas

## 📋 Checklist Final

Antes de testar, confirme:

- [x] `VITE_SUPABASE_URL` = `https://zaemlxjwhzrfmowbckmk.supabase.co` ✅
- [x] `VITE_SUPABASE_ANON_KEY` = Chave correta ✅
- [ ] Código atualizado foi commitado e pushado
- [ ] Cache do build foi limpo
- [ ] Novo deploy foi feito (sem cache)
- [ ] Build foi concluído com sucesso
- [ ] Console mostra `[Supabase Config]` com URL correta

## 🆘 Se Ainda Não Funcionar

1. **Verifique os Build Logs:**
   - Deployments > Último deployment > Build Logs
   - Procure por `VITE_SUPABASE_URL`
   - Verifique se aparece a URL correta

2. **Verifique o Console do Navegador:**
   - Se aparecer `URL original: NÃO DEFINIDA` → Variável não está sendo lida
   - Se aparecer URL diferente → Variável está errada
   - Se aparecer URL correta mas ainda não funciona → Problema pode ser no banco

3. **Verifique se os usuários existem no banco:**
   - Acesse o Supabase
   - Vá em Table Editor > users
   - Verifique se os usuários existem com as senhas `plain:dev`, `plain:admin123`, `plain:123456`

## ✅ Após o Deploy

O login deve funcionar normalmente no Vercel! 🎉
