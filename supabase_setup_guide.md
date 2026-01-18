# Guia Completo de Setup do Banco de Dados - Supabase

Este guia irá ajudá-lo a configurar todo o banco de dados do App Qualivida no Supabase.

## 📋 Pré-requisitos

1. Conta no Supabase (https://supabase.com)
2. Projeto criado no Supabase
3. Acesso ao SQL Editor do Supabase

## 🚀 Passos para Configuração

### 1. Criar o Schema do Banco de Dados

1. Acesse seu projeto no Supabase
2. Vá para **SQL Editor**
3. Clique em **New Query**
4. Copie todo o conteúdo do arquivo `supabase_schema_complete.sql`
5. Cole no editor SQL
6. Clique em **Run** ou pressione `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

### 2. Criar as Funções e Views

1. No mesmo SQL Editor, abra uma nova query
2. Copie todo o conteúdo do arquivo `supabase_functions_complete.sql`
3. Cole no editor SQL
4. Clique em **Run**

### 3. Verificar se Tudo Foi Criado

1. Execute o arquivo `supabase_check_tables.sql` para verificar se todas as tabelas foram criadas corretamente

## 📊 Estrutura das Tabelas Criadas

O schema cria as seguintes tabelas:

### Tabelas Principais:
- ✅ **users** - Usuários do sistema (Porteiro e Síndico)
- ✅ **residents** - Moradores do condomínio
- ✅ **packages** - Encomendas recebidas
- ✅ **package_items** - Itens das encomendas
- ✅ **visitors** - Visitantes
- ✅ **occurrences** - Ocorrências
- ✅ **reservations** - Reservas de áreas comuns
- ✅ **areas** - Áreas comuns
- ✅ **notices** - Avisos
- ✅ **notice_reads** - Leitura de avisos por moradores
- ✅ **chat_messages** - Mensagens do chat
- ✅ **notes** - Notas operacionais
- ✅ **staff** - Funcionários
- ✅ **boletos** - Boletos de condomínio ⭐ NOVO
- ✅ **crm_units** - Unidades do CRM
- ✅ **crm_issues** - Problemas do CRM
- ✅ **app_config** - Configurações do app

## 🔐 Segurança (RLS - Row Level Security)

Todas as tabelas têm RLS habilitado. **IMPORTANTE**: Antes de colocar em produção, você deve:

1. Configurar políticas RLS específicas para cada tabela
2. Criar roles apropriados para diferentes tipos de usuários
3. Definir permissões de acesso adequadas

As políticas atuais são permissivas para desenvolvimento. Ajuste conforme necessário.

## 📝 Dados Iniciais

O schema inclui dados de seed:

### Usuários Padrão:
- **portaria** (role: PORTEIRO) - Senha: deve ser alterada
- **admin** (role: SINDICO) - Senha: deve ser alterada
- **desenvolvedor** (role: SINDICO) - Senha: deve ser alterada

⚠️ **IMPORTANTE**: As senhas são placeholders. Você deve:
1. Criar hashes reais das senhas usando bcrypt
2. Atualizar os registros na tabela `users`
3. Ou criar novos usuários através da interface de autenticação do Supabase

### Áreas Comuns Padrão:
- SALÃO DE FESTAS CRYSTAL
- ESPAÇO GOURMET
- CHURRASQUEIRA ROOFTOP
- ACADEMIA

## 🔧 Funções Criadas

### Funções de Cálculo:
- `calculate_package_permanence()` - Calcula tempo de permanência da encomenda
- `calculate_visitor_permanence()` - Calcula tempo de permanência do visitante
- `check_boleto_status()` - Verifica status do boleto
- `update_expired_boletos()` - Atualiza boletos vencidos

### Funções de Validação:
- `check_reservation_conflict()` - Verifica conflito de horário em reservas
- `find_resident_by_qr()` - Busca morador por QR code

### Funções de Dashboard:
- `get_dashboard_stats()` - Retorna estatísticas do dashboard
- `get_packages_by_resident()` - Obtém pacotes de um morador
- `get_boletos_by_resident()` - Obtém boletos de um morador

## 📊 Views Criadas

- `v_pending_packages` - Encomendas pendentes
- `v_active_visitors` - Visitantes ativos
- `v_open_occurrences` - Ocorrências abertas
- `v_today_reservations` - Reservas do dia
- `v_pending_boletos` - Boletos pendentes e vencidos

## 🎯 Próximos Passos

1. **Configurar Autenticação**:
   - Configure a autenticação do Supabase na aplicação
   - Crie usuários reais com senhas seguras

2. **Configurar APIs**:
   - Crie API routes ou use Supabase Client diretamente
   - Configure variáveis de ambiente

3. **Testar Integração**:
   - Teste todas as operações CRUD
   - Verifique se os triggers estão funcionando
   - Teste as funções e views

4. **Configurar RLS**:
   - Crie políticas RLS específicas
   - Teste permissões de acesso
   - Configure roles adequados

## 🐛 Troubleshooting

### Erro ao executar schema:
- Verifique se as extensões `uuid-ossp` e `btree_gist` estão habilitadas
- Certifique-se de estar executando no schema `public`

### Triggers não funcionando:
- Verifique se as funções foram criadas corretamente
- Execute `supabase_functions_complete.sql` novamente

### RLS bloqueando acesso:
- Verifique as políticas RLS criadas
- Temporariamente, você pode desabilitar RLS para testes (NÃO RECOMENDADO EM PRODUÇÃO)

## 📚 Recursos Adicionais

- [Documentação do Supabase](https://supabase.com/docs)
- [Guia de RLS do Supabase](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase SQL Reference](https://supabase.com/docs/guides/database)

---

**Versão**: 2.0 - Completo  
**Última atualização**: 2025