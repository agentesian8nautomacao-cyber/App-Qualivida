# 🔄 Migração para Supabase - Autenticação de Moradores

## 📋 O que foi migrado

A autenticação de moradores foi migrada de `localStorage` para **Supabase**, usando uma tabela dedicada com hash de senhas.

## 🗄️ Alterações no Banco de Dados

### 1. Schema Atualizado

A tabela `residents` agora possui o campo `password_hash`:

```sql
ALTER TABLE residents 
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
```

### 2. Executar Migração

Execute o arquivo de migração no Supabase SQL Editor:

```bash
supabase_migration_residents_auth.sql
```

Este script:
- ✅ Adiciona o campo `password_hash` na tabela `residents`
- ✅ Cria função `verify_resident_credentials()` para verificação
- ✅ Cria função `update_resident_password()` para atualização

## 📦 Dependências Instaladas

```bash
npm install @supabase/supabase-js
```

## 🔧 Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Onde encontrar:**
- Acesse seu projeto no Supabase
- Vá em **Settings** > **API**
- Copie **Project URL** e **anon public key**

### 2. Executar Migração SQL

1. No Supabase, vá em **SQL Editor**
2. Abra o arquivo `supabase_migration_residents_auth.sql`
3. Execute o script completo

## 📁 Arquivos Criados/Modificados

### Novos Arquivos

1. **`services/supabase.ts`**
   - Cliente Supabase configurado
   - Tipos TypeScript para as tabelas

2. **`services/residentAuth.ts`**
   - `registerResident()` - Cadastro de moradores
   - `loginResident()` - Login de moradores
   - `getResidentByUnit()` - Busca por unidade
   - `updateResidentPassword()` - Atualização de senha
   - Hash de senhas usando SHA-256 (Web Crypto API)

3. **`supabase_migration_residents_auth.sql`**
   - Script de migração do banco de dados

4. **`.env.example`**
   - Exemplo de variáveis de ambiente

### Arquivos Modificados

1. **`App.tsx`**
   - Removido `localStorage` para credenciais
   - Integração com `residentAuth` service
   - Sessão salva em `sessionStorage` (apenas dados do morador)

2. **`components/ResidentRegister.tsx`**
   - Integração com `registerResident()` e `loginResident()`
   - Validações e tratamento de erros do Supabase

3. **`package.json`**
   - Adicionado `@supabase/supabase-js`

4. **`supabase_schema_complete.sql`**
   - Campo `password_hash` adicionado na tabela `residents`

## 🔐 Segurança

### Hash de Senhas

As senhas são hasheadas usando **SHA-256** (Web Crypto API) antes de serem salvas no banco.

⚠️ **Para produção**, recomenda-se usar **bcrypt** via Edge Function do Supabase para maior segurança.

### Sessão

- Dados do morador logado salvos em `sessionStorage`
- Credenciais (senha) **NÃO** são salvas localmente
- Cada login verifica credenciais no Supabase

## 🚀 Como Usar

### 1. Cadastro de Morador

```typescript
import { registerResident } from './services/residentAuth';

const result = await registerResident({
  name: 'João Silva',
  unit: '201A',
  email: 'joao@email.com',
  phone: '5511999999999'
}, '201A'); // senha
```

### 2. Login de Morador

```typescript
import { loginResident } from './services/residentAuth';

const result = await loginResident('201A', '201A');
if (result.success) {
  console.log('Morador logado:', result.resident);
}
```

## ✅ Checklist de Migração

- [x] Instalar `@supabase/supabase-js`
- [x] Criar cliente Supabase
- [x] Criar serviço de autenticação
- [x] Atualizar schema SQL
- [x] Migrar `ResidentRegister` para Supabase
- [x] Migrar `App.tsx` para Supabase
- [x] Remover dependência de `localStorage` para credenciais
- [x] Adicionar tratamento de erros
- [x] Criar documentação

## 🔄 Próximos Passos (Opcional)

1. **Melhorar segurança:**
   - Migrar hash de senhas para bcrypt via Edge Function
   - Adicionar rate limiting no login

2. **Recuperação de senha:**
   - Implementar fluxo de recuperação via e-mail
   - Adicionar tokens de redefinição

3. **Sessão persistente:**
   - Implementar refresh tokens
   - Sessão entre dispositivos

## 🐛 Troubleshooting

### Erro: "Variáveis de ambiente não configuradas"

**Solução:** Crie o arquivo `.env.local` com as credenciais do Supabase.

### Erro: "relation 'residents' does not exist"

**Solução:** Execute o `supabase_schema_complete.sql` primeiro.

### Erro: "column 'password_hash' does not exist"

**Solução:** Execute o `supabase_migration_residents_auth.sql`.

### Login não funciona

**Verifique:**
1. Variáveis de ambiente configuradas
2. Migração SQL executada
3. Morador cadastrado com senha
4. Console do navegador para erros

## 📚 Referências

- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)