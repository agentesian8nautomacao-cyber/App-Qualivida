## Documentos LGPD (modelo)

Estes documentos são **modelos** para completar a adequação mínima de LGPD do sistema (Gestão Qualivida Residence). Ajuste os campos entre **[colchetes]** com os dados reais do condomínio/empresa antes de publicar.

### Conteúdo

- `Politica_de_Privacidade.md`: política de privacidade (titulares, dados, finalidades, bases legais, retenção, direitos, segurança).
- `Termos_de_Uso.md`: termos de uso do sistema (condições, responsabilidades, uso aceitável, limitações).
- `Agentes_de_Tratamento_e_Contato.md`: definição de **Controlador/Operador**, encarregado (se houver) e **canal de contato**.
- `Operacao_e_Seguranca.md`: backups automáticos, teste de restauração, monitoramento (Sentry) e logs administrativos.
- `Acesso_Administrativo_e_Auditoria.md`: processos de troca de síndico/admin, recuperação de conta e trilha mínima de auditoria.
- `Suporte_SLA_Incidentes_Manutencao.md`: SLA básico, procedimento de incidente e janela de manutenção.

### Observações rápidas de implementação (projeto)

- **Monitoramento**: o app inicializa Sentry quando `VITE_SENTRY_DSN` está configurado em `.env.local`.
- **Auditoria**: existe migração `migrations/008_admin_audit_logs.sql` e instrumentação em `services/dataService.ts` para registrar ações de boletos.

