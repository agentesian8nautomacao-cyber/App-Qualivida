# Recuperação de Senha — Supabase Auth (Qualivida)

## Princípios

- **auth.users** é a **ÚNICA** fonte de autenticação.
- Login e recuperação de senha usam **exclusivamente** Supabase Auth.
- Nenhuma senha é armazenada em tabelas próprias (`users`, `staff`, `residents`).

---

## 1. Checagens no Supabase

### 1.1 Usuários em auth.users

Execute no SQL Editor do Supabase:

```sql
-- Verificar usuários com provider e email
SELECT id, email, raw_user_meta_data->>'provider' as provider, created_at
FROM auth.users
WHERE email IS NOT NULL AND email != ''
ORDER BY created_at DESC;
```

Todos os usuários ativos devem ter:
- `email` válido
- `provider` = `email` (login por e-mail/senha)

### 1.2 Redirect URLs

**Authentication** → **URL Configuration**:

- **Site URL**: `https://app.qualivida.com.br` (ou sua URL de produção)
- **Redirect URLs** (adicione todas necessárias):
  - `https://app.qualivida.com.br/reset-password`
  - `https://qualivida-club-residence.vercel.app/reset-password`
  - `http://localhost:3000/reset-password`
  - `http://localhost:5173/reset-password`

### 1.3 E-mail e SMTP

- **Authentication** → **Email Templates** → **Reset Password**: habilitado.
- **Authentication** → **E-mails** → **Configurações SMTP**: SMTP personalizado configurado (veja `CONFIGURAR_SMTP_SUPABASE.md`).

---

## 2. Fluxo de Recuperação

1. Usuário informa **e-mail**, **usuário** ou **unidade** na tela "Esqueci minha senha".
2. O sistema resolve para **e-mail** (users, staff, residents).
3. Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL/reset-password })`.
4. Supabase envia o e-mail com link.
5. Usuário clica no link → redirecionado para `/reset-password#type=recovery&access_token=...`.
6. A página restaura a sessão e o usuário informa nova senha.
7. `supabase.auth.updateUser({ password })` atualiza em **auth.users**.
8. `signOut()` e redirecionamento para login.

---

## 3. Variáveis de Ambiente

No `.env` ou Vercel:

```
VITE_APP_URL=https://app.qualivida.com.br
# ou
VITE_APP_URL=https://qualivida-club-residence.vercel.app
```

Sem `VITE_APP_URL`, o `redirectTo` usa `window.location.origin`.

---

## 4. Cadastro Automático em auth.users

### 4.1 Porteiros, síndicos e funcionários com login

Ao cadastrar **porteiro** ou **síndico** (manual ou importação), o sistema:

1. Chama a API `/api/create-auth-user` (Vercel) que usa `SUPABASE_SERVICE_ROLE_KEY`.
2. Cria o usuário em auth.users com o e-mail do porteiro.
3. Insere em `staff` e `users` com `auth_user_id` vinculado.

**Variáveis obrigatórias no Vercel** (Projeto → Settings → Environment Variables):

| Variável | Descrição |
|----------|-----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role do Supabase (Settings → API) |
| `SUPABASE_URL` | URL do projeto (ex: `https://xxx.supabase.co`) |

### 4.2 Moradores

- **Criar conta** (self-registration): já cria em auth.users via `signUp`.
- **Cadastro manual** (síndico): exige e-mail; cria em auth.users com senha padrão 123456.
- **Importação**: e-mail obrigatório no CSV/JSON; cada morador é criado em auth.users com senha 123456 (podem trocar via "Esqueci minha senha").

---

## 5. Tabelas de Domínio

Todas as tabelas que representam usuários autenticáveis devem ter:

- `auth_user_id` (UUID) referenciando `auth.users.id`
- **Não** armazenar `password_hash` ou senha em texto

Migração para tornar `password_hash` opcional (se existir):

```sql
ALTER TABLE residents ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
-- Repetir para staff se aplicável
```

---

## 6. Testes Obrigatórios

- [ ] Síndico: recuperar senha por e-mail
- [ ] Porteiro: recuperar senha por usuário (resolvido para e-mail)
- [ ] Morador: recuperar senha por unidade (resolvido para e-mail)
- [ ] Morador: recuperar senha por e-mail
- [ ] Link de recuperação chega no e-mail
- [ ] Link redireciona para `/reset-password`
- [ ] Nova senha é aceita
- [ ] Login funciona após redefinição (Admin e Morador)
