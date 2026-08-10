# Documentação do Sistema — Qualivida Residence

## 1. Visão geral

O projeto Qualivida Residence é uma aplicação web de gestão condominial desenvolvida em React + TypeScript com foco em administração interna, comunicação com moradores e automação operacional.

O sistema reúne funcionalidades para:
- gestão de moradores, visitantes, encomendas e ocorrências;
- comunicação interna com avisos e notificações;
- controle financeiro com boletos;
- reserva de áreas comuns;
- integração com Supabase para persistência e autenticação;
- integração com IA via Gemini para recursos assistivos e automação.

## 2. Objetivo do sistema

O app foi pensado para centralizar as operações diárias de um condomínio, permitindo que síndicos, porteiros e moradores tenham acesso a informações e ações específicas conforme o perfil de usuário.

## 3. Perfis e papéis

O sistema suporta diferentes perfis, incluindo:
- Morador
- Porteiro
- Síndico
- Administradora / Administrador

A lógica de permissões é tratada por contexto e por serviço de permissões, com papéis possuindo diferentes níveis de acesso para visualizar, criar, editar e excluir registros.

## 4. Arquitetura principal

### Frontend
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Recharts

### Estrutura de pastas
- App.tsx: ponto central da aplicação
- components/: telas, modais, componentes visuais e views
- contexts/: estados globais de autenticação, permissões, notificações e configuração
- services/: integração com backend, Supabase, IA, notificações, autenticação e dados offline
- types.ts: modelos principais do domínio
- utils/: utilidades auxiliares
- sentinela/: módulo de assistente/voz com integração de IA

## 5. Funcionalidades principais

### 5.1 Gestão de moradores
- cadastro e consulta de moradores;
- associação de unidade;
- perfil e dados complementares;
- login específico para moradores.

### 5.2 Gestão de encomendas
- registro de entregas;
- controle de status (pendente/recebida);
- identificação de unidade e destinatário;
- suporte a imagem/QR code e histórico.

### 5.3 Gestão de visitantes
- registro de visitantes e entradas;
- acompanhamento de status e confirmação;
- histórico de visitas.

### 5.4 Ocorrências
- abertura de ocorrências por moradores e equipe;
- acompanhamento de status;
- comunicação interna por mensagens;
- leitura e notificações associadas.

### 5.5 Avisos e comunicação
- criação e visualização de avisos do condomínio;
- diferenciação por papel/autor;
- possibilidade de fixar mensagens importantes.

### 5.6 Reservas
- agendamento de áreas comuns;
- controle de disponibilidade e status.

### 5.7 Boletos e finanças
- cadastro e visualização de boletos;
- filtros por status e tipo;
- suporte à importação de PDFs e processamento de documentos.

### 5.8 Notificações
- envio de notificações para moradores;
- marcação como lida;
- integração com eventos como encomenda, visita e ocorrência.

## 6. Integrações e serviços

### Supabase
O sistema utiliza o Supabase como principal infraestrutura de dados e autenticação.

Pontos relevantes:
- armazenamento de registros principais;
- autenticação de usuários e moradores;
- realtime para atualização dinâmica de dados;
- políticas de acesso e integração com tabelas como residents, packages, notices, boletos e notifications.

### Gemini / IA
O projeto incorpora serviços de IA para recursos assistivos, incluindo integração com o Google Gemini. A estrutura aponta para uso de modelos de linguagem para automação e assistentes contextuais.

### Offline-first e cache local
O projeto também possui camada de persistência local e sincronização de dados, com suporte a:
- cache local de tabelas;
- outbox para operações offline;
- sincronização posterior quando houver conectividade.

## 7. Fluxo de uso típico

1. O usuário entra na aplicação e faz login.
2. O app restaura sessão e define o contexto de autorizações.
3. Dependendo do perfil, o usuário acessa módulos específicos.
4. Operações são persistidas localmente e, quando possível, sincronizadas com o Supabase.
5. Notificações e atualizações são exibidas na interface em tempo real.

## 8. Estado de verificação do projeto

A validação foi realizada por meio de uma tentativa de build local.

Comando executado:
```bash
npm run build
```

Resultado observado:
- o processo não concluiu com sucesso;
- o Vite não foi encontrado durante a execução da build;
- o erro reportado foi: "Cannot find package 'vite'".

Isso indica que o ambiente local atual ainda precisa de dependências instaladas ou de uma configuração de ambiente correta para completar a build do projeto.

## 9. Como rodar localmente

Pré-requisitos:
- Node.js 18+
- npm ou yarn

Passos sugeridos:
```bash
npm install
npm run dev
```

Também é necessário configurar as variáveis de ambiente, principalmente as relacionadas ao Supabase e à IA, conforme os arquivos de exemplo presentes no projeto.

## 10. Conclusão

O Qualivida Residence é um sistema completo de gestão condominial com foco em operação diária, comunicação e automação. Ele combina frontend moderno, integração com banco em nuvem, notificações, autenticação e recursos de IA em uma aplicação organizada por módulos e papéis.
