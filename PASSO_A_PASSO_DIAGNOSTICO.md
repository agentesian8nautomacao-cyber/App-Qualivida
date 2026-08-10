# 🔍 Passo a Passo: Diagnosticar Notificações

## ✅ Status Atual
- Tabela `notifications` existe ✅
- Políticas RLS configuradas ✅
- 0 notificações criadas ❌

## 📋 Passo 1: Testar Inserção Manual no Supabase

Execute `supabase_simple_test.sql` no Supabase SQL Editor.

**Resultado esperado:**
- Deve criar uma notificação de teste
- Deve mostrar o ID da notificação criada
- A notificação deve permanecer na tabela

**Se funcionar:** O problema está no código JavaScript.
**Se não funcionar:** O problema está nas políticas RLS ou estrutura da tabela.

## 📋 Passo 2: Verificar Logs do Console

1. Abra o console do navegador (F12 → Console)
2. Limpe o console (Ctrl+L)
3. Registre uma nova encomenda no app
4. Procure por logs que começam com:
   - `[handleRegisterPackageFinal]`
   - `[savePackage]`
   - `[Notificação]`
   - `[createNotification]`

### Logs Esperados (em ordem):

```
[handleRegisterPackageFinal] Iniciando registro de encomenda: {selectedResident: "...", recipientId: "...", unit: "..."}
[savePackage] Iniciando salvamento de encomenda: {recipient: "...", unit: "...", recipientId: "..."}
[savePackage] Verificando condições para criar notificação: {recipientId: "...", hasData: true, dataId: "..."}
[Notificação] ✅ Condições OK. Criando notificação para morador: [id] Encomenda: [id]
[createNotification] Iniciando criação de notificação: {moradorId: "...", title: "...", type: "package", relatedId: "..."}
[createNotification] Dados para inserção: {morador_id: "...", title: "...", message: "...", type: "package", read: false, related_id: "..."}
[createNotification] ✅ Notificação criada: {id: "...", ...}
[Notificação] ✅✅✅ Notificação criada com sucesso! ID: [id]
```

### Se aparecer erro:

**Erro: `[Notificação] ⚠️⚠️⚠️ Não foi possível criar notificação - condições não atendidas`**
- Problema: `recipientId` está null
- Solução: Verifique se o morador está selecionado corretamente

**Erro: `[createNotification] ❌ Erro do Supabase`**
- Problema: Erro do Supabase (RLS, tabela, etc.)
- Solução: Verifique a mensagem de erro específica

**Erro: `relation "notifications" does not exist`**
- Problema: Tabela não existe
- Solução: Execute `supabase_notifications.sql`

**Erro: `new row violates row-level security policy`**
- Problema: Política RLS bloqueando
- Solução: Execute `supabase_clean_and_fix_rls.sql`

## 📋 Passo 3: Verificar se recipientId está sendo passado

Nos logs, procure por:
```
[savePackage] recipientId encontrado: [uuid] ou null
```

**Se for `null`:**
- O morador não foi encontrado no banco
- Verifique se o morador existe na tabela `residents`
- Verifique se o nome e unidade estão corretos

## 📋 Passo 4: Verificar no Supabase

Após registrar uma encomenda, execute:

```sql
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5;
```

**Se aparecer notificações:** ✅ Funcionando!
**Se não aparecer:** ❌ Verifique os logs do console

## 🔧 Soluções Rápidas

### Solução 1: Recriar Políticas RLS
Execute `supabase_clean_and_fix_rls.sql`

### Solução 2: Verificar Estrutura da Tabela
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications';
```

### Solução 3: Testar Inserção Manual
Execute `supabase_simple_test.sql`

## 📞 Compartilhar Resultados

Se ainda não funcionar, compartilhe:
1. Logs do console (copie e cole)
2. Resultado do `supabase_simple_test.sql`
3. Resultado de `SELECT * FROM notifications;`
