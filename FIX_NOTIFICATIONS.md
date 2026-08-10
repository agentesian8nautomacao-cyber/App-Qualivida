# 🔧 Correção: Notificações não estão sendo criadas

## ❌ Problema
A encomenda é registrada, mas a notificação não aparece no app do morador.

## ✅ Soluções

### 1. Verificar se a tabela existe

Execute no Supabase SQL Editor:

```sql
-- Verificar se a tabela existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'notifications';
```

**Se não retornar nenhuma linha**, execute o script `supabase_notifications.sql` completo.

### 2. Verificar políticas RLS

As políticas RLS podem estar bloqueando a inserção. Execute:

```sql
-- Verificar políticas
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'notifications';
```

**Se não houver política de INSERT**, ou se estiver muito restritiva, execute novamente o script `supabase_notifications.sql` (ele recria as políticas).

### 3. Testar inserção manual

Execute no Supabase SQL Editor para testar:

```sql
-- Substitua 'MORADOR_ID_AQUI' pelo ID real de um morador
INSERT INTO notifications (morador_id, title, message, type, read)
VALUES (
  'MORADOR_ID_AQUI'::uuid,
  '📦 Nova encomenda na portaria',
  'Uma encomenda foi recebida e está disponível para retirada.',
  'package',
  false
);
```

**Se der erro**, verifique:
- Se o `morador_id` existe na tabela `residents`
- Se as políticas RLS estão corretas

### 4. Verificar logs do console

Abra o console do navegador (F12) e procure por:
- `[Notificação]` - logs detalhados da criação
- `[createNotification]` - logs do serviço

Os logs mostrarão exatamente onde está falhando.

### 5. Verificar recipientId

O problema pode ser que o `recipientId` está `null`. Verifique no console:
- `[Notificação] ⚠️ Não foi possível criar notificação` - indica que `recipientId` está null

**Solução**: Certifique-se de que o morador está selecionado corretamente ao registrar a encomenda.

## 📋 Checklist

- [ ] Tabela `notifications` existe no Supabase
- [ ] Políticas RLS estão configuradas corretamente
- [ ] Política de INSERT permite criação de notificações
- [ ] O morador tem um `id` válido (não null)
- [ ] Logs do console mostram tentativa de criação
- [ ] Não há erros de permissão no console

## 🔍 Script de Verificação Completo

Execute `supabase_check_notifications.sql` para verificar tudo de uma vez.
