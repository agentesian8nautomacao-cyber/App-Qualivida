# 📋 Scripts de Correção - Boletos PDF (Supabase) 🗄️

## 🎯 **Problema Resolvido**

Os boletos importados anteriormente **não tinham PDFs anexados**, impedindo que moradores baixassem os boletos para pagamento.

## ✅ **Solução Implementada**

### **1. Importação Direta de PDFs**
- **Fluxo direto**: Botão abre seletor de arquivos sem modal intermediário
- **Processamento automático**: Extração inteligente de dados dos PDFs
- **Associação automática**: Vinculação com moradores baseada no conteúdo
- **Upload simultâneo**: Múltiplos PDFs processados em background

### **2. Scripts de Diagnóstico para Supabase**
Scripts SQL para diagnóstico e correção, compatíveis com Supabase:

#### **🔍 Script: `correcao_boletos_sem_pdf.sql`**
Identifica boletos sem PDF e fornece estatísticas detalhadas.

#### **✅ Script: `validacao_importacao_boletos_com_pdf.sql`**
Valida importações e gera relatórios de sucesso/falha.

#### **🎯 Script: `supabase_sql_editor_queries.sql`**
Consultas individuais para copiar e colar no SQL Editor do Supabase.

## 📋 **Fluxo de Importação Atual**

### **Como Funciona Agora:**

1. **Administrador clica** "IMPORTAR BOLETOS"
2. **Sistema abre** seletor de arquivos diretamente (sem modal)
3. **Administrador seleciona** múltiplos PDFs dos boletos
4. **Sistema processa** automaticamente em background:
   - Extrai dados (valor, vencimento, morador)
   - Cria boletos no banco de dados
   - Anexa PDFs permanentemente
   - Mostra progresso em tempo real
5. **Moradores veem** os boletos em suas interfaces
6. **Moradores podem** baixar os PDFs dos boletos

### **Vantagens do Novo Sistema:**

- ✅ **Fluxo direto**: Sem modais intermediários
- ✅ **Processamento em lote**: Múltiplos PDFs simultaneamente
- ✅ **Feedback visual**: Barra de progresso em tempo real
- ✅ **Integração completa**: PDFs ficam associados permanentemente
- ✅ **Experiência fluida**: Do upload à visualização do morador

## 🚀 **Como Executar os Scripts**

### **Pré-requisitos:**
- PostgreSQL instalado
- Acesso ao banco de dados da aplicação
- Permissões para executar queries

## 🚀 **Como Executar no Supabase**

### **Opção 1: Interface Web da Aplicação (Recomendado)**
1. **Logue como Administrador:**
   - Faça login com usuário Síndico ou Porteiro

2. **Acesse Boletos:**
   - Vá para **Financeiro → Boletos**
   - Clique no botão **"IMPORTAR BOLETOS"**

3. **Selecione os PDFs:**
   - Clique na área de upload
   - Selecione múltiplos arquivos PDF
   - O sistema processará automaticamente

4. **Confirme Importação:**
   - Aguarde processamento inteligente
   - Verifique boletos extraídos
   - Clique em "Importar" para finalizar

### **Opção 2: SQL Editor do Supabase (Diagnóstico)**
1. **Acesse o Supabase Dashboard:**
   - Vá para: https://supabase.com/dashboard
   - Selecione seu projeto

2. **Abra o SQL Editor:**
   - Clique em "SQL Editor" no menu lateral esquerdo
   - Clique em "New Query"

3. **Execute as Consultas:**
   - Abra o arquivo `scripts/supabase_sql_editor_queries.sql`
   - Copie e cole cada query individualmente
   - Execute uma por vez
   - Analise os resultados

### **Opção 2: Scripts Locais (Desenvolvimento)**
Se estiver desenvolvendo localmente com PostgreSQL:

#### **Script Batch (Windows):**
```cmd
scripts\executar_scripts_windows.bat
```

#### **Script PowerShell (Windows):**
```powershell
.\scripts\executar_scripts_windows.ps1
```

### **Opção 2: Comando Manual no PowerShell**

```powershell
# 🔍 Para identificar boletos sem PDF (correção manual necessária)
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -h localhost -U postgres -d gestao_qualivida -f scripts/correcao_boletos_sem_pdf.sql

# ✅ Para validar importações recentes
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -h localhost -U postgres -d gestao_qualivida -f scripts/validacao_importacao_boletos_com_pdf.sql

# 📖 Para ver exemplo de consultas individuais
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -h localhost -U postgres -d gestao_qualivida -f scripts/exemplo_execucao_boletos.sql
```

