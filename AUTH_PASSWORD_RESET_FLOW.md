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

**Validação de senha**: 6 caracteres, apenas letras e números (maiúsculas e minúsculas tratadas como iguais). Sem símbolos. Frontend em `validatePasswordStrength` em `ForgotPassword.tsx`. Para o fluxo Supabase Auth aceitar essa regra, ajuste em **Dashboard → Authentication → Providers → Email → Password** (ex.: mínimo 6 caracteres, desmarque exigência de caractere especial).

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
- **Senha simplificada**: 6 caracteres, letras e números (case-insensitive). Validada no frontend; o Auth do Supabase deve estar configurado para aceitar essa política (senão o usuário verá mensagem amigável com a regra correta).
- **Redirect**: `redirectTo` em `resetPasswordForEmail` aponta para a URL do app (ex.: `https://seu-app.vercel.app/reset-password`).

Configuração do e-mail no Supabase: **Dashboard → Authentication → Email Templates** (e **SMTP** em Project Settings se quiser usar servidor próprio).

---

### 5.1. "Email rate limit exceeded" — aumentar o limite

O Supabase limita quantos e-mails de autenticação (recuperação de senha, confirmação, etc.) podem ser enviados por hora. Com o SMTP padrão do Supabase o limite é **2 e-mails/h** e **não pode ser alterado** na tela de Limites de taxa.

Se você tentar alterar o limite em **Authentication → Limites de taxa** sem ter SMTP personalizado, o Supabase exibe:

> **"É necessário um provedor SMTP personalizado para atualizar esta configuração. O serviço de e-mail integrado possui um limite de taxa fixo. Você precisará configurar seu próprio provedor SMTP personalizado para atualizar seu limite de taxa de e-mail."**

Ou seja: **não é possível** aumentar o limite só pela tela de Limites de taxa. É obrigatório **configurar SMTP personalizado primeiro** (em **Authentication → E-mails → Configurações SMTP**). Depois de ativar o SMTP personalizado, o limite sobe para **30 e-mails/h** e a opção de ajustar em **Authentication → Limites de taxa** passa a funcionar.

**Passo a passo — configurar SMTP personalizado:**

1. **Supabase Dashboard** → **Authentication** → **E-mails** → aba **Configurações SMTP**.
2. Ative **"Habilitar SMTP personalizado"**.
3. Preencha todos os campos obrigatórios:
   - **Detalhes do remetente**
     - **Endereço de e-mail do remetente:** ex. `noreply@seudominio.com` (o endereço de onde os e-mails são enviados).
     - **Nome do remetente:** ex. `Condomínio XYZ` (nome exibido na caixa de entrada).
   - **Configurações do provedor SMTP**
     - **Hospedar:** host do seu provedor (ex. `smtp.resend.com`, `smtp.brevo.com`, `smtp.sendgrid.net`).
     - **Número da porta:** `465` ou `587` (evite 25).
     - **Intervalo mínimo por usuário:** ex. `60` segundos (mínimo entre e-mails para o mesmo usuário).
     - **Nome de usuário** e **Senha:** credenciais fornecidas pelo provedor de e-mail.
4. Salve. Após ativar, a mensagem do Supabase confirma: *"O limite de envio de e-mails será aumentado para 30 e poderá ser ajustado após a ativação do SMTP personalizado"*.
5. Depois disso, em **Authentication → Limites de taxa** você poderá alterar o **Limite de taxa para envio de e-mails** (ex.: 30, 60 e-mails/h).

**Como “desativar” ou deixar o limite bem alto:**  
O Supabase **não permite desligar** o limite de e-mail; só permite **aumentar** o valor. Para efeito prático de “sem limite”, configure o SMTP personalizado (passos acima) e, em **Authentication → Limites de taxa**, defina **Limite de taxa para envio de e-mails** com o **valor máximo** que o plano permitir (ex.: 100, 500 ou 1000 e-mails/h). Assim o limite deixa de impactar o uso normal.

**Como desativar o SMTP personalizado:**  
Se quiser voltar a usar o e-mail integrado do Supabase (limite fixo de 2 e-mails/h): **Supabase Dashboard** → **Authentication** → **E-mails** → aba **Configurações SMTP** → desmarque **"Habilitar SMTP personalizado"** e salve. Os e-mails voltarão a ser enviados pelo serviço padrão do Supabase; o limite de taxa de e-mail não poderá mais ser alterado na tela de Limites de taxa.

**O que colocar em cada campo (explicação):**

