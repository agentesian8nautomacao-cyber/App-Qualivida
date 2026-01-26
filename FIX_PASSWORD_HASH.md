# 🔧 Correção: Coluna password_hash não encontrada

## ❌ Erro
```
Could not find the 'password_hash' column of 'residents' in the schema cache
```

## ✅ Solução

A coluna `password_hash` não existe na tabela `residents` do seu banco Supabase. Execute o script SQL abaixo:

### Passo 1: Acessar Supabase SQL Editor

1. Acesse seu projeto no Supabase: https://supabase.com/dashboard
2. Vá em **SQL Editor** (menu lateral)
3. Clique em **New Query**

### Passo 2: Executar o Script

Copie e cole o seguinte SQL:

```sql
-- Adicionar coluna password_hash se não existir
ALTER TABLE residents 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
```

Ou execute o arquivo completo: `supabase_add_password_hash.sql`

### Passo 3: Verificar

Execute este SQL para verificar se a coluna foi criada:

```sql
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'residents'
  AND column_name = 'password_hash';
```

Se retornar uma linha, a coluna foi criada com sucesso! ✅

### Passo 4: Limpar Cache (se necessário)

Se o erro persistir após criar a coluna:

1. No Supabase, vá em **Settings** > **API**
2. Role até **Project Settings**
3. Clique em **Clear Cache** ou aguarde alguns minutos para o cache atualizar

## 📝 Script Completo

O arquivo `supabase_add_password_hash.sql` contém o script completo e pode ser executado diretamente no SQL Editor do Supabase.

## ⚠️ Importante

- Execute o script apenas UMA vez
- O script usa `IF NOT EXISTS`, então é seguro executar múltiplas vezes
- Não afeta dados existentes (apenas adiciona a coluna)
