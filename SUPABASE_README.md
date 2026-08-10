# 🗄️ Banco de Dados Supabase - App Qualivida

## 📁 Arquivos do Banco de Dados

### 1. **supabase_schema_complete.sql** ⭐ PRINCIPAL
   - Schema completo do banco de dados
   - Todas as tabelas necessárias
   - Triggers e funções básicas
   - **EXECUTE ESTE PRIMEIRO**

### 2. **supabase_functions_complete.sql**
   - Funções auxiliares
   - Views úteis
   - Triggers adicionais
   - **EXECUTE DEPOIS DO SCHEMA**

### 3. **supabase_check_tables.sql**
   - Script de verificação
   - Verifica se todas as tabelas foram criadas

### 4. **supabase_setup_guide.md**
   - Guia completo de setup
   - Instruções detalhadas

## 🚀 Setup Rápido

### No Supabase:

1. **SQL Editor** → New Query
2. **Copie e cole** `supabase_schema_complete.sql` → Run ✅
3. **Nova Query** → **Copie e cole** `supabase_functions_complete.sql` → Run ✅
4. **Execute** `supabase_verify_installation.sql` para verificar tudo ✅

## ✅ Tabelas Criadas (17 tabelas)

1. `users` - Usuários (Porteiro/Síndico)
2. `residents` - Moradores
3. `packages` - Encomendas ⭐ com campos QR code e imagem
4. `package_items` - Itens das encomendas
5. `visitors` - Visitantes
6. `occurrences` - Ocorrências
7. `reservations` - Reservas
8. `areas` - Áreas comuns
9. `notices` - Avisos
10. `notice_reads` - Leitura de avisos
11. `chat_messages` - Mensagens
12. `notes` - Notas
13. `staff` - Funcionários
14. `boletos` - Boletos ⭐ NOVA
15. `crm_units` - Unidades CRM
16. `crm_issues` - Problemas CRM
17. `app_config` - Configurações

## 🆕 Novidades desta Versão

- ✅ Tabela `boletos` completa
- ✅ Campos `qr_code_data` e `image_url` em `packages`
- ✅ Campo `extra_data` (JSONB) em `residents`
- ✅ Função `find_resident_by_qr()` para buscar morador por QR code
- ✅ Views atualizadas com novos campos
- ✅ Triggers para atualizar boletos vencidos automaticamente

## ⚠️ Importante

1. **Senhas**: Os usuários padrão têm senhas placeholder. Altere antes de produção!
2. **RLS**: As políticas RLS são permissivas. Ajuste para produção!
3. **Backup**: Faça backup antes de executar em produção!

## ✅ Verificação da Instalação

Após executar os scripts, execute `supabase_verify_installation.sql` para:
- ✅ Verificar se todas as 17 tabelas foram criadas
- ✅ Verificar se todas as funções estão funcionando
- ✅ Verificar se todas as views foram criadas
- ✅ Verificar se os triggers estão ativos
- ✅ Verificar se os dados iniciais foram inseridos
- ✅ Verificar se o RLS está habilitado

## 🔗 Links Úteis

- [Supabase Dashboard](https://app.supabase.com)
- [Documentação Supabase](https://supabase.com/docs)
- Ver guia completo: `supabase_setup_guide.md`

---

**✅ Instalação concluída com sucesso!** 🎉

**Próximos passos:**
1. Execute `supabase_verify_installation.sql` para confirmar
2. Configure as variáveis de ambiente na aplicação
3. Teste a conexão com o banco de dados
4. Ajuste as políticas RLS conforme necessário