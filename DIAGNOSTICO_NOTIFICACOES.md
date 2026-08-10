# 🔍 Diagnóstico: Notificações não estão sendo criadas

## ✅ Status Atual
- ✅ Tabela `notifications` existe no Supabase
- ❌ Nenhuma notificação foi criada (0 notificações)

## 🔧 Passos para Resolver

### 1. Verificar Políticas RLS

Execute no Supabase SQL Editor:

```sql
-- Verificar políticas de INSERT
SELECT 
    policyname,
    cmd,
    with_check
FROM pg_policies
WHERE tablename = 'notifications'
  AND cmd = 'INSERT';
```

**Se não retornar nenhuma política de INSERT**, ou se a política estiver muito restritiva, execute:

```sql
-- Remover política existente
DROP POLICY IF EXISTS "Porteiros e Síndicos podem criar notificações" ON notifications;

-- Criar política permissiva (desenvolvimento)
CREATE POLICY "Porteiros e Síndicos podem criar notificações" ON notifications
    FOR INSERT
    WITH CHECK (true);
```

### 2. Testar Inserção Manual

Execute no Supabase SQL Editor:

```sql
-- 1. Pegar um ID de morador
SELECT id, name, unit FROM residents LIMIT 1;

-- 2. Inserir notificação de teste (substitua 'ID_DO_MORADOR' pelo ID real)
INSERT INTO notifications (morador_id, title, message, type, read)
VALUES (
  'ID_DO_MORADOR'::uuid,
  '🧪 Teste de Notificação',
  'Esta é uma notificação de teste.',
  'package',
  false
)
RETURNING *;
```

**Se der erro**, o problema está nas políticas RLS ou na estrutura da tabela.

**Se funcionar**, o problema está no código JavaScript.

### 3. Verificar Logs do Console

1. Abra o console do navegador (F12)
2. Registre uma nova encomenda
3. Procure por logs com `[Notificação]` ou `[createNotification]`

**Logs esperados:**
- `[savePackage] Verificando condições para criar notificação`
- `[Notificação] ✅ Condições OK. Criando notificação...`
- `[createNotification] Iniciando criação de notificação`
- `[createNotification] ✅ Notificação criada`

**Se não aparecer nenhum log**, o código não está sendo executado.

**Se aparecer erro**, os logs mostrarão o problema exato.

### 4. Verificar recipientId

O problema pode ser que o `recipientId` está `null`. Verifique nos logs:

```
[Notificação] ⚠️⚠️⚠️ Não foi possível criar notificação - condições não atendidas
```

**Solução**: Certifique-se de que o morador está selecionado corretamente ao registrar a encomenda.

### 5. Verificar Estrutura da Tabela

Execute:

```sql
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
ORDER BY ordinal_position;
```

**Deve retornar:**
- `id` (uuid)
- `morador_id` (uuid)
- `title` (varchar)
- `message` (text)
- `type` (varchar)
- `related_id` (uuid, nullable)
- `read` (boolean)
- `created_at` (timestamp)

## 📋 Checklist de Verificação

- [ ] Tabela `notifications` existe
- [ ] Política RLS de INSERT existe e permite inserção (`WITH CHECK (true)`)
- [ ] Inserção manual funciona (teste no SQL Editor)
- [ ] Logs aparecem no console ao registrar encomenda
- [ ] `recipientId` não está null
- [ ] Estrutura da tabela está correta

## 🚀 Scripts Disponíveis

1. **`supabase_fix_notifications_rls.sql`** - Corrige políticas RLS
2. **`supabase_test_notification.sql`** - Testa inserção manual
3. **`supabase_check_notifications.sql`** - Verifica tudo

## 💡 Próximos Passos

1. Execute `supabase_fix_notifications_rls.sql` para garantir que as políticas estão corretas
2. Teste inserção manual para confirmar que funciona
3. Registre uma encomenda e verifique os logs no console
4. Compartilhe os logs se ainda não funcionar
