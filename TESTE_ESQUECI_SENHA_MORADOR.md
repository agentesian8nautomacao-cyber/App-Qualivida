# Teste: Fluxo "Esqueci minha senha" (Morador)

## Resumo do teste realizado

Foi executado o script `scripts/test_forgot_password_resident.js` para validar o fluxo de recuperação de senha para moradores.

### Resultado do script de teste

| Etapa | Status | Detalhe |
|-------|--------|---------|
| 1. Buscar e-mail em residents | ✅ OK | Unidade `03/005` → e-mail `elinhap@gmail.com` |
| 2. Verificar auth_user_id | ✅ OK | Morador possui `auth_user_id` (cadastrado em auth.users) |
| 3. Chamar resetPasswordForEmail | ❌ Erro | `Error sending recovery email` |

### Causa provável do erro

O erro **"Error sending recovery email"** do Supabase geralmente indica:

1. **Redirect URL não permitida** — A URL `http://localhost:3008/reset-password` (ou a porta em uso) precisa estar na lista de Redirect URLs do Supabase.
2. **SMTP / envio de e-mail** — O serviço de e-mail padrão do Supabase pode falhar (Gmail/Hotmail costumam bloquear o remetente padrão).
3. **Limite de taxa** — Com SMTP padrão, o limite é 2 e-mails/hora.

---

## Correções necessárias

### 1. Adicionar Redirect URLs no Supabase

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard) e abra o projeto.
2. Vá em **Authentication** → **URL Configuration** (ou **Site URL** / **Redirect URLs**).
3. Em **Redirect URLs**, adicione:
   - `http://localhost:3008/reset-password`
   - `http://localhost:3009/reset-password` (se a porta 3008 estiver em uso)

### 2. Configurar SMTP (recomendado para produção)

Se os e-mails não chegarem, configure SMTP personalizado conforme `CONFIGURAR_SMTP_SUPABASE.md`.

---

## Teste manual no navegador

### Pré-requisitos

- Aplicação rodando em `http://localhost:3008` (ou `http://localhost:3009`)
- Morador com e-mail em `auth.users` (ex.: unidade `03/005` → `elinhap@gmail.com`)

### Passos

1. **Acesse** `http://localhost:3008` (ou a porta em que o app está rodando).

2. **Tela de login** — Selecione **Morador**.

3. **Clique em "Esqueci minha senha"** (link abaixo do formulário).

4. **Tela de recuperação** — Informe:
   - **Unidade** (ex.: `03/005`) ou **e-mail** (ex.: `elinhap@gmail.com`).

5. **Clique em "Enviar Solicitação".**

6. **Verificação**:
   - Mensagem de sucesso: "Se o e-mail estiver cadastrado em auth.users, você receberá um link por e-mail..."
   - Se aparecer erro, verifique Redirect URLs e SMTP no Supabase.

7. **E-mail** — Verifique a caixa de entrada e a pasta **Spam** do e-mail informado.

8. **Link de recuperação** — Clique no link no e-mail. Deve abrir algo como:
   `http://localhost:3008/reset-password#type=recovery&access_token=...&refresh_token=...`

9. **Redefinir senha** — Defina a nova senha (6–32 caracteres, apenas letras e números) e confirme.

10. **Login** — Volte à tela de login e faça login com a **unidade** + **nova senha**.

---

## Script de teste automatizado

```bash
# Testar com unidade
node scripts/test_forgot_password_resident.js 03/005

# Testar com e-mail
node scripts/test_forgot_password_resident.js elinhap@gmail.com
```

---

## Verificar se o Supabase processou o pedido

- **Dashboard** → **Authentication** → **Logs**
- Procure o evento **`user_recovery_requested`** com data/hora próxima do pedido.
- Se existir, o Supabase processou o pedido e tentou enviar o e-mail.
