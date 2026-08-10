# O e-mail de recuperação não chega – o que fazer

## E-mail não chega no Gmail nem no Hotmail/Outlook

Se o link de recuperação **não chega em nenhum dos dois** (Gmail e Hotmail/Outlook) — nem na caixa de entrada nem em Spam —, as causas mais comuns são:

1. **E-mail não está em Authentication → Users**  
   O Supabase só envia para endereços cadastrados em **Authentication → Users**. Verifique isso primeiro (veja seção abaixo).

2. **Uso do e-mail padrão do Supabase (sem SMTP personalizado)**  
   O remetente padrão do Supabase tem **baixa entrega** em Gmail e Hotmail: muitos provedores bloqueiam ou filtram por falta de SPF/DKIM e reputação.  
   **Solução:** configurar **SMTP personalizado** no Supabase com um provedor (Resend, Brevo, SendGrid) e **verificar o domínio** (SPF/DKIM). Guia completo: **CONFIGURAR_SMTP_SUPABASE.md**.

Resumo: para o e-mail chegar de forma confiável em **Gmail e Hotmail**, é necessário **SMTP personalizado + domínio verificado** no Supabase. Não há ajuste apenas no app que resolva a entrega.

---

## Por que o e-mail não chega (verificações básicas)

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

## E-mail chega no Hotmail/Outlook mas NÃO no Gmail (nem no Spam)

Se o link de recuperação **chega no Hotmail** (ou Outlook) mas **não chega no Gmail** — nem na caixa de entrada, nem em **Spam** ou **Promoções** —, o Gmail está **bloqueando ou descartando** o e-mail do remetente padrão do Supabase. Isso é comum: o Gmail exige reputação e domínio verificado (SPF/DKIM).

### Solução: SMTP personalizado com domínio verificado

**Não há ajuste no app que resolva isso.** A única forma de o Gmail passar a receber é o **administrador** configurar **SMTP personalizado** no Supabase usando um provedor de e-mail (Resend, Brevo, SendGrid) e **verificar o domínio** de envio (SPF e DKIM). Sem isso, o Gmail continua sem entregar.

**Passo a passo resumido:**

1. **Criar conta em um provedor**  
   - [Resend](https://resend.com) (grátis para começar) ou [Brevo](https://brevo.com) ou SendGrid.

2. **Verificar um domínio**  
   - No provedor, adicione e verifique um domínio que você controla (ex.: `seudominio.com`).  
   - Siga as instruções do provedor para **SPF** e **DKIM** (geralmente são registros DNS no seu provedor de domínio).

3. **Configurar no Supabase**  
   - **Authentication** → **E-mails** → **Configurações SMTP**.  
   - Ative **Habilitar SMTP personalizado**.  
   - **Remetente:** use um e-mail do domínio verificado (ex.: `noreply@seudominio.com`).  
   - Preencha **Host, Porta, Usuário e Senha** conforme o provedor (veja **CONFIGURAR_SMTP_SUPABASE.md** com exemplos Resend e Brevo).  
   - Salve.

4. **Testar**  
   - Solicite de novo “Esqueci minha senha” com um e-mail **@gmail.com**. O e-mail deve passar a chegar (inbox ou Spam no início; depois tende a ir para a caixa de entrada).

**Se você não tem domínio próprio:**  
- Resend oferece domínio de teste (`onboarding@resend.dev`) para testes; para produção e Gmail estável, o ideal é um domínio verificado.  
- Brevo e outros também têm opções de teste; confira a documentação do provedor.

**Resumo:** Gmail não entrega o e-mail integrado do Supabase. Para Gmail receber, é obrigatório **SMTP personalizado + domínio verificado (SPF/DKIM)**. Guia completo: **CONFIGURAR_SMTP_SUPABASE.md**.

---

## Listar e-mails dos moradores (para cadastrar no Auth)

No **SQL Editor** do Supabase você pode rodar o script **`supabase_list_resident_emails_for_auth.sql`** (criado neste projeto) para ver todos os e-mails da tabela `residents`. Use essa lista para adicionar cada um em **Authentication → Users** manualmente, se quiser que todos possam usar “Esqueci minha senha”.
