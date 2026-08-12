# Trade HUB — Cluster MG

## Resumo executivo

O **Trade HUB — Cluster MG** é uma plataforma web de gestão de trade marketing para centralizar cadastros territoriais, estoque de brindes, controle financeiro, mídias, ações, eventos e indicadores operacionais. A solução foi construída como um painel administrativo protegido, com controle de acesso por perfil, rastreabilidade de alterações e persistência em PostgreSQL externo com conexão TLS.

| Item | Especificação |
| --- | --- |
| Aplicação | Trade HUB — Cluster MG |
| Objetivo | Gestão integrada de operações de trade marketing |
| Situação atual | Implementada, validada e com checkpoint de revisão disponível |
| Último checkpoint | `manus-webdev://9f507b6b` |
| Publicação | Pendente de acionamento manual pelo botão **Publish** |
| Rotina diária de alertas | Endpoint pronto; agendamento será ativado após a publicação |

## Tecnologias e arquitetura

| Camada | Tecnologia e responsabilidade |
| --- | --- |
| Interface | **React 19**, **TypeScript**, **Tailwind CSS 4** e componentes acessíveis da biblioteca de interface do projeto |
| Navegação | Wouter, com rotas protegidas e página de acesso disponível em `/login` |
| Servidor | **Node.js**, **Express 4** e **tRPC 11**, concentrando contratos tipados entre interface e backend |
| Acesso a dados | **Drizzle ORM** com schema PostgreSQL e migrações versionadas |
| Banco de dados | **PostgreSQL externo**, conectado por segredo de ambiente e TLS/SSL com verificação de certificado |
| Autenticação | Manus OAuth, sessão por cookie e procedimentos protegidos no backend |
| Arquivos | S3 via Manus Forge para comprovantes, PDFs, evidências e demais documentos; o banco armazena os metadados e referências |
| Mapa | Google Maps por proxy integrado, com carregador global único para evitar scripts duplicados |
| Testes | Vitest 2.1 e jest-axe para regras de negócio, autorização, integridade, acessibilidade e regressões de interface |

> O banco de dados é a fonte de verdade para registros e metadados. Arquivos não são gravados como binários no PostgreSQL: são armazenados de forma segura no S3 e referenciados pelas tabelas de documentos.

## Segurança e controle de acesso

A plataforma possui autenticação obrigatória e autorização em duas camadas: a interface esconde navegação sem permissão e o backend rejeita chamadas não autorizadas. Os perfis implementados são **administrador**, **gestor regional**, **operador**, **visualizador** e o perfil de compatibilidade `user`.

| Controle | Implementação |
| --- | --- |
| Sessão | OAuth com cookie de sessão autenticado |
| RBAC | Permissões por módulo e procedimento protegido no servidor |
| Dados | PostgreSQL externo com TLS/SSL e pool de conexões configurado |
| Arquivos | Referências S3 com validações de acesso por entidade e módulo |
| Auditoria | Registro de alterações administrativas e operacionais relevantes |
| Rotas | Bloqueio de acesso direto a módulos sem a permissão correspondente |
| Alertas agendados | Endpoint autenticado exclusivamente para cron, idempotente e preparado para retentativas |

## Módulos implementados

| Módulo | Recursos principais |
| --- | --- |
| **Visão geral** | Painel inicial, acessos rápidos, situação operacional e alertas resumidos |
| **Configurações** | Regionais, cidades, lojas, fornecedores, parceiros, serviços, tipos operacionais e associações N:N de fornecedores com cidades, serviços e tipos de mídia |
| **Estoque** | Catálogo de brindes, entradas, saídas, ajustes, saldo disponível e histórico cronológico por item, regional e cidade |
| **Financeiro** | Notas fiscais, contas a pagar, pagamentos, vínculo a operações e anexação de comprovantes |
| **Mídias** | Pontos de mídia, cobertura territorial, fornecedores, campanhas, renovação, histórico e acervo por regional |
| **Ações** | Planejamento, execução, status, debriefing e evidências de ações de trade marketing |
| **Eventos** | Pré-evento, pós-evento, fornecedores, avaliações, documentação e histórico operacional |
| **BI e indicadores** | Métricas consolidadas, desempenho por fornecedor, alertas persistentes, panorama operacional e mapa integrado |
| **Mapa operacional** | Pontos georreferenciados de mídias, ações e eventos, com filtros por regional, cidade e tipo |

## Dados, regras e automação

O schema contém **30 tabelas**, índices e regras de integridade, incluindo relações N:N de fornecedores e a regra de **uma campanha ativa por ponto de mídia**. As principais operações de escrita geram trilha de auditoria.

Os alertas operacionais já possuem callback em `/api/scheduled/operational-alerts`. Ele cobre vencimentos de campanhas, pendências financeiras e ações sem execução. Para que a rotina diária seja criada, a aplicação precisa primeiro estar publicada, pois o agendador utiliza a URL de produção. Depois da publicação, a rotina será criada e sua execução poderá ser acompanhada no painel de agendamentos do projeto.

## Interface e identidade visual

A experiência foi rebrandizada para a linguagem do **Cluster MG**, com interface responsiva em desktop e mobile.

| Elemento | Definição aplicada |
| --- | --- |
| Nome | **Trade HUB — Cluster MG** |
| Fonte | **Montserrat** |
| Verde institucional | `#0E723B` — navegação, ações primárias e estrutura visual |
| Laranja institucional | `#F45103` — destaques, CTAs e item ativo |
| Fundo | `#F7FAF7` com cartões brancos e bordas suaves |
| Marca | Logo do Cluster MG na navegação, login e telas auxiliares |
| Paleta | Tokens CSS semânticos centralizados, evitando cores duplicadas nas telas |

Também foram revisadas a tela de login, a rota direta `/login`, os estados de carregamento, a tela de acesso não autorizado e a página 404. Na barra lateral, contas sem nome cadastrado exibem o fallback solicitado: **Paulo Oliveira**.

## Qualidade e validação

Foram executados **34 testes automatizados**, todos aprovados. A cobertura inclui autenticação, autorização, integração PostgreSQL, integridade de dados, estoque, financeiro, documentos, operações, analytics, configurações, mapa, acessibilidade do layout e auditorias de acessibilidade dos workspaces.

| Validação | Resultado |
| --- | --- |
| Suíte automatizada | 17 arquivos / 34 testes aprovados |
| Acessibilidade | Auditorias com jest-axe no layout e nos 8 workspaces principais |
| Responsividade | Revisão visual em desktop e viewport móvel de 375 px |
| Mapa | Regressão do carregador duplicado corrigida e coberta por teste |
| Rebranding | Auditoria de tokens e revisão visual das telas operacionais e auxiliares |

## Próximo passo necessário

1. Publicar o checkpoint atual pela opção **Publish** da plataforma.
2. Confirmar a publicação.
3. Criar e verificar a rotina diária de alertas operacionais no ambiente publicado.
