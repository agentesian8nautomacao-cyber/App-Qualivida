# Convite por link: usar o mesmo envio da recuperação de senha

## Por que a recuperação de senha chega no Hotmail e o convite não?

- **Recuperação de senha:** o e-mail é enviado pelo **Supabase** usando o SMTP configurado em **Supabase Dashboard → Authentication → E-mails → SMTP** (Sender email / Sender name). Por isso chega em Gmail, Hotmail, etc.
- **Convite por link:** o e-mail é enviado pela API do app usando **Resend** com a variável **RESEND_FROM** (ou **APP_SENDER_EMAIL**) no Vercel. Se essa variável não estiver definida, o app usa `onboarding@resend.dev`, que só pode enviar para o e-mail da conta Resend.

Para o convite funcionar para **os mesmos destinatários** que a recuperação de senha (Gmail, Hotmail, etc.), é preciso usar o **mesmo remetente** que já está configurado no Supabase.

---

## Configuração (convite = mesmo envio da recuperação de senha)

### 1. Ver o remetente atual no Supabase

1. Abra o [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto.
2. Vá em **Authentication** → **Emails** (ou **E-mails**) → aba **SMTP** ou **Sender details**.
3. Anote o **Sender email** e o **Sender name** (ex: `noreply@seudominio.com` e `Qualivida`).

### 2. Definir o mesmo remetente no Vercel

1. No [Vercel Dashboard](https://vercel.com) → seu projeto → **Settings** → **Environment Variables**.
2. Crie a variável:
   - **Name:** `RESEND_FROM` (ou `APP_SENDER_EMAIL`)
   - **Value:** no **mesmo formato** que está no Supabase, por exemplo:
     - `Qualivida <noreply@seudominio.com>`
     - ou só o e-mail: `noreply@seudominio.com`
3. Salve e faça um **novo deploy** (Redeploy).

### 3. Conferir a chave do Resend

- No Supabase, se o SMTP for **Resend** (smtp.resend.com), a senha do SMTP é a **API Key** do Resend.
- No Vercel, a variável **RESEND_API_KEY** deve ser a **mesma** API Key da conta Resend usada no Supabase.

Assim, convite e recuperação de senha usam o mesmo provedor e o mesmo remetente, e o convite passa a chegar em Gmail, Hotmail, etc., como a recuperação de senha.

---

## Resumo

| Onde              | Variável / Config      | O que fazer |
|-------------------|------------------------|-------------|
| Supabase          | SMTP → Sender email    | Já configurado (recuperação de senha funciona) |
| Vercel            | `RESEND_FROM` ou `APP_SENDER_EMAIL` | Definir com o **mesmo** remetente do Supabase |
| Vercel            | `RESEND_API_KEY`       | Mesma API Key do Resend usada no Supabase |

Depois de definir **RESEND_FROM** (ou **APP_SENDER_EMAIL**) com o mesmo remetente do Supabase e fazer o deploy, o “Convidar por link” passa a enviar para qualquer e-mail da mesma forma que a recuperação de senha.
