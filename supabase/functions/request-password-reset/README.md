# Recuperação de senha – apenas Supabase Auth

O app **não usa** esta pasta para recuperação de senha. O envio do link de recuperação é feito **somente pelo Supabase Auth**:

1. O usuário informa e-mail ou usuário em "Esqueci minha senha".
2. O frontend chama `supabase.auth.resetPasswordForEmail(email)`.
3. O **Supabase** envia o e-mail com o link (usando a configuração de e-mail do projeto no Dashboard do Supabase).
4. O usuário clica no link (ex.: `.../reset-password#type=recovery&...`), define a nova senha e faz login.

**Stack do app:** Vercel (hosting), Git (repositório), Supabase (banco + Auth + envio de e-mail). Nenhuma outra plataforma (ex.: Resend) é utilizada.

Configuração do e-mail no Supabase: **Dashboard → Authentication → Email Templates** (e, se quiser, **SMTP** em Project Settings).
