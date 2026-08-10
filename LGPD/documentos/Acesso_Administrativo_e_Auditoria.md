## Acesso administrativo: troca de síndico/admin, recuperação de conta e auditoria mínima

**Última atualização:** [AAAA-MM-DD]  
**Versão:** 1.0

Este documento define processos operacionais para manter controle de acesso e rastreabilidade em módulos sensíveis (especialmente **financeiro/boletos**).

### 1) Perfis e princípio do menor privilégio

- Conceder acesso **somente** para quem precisa (porteiro vs síndico vs outros perfis).
- Revisar acessos em **[periodicidade]** (ex.: trimestral).
- Proibir contas compartilhadas (cada pessoa com credencial própria).

### 2) Processo para troca de síndico/admin (onboarding/offboarding)

Quando houver mudança de síndico(a) ou administrador(a):

- **Preparação**
  - Identificar contas administrativas ativas (síndico/admin).
  - Definir a data/hora de corte.
- **Criação/ativação do novo responsável**
  - Criar/ativar conta do novo síndico/admin com e-mail/telefone atualizados.
  - Exigir definição de senha forte na primeira entrada (não usar senha padrão por período longo).
- **Revogação do responsável anterior**
  - Desativar a conta anterior (marcar `is_active=false` quando aplicável).
  - Invalidar sessões (logout) e revogar acessos a painéis externos (ex.: Sentry, Vercel, Supabase).
- **Rotação de segredos e acessos**
  - Revisar chaves/integrações (SMTP, tokens, acessos de infraestrutura).
  - Alterar senhas de caixas de e-mail usadas em recuperação.
- **Registro**
  - Registrar a troca no livro/ata interna e manter evidências (data, responsável, contas afetadas).

### 3) Recuperação de conta (admin)

Objetivo: recuperar acesso com segurança sem “abrir brecha” de engenharia social.

Fluxo mínimo recomendado:

- **Solicitação**: feita pelo canal definido em `Agentes_de_Tratamento_e_Contato.md`.
- **Verificação**:
  - confirmar vínculo com o condomínio (ata, procuração, documento interno);
  - confirmar dados cadastrais (e-mail/telefone) por um segundo fator (ex.: confirmação em canal alternativo).
- **Ação**:
  - iniciar recuperação via e-mail (link de reset) **ou** reset assistido com troca obrigatória no primeiro login;
  - invalidar sessões ativas após reset.
- **Registro**:
  - guardar evidência mínima (data/hora, solicitante, aprovador e resultado).

### 4) Trilha mínima de auditoria (quem fez o quê)

Requisitos mínimos para módulos sensíveis (financeiro/boletos):

- Registrar **criação**, **atualização**, **exclusão** e ações críticas (ex.: upload do PDF original).
- Registrar: **ator**, **ação**, **objeto**, **data/hora** e **contexto**.
- Restringir leitura dos logs a perfis administrativos.

Implementação no projeto:

- Tabela `admin_audit_logs` (ver `migrations/008_admin_audit_logs.sql`).
- Registro automático em ações de boletos no `services/dataService.ts`.

### 5) Auditoria operacional (procedimento)

Quando houver questionamento/controvérsia (ex.: “boleto foi marcado como pago indevidamente”):

- Extrair logs do período (ex.: últimos 30 dias).
- Correlacionar com registros do boleto (ID, unidade, competência, valores).
- Identificar ator (user/role) e horário do evento.
- Se necessário, abrir incidente e aplicar ações corretivas (ver `Suporte_SLA_Incidentes_Manutencao.md`).

