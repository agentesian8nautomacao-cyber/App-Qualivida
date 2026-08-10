# Identificação de Boletos Importados

## Campos de Identificação

A estrutura de boletos foi atualizada para incluir campos específicos que permitem identificar e gerenciar boletos que foram importados de sistemas externos.

### Campos Principais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | `string` | Identificador único do boleto no sistema |
| `resident_id` | `string` | ID do morador no sistema (referência para `residents.id`) |
| `unidade_id` | `string` | ID da unidade no sistema |
| `nosso_numero` | `string` | Nosso número do boleto (identificação bancária) |
| `vencimento` | `string` | Data de vencimento (`dueDate`) |
| `valor` | `number` | Valor do boleto (`amount`) |
| `referencia` | `string` | Mês de referência (`referenceMonth`) |
| `pdf_url` | `string` | URL para download do PDF (`pdfUrl`) |
| `status` | `'Pendente' \| 'Pago' \| 'Vencido'` | Status atual do boleto |

## Uso dos Campos de Identificação

### `resident_id`
- **Propósito**: Vincular o boleto diretamente ao morador no banco de dados
- **Uso**: Ao importar boletos, buscar o `resident_id` correspondente baseado no nome e unidade
- **Importância**: Permite relacionamentos consistentes e notificações precisas

### `unidade_id`
- **Propósito**: Identificar a unidade específica do boleto
- **Uso**: Ao importar, mapear a unidade do boleto para o ID da unidade no sistema
- **Importância**: Permite agrupamentos e filtros por unidade

### `nosso_numero`
- **Propósito**: Identificação única do boleto no sistema bancário
- **Uso**: Campo único que identifica o boleto na instituição financeira
- **Importância**: Evita duplicatas e permite conciliação bancária

## Processo de Importação

### 1. Mapeamento de Dados
```typescript
interface BoletoImportado {
  nosso_numero: string;
  morador_nome: string;
  unidade_codigo: string;
  vencimento: string;
  valor: number;
  referencia: string;
  pdf_url?: string;
}
```

### 2. Validação e Vinculação
```typescript
// 1. Buscar resident_id baseado no nome e unidade
const resident = residents.find(r =>
  r.name === boletoImportado.morador_nome &&
  r.unit === boletoImportado.unidade_codigo
);

// 2. Verificar se boleto já existe (pelo nosso_numero)
const boletoExistente = boletos.find(b =>
  b.nosso_numero === boletoImportado.nosso_numero
);

// 3. Criar boleto com identificação completa
const boleto: Boleto = {
  id: generateId(),
  resident_id: resident?.id,
  unidade_id: boletoImportado.unidade_id || resident?.unit, // ID da unidade no sistema
  nosso_numero: boletoImportado.nosso_numero,
  residentName: boletoImportado.morador_nome,
  unit: boletoImportado.unidade_codigo,
  referenceMonth: boletoImportado.referencia,
  dueDate: boletoImportado.vencimento,
  amount: boletoImportado.valor,
  pdfUrl: boletoImportado.pdf_url,
  status: 'Pendente',
  boletoType: 'condominio'
};
```

### 3. Exemplo de Uso no Modal de Importação
```typescript
// No ImportBoletosModal.tsx, os campos são populados automaticamente:
boletos.push({
  id: boleto.id!,
  residentName: resident.name,
  unit: resident.unit,
  referenceMonth: referenceMonth,
  dueDate: parsedDate.toISOString().split('T')[0],
  amount: amount,
  status: status,
  boletoType: boletoType,
  barcode: boleto.barcode,
  description: boleto.description,
  pdfUrl: pdfUrl || undefined,
  // Campos de identificação preenchidos automaticamente
  resident_id: resident.id, // ID do morador encontrado
  unidade_id: resident.unit, // Unidade como identificador
  nosso_numero: boleto.nosso_numero || boleto.id, // Nosso número ou ID como fallback
});
```

### 3. Verificações de Integridade
- **Duplicatas**: Verificar se `nosso_numero` já existe
- **Vinculação**: Garantir que `resident_id` e `unidade_id` existem
- **Consistência**: Validar que os dados do boleto batem com o morador/unidade

## Benefícios

### Para o Sistema
- **Rastreabilidade**: Cada boleto pode ser vinculado diretamente às entidades do sistema
- **Conciliação**: Possibilita conciliação automática com dados bancários
- **Integridade**: Evita inconsistências entre dados importados e sistema

### Para os Usuários
- **Precisão**: Notificações e associações corretas
- **Transparência**: Moradores veem apenas seus boletos
- **Confiabilidade**: Sistema confiável para gestão financeira

## Script de Migração

Execute o script `scripts/add_boletos_identification_fields.sql` para adicionar os novos campos à tabela existente:

```sql
-- Adiciona unidade_id e nosso_numero à tabela boletos
-- Cria índices para performance
-- Atualiza comentários para documentação
```

## Considerações Técnicas

- Campos `resident_id`, `unidade_id` e `nosso_numero` são opcionais para manter compatibilidade
- `nosso_numero` deve ser único quando preenchido
- Índices foram criados para otimizar consultas por esses campos
- RLS (Row Level Security) permite controle de acesso granular