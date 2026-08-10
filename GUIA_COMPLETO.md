# 🚀 Guia Completo - App Qualivida

Este guia contém todas as instruções necessárias para configurar e executar o App Qualivida localmente e em produção.

---

## 📋 Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Configuração do Banco de Dados (Supabase)](#configuração-do-banco-de-dados-supabase)
3. [Desenvolvimento Local](#desenvolvimento-local)
4. [Configuração da Aplicação](#configuração-da-aplicação)
5. [Próximos Passos](#próximos-passos)
6. [Troubleshooting](#troubleshooting)

---

## 📦 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior)
- **npm** ou **yarn**
- **Git**
- Conta no **Supabase** (gratuita)
- Editor de código (VS Code recomendado)

---

## 🗄️ Configuração do Banco de Dados (Supabase)

### Passo 1: Criar Projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com)
2. Faça login ou crie uma conta
3. Clique em **"New Project"**
4. Preencha os dados:
   - **Name:** Qualivida (ou o nome que preferir)
   - **Database Password:** Crie uma senha forte (anote em local seguro!)
   - **Region:** Escolha a região mais próxima (ex: South America - São Paulo)
5. Clique em **"Create new project"**
6. Aguarde alguns minutos enquanto o projeto é criado

### Passo 2: Executar Schema do Banco de Dados

1. No painel do Supabase, vá em **SQL Editor** (menu lateral)
2. Clique em **"New Query"**
3. Abra o arquivo `supabase_schema.sql` do projeto
4. **Copie todo o conteúdo** do arquivo
5. **Cole no SQL Editor** do Supabase
6. Clique em **"Run"** ou pressione `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
7. Aguarde a execução terminar (deve mostrar "Success. No rows returned")

### Passo 3: Executar Funções e Triggers

1. Ainda no **SQL Editor**, clique em **"New Query"** novamente
2. Abra o arquivo `supabase_functions.sql` do projeto
3. **Copie todo o conteúdo** do arquivo
4. **Cole no SQL Editor** do Supabase
5. Clique em **"Run"** ou pressione `Ctrl+Enter` / `Cmd+Enter`
6. Aguarde a execução terminar (deve mostrar "Success. No rows returned")

### Passo 4: Adicionar Usuários Padrão

1. No **SQL Editor**, clique em **"New Query"**
2. Abra o arquivo `supabase_add_users.sql` do projeto
3. **Copie todo o conteúdo** do arquivo
4. **Cole no SQL Editor** do Supabase
5. Clique em **"Run"** ou pressione `Ctrl+Enter` / `Cmd+Enter`
6. Verifique se o usuário foi criado (deve aparecer os dados do usuário desenvolvedor)

### Passo 5: Verificar Tabelas Criadas

1. No menu lateral, clique em **"Table Editor"**
2. Você deve ver as seguintes tabelas:
   - `users`
   - `residents`
   - `packages`
   - `package_items`
   - `visitors`
   - `occurrences`
   - `reservations`
   - `areas`
   - `notices`
   - `notice_reads`
   - `chat_messages`
   - `notes`
   - `staff`
   - `crm_units`
   - `crm_issues`
   - `app_config`

### Passo 6: Obter Credenciais de Conexão

1. No menu lateral, vá em **Settings** > **API**
2. Copie e anote as seguintes informações:
   - **Project URL:** `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ⚠️ **MANTENHA SECRETO!**

---

## 💻 Desenvolvimento Local

### Passo 1: Clonar/Configurar o Repositório

Se ainda não tiver o código localmente:

```bash
# Clone o repositório (se estiver no Git)
git clone <url-do-repositorio>
cd "App Qualivida"
```

### Passo 2: Instalar Dependências

Escolha uma das opções:

**Com npm:**
```bash
npm install
```

**Com yarn:**
```bash
yarn install
```

### Passo 3: Configurar Variáveis de Ambiente

1. Crie um arquivo `.env` na raiz do projeto (se não existir)
2. Adicione as credenciais do Supabase:

```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ IMPORTANTE:** 
- Substitua `xxxxxxxxxxxxx` pela URL do seu projeto Supabase
- Substitua a chave anon pela sua chave pública
- **NUNCA** commite o arquivo `.env` no Git (ele já deve estar no `.gitignore`)

### Passo 4: Executar o Projeto Localmente

**Com npm:**
```bash
npm run dev
```

**Com yarn:**
```bash
yarn dev
```

### Passo 5: Acessar a Aplicação

1. O terminal mostrará a URL local, geralmente:
   ```
   ➜  Local:   http://localhost:5173/
   ```
2. Abra essa URL no navegador
3. Você deve ver a tela de login do App Qualivida

### Passo 6: Fazer Login

Use as credenciais do usuário desenvolvedor:

- **Usuário:** `desenvolvedor`
- **Senha:** `dev`
- **Role:** SINDICO (acesso completo)

---

## ⚙️ Configuração da Aplicação

### Conectar ao Supabase

Você precisará instalar o cliente do Supabase no projeto:

```bash
# Com npm
npm install @supabase/supabase-js

# Com yarn
yarn add @supabase/supabase-js
```

### Criar Cliente Supabase

Crie um arquivo `src/lib/supabase.ts` (ou similar):

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### Exemplo de Uso

```typescript
import { supabase } from './lib/supabase'

// Buscar moradores
const { data: residents, error } = await supabase
  .from('residents')
  .select('*')

// Inserir encomenda
const { data, error } = await supabase
  .from('packages')
  .insert({
    recipient_name: 'João Silva',
    unit: '102A',
    type: 'Amazon',
    status: 'Pendente'
  })
```

---

## 🔐 Próximos Passos

### 1. Configurar Políticas RLS (Row Level Security)

**⚠️ IMPORTANTE:** Configure as políticas RLS antes de colocar em produção!

1. No Supabase, vá em **Authentication** > **Policies**
2. Para cada tabela, configure políticas específicas:

**Exemplo de política para leitura:**
```sql
-- Permitir leitura para usuários autenticados
CREATE POLICY "Authenticated users can read residents" 
ON residents FOR SELECT 
USING (auth.role() = 'authenticated');
```

**Exemplo de política para escrita:**
```sql
-- Permitir inserção para usuários autenticados
CREATE POLICY "Authenticated users can insert residents" 
ON residents FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
```

**Políticas recomendadas por tabela:**

- **residents:** Leitura/escrita para autenticados
- **packages:** Porteiro pode criar/atualizar, Síndico pode ler
- **visitors:** Porteiro pode criar/atualizar, Síndico pode ler
- **occurrences:** Todos podem criar, Síndico pode atualizar
- **reservations:** Todos podem criar, Síndico pode atualizar
- **notices:** Síndico pode criar/atualizar, todos podem ler
- **chat_messages:** Todos podem criar/ler suas próprias mensagens
- **notes:** Porteiro pode criar/atualizar suas próprias notas
- **staff:** Apenas Síndico pode gerenciar

### 2. Atualizar Senhas dos Usuários

Os usuários padrão têm senhas hasheadas. Para atualizar:

**Opção 1: Usar o script SQL**
```sql
-- Atualizar senha do desenvolvedor
UPDATE users 
SET password_hash = crypt('nova_senha', gen_salt('bf'))
WHERE username = 'desenvolvedor';
```

**Opção 2: Usar autenticação do Supabase**
- Configure autenticação via email/senha no Supabase
- Use a API de autenticação do Supabase na aplicação

### 3. Testar o Banco de Dados

1. **Inserir dados de teste:**
   ```sql
   -- Inserir morador de teste
   INSERT INTO residents (name, unit, email, phone, whatsapp)
   VALUES ('João Silva', '102A', 'joao@email.com', '5511999999999', '5511999999999');
   
   -- Inserir encomenda de teste
   INSERT INTO packages (recipient_name, unit, type, status)
   VALUES ('João Silva', '102A', 'Amazon', 'Pendente');
   ```

2. **Verificar triggers:**
   - Insira uma encomenda com `recipient_id`
   - Verifique se `recipient_name` e `unit` foram preenchidos automaticamente

3. **Testar funções:**
   ```sql
   -- Testar cálculo de permanência
   SELECT calculate_package_permanence(NOW() - INTERVAL '2 hours');
   
   -- Testar estatísticas do dashboard
   SELECT * FROM get_dashboard_stats();
   ```

### 4. Configurar Deploy (Vercel)

1. **Conectar repositório:**
   - Acesse [vercel.com](https://vercel.com)
   - Conecte seu repositório Git

2. **Configurar variáveis de ambiente:**
   - No Vercel, vá em **Settings** > **Environment Variables**
   - Adicione:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

3. **Deploy:**
   - O Vercel detectará automaticamente o projeto
   - Clique em **Deploy**
   - Aguarde o deploy concluir

---

## 🐛 Troubleshooting

### Erro: `ERR_CONNECTION_RESET` ou `ERR_EMPTY_RESPONSE`

**Solução:**
1. Pare o servidor (Ctrl+C)
2. Limpe o cache: `rm -rf node_modules .vite package-lock.json`
3. Reinstale: `npm install`
4. Inicie novamente: `npm run dev`

**Veja mais detalhes em:** `SOLUCAO_RAPIDA.md` ou `TROUBLESHOOTING.md`

### Aviso: Tailwind CSS via CDN

**Solução:** 
- Por enquanto pode ignorar (não impede funcionamento)
- Para produção, instale Tailwind: `npm install -D tailwindcss postcss autoprefixer`
- Veja instruções completas em `TROUBLESHOOTING.md`

### Erro: "relation does not exist"

**Solução:** Execute novamente o `supabase_schema.sql` para criar as tabelas.

### Erro: "permission denied"

**Solução:** Configure as políticas RLS ou desabilite temporariamente para desenvolvimento:
```sql
ALTER TABLE nome_da_tabela DISABLE ROW LEVEL SECURITY;
```

### Erro ao conectar ao Supabase

**Solução:** 
1. Verifique se as variáveis de ambiente estão corretas
2. Verifique se a URL e a chave estão corretas
3. Verifique se o projeto Supabase está ativo

### Erro: "Failed to run sql query"

**Solução:**
1. Verifique se está executando os scripts na ordem correta
2. Verifique se não há erros de sintaxe
3. Execute um script por vez

### Aplicação não inicia

**Solução:**
1. Verifique se as dependências foram instaladas: `npm install` ou `yarn install`
2. Verifique se a porta 3007 está livre (ou altere no `vite.config.ts`)
3. Tente limpar o cache: `rm -rf node_modules .vite && npm install`

### Login não funciona

**Solução:**
1. Verifique se o usuário existe no banco
2. Verifique se a senha está correta
3. Verifique se o hash da senha está correto no banco

### 404 no favicon

**Solução:** 
- Não é crítico, pode ignorar
- Ou adicione um `favicon.ico` na pasta `public/`

---

## 📚 Recursos Adicionais

- [Documentação do Supabase](https://supabase.com/docs)
- [Documentação do Vite](https://vitejs.dev/)
- [Documentação do React](https://react.dev/)

---

## ✅ Checklist de Configuração

- [ ] Projeto criado no Supabase
- [ ] Schema executado (`supabase_schema.sql`)
- [ ] Funções executadas (`supabase_functions.sql`)
- [ ] Usuários criados (`supabase_add_users.sql`)
- [ ] Credenciais copiadas
- [ ] Variáveis de ambiente configuradas
- [ ] Dependências instaladas
- [ ] Aplicação rodando localmente
- [ ] Login funcionando
- [ ] Políticas RLS configuradas
- [ ] Testes realizados
- [ ] Deploy configurado (se aplicável)

---

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs no console do navegador
2. Verifique os logs no terminal
3. Verifique os logs no Supabase (SQL Editor > History)
4. Consulte a seção [Troubleshooting](#troubleshooting)

---

**Desenvolvido com ❤️ para o App Qualivida**

