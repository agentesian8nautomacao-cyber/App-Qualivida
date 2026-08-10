# 🔧 Correção: Erro de Cache do Schema do Supabase

## ❌ Erro
```
Could not find the 'password_hash' column of 'residents' in the schema cache
```

## ✅ Solução

A coluna `password_hash` **existe** no banco de dados, mas o cache do cliente Supabase está desatualizado.

### Opção 1: Aguardar (Recomendado)
O cache do Supabase atualiza automaticamente em 2-5 minutos. Aguarde e tente novamente.

### Opção 2: Limpar Cache do Navegador
1. Pressione `Ctrl + Shift + R` (Windows/Linux) ou `Cmd + Shift + R` (Mac)
2. Ou limpe o cache do navegador completamente
3. Recarregue a página

### Opção 3: Forçar Atualização do Schema (Avançado)
No Supabase Dashboard:
1. Vá em **Settings** > **API**
2. Role até **Project Settings**
3. Procure por opções de cache ou aguarde alguns minutos

### Opção 4: Verificar se a Coluna Existe
Execute no Supabase SQL Editor:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'residents'
  AND column_name = 'password_hash';
```

Se retornar uma linha, a coluna existe e é apenas um problema de cache.

## 🔍 Verificação

A coluna já foi verificada e existe:
```json
{
  "column_name": "password_hash",
  "data_type": "character varying",
  "is_nullable": "YES"
}
```

## 💡 Solução Temporária no Código

O código foi atualizado para usar `as any` temporariamente, contornando a verificação de tipos do Supabase. Isso permite que o cadastro funcione mesmo com cache desatualizado.

## ⚠️ Nota

Este é um problema conhecido do Supabase quando colunas são adicionadas recentemente. O cache geralmente se atualiza automaticamente em poucos minutos.
