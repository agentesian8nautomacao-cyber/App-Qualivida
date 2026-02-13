# 🚀 **INSTRUÇÕES RÁPIDAS - Correção de Boletos PDF (Supabase)**

## ⚡ **Problema Resolvido**
Moradores não conseguiam baixar boletos porque os PDFs não estavam anexados.

## ✅ **Solução Implementada**
Sistema agora importa boletos com PDFs automaticamente + scripts de correção para Supabase.

---

## 🎯 **EXECUÇÃO NO SUPABASE (Método Recomendado)**

### **Passo 1: Acessar SQL Editor**
1. Vá para: https://supabase.com/dashboard
2. Selecione seu projeto
3. Clique em "SQL Editor" → "New Query"

### **Passo 2: Executar Diagnóstico**
Abra o arquivo `scripts/supabase_sql_editor_queries.sql` e execute:

#### **Query 1.1 - Contagem Geral:**
```sql
SELECT
    'BOLETOS SEM PDF - NECESSITAM CORREÇÃO' as status,
    COUNT(*) as total_boletos_sem_pdf,
    COUNT(CASE WHEN status = 'Pago' THEN 1 END) as pagos_sem_pdf,
    COUNT(CASE WHEN status = 'Pendente' THEN 1 END) as pendentes_sem_pdf,
    COUNT(CASE WHEN status = 'Vencido' THEN 1 END) as vencidos_sem_pdf
FROM public.boletos
WHERE pdf_original_path IS NULL AND pdf_url IS NULL;
```

#### **Query 1.2 - Lista Detalhada (TOP 20):**
```sql
SELECT
    id,
    unit,
    resident_name,
    reference_month,
    due_date,
    amount,
    status,
    CASE
        WHEN status = 'Pago' THEN '🔴 CRÍTICO'
        WHEN status = 'Vencido' THEN '🟠 IMPORTANTE'
        WHEN status = 'Pendente' THEN '🟡 NORMAL'
    END as prioridade_correcao
FROM public.boletos
WHERE pdf_original_path IS NULL AND pdf_url IS NULL
ORDER BY
    CASE status
        WHEN 'Pago' THEN 1
        WHEN 'Vencido' THEN 2
        WHEN 'Pendente' THEN 3
    END,
    due_date DESC
LIMIT 20;
```

### **Passo 3: Corrigir Boletos**
Para cada boleto sem PDF identificado:

1. **Logar como Administrador** no sistema
2. **Ir para Financeiro → Boletos**
3. **Localizar boleto** (usar ID da query)
4. **Clicar botão "Anexar PDF"**
5. **Selecionar arquivo PDF**
6. **Confirmar upload**

---

## 🎯 **EXECUÇÃO LOCAL (Desenvolvimento)**

### **Scripts Windows (se usar PostgreSQL local):**
```cmd
# Script Batch:
scripts\executar_scripts_windows.bat

# OU PowerShell:
.\scripts\executar_scripts_windows.ps1
```

---

## 🔧 **EXECUÇÃO MANUAL (se necessário)**

### **Se PostgreSQL estiver no PATH:**
```powershell
# Diagnóstico
psql -h localhost -U postgres -d gestao_qualivida -f scripts/correcao_boletos_sem_pdf.sql

# Validação
psql -h localhost -U postgres -d gestao_qualivida -f scripts/validacao_importacao_boletos_com_pdf.sql
```

### **Se PostgreSQL NÃO estiver no PATH:**
```powershell
# Ajuste o caminho conforme sua instalação
& "C:\Program Files\PostgreSQL\15\bin\psql.exe" -h localhost -U postgres -d gestao_qualivida -f scripts/correcao_boletos_sem_pdf.sql
```

---

## 📊 **O QUE OS SCRIPTS FAZEM**

### **Script 1 - Diagnóstico:**
- ✅ Conta boletos sem PDF
- ✅ Lista quais precisam de correção
- ✅ Mostra estatísticas por status

### **Script 2 - Validação:**
- ✅ Verifica importações recentes
- ✅ Calcula % de sucesso
- ✅ Gera relatório final

---

## 🔨 **CORREÇÃO MANUAL VIA INTERFACE**

Após executar diagnóstico:

1. **Logar como Administrador** (Síndico/Porteiro)
2. **Ir para: Financeiro → Boletos**
3. **Encontrar boleto sem PDF**
4. **Clicar botão laranja "Anexar PDF"**
5. **Selecionar arquivo PDF**
6. **Confirmar upload**

---

## 🎯 **RESULTADO ESPERADO**

**Antes:** ❌ Boletos visíveis mas sem download
**Depois:** ✅ Moradores podem baixar todos os PDFs

---

## ❓ **PROBLEMAS COMUNS**

### **"psql não encontrado"**
```cmd
# Execute diagnóstico automático:
scripts\executar_scripts_windows.bat
# Escolha opção [4]
```

### **"Banco não existe"**
- Verifique nome do banco: `gestao_qualivida`
- Ou ajuste no comando: `-d nome_correto_do_banco`

### **"Erro de permissão"**
- Verifique usuário/senha
- Use: `-U nome_do_usuario`

---

## 📞 **SUPORTE**
1. Execute primeiro o diagnóstico
2. Verifique resultados
3. Corrija via interface web
4. Execute validação final

**Precisa de ajuda?** Verifique o arquivo `SCRIPTS_BOLETOS_README.md` para instruções completas.

---
**⚡ Versão Rápida - Fevereiro 2026**