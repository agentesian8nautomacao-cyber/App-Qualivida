### Documento de Requisitos do Produto (PRD) — QualiVida Residence
### Objetivo: orientar o TestSprite a encontrar erros

#### 1) Resumo do produto
O QualiVida Residence é uma aplicação web (Vite + React) para gestão de rotinas de condomínio.
Existem perfis com permissões diferentes:
- Portaria (Porteiro)
- Síndico (Admin)
- Morador

Principais módulos (abas/telas):
- Dashboard (varia por role)
- Encomendas (Packages)
- Visitantes (inclui “visitante esperado” e pré-cadastro do morador)
- Ocorrências
- Avisos/Comunicados
- Reservas de áreas
- Moradores
- Funcionários
- Boletos e Financeiro
- Notificações
- Configurações
- Módulo “Sentinela” (IA: chat + conversa ao vivo + settings), embutido no app

#### 2) Ambiente e execução (para testes automatizados)
- Comando principal: `npm run dev`
- Porta padrão de dev: 3008 (`http://localhost:3008/`)
- A aplicação usa Supabase para autenticação/dados e pode usar Realtime para sincronização.

Variáveis/integrações (podem afetar testes):
- Supabase (URL/keys no projeto; se estiver como placeholder, alguns fluxos podem falhar)
- WhatsApp (há envio/abertura de WhatsApp em alguns fluxos; em teste E2E deve ser mockado/ignorado)
- Upload/download de PDF de boletos (pode depender de storage/URL)

#### 3) Personas e permissões (requisitos de acesso)

##### 3.1 Porteiro (Portaria)
Pode:
- Registrar e gerenciar encomendas (inclui marcar como recebida, excluir, importar)
- Registrar e gerenciar visitantes, confirmar visitante esperado
- Registrar ocorrências
- Ver dashboard de portaria
- Gerenciar moradores (dependendo das regras do app)
- Gerenciar funcionários (se permitido)
- Ver/gerenciar avisos e reservas (se permitido)

Não deve:
- Acessar telas restritas do Síndico, se existirem (ex.: financeiro/admin avançado), quando aplicável.

##### 3.2 Síndico (Admin)
Pode:
- Gerenciar avisos/comunicados
- Ver dashboards/relatórios de síndico
- Financeiro/Boletos (se aplicável)
- Configurações administrativas

Não deve:
- Acessar o módulo de Encomendas (regra crítica: “Encomendas é fluxo exclusivo da Portaria”).

Critério de aceite:
- Se o Síndico tentar abrir “Encomendas”, o app deve bloquear e exibir mensagem coerente (sem loop/redirect infinito).

##### 3.3 Morador
Pode:
- Fazer login como morador
- Ver seus boletos (e baixar PDF quando disponível)
- Ver notificações
- Pré-cadastrar visitante esperado
- Ver sua dashboard

Pode parcialmente:
- Encomendas: morador só vê/baixa/oculta encomendas da sua unidade/conta.

Não deve:
- Ver dados de outros moradores/unidades
- Dar baixa/excluir encomenda de outra unidade/conta

Critério de aceite:
- Qualquer tentativa deve ser bloqueada com mensagem clara.

#### 4) Requisitos funcionais por módulo (o que deve funcionar)

##### 4.1 Login e sessão
Requisitos:
- Permitir login e manter sessão durante navegação.
- Troca de role (quando aplicável) não deve “vazar” permissões.
- Fluxos de “primeiro login”/troca de senha (se presentes) não devem travar UI.

Erros a caçar:
- Loop de autenticação
- Sessão expira e UI quebra (tela branca / erro no console)
- Role incorreto após refresh

##### 4.2 Dashboard
Requisitos:
- Carregar dados essenciais sem travar.
- Para Morador, dashboard deve refletir boletos/notificações atualizados.

Erros a caçar:
- Cards inconsistentes com badges/contagens
- Tela vazia após refresh

##### 4.3 Encomendas (Packages)
Requisitos:
- Portaria consegue criar encomenda associada a um morador/unidade.
- Marcar encomenda como recebida funciona.
- Excluir encomenda (Portaria) funciona.
- Morador:
  - Só acessa encomendas da sua unidade/conta.
  - “Apagar” para morador deve apenas ocultar (soft delete), não remover globalmente.
- Síndico não pode acessar este módulo (regra crítica).

Erros a caçar:
- Síndico conseguindo entrar por link direto/atalho
- Morador vendo/encontrando encomenda de outro morador
- Erro ao salvar encomenda não exibido (falha silenciosa)
- Confirmações (confirm dialogs) não aparecem/duplicam

##### 4.4 Visitantes
Requisitos:
- Portaria cria/edita visitante.
- Existe fluxo de “visitante esperado” (confirmar chegada).
- Morador consegue pré-cadastrar visitante esperado (se habilitado).

Erros a caçar:
- Duplicidade de visitante esperado
- Portaria não consegue confirmar
- Morador consegue ver visitantes de outras unidades

##### 4.5 Ocorrências
Requisitos:
- Criar ocorrência
- Resolver ocorrência
- Excluir apenas quando resolvida (regra mencionada no app)

Erros a caçar:
- Excluir ocorrência não resolvida
- Resolver não atualiza lista/estado

##### 4.6 Avisos/Comunicados
Requisitos:
- Criar/editar/excluir aviso (roles conforme política do condomínio)
- Listagem estável e consistente

