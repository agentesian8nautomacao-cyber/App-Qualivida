## Visão Geral de Funcionalidades

- **Dashboard**
  - Visão diferente por perfil (morador, porteiro, síndico/admin).
  - Cards de resumo (avisos, boletos, reservas, encomendas).
  - Atalhos para áreas principais.

- **Moradores**
  - Cadastro/edição/exclusão de moradores.
  - Importação em massa.
  - Visualização de dados de contato, unidade, veículos e extras.

- **Funcionários**
  - Cadastro de staff (porteiros, apoio, etc.).
  - Controle de cargo/turno/status.
  - Importação em massa.

- **Visitantes**
  - Registro de visitantes pela portaria.
  - Confirmação de entrada/saída.
  - Histórico e permanência.

- **Ocorrências**
  - Abertura de ocorrência pelo morador.
  - Acompanhamento, respostas e marcação como resolvida pelo síndico/admin.
  - Exclusão apenas quando resolvida.

- **Reservas**
  - Gestão de áreas comuns (salão, gourmet, etc.).
  - Morador agenda horário pela UI própria.
  - Portaria/admin confirmam/check-in/check-out.
  - Valor da área por tipo (afeta boleto).

- **Encomendas**
  - Registro de encomendas na portaria.
  - Notificação para o morador.
  - Morador visualiza e pode ocultar após retirada.

- **Mural de Avisos**
  - Criação/edição/exclusão de avisos pela portaria/síndico.
  - Mural digital para moradores com confirmação de leitura.
  - Morador pode dispensar aviso (não volta após refresh no mesmo dispositivo).

- **Financeiro / Boletos**
  - Importação e listagem de boletos.
  - Integração com PDF original.
  - Filtros e visão por perfil.

- **Sentinela AI**
  - Acesso condicionado à permissão `sentinela.view`.
  - Funcionalidades de assistência/IA específicas (chat, planos, etc.).

- **Configurações**
  - Nome do condomínio, tema, WhatsApp, templates.
  - Gestão de usuários admin.
  - Página de configurações diferente para morador/porteiro vs. admin.
  - Backup em PDF com dados básicos.

- **Permissões (RBAC)**
  - Perfis: morador, porteiro, cabo_turma, administradora, síndico.
  - Permissões granulares `pagina.acao` (ex.: `residents.view`, `occurrences.create`).
  - Matriz por página com modal para configurar acesso por perfil.
  - Integração com Sidebar, rotas e botões (view/create/update/delete).

- **Notificações (Sino)**
  - Notificações de ocorrências e mural para o morador.
  - Dropdown com lista de notificações, marcar como lida e excluir.

- **Offline / Sincronização**
  - Leitura e cache offline-first em várias tabelas.
  - Outbox para sincronizar operações quando a conexão volta.

---

## Checklist de Testes (Alta Nível)

### 1. Autenticação e Perfis
- [ ] Login como **morador** carrega dashboard correto e menu restrito.
- [ ] Login como **porteiro** carrega dashboard e funcionalidades de portaria.
- [ ] Login como **síndico/administradora/admin** carrega visão administrativa.
- [ ] Troca de usuário limpa permissões e dados sensíveis.

### 2. RBAC / Permissões
- [ ] Página **Permissões** só é acessível por síndico/administradora/admin.
- [ ] Matriz lista exatamente as 10 páginas principais.
- [ ] Modal por página abre e mostra colunas `.view/.create/.update/.delete`.
- [ ] Desmarcar `.view` remove item do menu e bloqueia rota com tela de acesso restrito.
- [ ] Desmarcar `.create` esconde botões/ações de criação na página.
- [ ] Desmarcar `.update` desabilita botões de edição.
- [ ] Desmarcar `.delete` desabilita botões de exclusão.
- [ ] Alterações são persistidas em `role_permissions` (Supabase) e respeitadas após relogar.

### 3. Dashboard
- [ ] Morador vê saudação com **nome completo** e resumo (avisos, boletos, reservas, encomendas).
- [ ] Porteiro vê visão operacional (encomendas, visitantes, ocorrências abertas).
- [ ] Síndico/admin vê visão gerencial (gráficos, atalhos).
- [ ] Ao remover `dashboard.view` do perfil, o menu e a rota são bloqueados.

