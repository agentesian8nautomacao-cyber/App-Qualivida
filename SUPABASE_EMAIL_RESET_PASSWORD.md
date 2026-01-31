# Template de e-mail: Recuperar senha (Supabase)

Configure no **Supabase Dashboard**:

**Authentication** → **Email Templates** → **Reset Password**

---

## Subject (assunto)

```
Redefinir sua senha
```

---

## Body (corpo do e-mail)

Cole exatamente o HTML abaixo. **Não remova** `{{ .ConfirmationURL }}` — é a variável do Supabase que gera o link de redefinição.

```html
<h2>Redefinir senha</h2>

<p>Use o link abaixo para redefinir a senha da sua conta:</p>
<p><a href="{{ .ConfirmationURL }}">Redefinir senha</a></p>

<p>Se você não solicitou essa alteração, ignore este e-mail.</p>
```

---

## Onde colar

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto.
2. Menu **Authentication** → **Email Templates**.
3. Selecione **Reset Password**.
4. Em **Subject**, cole: `Redefinir sua senha`.
5. Em **Body**, cole o HTML acima.
6. Clique em **Save**.

O link `{{ .ConfirmationURL }}` será substituído automaticamente pelo Supabase pelo link real de recuperação (ex.: `https://seu-app.vercel.app/reset-password#type=recovery&access_token=...`).

---

## Login como morador (unidade + senha) após recuperar senha

Para que o login **morador** (unidade + senha) funcione depois de redefinir a senha pelo link, é obrigatório criar a função no Supabase que sincroniza a nova senha na tabela de moradores:

1. No Supabase: **SQL Editor** → **New query**.
2. Abra o arquivo **`supabase_sync_resident_password_after_reset.sql`** do projeto e copie todo o conteúdo.
3. Cole no editor e clique em **Run**.
4. Sem esse script, a senha redefinida fica só no Auth e o login por **unidade + senha** continua com a senha antiga (erro "Unidade ou senha incorretos"). O login por **e-mail/usuário** (admin/porteiro) funciona normalmente após o reset.
