## Operação e Segurança (mínimo recomendado)

**Última atualização:** [AAAA-MM-DD]  
**Versão:** 1.0

Este documento descreve práticas operacionais mínimas: **backups**, **teste de restauração**, **monitoramento de erros (Sentry)** e **logs de ações administrativas**.

### 1) Backups automáticos

Definição mínima:

- **Escopo**: banco de dados (Postgres/Supabase), objetos de storage (ex.: PDFs de boletos) e variáveis de configuração (sem segredos em texto plano).
- **Frequência**: diário (recomendado) + retenção de **[X dias]** (ex.: 30/60/90).
- **Proteção**: backups criptografados em repouso e com acesso restrito (menor privilégio).
- **Rotação**: manter ao menos 1 cópia semanal e 1 mensal (opcional, mas recomendado).

Observação Supabase:

- Se o projeto usa **Supabase Cloud**, habilitar e acompanhar a política de backups do plano contratado.
- Se **self-hosted**, automatizar via `pg_dump`/snapshots e rotinas de storage.

### 2) Teste de restauração (pelo menos 1x)

Objetivo: garantir que o backup “restaura de verdade”.

- **Periodicidade**: pelo menos **1 teste inicial** (obrigatório) e depois **[trimestral/semestral]**.
- **Ambiente**: restaurar em um banco separado (staging), nunca em produção.
- **Critérios de sucesso**:
  - restauração completa do banco;
  - validação de tabelas críticas (ex.: `boletos`, `residents`, `packages`);
  - validação de acesso (login) e de algumas rotinas (ex.: listar boletos, criar/atualizar boleto em staging);
  - registro do teste (data, responsável, evidências).

### 3) Monitoramento de erros (ex.: Sentry)

Recomendação: usar Sentry (ou equivalente) para capturar erros de frontend e regressões.

- **Implementado no projeto**: o app inicializa Sentry no bootstrap (`index.tsx`) quando `VITE_SENTRY_DSN` estiver configurado.
- **Configuração**:
  - Definir `VITE_SENTRY_DSN` em `.env.local` (não versionar).
  - Ajustar ambiente (`development`/`production`) e amostragem de performance conforme necessidade.
- **Boas práticas**:
  - não enviar dados sensíveis em eventos (evitar incluir CPF/telefone em mensagens/metadata);
  - restringir acesso ao painel do Sentry;
  - configurar alertas de erro (ex.: spikes de erro, releases com regressão).

### 4) Logs de ações administrativas (auditoria mínima)

Objetivo: registrar “quem fez o quê” em módulos sensíveis (financeiro/boletos), para investigação e governança.

#### 4.1 O que registrar (mínimo)

- **Ator**: `actor_user_id` (Auth), `actor_role`, `actor_username`.
- **Ação**: criar/atualizar/excluir (e ações específicas, como upload do PDF original).
- **Objeto**: tipo (ex.: `boletos`) e identificador (`entity_id`).
- **Contexto**: data/hora, rota do app, metadados técnicos (user-agent) e metadados do evento (ex.: unidade/competência/valor).

#### 4.2 Implementação no projeto

- **Tabela**: `public.admin_audit_logs` (migração `migrations/008_admin_audit_logs.sql`).
- **Instrumentação**: `services/dataService.ts` registra auditoria em:
  - criação/atualização/exclusão de boletos;
  - upload do PDF original do boleto.

#### 4.3 Retenção e acesso

- **Retenção sugerida**: **[12 meses]** (ajustar conforme política interna e necessidade de auditoria).
- **Acesso**: restrito a perfis administrativos.

### 5) Revisões e responsabilidade

- **Responsável operacional**: [NOME / FUNÇÃO]  
- **Periodicidade de revisão deste documento**: [anual/semestral]