### 4. Moradores
- [ ] Criar morador com dados básicos e extras.
- [ ] Editar morador existente.
- [ ] Excluir morador com confirmação.
- [ ] Importar moradores por planilha (quando disponível).
- [ ] Permissões `residents.view/create/update/delete` funcionam conforme esperado.

### 5. Funcionários
- [ ] Criar/editar/excluir funcionário.
- [ ] Importar funcionários (se habilitado).
- [ ] Permissões `staff.view/create/update/delete` respeitadas.

### 6. Visitantes
- [ ] Registrar visitante para uma unidade.
- [ ] Confirmar entrada pela portaria.
- [ ] Finalizar/registrar saída.
- [ ] Permanência é calculada corretamente.
- [ ] Morador vê visitantes apenas da própria unidade (quando aplicável).

### 7. Ocorrências
- [ ] Morador abre ocorrência, preenche descrição e anexa imagem (se disponível).
- [ ] Ocorrência aparece para síndico/admin/porteiro.
- [ ] Síndico/admin responde e marca como **resolvida**.
- [ ] Morador só consegue excluir ocorrências **resolvidas**.
- [ ] Permissões `occurrences.view/create/update/delete/resolve` funcionam.

### 8. Reservas
- [ ] Morador agenda reserva de área, definindo data e horário.
- [ ] Portaria/admin visualiza reservas do dia.
- [ ] Botões de check-in/check-out funcionam.
- [ ] Portaria/admin consegue excluir reservas quando tem `reservations.delete`.
- [ ] Valores das áreas aparecem corretamente nos cards.
- [ ] Apenas perfis com `settings.update` (e não morador) conseguem editar valores.

### 9. Encomendas
- [ ] Portaria registra nova encomenda para morador.
- [ ] Morador recebe visualização da encomenda pendente.
- [ ] Morador pode ocultar encomenda após retirada, sem apagar registro global.
- [ ] Permissões `packages.view/create/update/delete` funcionam.

### 10. Mural de Avisos
- [ ] Síndico/portaria cria aviso no mural (com/sem imagem).
- [ ] Morador vê aviso no **Mural de Avisos**.
- [ ] Botão **Confirmar leitura** marca aviso como lido.
- [ ] Botão de **fechar/dispensar** some o aviso da interface do morador.
- [ ] Ao recarregar / relogar **no mesmo dispositivo**, avisos dispensados **não** reaparecem.
- [ ] Novos avisos geram notificação no sino para moradores.

### 11. Financeiro / Boletos
- [ ] Importar boletos (ou cadastrar via integração existente).
- [ ] Morador vê apenas boletos da própria unidade.
- [ ] PDF original abre corretamente (quando configurado).
- [ ] Permissões `boletos.view/create/update/delete/download` são respeitadas.

### 12. Sentinela AI
- [ ] Menu Sentinela AI só aparece com `sentinela.view`.
- [ ] Fluxos principais (chat, planos, relatórios) funcionam sem erro.

### 13. Configurações
- [ ] Síndico/admin consegue alterar nome do condomínio, WhatsApp, tema e templates.
- [ ] Morador e porteiro veem **página de configurações simplificada** (não a administrativa).
- [ ] Backup em PDF é gerado com as seções esperadas (moradores, staff, reservas, etc.).
- [ ] Permissões `settings.view` e `settings.update` funcionam para controlar acesso/edição.

### 14. Notificações (Sino)
- [ ] Morador recebe notificações de:
  - [ ] Respostas/atualizações em ocorrências.
  - [ ] Novos avisos do mural.
- [ ] Sino mostra contador de não lidos correto.
- [ ] Ao clicar em uma notificação, usuário é levado para a página certa e a notificação é marcada como lida.
- [ ] Morador consegue excluir notificações individuais (quando permitido).

### 15. Offline / Sincronização
- [ ] Listagens principais funcionam mesmo sem conexão (dados em cache).
- [ ] Ao voltar a conexão, operações pendentes (outbox) são sincronizadas.
- [ ] Mensagens claras de “sem conexão” e “sincronizando dados” aparecem no topo.

