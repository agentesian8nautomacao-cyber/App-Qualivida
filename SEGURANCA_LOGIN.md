# 🔐 Sistema de Segurança de Login

## ✅ Funcionalidades Implementadas

### 1. Limite de Tentativas de Login
- **5 tentativas** permitidas antes do bloqueio
- Contador de tentativas restantes exibido ao usuário
- Reset automático após login bem-sucedido

### 2. Bloqueio Temporário
- Bloqueio automático após **5 tentativas falhas**
- Duração: **15 minutos**
- Mensagem informando tempo restante
- Bloqueio baseado em username (localStorage)

### 3. Recuperação de Senha
- Geração de tokens seguros de 64 caracteres
- Tokens válidos por **24 horas**
- Interface completa de recuperação
- Validação de token antes de permitir redefinição
- Tokens são invalidados após uso

## 📋 Configuração

### Passo 1: Criar Tabela de Tokens no Supabase

Execute o script SQL no Supabase SQL Editor:

```bash
supabase_password_reset_tokens.sql
```

Este script cria:
- Tabela `password_reset_tokens` com campos necessários
- Índices para performance
- Políticas RLS (Row Level Security)
- Função para limpeza de tokens expirados

### Passo 2: Testar o Sistema

1. **Teste de Limite de Tentativas:**
   - Tente fazer login com senha errada 5 vezes
   - Você verá mensagens informando tentativas restantes
   - Após 5 tentativas, a conta será bloqueada por 15 minutos

2. **Teste de Recuperação de Senha:**
   - Clique em "Esqueci minha senha" na tela de login
   - Digite seu username ou email
   - O token será exibido no console (modo desenvolvimento)
   - Copie o token e cole na tela de redefinição
   - Defina nova senha

## 🔧 Como Funciona

### Rastreamento de Tentativas
- Armazenado em `localStorage` com chave `login_attempts_{username}`
- Estrutura:
  ```javascript
  {
    count: 5,
    blockedUntil: 1234567890,
    lastAttempt: 1234567890
  }
  ```

### Bloqueio Temporário
- Verificação automática antes de cada tentativa de login
- Cálculo do tempo restante em minutos
- Reset automático após expiração

### Tokens de Recuperação
- Gerados usando `crypto.getRandomValues()` (32 bytes = 64 caracteres hex)
- Armazenados no Supabase com:
  - `user_id`: ID do usuário
  - `token`: Token único
  - `expires_at`: Data de expiração (24h)
  - `used`: Boolean indicando se foi usado

### Segurança
- Tokens são únicos e não podem ser reutilizados
- Tokens expiram automaticamente após 24 horas
- Validação de senha mínima (6 caracteres)
- Hash SHA-256 para senhas
- Tentativas são resetadas após login bem-sucedido

## 📝 Notas de Desenvolvimento

### Modo Desenvolvimento vs Produção

**Desenvolvimento:**
- Tokens são exibidos no console do navegador
- Não há envio de email

**Produção (Recomendado):**
- Implementar serviço de email (SendGrid, AWS SES, etc.)
- Enviar token por email ao usuário
- Adicionar link direto no email para redefinição
- Remover logs de token do console

### Exemplo de Integração com Email

```typescript
// Em services/userAuth.ts, função generatePasswordResetToken
// Após criar o token no banco:

if (import.meta.env.PROD) {
  // Enviar email
  await sendPasswordResetEmail({
    to: user.email,
    token: token,
    username: user.username
  });
}
```

## 🚀 Próximas Melhorias (Opcional)

1. **Email de Recuperação:**
   - Integrar com serviço de email
   - Template HTML para email
   - Link direto para redefinição

2. **Auditoria:**
   - Registrar todas as tentativas de login
   - Histórico de redefinições de senha
   - Alertas para administradores

3. **Configurações Flexíveis:**
   - Permitir ajustar limite de tentativas
   - Configurar duração do bloqueio
   - Políticas de senha configuráveis

4. **Autenticação em Dois Fatores (2FA):**
   - SMS ou aplicativo autenticador
   - Backup codes

## 📊 Estrutura de Arquivos

```
├── components/
│   ├── Login.tsx                    # Componente de login atualizado
│   └── ForgotPassword.tsx           # Componente de recuperação
├── services/
│   └── userAuth.ts                  # Lógica de autenticação e segurança
└── supabase_password_reset_tokens.sql  # Script SQL para tabela
```

## ⚠️ Importante

- Execute `supabase_password_reset_tokens.sql` antes de usar recuperação de senha
- Configure variáveis de ambiente do Supabase corretamente
- Em produção, implemente envio de email
- Monitore tentativas de login para detectar ataques
