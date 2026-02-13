# 🗄️ **Guia Completo: Correção de Boletos PDF no Supabase**

## 📋 **Visão Geral**

Este guia explica como diagnosticar e corrigir boletos que não têm PDFs anexados usando o **SQL Editor do Supabase**.

## 🎯 **Passo a Passo Completo**

### **1. Acessar o Supabase**
1. Vá para: https://supabase.com/dashboard
2. Faça login na sua conta
3. Selecione o projeto da **Gestão Qualivida Residence**

### **2. Abrir SQL Editor**
1. No menu lateral esquerdo, clique em **"SQL Editor"**
2. Clique no botão **"New Query"** (canto superior direito)

### **3. Executar Diagnóstico Inicial**

#### **Query 1: Contagem Geral**
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

**Resultado esperado:**
- Mostra quantos boletos não têm PDF
- Prioriza por status (Pago > Vencido > Pendente)

#### **Query 2: Lista Detalhada (TOP 20)**
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
        WHEN status = 'Pago' THEN '🔴 CRÍTICO - Morador pagou mas não consegue baixar'
        WHEN status = 'Vencido' THEN '🟠 IMPORTANTE - Morador precisa baixar para pagar'
        WHEN status = 'Pendente' THEN '🟡 NORMAL - Ainda pode ser corrigido'
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

**Resultado esperado:**
- Lista os 20 boletos mais prioritários
- Mostra ID, unidade, morador, valor, etc.
- Indica nível de prioridade

### **4. Analisar Resultados**

#### **Cenários Possíveis:**

**✅ Nenhum boleto sem PDF:**
- Todas as importações futuras terão PDFs
- Problema resolvido!

**⚠️ Alguns boletos sem PDF:**
- Corrigir os identificados
- Melhorar processo de importação

**❌ Muitos boletos sem PDF:**
- Revisar processo de importação
- Corrigir todos os boletos identificados

### **5. Correção Manual via Interface Web**

Para cada boleto identificado na query 2:

1. **Abrir o Sistema:**
   - Acesse a aplicação web
   - Faça login como **Síndico** ou **Porteiro**

2. **Ir para Boletos:**
   - Menu → **Financeiro** → **Boletos**

3. **Localizar Boleto:**
   - Use **ID** do boleto (da query SQL)
   - Ou pesquise por **unidade** + **mês de referência**

4. **Anexar PDF:**
   - Clique no botão laranja **"Anexar PDF"**
   - Selecione o arquivo PDF correspondente
   - Confirme o upload

5. **Verificar:**
   - O botão agora deve mostrar **"Download"**
   - Morador poderá baixar o PDF

### **6. Validação Pós-Correção**

#### **Query 3: Verificar Correção Específica**
```sql
SELECT
    id,
    unit,
    resident_name,
    reference_month,
    CASE
        WHEN pdf_original_path IS NOT NULL THEN '✅ PDF ANEXADO'
        WHEN pdf_url IS NOT NULL THEN '⚠️ PDF LEGADO'
        ELSE '❌ AINDA SEM PDF'
    END as status_correcao
FROM public.boletos
WHERE id = 'COLE_O_ID_AQUI';
```

**Como usar:**
- Substitua `'COLE_O_ID_AQUI'` pelo ID do boleto corrigido
- Execute a query
- Deve mostrar "✅ PDF ANEXADO"

#### **Query 4: Relatório Geral Atualizado**
```sql
WITH relatorio_correcao AS (
    SELECT
        (SELECT COUNT(*) FROM public.boletos WHERE pdf_original_path IS NULL AND pdf_url IS NULL) as boletos_ainda_sem_pdf,
        (SELECT COUNT(*) FROM public.boletos WHERE pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL) as boletos_com_pdf,
        (SELECT COUNT(*) FROM public.boletos) as total_boletos
)
SELECT
    'RELATÓRIO FINAL DE CORREÇÃO' as titulo,
    total_boletos,
    boletos_com_pdf,
    boletos_ainda_sem_pdf,
    ROUND(boletos_com_pdf::decimal / NULLIF(total_boletos, 0)::decimal * 100, 1) as cobertura_atual,
    CASE
        WHEN boletos_ainda_sem_pdf = 0 THEN '🎉 SUCESSO TOTAL: 100% dos boletos têm PDF!'
        WHEN boletos_com_pdf::decimal / total_boletos >= 0.95 THEN '✅ EXCELENTE: Cobertura superior a 95%'
        WHEN boletos_com_pdf::decimal / total_boletos >= 0.80 THEN '⚠️ BOM: Cobertura superior a 80%'
        ELSE '❌ PREOCUPANTE: Cobertura abaixo de 80%'
    END as avaliacao_final
FROM relatorio_correcao;
```

