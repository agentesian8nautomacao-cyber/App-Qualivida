# Configurar SMTP personalizado no Supabase (aumentar limite de e-mails)

O e-mail **integrado** do Supabase tem limite fixo de **2 e-mails por hora** e **não pode ser aumentado** sem configurar um provedor SMTP próprio. Para produção e para aumentar o limite, é necessário **Set up custom SMTP**.

---

## E-mail de recuperação não chega no Gmail nem no Hotmail?

Se os links de recuperação **não chegam** na caixa de entrada (e nem em Spam) de **Gmail** ou **Hotmail/Outlook**, o remetente padrão do Supabase está sendo bloqueado ou filtrado por esses provedores. A solução é configurar **SMTP personalizado com domínio verificado (SPF/DKIM)** — siga os passos deste guia.

---

## Gmail não recebe o link de recuperação?

Se o e-mail de recuperação **chega no Hotmail/Outlook mas não chega no Gmail** (nem na caixa de entrada, nem em Spam/Promoções), o Gmail está bloqueando o remetente padrão do Supabase. **A única solução é configurar SMTP personalizado com domínio verificado (SPF/DKIM)** — siga este guia. Sem isso, o Gmail não entrega.

---

## Onde configurar

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard) e abra seu projeto.
2. No menu lateral: **Authentication** → **E-mails**.
3. Aba **Configurações SMTP** (ou **SMTP** / **Custom SMTP**).
4. Ative **"Habilitar SMTP personalizado"** (ou **Enable Custom SMTP**).

---

## Campos obrigatórios

### Detalhes do remetente

| Campo | O que colocar |
|-------|----------------|
| **Endereço de e-mail do remetente** | E-mail de envio (ex.: `noreply@seudominio.com`). Deve ser de um domínio que você **verificou** no provedor de e-mail. |
| **Nome do remetente** | Nome que aparece como "De:" (ex.: `Sistema Qualivida`, `Condomínio XYZ`). |

### Configurações do provedor SMTP

| Campo | O que colocar |
|-------|----------------|
| **Hospedar (Host)** | Servidor SMTP do provedor (ex.: `smtp.resend.com`, `smtp-relay.brevo.com`). |
| **Número da porta** | `465` (SSL) ou `587` (TLS). Use o que o provedor indicar. |
| **Nome de usuário** | Login SMTP (pode ser `resend`, um e-mail ou "SMTP login" — depende do provedor). |
| **Senha** | **Chave SMTP** ou **API Key** do provedor (não é a senha da sua conta). |
| **Intervalo mínimo por usuário** | Ex.: `60` segundos (tempo mínimo entre e-mails para o mesmo usuário). |

Depois de preencher, **salve**. O Supabase passa a usar seu SMTP e o limite sobe para **30 e-mails/hora**; você poderá alterar esse valor em **Authentication → Limites de taxa**.

---

## Exemplo 1 — Resend (grátis para começar)

1. Crie conta em [resend.com](https://resend.com).
2. Em **Resend** → **API Keys** → crie uma chave e copie (ex.: `re_123abc...`).
3. No Supabase → **Authentication** → **E-mails** → **Configurações SMTP**:

| Campo | Valor |
|-------|--------|
| Endereço do remetente | `onboarding@resend.dev` (teste) ou `noreply@seudominio.com` (se verificou o domínio no Resend) |
| Nome do remetente | `Qualivida` |
| Hospedar | `smtp.resend.com` |
| Porta | `465` |
| Nome de usuário | `resend` |
| Senha | Sua **API Key** do Resend |
| Intervalo mínimo por usuário | `60` |

4. Ative **Habilitar SMTP personalizado** e salve.

---

## Exemplo 2 — Brevo (ex-Sendinblue)

1. Crie conta em [brevo.com](https://brevo.com).
2. Em **Brevo** → **Configurações** → **SMTP e API**: anote o **login SMTP** (e-mail) e a **chave SMTP** (não use a senha da conta).
3. No Supabase → **Configurações SMTP**:

| Campo | Valor |
|-------|--------|
| Endereço do remetente | E-mail que você cadastrou no Brevo (ex.: `noreply@seudominio.com`) |
| Nome do remetente | `Qualivida` |
| Hospedar | `smtp-relay.brevo.com` |
| Porta | `587` ou `465` |
| Nome de usuário | Login SMTP do Brevo (geralmente um e-mail) |
| Senha | **Chave SMTP** do Brevo |
| Intervalo mínimo por usuário | `60` |

4. Ative **Habilitar SMTP personalizado** e salve.

---

## Aumentar o limite após ativar o SMTP

1. **Authentication** → **Limites de taxa** (ou **Rate Limits**).
2. Altere **Limite de taxa para envio de e-mails** (ex.: 30, 60, 100 e-mails/hora, conforme seu plano Supabase).

Sem SMTP personalizado, essa opção fica bloqueada e o limite permanece em 2 e-mails/hora.

---

## Outros provedores (referência)

- **SendGrid:** host `smtp.sendgrid.net`, porta `587`, usuário `apikey`, senha = API Key do SendGrid.
- **Postmark, ZeptoMail, AWS SES:** consulte a documentação do provedor para host, porta e autenticação.

---

## Resumo

1. **Authentication** → **E-mails** → **Configurações SMTP**.
2. Preencha host, porta, usuário, senha (chave SMTP/API) e remetente.
3. Ative **Habilitar SMTP personalizado** e salve.
4. Depois: **Authentication** → **Limites de taxa** para ajustar o limite de e-mails/hora.

Mais detalhes e troubleshooting: **AUTH_PASSWORD_RESET_FLOW.md** (seção 5.1 e exemplos).
