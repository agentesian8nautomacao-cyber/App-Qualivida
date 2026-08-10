# Link de recuperação: "expirado" ou 404 na Vercel

## Sintomas

- Ao clicar no link do e-mail de recuperação, a URL fica com algo como:  
  `...#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`
- Ou a página abre com **404 NOT_FOUND** / **DEPLOYMENT_NOT_FOUND** (Vercel).

---

## 1. Link expirado ou já usado (`otp_expired`)

O link de recuperação do Supabase **expira** (em geral em **1 hora**) e **só pode ser usado uma vez**.

**O que fazer:**

1. No app, abra de novo **Esqueci minha senha**.
2. Informe o **mesmo e-mail** e solicite um **novo** link.
3. Abra o novo e-mail e use o link **em até 1 hora**.

O app agora detecta quando você chega com esse erro na URL e mostra a mensagem: *"Este link expirou ou já foi usado. Solicite um novo link abaixo."*

---

## 2. 404 / DEPLOYMENT_NOT_FOUND na Vercel

Isso indica que a **URL de produção** que o Supabase usa no redirect **não existe** ou está errada no Vercel (projeto renomeado, deploy antigo, etc.).

**O que fazer:**

### A) Confirmar a URL correta do app

1. No **Vercel Dashboard**, abra o projeto do app.
2. Veja a **URL de produção** (ex.: `https://nome-do-projeto.vercel.app`).
3. Confirme se é essa mesma URL que aparece no link do e-mail (antes do `#` ou `?`).  
   Se no e-mail estiver outra URL (ex.: `sistema-de-gest-o-de-encomendas.vercel.app`), pode ser projeto antigo ou nome diferente.

### B) Configurar essa URL no Supabase

1. No **Supabase Dashboard** → **Authentication** → **URL Configuration**.
2. Em **Site URL**, coloque a URL base do app (ex.: `https://seu-app.vercel.app`).
3. Em **Redirect URLs**, adicione:
   - `https://seu-app.vercel.app`
   - `https://seu-app.vercel.app/reset-password`
   - `https://seu-app.vercel.app/**`  
   (troque `seu-app` pelo nome real do projeto na Vercel.)
4. Salve.

Assim, ao clicar no link do e-mail, o Supabase redireciona para uma URL que **existe** no seu deploy na Vercel e a página de redefinição de senha carrega corretamente.

---

## Resumo

| Problema | Ação |
|----------|------|
| Link expirado / já usado | Solicitar novo link em "Esqueci minha senha" e usar em até 1 h. |
| 404 / DEPLOYMENT_NOT_FOUND | Conferir a URL real do app na Vercel e colocá-la em **Site URL** e **Redirect URLs** no Supabase. |
