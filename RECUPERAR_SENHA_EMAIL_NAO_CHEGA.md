# O e-mail de recuperação não chega – o que fazer

## Por que o e-mail não chega

O Supabase **só envia** o link de recuperação para endereços que estão em **Authentication → Users** (no Dashboard do Supabase).

- A tabela **`residents`** (moradores) é **outra coisa**: nela ficam nome, unidade, e-mail, senha do app etc.
- Cadastrar ou editar o morador em **residents** **não** cria usuário no Auth.
- Por isso: **mesmo com o e-mail certo em residents, o e-mail de recuperação não é enviado** até esse mesmo e-mail existir em **Authentication → Users**.

Não existe tabela “public_user” para isso. O lugar certo é:

**Dashboard do Supabase → menu lateral → Authentication → Users**

---

## O que fazer (passo a passo)

### 1. Abrir o projeto no Supabase

1. Acesse [https://supabase.com/dashboard](https://supabase.com/dashboard) e faça login.
2. Abra o **projeto** do app (ex.: Qualivida).

### 2. Ir em Authentication → Users

1. No **menu lateral esquerdo**, clique em **Authentication** (ícone de pessoa/cadeado).
2. Clique em **Users** (ou “Usuários”).
3. Você verá a lista de usuários do **Auth** (pode estar vazia ou com poucos itens).  
   **Não** confunda com Table Editor → `residents` ou `users`.

### 3. Adicionar o usuário com o e-mail do morador

1. Clique no botão **“Add user”** / **“Invite user”** (ou similar).
2. Preencha:
   - **Email:** o **mesmo** e-mail do morador (ex.: `paulohmorais@hotmail.com`).
   - **Password:** defina uma senha inicial (a pessoa pode trocar depois pelo “Esqueci minha senha”).
3. Confirme / salve.

### 4. Testar de novo

1. No app, na tela de login, abra **“Esqueci minha senha”**.
2. Informe o **mesmo e-mail** que você acabou de cadastrar em Authentication → Users (ex.: `paulohmorais@hotmail.com`).
3. O Supabase enviará o e-mail com o link. Verifique **caixa de entrada** e **spam**.

---

## Resumo

| Onde está o e-mail        | O Supabase envia o e-mail? |
|---------------------------|----------------------------|
| Só na tabela `residents`  | **Não**                    |
| Só na tabela `public.users` (porteiro/síndico) | **Não** |
| Em **Authentication → Users** no Dashboard     | **Sim** |

Para o e-mail chegar: cadastre o endereço em **Authentication → Users** no Dashboard do Supabase (mesmo e-mail que está no perfil do morador).

---

## E-mail chega no Hotmail/Outlook mas não no Gmail

Se o link de recuperação **chega no Hotmail** (ou Outlook) mas **não chega no Gmail**, o envio está funcionando; o Gmail está filtrando ou bloqueando a mensagem.

### O que fazer (Gmail)

1. **Verificar Spam e Promoções**
   - No Gmail, abra a pasta **Spam** (e também a aba **Promoções**, se usar abas).
   - Procure por e-mails do remetente do app (ex.: noreply@..., Sistema Qualivida).
   - Se encontrar, marque como **Não é spam** e, se quiser, arraste para **Principal** ou adicione o remetente aos contatos.

2. **Adicionar o remetente aos contatos**
   - Se o e-mail de recuperação usar um endereço fixo (ex.: `noreply@seudominio.com`), adicione esse endereço aos **Contatos** do Gmail para reduzir a chance de ir para Spam no futuro.

3. **Melhorar a entrega no Gmail (administrador)**
   - O Gmail é mais rigoroso que Hotmail/Outlook com remetentes sem reputação ou sem domínio verificado.
   - Configure **SMTP personalizado** no Supabase (veja **CONFIGURAR_SMTP_SUPABASE.md**) usando um provedor (Resend, Brevo, SendGrid etc.).
   - **Verifique o domínio** no provedor e configure **SPF** e **DKIM** para o domínio de envio — isso aumenta muito a chance do Gmail aceitar e colocar na caixa de entrada.
   - Use um **remetente** com esse domínio verificado (ex.: `noreply@seudominio.com`), não o e-mail padrão do Supabase.

Resumo: para Gmail, verifique **Spam** e **Promoções**; para evitar isso no futuro, use SMTP personalizado com domínio verificado (SPF/DKIM).

---

## Listar e-mails dos moradores (para cadastrar no Auth)

No **SQL Editor** do Supabase você pode rodar o script **`supabase_list_resident_emails_for_auth.sql`** (criado neste projeto) para ver todos os e-mails da tabela `residents`. Use essa lista para adicionar cada um em **Authentication → Users** manualmente, se quiser que todos possam usar “Esqueci minha senha”.