Erros a caçar:
- Perda de formatação
- Aviso some após refresh (problema de persistência/cache)

##### 4.7 Reservas de áreas
Requisitos:
- Listar áreas
- Criar reserva e atualizar
- Regras de conflito (se existirem) devem impedir reservas sobrepostas

Erros a caçar:
- Dupla reserva no mesmo horário
- Reserva criada mas não aparece na lista

##### 4.8 Moradores
Requisitos:
- Admin/portaria consegue cadastrar e editar morador.
- Morador consegue atualizar perfil permitido.
- CPF (quando informado) pode ser usado para associar boletos importados.

Erros a caçar:
- Dados sensíveis expostos para role errada
- Cadastro exige e-mail e o app não valida corretamente

##### 4.9 Boletos e Financeiro
Requisitos:
- Morador vê boletos da própria unidade/conta.
- Download de boleto:
  - Se não houver PDF, deve exibir mensagem clara.
  - Se houver PDF (URL ou storage path), download deve iniciar.
- Importação de boletos (admin/portaria) deve persistir e atualizar listagem.

Erros a caçar:
- Download quebra (404/CORS) sem feedback
- Morador vê boleto de outra unidade
- “Baixar” gera nome de arquivo inválido

##### 4.10 Notificações
Requisitos:
- Notificações carregam e podem ser marcadas como lidas.
- “Marcar todas como lidas” funciona.
- Badge/contagem consistente com lista.

Erros a caçar:
- Contagem não bate com itens
- Marcar como lida não atualiza UI
- Atualização realtime não reflete (ou gera duplicidade)

##### 4.11 Configurações
Requisitos:
- Troca de tema (dark/light) persiste.
- Configurações de app persistem sem corromper o `localStorage`.

Erros a caçar:
- Tema não aplica no reload
- JSON inválido no storage quebra app

##### 4.12 Módulo Sentinela (IA)
Requisitos:
- Abrir módulo Sentinela dentro do app
- Alternar entre Chat / Live / Settings sem erro
- Eventos gerados (encomenda/ocorrência/aviso por voz/chat) devem ser persistidos quando integrados ao app principal

Erros a caçar:
- Navegação “voltar/sair” não retorna ao dashboard
- Evento criado no Sentinela não aparece no módulo correspondente

#### 5) Requisitos não funcionais (para o TestSprite detectar)
- A aplicação não deve exibir “tela branca” em nenhum fluxo principal.
- Erros devem ser exibidos como toast/mensagem, não apenas console.
- Operações async devem ter estado de loading (ou pelo menos impedir duplo clique).
- O app não deve entrar em loop de redirects ao trocar de aba/role.
- Performance aceitável: primeira interação < 3s em dev local (heurística).

#### 6) Dados de teste (mínimo necessário)
Criar/ter disponível no ambiente de teste (seed manual ou ambiente dedicado):
- 1 usuário Porteiro válido
- 1 usuário Síndico válido
- 2 moradores (unidades diferentes), com e-mail e (idealmente) um com CPF
- Pelo menos 1 boleto para cada morador (ou ao menos para um)
- 1 encomenda associada ao Morador A
- 1 visitante esperado para o Morador A
- 1 ocorrência em aberto e 1 resolvida

Observação:
Se não houver seed automático, o TestSprite deve executar um “setup” via UI (criando os dados) e então rodar os testes.

#### 7) Plano de testes (checklist que o TestSprite deve automatizar)

##### 7.1 Smoke (sempre)
- Abrir app e carregar sem erro
- Fazer login (cada role) e abrir dashboard
- Navegar por todas as abas disponíveis para a role

##### 7.2 Regressão por role (crítico)
- Síndico NÃO consegue acessar Encomendas (inclusive por tentativa indireta: atalho/redirect/URL)
- Morador NÃO acessa dados de outro morador (boletos/encomendas/notificações)

##### 7.3 Fluxos críticos
- Portaria: criar encomenda -> salvar -> aparece na lista -> marcar recebida
- Morador: abrir boletos -> baixar (quando disponível) ou ver mensagem clara (quando indisponível)
- Visitante esperado: criar (morador ou portaria) -> portaria confirma chegada
- Ocorrência: criar -> resolver -> excluir (apenas resolvida)

##### 7.4 Consistência e UX
- Badges de notificações/encomendas batem com a lista
- Após refresh (F5), sessão/role e aba atual não quebram
- Não há duplicidade de itens após recarregar/listar novamente

#### 8) Definição de “erro” (o que reportar)
O TestSprite deve reportar como bug quando ocorrer:
- Qualquer crash (exceção não tratada) / tela branca
- Permissão quebrada (role errada acessa módulo/dado)
- Ação confirma sucesso mas não persiste (sumiu após refresh)
- Loop de navegação/redirect
- Feedback ausente: falha na API sem mensagem ao usuário
- Inconsistência: contagens/badges divergentes da listagem

#### 9) Fora de escopo (para não gerar falsos positivos)
- Problemas de rede do ambiente local (se Supabase indisponível): reportar como “bloqueio de ambiente”
- Integrações externas (WhatsApp) que abrem apps externos: apenas validar que o app não quebra

#### 10) Como registrar evidências de bug
Para cada bug encontrado, anexar:
- Passos para reproduzir (role, aba, ação)
- Resultado esperado vs. obtido
- Screenshot do estado final
- Erro do console (se existir) e horário aproximado