| Campo no Supabase | O que é | O que colocar |
|-------------------|---------|----------------|
| **Endereço de e-mail do remetente** | O endereço que aparece como "De:" nos e-mails (recuperação de senha, confirmação, etc.). | Um e-mail do **domínio que você verificou** no provedor (ex.: `noreply@seudominio.com` ou `auth@meucondominio.com.br`). Não use um e-mail genérico como `gmail.com` a menos que o provedor permita. |
| **Nome do remetente** | O nome que aparece ao lado do "De:" na caixa de entrada. | Texto livre, ex.: `Condomínio XYZ`, `Sistema Qualivida`, `Suporte`. |
| **Hospedar** | Servidor SMTP do provedor. | Host exato indicado pelo provedor (ex.: `smtp.resend.com`, `smtp-relay.brevo.com`). |
| **Número da porta** | Porta de conexão do servidor SMTP. | `465` (SSL) ou `587` (TLS). Use a que o provedor recomendar. |
| **Intervalo mínimo por usuário** | Tempo mínimo em **segundos** entre dois e-mails para o **mesmo** usuário (evita spam). | Ex.: `60` (1 minuto). Aumente se quiser limitar mais (ex.: 120). |
| **Nome de usuário** | Login SMTP. | Depende do provedor: às vezes é literalmente `resend`, às vezes é um e-mail ou "SMTP login" (veja exemplos abaixo). |
| **Senha** | Senha ou chave de autenticação SMTP. | **Não** é a senha da sua conta do provedor. É a **chave SMTP** ou **API key** que o provedor gera na área de SMTP/API (veja exemplos abaixo). |

---

**Exemplo 1 — Resend**

