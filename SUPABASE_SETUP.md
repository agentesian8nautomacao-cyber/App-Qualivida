# Configuração do Banco de Dados - Supabase

Este documento contém as instruções para configurar o banco de dados do App Qualivida no Supabase.

## 📋 Pré-requisitos

1. Projeto criado no Supabase
2. Acesso ao SQL Editor do Supabase
3. Credenciais de acesso ao projeto

## 🚀 Passos para Configuração

### 1. Acessar o SQL Editor

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **SQL Editor**
4. Clique em **New Query**

### 2. Executar o Schema (OBRIGATÓRIO - Execute primeiro!)

1. Abra o arquivo `supabase_schema.sql` neste repositório
2. Copie todo o conteúdo do arquivo
3. Cole no SQL Editor do Supabase
4. Clique em **Run** ou pressione `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
5. **Aguarde a execução terminar completamente** antes de prosseguir

**⚠️ IMPORTANTE:** Este arquivo deve ser executado PRIMEIRO, pois cria todas as tabelas necessárias.

### 2.1. Executar Funções Auxiliares (Execute após o schema)

1. **Certifique-se de que o `supabase_schema.sql` foi executado com sucesso**
2. Abra o arquivo `supabase_functions.sql` neste repositório
3. Copie todo o conteúdo do arquivo
4. Cole no SQL Editor do Supabase
5. Clique em **Run** ou pressione `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

**Nota:** Este arquivo contém funções úteis para validações, cálculos e views que facilitam o trabalho com os dados. Ele depende das tabelas criadas no schema.

### 3. Verificar a Criação das Tabelas

Após executar o script, verifique se todas as tabelas foram criadas:

1. No menu lateral, clique em **Table Editor**
2. Você deve ver as seguintes tabelas:
   - `users`
   - `residents`
   - `areas`
   - `reservations`
   - `packages`
   - `package_items`
   - `visitors`
   - `occurrences`
   - `notices`
   - `notice_reads`
   - `chat_messages`
   - `notes`
   - `staff`
   - `crm_units`
   - `crm_issues`
   - `app_config`

### 4. Configurar Autenticação (Opcional)

Se você quiser usar a autenticação nativa do Supabase:

1. Vá em **Authentication** > **Users**
2. Crie usuários manualmente ou configure o provider de autenticação desejado
3. Atualize as senhas dos usuários padrão criados no seed

### 5. Configurar Row Level Security (RLS)

O schema já habilita RLS em todas as tabelas, mas você precisa criar políticas específicas conforme sua necessidade de segurança.

**Exemplo de políticas básicas:**

```sql
-- Permitir leitura para usuários autenticados
CREATE POLICY "Authenticated users can read" ON residents
    FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir inserção para usuários autenticados
CREATE POLICY "Authenticated users can insert" ON residents
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Permitir atualização para usuários autenticados
CREATE POLICY "Authenticated users can update" ON residents
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Permitir exclusão para usuários autenticados
CREATE POLICY "Authenticated users can delete" ON residents
    FOR DELETE USING (auth.role() = 'authenticated');
```

**Aplique políticas similares para todas as tabelas conforme necessário.**

### 6. Obter Credenciais de Conexão

Para conectar sua aplicação ao Supabase:

1. Vá em **Settings** > **API**
2. Copie as seguintes informações:
   - **Project URL**: URL do seu projeto
   - **anon/public key**: Chave pública para acesso
   - **service_role key**: Chave de serviço (mantenha segura!)

## 📊 Estrutura das Tabelas Principais

### Users (Usuários)
- Armazena os usuários do sistema (Porteiro e Síndico)
- Campos: `id`, `username`, `password_hash`, `role`, `name`, `email`, `phone`

### Residents (Moradores)
- Cadastro de moradores do condomínio
- Campos: `id`, `name`, `unit`, `email`, `phone`, `whatsapp`

### Packages (Encomendas)
- Registro de encomendas recebidas
- Relacionado com: `residents`, `package_items`
- Campos: `id`, `recipient_id`, `type`, `status`, `received_at`, `deadline_minutes`

### Visitors (Visitantes)
- Controle de entrada e saída de visitantes
- Campos: `id`, `resident_id`, `visitor_names`, `type`, `entry_time`, `exit_time`, `status`

### Reservations (Reservas)
- Agendamento de áreas comuns
- Relacionado com: `areas`, `residents`
- Campos: `id`, `area_id`, `resident_id`, `date`, `start_time`, `end_time`, `status`

### Occurrences (Ocorrências)
- Registro de problemas e reclamações
- Campos: `id`, `resident_id`, `description`, `status`, `date`, `reported_by`

### Notices (Avisos)
- Sistema de avisos e comunicados
- Campos: `id`, `title`, `content`, `author`, `author_role`, `category`, `priority`, `pinned`

### Notes (Notas)
- Notas operacionais do porteiro
- Campos: `id`, `content`, `completed`, `scheduled`, `category`

### Staff (Funcionários)
- Cadastro de funcionários do condomínio
- Campos: `id`, `name`, `role`, `status`, `shift`, `phone`, `email`

## 🔐 Segurança

### Senhas dos Usuários Padrão

Os usuários padrão criados no seed têm senhas placeholder. **IMPORTANTE**: Você deve:

1. Criar um hash real das senhas usando bcrypt ou similar
2. Atualizar os registros na tabela `users`
3. Ou criar novos usuários através da interface de autenticação do Supabase

### Row Level Security (RLS)

Todas as tabelas têm RLS habilitado por padrão. Configure políticas específicas conforme sua necessidade de segurança antes de colocar em produção.

## 🔄 Migrações Futuras

Para fazer alterações no schema no futuro:

1. Crie um novo arquivo SQL com as alterações
2. Execute no SQL Editor do Supabase
3. Ou use o sistema de migrações do Supabase (recomendado para produção)

## 📝 Notas Importantes

- O schema inclui índices para otimizar consultas frequentes
- Triggers automáticos atualizam o campo `updated_at` em todas as tabelas
- A validação de conflito de horários em reservas é feita através da função `check_reservation_conflict()`
- Campos de cache (como `resident_name`, `unit`) são mantidos para melhor performance
- Triggers automáticos atualizam os campos de cache quando o `resident_id` é alterado
- Views úteis estão disponíveis para consultas frequentes (v_pending_packages, v_active_visitors, etc.)

## 🔧 Funções Disponíveis

Após executar `supabase_functions.sql`, você terá acesso a:

- `check_reservation_conflict()`: Verifica se há conflito de horário em reservas
- `calculate_package_permanence()`: Calcula o tempo de permanência de uma encomenda
- `calculate_visitor_permanence()`: Calcula o tempo de permanência de um visitante
- `get_dashboard_stats()`: Retorna estatísticas consolidadas para o dashboard

## 📊 Views Disponíveis

- `v_pending_packages`: Encomendas pendentes com informações consolidadas
- `v_active_visitors`: Visitantes ativos com informações consolidadas
- `v_open_occurrences`: Ocorrências abertas com informações consolidadas
- `v_today_reservations`: Reservas do dia atual formatadas

## 🆘 Suporte

Se encontrar problemas:

1. Verifique os logs no SQL Editor do Supabase
2. Certifique-se de que todas as extensões necessárias estão instaladas
3. Verifique se não há conflitos com tabelas existentes

