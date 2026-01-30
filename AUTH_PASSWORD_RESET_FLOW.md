## Fluxo de Recuperação de Senha (Forgot Password)

O app usa **apenas Supabase** para envio do link de recuperação. Stack: **Vercel** (hosting), **Git** (repositório), **Supabase** (banco + Auth + e-mail). Nenhuma outra plataforma (ex.: Resend) é utilizada.

---

### Visão geral

- **Entrada**: link "Esqueci minha senha" na tela de login (`Login.tsx`).
- **Envio do link**: Supabase Auth envia o e-mail (configuração em Dashboard → Authentication → Email).
- **Redefinição**: usuário clica no link (ex.: `.../reset-password#type=recovery&...`), define a nova senha e faz login.

Arquivos principais:

- **Frontend**: `components/Login.tsx`, `components/ForgotPassword.tsx`, `services/userAuth.ts`
- **Banco**: Supabase (`users` com `auth_id` para usuários migrados; `auth.users` para Auth)

---

### 1. Solicitação do link (Esqueci minha senha)

1. Usuário informa **e-mail ou nome de usuário** em `ForgotPassword.tsx`.
2. Se for usuário, o app busca o e-mail em `public.users` (`getEmailForReset`).
3. Se não houver e-mail encontrado → mensagem: "E-mail ou usuário não encontrado."
4. Se houver e-mail → chama `requestPasswordReset(email)` em `userAuth.ts`, que usa:
   - `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`
5. O **Supabase** envia o e-mail com o link (sem Resend, sem API Vercel).
6. Mensagem exibida: "Se o e-mail estiver cadastrado, você receberá um link de recuperação por e-mail. Verifique a caixa de entrada e o spam."

**Requisito**: o e-mail deve existir em `auth.users` (usuários migrados para Supabase Auth). Configurar envio de e-mail no Supabase: **Dashboard → Authentication → Email Templates** e, se quiser, **Project Settings → Auth → SMTP**.

---

### 2. Redefinição da senha (clique no link)

1. O link do Supabase redireciona para `.../reset-password` com `#type=recovery&...` no hash.
2. `ForgotPassword.tsx` detecta `type=recovery` e usa o fluxo Supabase Auth (`recoveryFromAuth = true`).
3. Usuário informa nova senha e confirma.
4. O app chama `supabase.auth.updateUser({ password: newPassword })`.
5. Em caso de sucesso, exibe mensagem e o usuário pode fazer login.

**Validação de senha**: mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial (frontend em `validatePasswordStrength`).

---

### 3. Fluxo legado (token em `password_reset_tokens`)

Para usuários que ainda não estão em `auth.users` e usam o fluxo antigo com token no link (ex.: `/reset-password?token=...`):

- `ForgotPassword` usa `resetPasswordWithToken(token, newPassword)` em `userAuth.ts`.
- O token é validado em `password_reset_tokens` (hash SHA-256), verificação de `used` e `expires_at`.
- A senha é atualizada em `users.password_hash` (e, se existir, em Auth).

O app **não gera mais** novos tokens por API ou Edge Function; apenas o Supabase Auth envia o link. A tabela `password_reset_tokens` permanece para links antigos ainda válidos.

---

### 4. Migração de usuários para Supabase Auth

Para que "Esqueci minha senha" funcione para usuários existentes:

1. Adicionar coluna `auth_id` em `public.users` (já feito por `supabase_migration_auth_users.sql`).
2. Criar cada usuário em **Authentication → Users** no Dashboard do Supabase (mesmo e-mail de `public.users`).
3. Atualizar `public.users` com o UUID do Auth: `UPDATE public.users SET auth_id = '<uuid>' WHERE email = '...';`

Novos usuários criados pelo app (quando o fluxo de criação usar Auth) já terão `auth_id` preenchido.

---

### 5. Segurança e configuração

- **E-mail**: configurado apenas no Supabase (templates e opcionalmente SMTP). Sem Resend.
- **Mensagens neutras**: não se revela se o e-mail existe ou não.
- **Senha forte**: validada no frontend e no Auth.
- **Redirect**: `redirectTo` em `resetPasswordForEmail` aponta para a URL do app (ex.: `https://seu-app.vercel.app/reset-password`).

Configuração do e-mail no Supabase: **Dashboard → Authentication → Email Templates** (e **SMTP** em Project Settings se quiser usar servidor próprio).

---

### 6. Como verificar se o Supabase disparou o e-mail

A mensagem *"Se o e-mail estiver cadastrado, você receberá um link de recuperação por e-mail. Verifique a caixa de entrada e o spam"* é exibida após a chamada a `resetPasswordForEmail`. Por segurança, a API **não informa** se o e-mail existe ou se o envio foi feito; portanto a confirmação é feita fora do app.

**Onde verificar:**

1. **Auth Logs (recomendado)**  
   - No **Dashboard do Supabase** → **Authentication** → **Logs** (ou **Audit Logs**).  
   - Procure eventos com ação **`user_recovery_requested`** (pedido de recuperação de senha).  
   - Se existir um evento com data/hora próxima do pedido do usuário, o Supabase **processou** o pedido e tentou enviar o e-mail.

2. **Usuário no Auth**  
   - **Authentication** → **Users**.  
   - Confirme se o e-mail está cadastrado. Se **não** estiver em `auth.users`, o Supabase **não envia** o e-mail (o app pode ter encontrado o e-mail em `public.users`, mas o link de recuperação só funciona para usuários no Auth).

3. **Banco (opcional)**  
   - Se os audit logs estiverem no Postgres, consulte `auth.audit_log_entries` com `action = 'user_recovery_requested'` para ver pedidos de recuperação.

4. **Caixa de entrada e spam**  
   - O usuário deve verificar a caixa de entrada e o spam; provedores podem atrasar ou bloquear e-mails de “password reset”.

**Resumo:** Para saber se o Supabase “disparou” o e-mail, use os **Auth Logs** e confirme o evento `user_recovery_requested` e se o e-mail está em **Authentication → Users**.

---

### 7. Por que o e-mail não chegou? (Morador ou Porteiro/Síndico)

O Supabase **só envia** o link de recuperação para endereços que existem em **Authentication → Users** (`auth.users`). Não basta o e-mail estar em `public.users` (porteiro/síndico) ou em `residents` (morador).

**O que fazer para o e-mail passar a chegar:**

1. **Adicionar o usuário no Supabase Auth**
   - No **Dashboard do Supabase** → **Authentication** → **Users** → **Add user**.
   - Informe o **mesmo e-mail** que está no perfil (ex.: `agentesian8nautomacao@gmail.com`).
   - Defina uma senha inicial (o usuário poderá trocar pelo link de recuperação).
   - Salve.

2. **Depois disso**
   - Quando a pessoa solicitar "Esqueci minha senha" com esse e-mail, o Supabase enviará o link.
   - Verifique **Auth Logs** para ver o evento `user_recovery_requested`.

**Morador (tabela `residents`):**

- O app busca o e-mail do morador por **unidade** ou **e-mail** em `residents` (`getEmailForResetResident`).
- Para o link ser enviado, o **mesmo e-mail** precisa existir em **Authentication → Users** (passo 1 acima).
- Após redefinir a senha pelo link, a nova senha fica no Auth e, se você rodou `supabase_sync_resident_password_after_reset.sql`, também em `residents.password_hash`, para o login como morador (unidade + senha) continuar funcionando.

**Resumo:** E-mail só chega se o endereço estiver em **Authentication → Users**. Cadastre o usuário lá com o mesmo e-mail do perfil.