1. Crie conta em [resend.com](https://resend.com) e verifique um domínio (ou use o domínio de teste deles).
2. Em **Resend** → **API Keys** → crie uma chave e copie (ex.: `re_123abc...`).
3. Em **Supabase** → **Authentication** → **E-mails** → **Configurações SMTP** preencha:

| Campo | Valor (Resend) |
|-------|----------------|
| Endereço de e-mail do remetente | `onboarding@resend.dev` (domínio de teste) ou `noreply@seudominio.com` (se você verificou o domínio no Resend) |
| Nome do remetente | `Qualivida` (ou o nome do seu app/condomínio) |
| Hospedar | `smtp.resend.com` |
| Número da porta | `465` |
| Intervalo mínimo por usuário | `60` |
| Nome de usuário | `resend` (literalmente a palavra "resend") |
| Senha | Sua **API Key** do Resend (ex.: `re_xxxxxxxxxx`) |

4. Ative **Habilitar SMTP personalizado** e salve.

---

**Exemplo 2 — Brevo (ex-Sendinblue)**

1. Crie conta em [brevo.com](https://brevo.com) e verifique um domínio (ou use o remetente padrão).
2. Em **Brevo** → **Configurações** → **SMTP e API** (ou **SMTP**): anote o **login SMTP** (um e-mail) e crie/visualize a **chave SMTP** (não use a chave de API genérica nem a senha da conta).
3. Em **Supabase** → **Authentication** → **E-mails** → **Configurações SMTP** preencha:

| Campo | Valor (Brevo) |
|-------|----------------|
| Endereço de e-mail do remetente | E-mail do remetente configurado no Brevo (ex.: `noreply@seudominio.com` ou o que você cadastrou no Brevo) |
| Nome do remetente | `Qualivida` (ou o nome do seu app/condomínio) |
| Hospedar | `smtp-relay.brevo.com` |
| Número da porta | `587` ou `465` |
| Intervalo mínimo por usuário | `60` |
| Nome de usuário | O **login SMTP** que o Brevo mostra (geralmente um e-mail, ex.: `seuemail@dominio.com`) |
| Senha | A **chave SMTP** do Brevo (não a senha da sua conta; é a chave gerada na página SMTP) |

4. Ative **Habilitar SMTP personalizado** e salve.

---

**Outros provedores (referência rápida):**

- **SendGrid:** host `smtp.sendgrid.net`, porta `587`, usuário `apikey`, senha = sua API Key do SendGrid.
- **Postmark**, **ZeptoMail**, **AWS SES:** consulte a documentação do provedor para host, porta e tipo de autenticação (usuário/senha ou API key).

**Resumo:** O remetente deve ser um e-mail que você controla e que o provedor SMTP aceita (domínio verificado). Usuário e senha vêm sempre da **área SMTP/API do provedor**, nunca da senha da sua conta. Depois de salvar e ativar, o limite de e-mails no Supabase sobe para 30/h e pode ser ajustado em **Authentication → Limites de taxa**.

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

### 6.1. Erro 500 ou "Error sending recovery email"

Se ao solicitar recuperação de senha aparecer **erro 500** na chamada a `/auth/v1/recover` ou a mensagem **"Error sending recovery email"**, o Supabase está falhando ao processar o pedido no servidor. As causas mais comuns são:

1. **URL de redirecionamento não permitida**  
   O app envia `redirect_to=https://app-qualivida.vercel.app/reset-password`. Essa URL **precisa estar na lista de Redirect URLs** do Supabase.  
   - **Onde:** **Supabase Dashboard** → **Authentication** → **URL Configuration** (ou **Redirect URLs**).  
   - **O que fazer:** Adicione exatamente `https://app-qualivida.vercel.app/reset-password` na lista (ou um padrão permitido pelo Supabase, ex.: `https://app-qualivida.vercel.app/**`).  
   - Confirme também que **Site URL** está como `https://app-qualivida.vercel.app` (ou a URL base do seu app).

2. **SMTP personalizado mal configurado**  
   Se você ativou SMTP personalizado (Resend, Brevo, etc.), credenciais erradas (host, porta, usuário, senha) ou remetente não verificado podem fazer o Supabase retornar 500 ao tentar enviar o e-mail.  
   - **O que fazer:** Revise **Authentication → E-mails → Configurações SMTP**: host, porta, usuário, senha e **endereço do remetente** (domínio verificado no provedor). Teste enviar um e-mail de teste pelo provedor, se disponível.

3. **Ver o erro exato no Supabase**  
   - **Authentication → Logs**: veja se há entradas com erro para o evento de recuperação.  
   - No navegador (DevTools → Network), inspecione a resposta da requisição a `.../auth/v1/recover`; às vezes o corpo da resposta 500 traz mais detalhes (ex.: mensagem do SMTP).

**Resumo:** Corrija **Redirect URLs** (incluir `https://app-qualivida.vercel.app/reset-password`) e, se usar SMTP personalizado, confira as credenciais e o remetente. Use os Auth Logs para confirmar o que o Supabase está retornando.

---

### 6.2. "Auth session missing!"

Esse erro aparecia quando o usuário tentava **redefinir a senha** na tela após clicar no link de recuperação e **a sessão não era estabelecida** a partir do hash da URL (`#type=recovery&access_token=...&refresh_token=...`).

**Correção estrutural aplicada no app:**

1. **Cliente Supabase** (`services/supabase.ts`): `detectSessionInUrl: true` — o cliente detecta e estabelece a sessão automaticamente quando a página carrega com o hash de recovery na URL.

2. **Serviço de auth** (`services/userAuth.ts`):
   - **`getOrRestoreRecoverySession()`**: obtém ou restaura a sessão de recuperação a partir da URL (nunca assume sessão ativa). Chama `initialize()`, depois `getSession()`; se não houver sessão, extrai `access_token` e `refresh_token` do hash e chama `setSession()`. Retorna a sessão ou `null`. Funciona em navegador limpo, aba anônima e sem login prévio.
   - **`clearRecoveryHashFromUrl()`**: remove os tokens da URL após estabelecer a sessão (segurança: evitar exposição no histórico/back).

3. **Tela de redefinição** (`components/ForgotPassword.tsx`):
   - **No mount**: quando o hash contém `type=recovery`, chama `getOrRestoreRecoverySession()` e, se houver sessão, `clearRecoveryHashFromUrl()` — a sessão fica pronta antes do usuário enviar o formulário.
   - **Antes de `updateUser`**: chama novamente `getOrRestoreRecoverySession()` (nunca assumir sessão ativa), limpa a URL se sessão estabelecida; se não houver sessão, exibe mensagem clara e não chama `updateUser`. Só depois de validar sessão: executa `updateUser({ password })`.

4. **Tratamento de erros**: o app diferencia erro de **sessão ausente** (link expirado/já usado) de **política de senha** e de outros erros, exibindo mensagens específicas em vez de genéricas.

**O que o app faz em caso de falha:** Se não existir sessão (link expirado, já usado ou hash inválido), ou se o Supabase retornar "Auth session missing!" (ou variantes como "invalid session", "session expired"), é exibida a mensagem: *"O link expirou ou já foi usado. Solicite um novo link de recuperação abaixo (use o mesmo e-mail)."* O usuário pode voltar ao passo de solicitação e pedir um novo e-mail.

**Causas comuns quando o erro ainda ocorre:** Link de recuperação com validade expirada (ex.: 1 h); link já utilizado para trocar a senha; abrir o link em outro navegador/dispositivo sem a sessão.

**Resumo:** O fluxo não assume sessão ativa: valida ou restaura a sessão explicitamente a partir do link (tokens no hash), usa `setSession()` quando necessário e só então chama `updateUser()`. Comportamento alinhado a boas práticas de autenticação (SaaS/produção).

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
