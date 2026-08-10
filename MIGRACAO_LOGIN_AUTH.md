# Migração de login para Supabase Auth

Quando o login retorna **400 Bad Request** ("Invalid login credentials"), geralmente os usuários ainda não existem em `auth.users`. Este guia descreve como migrá-los.

## Diagnóstico

Execute no **SQL Editor do Supabase** o script `scripts/check_auth_users.sql` para ver:
- Usuários em `auth.users`
- Registros em `users`, `staff`, `residents` sem `auth_user_id`
- E-mails em tabelas que não estão em `auth.users`

## Solução: script de migração

O script `scripts/migrate_auth_login.cjs` cria usuários em `auth.users` para todos os registros com e-mail válido e vincula `auth_user_id`.

### Como rodar

**No terminal (PowerShell ou CMD):**

```powershell
# Definir variáveis (use as do seu projeto Supabase)
$env:SUPABASE_URL = "https://SEU_PROJETO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Rodar o script
node scripts/migrate_auth_login.cjs
```

**Ou em uma linha:**

```bash
SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/migrate_auth_login.cjs
```

### Senha padrão

- **Padrão:** `123456`
- **Customizar:** defina `MIGRATE_DEFAULT_PASSWORD`:
  ```bash
  MIGRATE_DEFAULT_PASSWORD=MinhaS3nhaSegura node scripts/migrate_auth_login.cjs
  ```

### O que o script faz

1. Lê registros de `users`, `staff` e `residents` com e-mail e sem `auth_user_id`
2. Se o e-mail já existe em `auth.users`, apenas vincula `auth_user_id`
3. Se não existe, cria o usuário em `auth.users` com a senha padrão e vincula

### Após a migração

- **Login:** usuário (ou e-mail) + senha definida
- **Moradores:** unidade (ex.: 101) + senha
- **Troca de senha:** use "Esqueci minha senha" no login

## Pré-requisitos

- **E-mail obrigatório** em `users`, `staff` e `residents` para quem precisa de login
- Cadastrar e-mail nos registros que ainda não tiverem
- **Service Role Key:** em Supabase → Project Settings → API → `service_role` (secret)

## Observação sobre staff

A tabela `staff` não possui coluna `username`. Porteiros/síndicos entram via tabela `users`, que tem `username`. O script `createUserFromStaff` em `saveStaff` cria o registro em `users` automaticamente ao cadastrar funcionários com cargo de login.