### **Opção 3: Prompt de Comando (CMD)**

```cmd
# 🔍 Para identificar boletos sem PDF (correção manual necessária)
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -h localhost -U postgres -d gestao_qualivida -f scripts/correcao_boletos_sem_pdf.sql

# ✅ Para validar importações recentes
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -h localhost -U postgres -d gestao_qualivida -f scripts/validacao_importacao_boletos_com_pdf.sql

# 📖 Para ver exemplo de consultas individuais
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -h localhost -U postgres -d gestao_qualivida -f scripts/exemplo_execucao_boletos.sql
```

**Parâmetros a ajustar:**
- Caminho do `psql.exe` (ajuste a versão do PostgreSQL, ex: `\14\bin\`, `\16\bin\`)
- `-h localhost`: Endereço do servidor PostgreSQL
- `-U postgres`: Nome do usuário do banco
- `-d gestao_qualivida`: Nome do banco de dados

### **⚠️ Importante:**
- **Execute no TERMINAL**, não dentro do arquivo SQL
- Arquivos `.sql` contêm apenas instruções SQL
- Use o **caminho completo** do `psql.exe` se não estiver no PATH

## 📊 **O que os Scripts Fazem**

### **Script de Correção:**
- ✅ Conta boletos sem PDF por status (Pago/Pendente/Vencido)
- ✅ Lista detalhada de boletos afetados
- ✅ Estatísticas por unidade e morador
- ✅ Priorização de correção (crítico > importante > normal)

### **Script de Validação:**
- ✅ Valida importações do dia atual
- ✅ Calcula taxa de sucesso (% com PDF)
- ✅ Gera relatório final com avaliação
- ✅ Registra log da validação no sistema

## 🔧 **Correção Manual (Interface Web)**

Para boletos identificados sem PDF:

1. **Logar como administrador** (Síndico ou Porteiro)
2. **Ir para Financeiro > Boletos**
3. **Localizar boleto específico**
4. **Clicar botão laranja "Anexar PDF"**
5. **Selecionar arquivo PDF correspondente**
6. **Confirmar upload**

## 📁 **Estrutura dos Arquivos**

```
scripts/
├── supabase_sql_editor_queries.sql       # 🟢 PRINCIPAL: Queries para Supabase
├── correcao_boletos_sem_pdf.sql          # Diagnóstico detalhado
├── validacao_importacao_boletos_com_pdf.sql  # Validação pós-importação
├── exemplo_execucao_boletos.sql          # Exemplos adicionais
└── local_development/                    # Scripts para desenvolvimento local
    ├── executar_scripts_windows.bat      # Script batch (PostgreSQL local)
    ├── executar_scripts_windows.ps1      # Script PowerShell (PostgreSQL local)
    └── config_boletos.json               # Configurações locais

📁 documentação/
├── GUIA_SUPABASE_BOLETOS.md             # Guia completo passo a passo
├── SCRIPTS_BOLETOS_README.md            # Esta documentação
├── INSTRUCOES_RAPIDAS_BOLETOS.md        # Guia rápido
└── RESUMO_SUPABASE_BOLETOS.md           # Resumo executivo
```

## 🎯 **Resultados Esperados**

### **Antes da Correção:**
- ❌ Boletos visíveis mas sem download
- ❌ Moradores não conseguem pagar via banco
- ❌ Problemas de experiência do usuário

### **Depois da Correção:**
- ✅ 100% dos boletos com PDF disponível
- ✅ Moradores podem baixar e pagar normalmente
- ✅ Sistema totalmente funcional

## 📈 **Monitoramento Contínuo**

Execute validações periódicas para garantir:
- Todas as importações incluem PDFs
- Nenhum boleto fica sem arquivo anexado
- Cobertura total de documentos

## 🆘 **Suporte**

Em caso de dúvidas:
1. Execute primeiro o script de diagnóstico
2. Verifique os resultados na tabela
3. Siga as instruções de correção manual
4. Use validação para confirmar sucesso

## 🔧 **Troubleshooting**

### **Supabase - Problemas de Acesso**
- **Erro "Permission denied":**
  - Verifique se está logado no projeto correto
  - Certifique-se que tem permissões de leitura nas tabelas `boletos`
  - Use o SQL Editor apenas com usuário administrador

- **Queries não retornam dados:**
  - Verifique se a tabela `boletos` existe: `SELECT COUNT(*) FROM public.boletos;`
  - Confirme os nomes das colunas: `SELECT * FROM public.boletos LIMIT 1;`
  - Verifique se há dados: `SELECT COUNT(*) FROM public.boletos WHERE created_at >= CURRENT_DATE;`

- **Erro de sintaxe SQL:**
  - Execute apenas uma query por vez
  - Remova comentários se estiverem causando problemas
  - Verifique se copiou a query completa

### **Erro: "psql: command not found" (PostgreSQL Local)**
```cmd
# 1. VERIFICAR INSTALAÇÃO
# Execute o script batch para diagnóstico automático:
scripts\executar_scripts_windows.bat
# Escolha opção [4] para verificar PostgreSQL

# 2. INSTALAR PostgreSQL (se necessário)
# Opção A: Site oficial
# • Acesse: https://www.postgresql.org/download/windows/
# • Baixe e instale a versão completa

# Opção B: Chocolatey (se instalado)
choco install postgresql

# Opção C: winget (Windows 10/11)
winget install PostgreSQL.PostgreSQL

# 3. ADICIONAR AO PATH
# • Localizar pasta: C:\Program Files\PostgreSQL\[versao]\bin
# • Adicionar ao PATH do sistema nas variáveis de ambiente
# • Reiniciar terminal/PowerShell

# 4. USAR CAMINHO COMPLETO (solução imediata)
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" [parametros]
```

### **Erro: "psql: command not found" (Linux/macOS)**
```bash
# Instalar PostgreSQL client (Ubuntu/Debian)
sudo apt-get install postgresql-client

# Instalar PostgreSQL client (macOS com Homebrew)
brew install postgresql

# Instalar PostgreSQL client (CentOS/RHEL/Fedora)
sudo yum install postgresql  # ou dnf install postgresql
```

### **Erro: "FATAL: database does not exist"**
- Verifique o nome do banco de dados
- Use `\l` no psql para listar bancos disponíveis
- Ou use: `psql -h localhost -U postgres -l`

### **Erro: "FATAL: password authentication failed"**
- Verifique credenciais no arquivo de configuração
- Use arquivo `.pgpass` ou variável `PGPASSWORD`
- Exemplo: `PGPASSWORD=minha_senha psql -h localhost -U postgres -d gestao_qualivida`

### **Queries não retornam resultados**
- Verifique se há boletos na tabela: `SELECT COUNT(*) FROM boletos;`
- Verifique datas: `SELECT MIN(created_at), MAX(created_at) FROM boletos;`
- Use `CURRENT_DATE` correto para o fuso horário

### **Problemas de permissão**
- Certifique-se que o usuário tem acesso a `public.boletos`
- Execute: `GRANT SELECT ON public.boletos TO seu_usuario;`

---

## 📋 **Checklist Pós-Correção (Supabase)**

- [ ] Acesso ao Supabase Dashboard confirmado
- [ ] SQL Editor funcionando corretamente
- [ ] Query de diagnóstico executada com sucesso
- [ ] Boletos sem PDF identificados e listados
- [ ] PDFs anexados via interface web da aplicação
- [ ] Validação mostra cobertura adequada (≥95%)
- [ ] Moradores conseguem baixar boletos via app
- [ ] Teste realizado com diferentes dispositivos/navegadores
- [ ] Dashboard de monitoramento configurado para acompanhamento futuro

---

## 🎯 **Próximos Passos Recomendados**

1. **Execute diagnóstico** no Supabase SQL Editor
2. **Corrija boletos prioritários** via interface web
3. **Valide melhorias** com queries de monitoramento
4. **Configure monitoramento contínuo** para futuras importações

## 📞 **Links Úteis**

- **Supabase Dashboard:** https://supabase.com/dashboard
- **SQL Editor:** Projeto → SQL Editor → New Query
- **Documentação Completa:** `GUIA_SUPABASE_BOLETOS.md`
- **Resumo Executivo:** `RESUMO_SUPABASE_BOLETOS.md`

---

**📅 Última atualização:** Fevereiro 2026
**🔧 Versão:** 1.0 - Supabase Edition - Correção completa implementada