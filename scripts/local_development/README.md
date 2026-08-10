# 🔧 **Scripts para Desenvolvimento Local**

## 📋 **Quando Usar**

Estes scripts são para **desenvolvimento local** com PostgreSQL instalado na máquina.

**NÃO use estes scripts se seu projeto usa Supabase!** Para Supabase, use:
- `../supabase_sql_editor_queries.sql`
- `../../GUIA_SUPABASE_BOLETOS.md`

## 🚀 **Como Usar**

### **Pré-requisitos:**
- PostgreSQL instalado localmente
- Comando `psql` disponível no PATH
- Banco de dados `gestao_qualivida` criado

### **Opções:**

#### **1. Script Batch (Windows):**
```cmd
executar_scripts_windows.bat
```
- Menu interativo simples
- Detecta automaticamente PostgreSQL
- Ideal para usuários iniciantes

#### **2. Script PowerShell (Windows):**
```powershell
.\executar_scripts_windows.ps1
```
- Interface colorida avançada
- Configuração interativa
- Melhor tratamento de erros

#### **3. Comando Manual:**
```bash
psql -h localhost -U postgres -d gestao_qualivida -f ../correcao_boletos_sem_pdf.sql
```

## 📁 **Arquivos:**

- **`executar_scripts_windows.bat`** - Script batch automatizado
- **`executar_scripts_windows.ps1`** - Script PowerShell avançado
- **`config_boletos.json`** - Configurações de conexão

## ⚠️ **Importante:**

- Ajuste as credenciais no `config_boletos.json` se necessário
- Certifique-se que o PostgreSQL está rodando
- Use apenas para desenvolvimento/testes locais

## 🔄 **Para Produção (Supabase):**

Use os arquivos na pasta pai (`../`):
- `supabase_sql_editor_queries.sql`
- `GUIA_SUPABASE_BOLETOS.md`

---

**Para projetos Supabase, ignore esta pasta completamente.**