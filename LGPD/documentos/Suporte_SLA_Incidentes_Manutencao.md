## Suporte: SLA básico, incidentes e janela de manutenção

**Última atualização:** [AAAA-MM-DD]  
**Versão:** 1.0

Este documento define um SLA simples e um procedimento mínimo para incidentes e manutenções do Sistema.

### 1) Canais de suporte

- **Canal principal**: [E-MAIL / WHATSAPP / PORTAL]  
- **Horário**: [ex.: Seg–Sex, 9h–18h]  
- **Canal de emergência (opcional)**: [telefone]  

### 2) Classificação de severidade

- **Sev 1 (Crítico)**: sistema indisponível para todos; falha em login geral; perda/risco de perda de dados; incidente de segurança confirmado.
- **Sev 2 (Alto)**: indisponibilidade parcial; erro que impede um módulo crítico (ex.: boletos) para vários usuários.
- **Sev 3 (Médio/Baixo)**: defeito com contorno; problemas visuais; solicitações e dúvidas.

### 3) SLA básico (exemplo)

> Ajuste conforme contrato/realidade do time.

- **Sev 1**
  - **Primeira resposta**: até **2 horas** (horário comercial) / **[X]** fora do horário (se houver plantão)
  - **Atualizações**: a cada **4 horas** enquanto o incidente estiver ativo
- **Sev 2**
  - **Primeira resposta**: até **8 horas úteis**
  - **Correção/mitigação**: até **[2 dias úteis]** (meta)
- **Sev 3**
  - **Primeira resposta**: até **2 dias úteis**
  - **Tratativa**: backlog planejado

### 4) Procedimento de incidente

Passos mínimos:

- **Detecção/abertura**
  - registrar data/hora, descrição, evidências (prints/logs), impacto e severidade
- **Contenção**
  - aplicar mitigação (ex.: rollback, desabilitar funcionalidade, bloquear ação)
- **Investigação**
  - usar monitoramento de erros (ex.: Sentry) e logs administrativos para correlacionar eventos
- **Comunicação**
  - informar síndico/admin (e, se necessário, moradores) sobre status e impacto
- **Recuperação**
  - validar retorno do serviço e integridade dos dados
- **Pós-incidente**
  - relatório com causa raiz, ações corretivas e preventivas

Se o incidente envolver dados pessoais relevantes, seguir governança LGPD e avaliar comunicação à ANPD e aos titulares conforme orientação jurídica.

### 5) Janela de manutenção

- **Janela preferencial**: [ex.: domingos 22h–02h]  
- **Aviso prévio**: [ex.: 48h] para manutenção programada (exceto emergências)
- **Manutenção emergencial**: pode ocorrer sem aviso prévio para mitigar risco crítico

