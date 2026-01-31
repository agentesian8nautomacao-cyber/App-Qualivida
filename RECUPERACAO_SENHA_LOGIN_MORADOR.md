# "Unidade ou senha incorretos" após redefinir a senha pelo link

Se a mensagem diz que a senha foi alterada com sucesso, mas ao tentar logar como **morador** (unidade + senha) aparece **"Unidade ou senha incorretos"**, siga esta lista.

---

## Por que isso acontece

- A senha redefinida pelo link fica no **Supabase Auth** (login por e-mail/usuário).
- O login como **morador** usa **unidade + senha** e lê a senha na tabela **residents**.
- Uma função no Supabase (**sync_resident_password_after_reset**) copia a nova senha do Auth para **residents**. Se essa função não existir ou não encontrar o morador, a senha em **residents** não é atualizada e o login por unidade continua com a senha antiga.

---

## Checklist

### 1. A função foi criada no Supabase?

A função **sync_resident_password_after_reset** precisa existir no projeto.

1. No **Supabase Dashboard** → **SQL Editor** → **New query**.
2. Abra o arquivo **`supabase_sync_resident_password_after_reset.sql`** do projeto e copie **todo** o conteúdo.
3. Cole no editor e clique em **Run**.

Se essa função não tiver sido executada antes, o login como morador **não** vai reconhecer a nova senha.

---

### 2. E-mail do morador = e-mail que recebeu o link

A função atualiza o morador pelo **e-mail**: ela usa o e-mail do usuário no Auth (quem recebeu o link) e atualiza o **residents** que tiver **o mesmo e-mail**.

- O e-mail em **residents** (cadastro do morador) deve ser **o mesmo** que recebeu o link de recuperação (agora a comparação é sem diferenciar maiúsculas/minúsculas).
- Se o morador foi cadastrado **sem e-mail** ou com **outro e-mail**, a função não encontra o registro e não atualiza a senha.

**O que fazer:** conferir no Supabase (tabela **residents**) se o morador tem **email** preenchido e se é exatamente o e-mail usado para solicitar e receber o link de recuperação.

---

### 3. Onde fazer login

- **Morador (unidade + senha):** aba **Morador**, campo **Unidade** + **Senha** (a nova senha definida no link).
- **Admin/Porteiro (e-mail/usuário + senha):** aba **Admin/Porteiro**, **E-mail ou usuário** + **Senha** (a nova senha).

Se a pessoa é morador e vai redefinir a senha pelo link, depois do sucesso ela deve logar na **aba Morador** com **unidade + nova senha**.

---

### 4. Se já redefiniu a senha antes de criar a função

1. Crie a função no Supabase (passo 1 acima), se ainda não tiver criado.
2. Peça à pessoa para **solicitar de novo** "Recuperar senha", abrir o link no e-mail e **definir a nova senha outra vez**. Nessa segunda vez a função vai rodar e atualizar **residents**.
3. Ou: o síndico pode **alterar a senha do morador** manualmente (editar morador e definir nova senha), para não depender do link.

---

## Resumo

| Problema | Solução |
|----------|--------|
| Função não existe no Supabase (404) | Executar **supabase_sync_resident_password_after_reset.sql** no SQL Editor. |
| E-mail do morador diferente do e-mail do link | Garantir que em **residents** o **email** seja o mesmo que recebeu o link (ou corrigir o cadastro). |
| Login na aba errada | Morador: aba **Morador** (unidade + senha). Admin/Porteiro: aba **Admin/Porteiro** (e-mail/usuário + senha). |
| Já redefiniu antes de criar a função | Criar a função e pedir para **redefinir a senha de novo** pelo link, ou alterar a senha do morador manualmente. |

A função no SQL foi ajustada para comparar e-mail **sem diferenciar maiúsculas e minúsculas**; se você já tinha criado a função antes, execute o script de novo no SQL Editor para atualizar.