### **7. Monitoramento Contínuo**

#### **Query 5: Dashboard de Monitoramento**
```sql
SELECT
    'MONITORAMENTO PDF BOLETOS' as dashboard,
    (SELECT COUNT(*) FROM public.boletos) as total_boletos,
    (SELECT COUNT(*) FROM public.boletos WHERE pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL) as boletos_com_pdf,
    (SELECT COUNT(*) FROM public.boletos WHERE pdf_original_path IS NULL AND pdf_url IS NULL) as boletos_sem_pdf,
    ROUND(
        (SELECT COUNT(*) FROM public.boletos WHERE pdf_original_path IS NOT NULL OR pdf_url IS NOT NULL)::decimal /
        NULLIF((SELECT COUNT(*) FROM public.boletos), 0)::decimal * 100, 1
    ) as percentual_cobertura_pdf,
    (SELECT COUNT(*) FROM public.residents) as total_moradores,
    (SELECT COUNT(DISTINCT unit) FROM public.boletos WHERE pdf_original_path IS NULL AND pdf_url IS NULL) as unidades_afetadas
FROM (SELECT 1) as dummy;
```

**Execute esta query periodicamente para:**
- Acompanhar cobertura geral
- Identificar novas importações sem PDF
- Garantir manutenção do padrão

## 📊 **Interpretando os Resultados**

### **Colunas Importantes:**
- **`id`**: Identificador único do boleto
- **`unit`**: Unidade do morador (ex: "03/005")
- **`resident_name`**: Nome do morador
- **`reference_month`**: Mês de referência (ex: "12/2025")
- **`status`**: Situação do boleto
- **`prioridade_correcao`**: Nível de urgência

### **Status dos PDFs:**
- **✅ PDF ANEXADO**: Correção bem-sucedida
- **⚠️ PDF LEGADO**: Sistema antigo (funciona, mas não ideal)
- **❌ SEM PDF**: Necessita correção urgente

## 🎯 **Dicas de Eficiência**

### **Correção em Massa:**
1. Execute a query de diagnóstico
2. Anote os IDs dos boletos prioritários
3. Prepare os PDFs correspondentes
4. Corrija em lotes por unidade

### **Organização dos PDFs:**
- Nomeie os arquivos como: `Unidade_Mes_Ano.pdf`
- Exemplo: `03_005_12_2025.pdf`
- Mantenha em pasta organizada por mês

### **Validação Final:**
- Execute relatório geral após correções
- Verifique se cobertura chegou a 100%
- Teste download real com usuário morador

## ❓ **Problemas Comuns e Soluções**

### **Query não retorna resultados:**
```sql
-- Verificar se tabela existe
SELECT COUNT(*) FROM public.boletos;

-- Verificar estrutura da tabela
SELECT * FROM public.boletos LIMIT 1;
```

### **Erro de permissão:**
- Use apenas o SQL Editor com usuário administrador
- Evite modificar dados diretamente via SQL

### **Boletos não aparecem na interface:**
- Verifique se o boleto pertence ao usuário logado
- Moradores só veem boletos da própria unidade

## 📞 **Suporte**

Para dúvidas específicas:
1. Execute as queries na ordem sugerida
2. Anote os resultados obtidos
3. Descreva o problema encontrado
4. Compartilhe screenshots se possível

---

**🎉 Sucesso garantido seguindo este guia passo a passo!**