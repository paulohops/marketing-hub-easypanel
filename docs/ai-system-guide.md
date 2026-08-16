# Guia de implementação para IA — Marketing HUB

> **Objetivo:** permitir que uma IA leia o sistema, entenda suas decisões existentes e implemente novas funcionalidades sem quebrar a navegação, o design, as permissões, os vínculos de negócio ou a rastreabilidade operacional.

Este documento é uma instrução de trabalho para agentes de código. Ele descreve o estado observado no repositório e define o padrão que deve ser seguido em novas telas, rotas, formulários e endpoints. A referência visual e comportamental principal é formada pelos módulos **Campanhas** e **Ações**, que já implementam o fluxo completo de lista, filtros, detalhe, edição, estados operacionais, evidências e debriefing.

## 1. Regra de leitura antes de qualquer alteração

Antes de escrever código, a IA deve localizar a funcionalidade equivalente mais próxima e ler o fluxo completo. Para telas operacionais, a ordem recomendada é:

| Ordem | Arquivo ou área | O que deve ser entendido |
|---|---|---|
| 1 | [`client/src/App.tsx`](../client/src/App.tsx) | Rotas públicas, rotas protegidas e parâmetros dinâmicos. |
| 2 | [`client/src/pages/ProtectedModule.tsx`](../client/src/pages/ProtectedModule.tsx) | Mapa entre `module`, permissão, título e workspace renderizado. |
| 3 | [`client/src/components/DashboardLayout.tsx`](../client/src/components/DashboardLayout.tsx) | Menu, agrupamento funcional, permissões de navegação e moldura autenticada. |
| 4 | [`client/src/index.css`](../client/src/index.css) | Tokens visuais, superfícies, densidade, `cluster-workspace` e padrão de listas. |
| 5 | [`client/src/pages/CampaignsWorkspace.tsx`](../client/src/pages/CampaignsWorkspace.tsx) | Padrão canônico para entidades agregadoras com operações vinculadas. |
| 6 | [`client/src/pages/ActionsWorkspace.tsx`](../client/src/pages/ActionsWorkspace.tsx) | Padrão canônico para execução operacional, dependências, evidências e histórico. |
| 7 | [`server/routers/campaigns.ts`](../server/routers/campaigns.ts) e [`server/routers/actions.ts`](../server/routers/actions.ts) | Contratos, validações, permissões, transações e auditoria no backend. |

A IA **não deve começar criando um componente novo**. Primeiro deve identificar quais componentes existentes resolvem o mesmo problema, por exemplo `Button`, `Badge`, `Dialog`, `Input`, `Textarea`, `SearchableMultiSelect`, `CompactListToggle`, `ImageViewer`, `EvidenceUpload` e os hooks de permissão e densidade.

## 2. Arquitetura do aplicativo

A aplicação é uma plataforma web de gestão de trade marketing. O frontend usa React, Vite, TypeScript e Wouter; o backend usa Express, tRPC, Drizzle ORM e PostgreSQL. A autenticação é local e as operações protegidas passam por procedimentos tRPC que conferem a permissão antes de acessar o banco.

| Camada | Localização | Responsabilidade | Regra para IA |
|---|---|---|---|
| Entrada e roteamento | `client/src/App.tsx` | Declara os caminhos e associa rotas protegidas a `ProtectedModule`. | Não duplicar a árvore de rotas em páginas individuais. |
| Proteção de módulo | `client/src/pages/ProtectedModule.tsx` | Autenticação, permissão de leitura, definição e escolha do workspace. | Toda nova área deve ter `module`, permissão e resolução explícita. |
| Layout autenticado | `client/src/components/DashboardLayout.tsx` | Sidebar, grupos de navegação, tema, perfil e área de conteúdo. | Não criar outro layout lateral ou outro cabeçalho global. |
| Workspace de domínio | `client/src/pages/*Workspace.tsx` | Lista, detalhe, edição, filtros e ações do módulo. | Seguir o fluxo lista → detalhe → diálogo/formulário. |
| Componentes de interface | `client/src/components` e `client/src/components/ui` | Primitivas e padrões reutilizáveis. | Reutilizar antes de criar CSS ou componentes paralelos. |
| Dados do frontend | `client/src/lib/trpc.ts` e hooks locais | Queries, mutations, cache e estados de carregamento. | Invalidar queries relacionadas após mutações bem-sucedidas. |
| Contrato de backend | `server/routers/*.ts` | Schemas Zod, permissões, regras de vínculo, transações e retorno enriquecido. | Não confiar somente na validação do frontend. |
| Persistência | `drizzle/schema.ts`, `drizzle/relations.ts`, migrations | Modelo relacional e histórico de alterações. | Alterar schema por migration versionada; nunca editar banco manualmente como solução permanente. |
| Auditoria e arquivos | `server/audit.ts`, `server/storage.ts` | Rastreabilidade e armazenamento de imagens/evidências. | Ações operacionais importantes precisam registrar contexto e ator. |

O fluxo de renderização protegido é uniforme: a rota entra em `ProtectedModule`, o usuário é autenticado, a permissão de leitura é verificada, o conteúdo é envolvido por `DashboardLayout` e `cluster-workspace`, e só então o workspace específico é renderizado.

## 3. Mapa de rotas

As rotas abaixo são a fonte de verdade atual. Ao adicionar uma rota, a IA deve alterar o mínimo necessário em `App.tsx`, `ProtectedModule.tsx` e `DashboardLayout.tsx`, mantendo o mesmo `module` entre a rota, a permissão e o workspace.

| Grupo | Rota | `module` | Workspace ou comportamento | Permissão de leitura |
|---|---|---|---|---|
| Geral | `/` | — | `Home` | `dashboard.read` |
| Autenticação | `/login` | — | `LoginPage` | Pública |
| Operação | `/campanhas` | `campanhas` | `CampaignsWorkspace` | `actions.read` |
| Operação | `/campanhas/:campaignId` | `campanhas` | `CampaignsWorkspace` em detalhe | `actions.read` |
| Operação | `/acoes` | `acoes` | `ActionsWorkspace` | `actions.read` |
| Operação | `/acoes/:actionId` | `acoes` | `ActionsWorkspace` em detalhe | `actions.read` |
| Operação | `/eventos` | `eventos` | `EventsWorkspace` | `events.read` |
| Operação | `/eventos/:eventId` | `eventos` | `EventsWorkspace` em detalhe | `events.read` |
| Mídias | `/midias` | — | Redireciona para `/midias/graficas` | `media.read` |
| Mídias | `/midias/graficas` | `midias-graficas` | `MediaWorkspace` com categoria `graphics` | `media.read` |
| Mídias | `/midias/audio-video` | `midias-audio-video` | `MediaWorkspace` com categoria `audio_video` | `media.read` |
| Mídias | `/midias/panfletagem` | `midias-panfletagem` | `MediaWorkspace` com categoria `leafleting` | `media.read` |
| Mídias | `/midias/carro-de-som` | `midias-carro-som` | `MediaWorkspace` com categoria `sound_car` | `media.read` |
| Mídias | `/midias/influencers` | `midias-influencers` | `MediaWorkspace` com categoria `influencers` | `media.read` |
| Mídias | `/midias/veiculacao/:campaignId` | `midias-veiculacao` | `UrbanVeiculationPage` | `media.read` |
| Mídias | `/midias/:mediaPointId` | `midias-graficas` | `MediaWorkspace` em ponto selecionado | `media.read` |
| Gestão | `/estoque` | `estoque` | `InventoryWorkspace` | `inventory.read` |
| Gestão | `/financeiro` | `financeiro` | `FinanceWorkspace` | `finance.read` |
| Gestão | `/cadastros` | — | Redireciona para `/cadastros/operacionais` | `settings.read` |
| Gestão | `/cadastros/operacionais` | `cadastros` | `OperationalRegistriesWorkspace` | `settings.read` |
| Gestão | `/cadastros/operacionais?grupo=...` | `cadastros` | Mesmo workspace com grupo selecionado | `settings.read` |
| Gestão | `/cadastros/modelos` | `modelos-campanha` | `CampaignTemplatesWorkspace` | `settings.read` |
| Gestão | `/cadastros/modelos-acoes` | `modelos-acao` | `ActionTemplatesWorkspace` | `settings.read` |
| Gestão | `/cadastros/empresas` | `empresas` | `CompaniesWorkspace` | `settings.read` |
| Gestão | `/cadastros/empresas/:providerId` | `empresas` | Empresa selecionada | `settings.read` |
| Gestão | `/cadastros/influencers` | `cadastro-influencers` | `MediaWorkspace` filtrado | `settings.read` |
| Gestão | `/cadastros/:entity` | `cadastro-entidade` | `RegistryEntityWorkspace` | `settings.read` |
| Gestão | `/cadastros/:entity/:id` | `cadastro-entidade` | Entidade selecionada | `settings.read` |
| Administração | `/configuracoes` | `configuracoes` | `SettingsWorkspace` | `settings.read` |
| Administração | `/usuarios` | `usuarios` | `UserAdministrationWorkspace` | `settings.read` |
| Administração | `/administracao-usuarios` | `usuarios` | Alias administrativo | `settings.read` |
| Administração | `/equipes` | `equipes` | `TeamsWorkspace` | `settings.read` |
| Administração | `/pontos-de-acao` | `pontos-de-acao` | `ActionPointsWorkspace` | `settings.read` |
| Administração | `/importar-dados` | `importacao` | `DataImportWorkspace` | `settings.write` |
| Administração | `/exportar-relatorios` | `exportacao` | `ReportExportWorkspace` | `settings.read` |
| Relatórios | `/indicadores` | `indicadores` | `IndicatorsWorkspace` | `dashboard.read` |
| Conta | `/perfil` | `perfil` | `ProfileWorkspace` | `dashboard.read` |
| Conta | `/notificacoes` | `notificacoes` | `NotificationsWorkspace` | `dashboard.read` |
| Suporte | `/ajuda` | `ajuda` | `HelpWorkspace` | `dashboard.read` |
| Integrações | `/trello` | `trello` | `TrelloWorkspace` | `settings.read` |

### Regras de navegação

A navegação entre entidades deve usar caminhos conhecidos e legíveis. O detalhe de uma campanha deve abrir ações, eventos e mídias pelas respectivas rotas, como `/acoes/:actionId`, `/eventos/:eventId` e `/midias/:mediaPointId`. A ação deve voltar para `/acoes` e, quando vinculada, pode abrir a campanha por `/campanhas/:campaignId`.

Parâmetros de entidade devem ser tratados com `useRoute` ou equivalente no workspace. A página deve distinguir claramente entre o modo de lista e o modo de detalhe; não deve renderizar dois workspaces concorrentes nem inventar uma rota paralela para contornar um estado ausente.

## 4. Padrão visual canônico

O design do aplicativo é baseado em uma superfície clara e funcional, com verde como cor primária, laranja como cor de destaque, tipografia Montserrat, cantos arredondados e cartões independentes. Os tokens vivem em [`client/src/index.css`](../client/src/index.css) e devem ser usados por meio das classes semânticas do Tailwind, como `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary` e `text-primary`.

| Elemento | Padrão obrigatório |
|---|---|
| Fundo da página | `bg-background`, sem fundo branco arbitrário como base. |
| Superfície de conteúdo | `bg-card` com `border border-border`; usar `rounded-xl` ou `rounded-2xl` conforme a hierarquia. |
| Texto principal | `text-foreground`; títulos de página usam `font-display`, `text-3xl` e `font-bold`. |
| Texto auxiliar | `text-muted-foreground`, geralmente em `text-sm` ou `text-xs`. |
| Ação principal | `Button` padrão com a cor primária; não criar botão verde manualmente se o componente já resolve o caso. |
| Ação secundária | `Button variant="outline"`; cancelamento e ações de retorno não devem competir com a ação principal. |
| Estado | `Badge variant="outline"` com classes semânticas de estado. |
| Lista | Itens independentes, com borda, raio de 10 px, fundo de cartão, sombra discreta e hover com elevação sutil. |
| Densidade | Respeitar `useListDensity` e oferecer `CompactListToggle` em listas operacionais longas. |
| Formulário | `Dialog` com rolagem interna, seções agrupadas, labels claros e campos dependentes desabilitados ou vazios quando o contexto ainda não foi escolhido. |
| Feedback | `toast.success` para conclusão e `toast.error` para falha; estados de carregamento devem ser visíveis no botão ou na área de conteúdo. |
| Imagem | `ImageViewer` para identidade visual e `object-contain` quando a imagem deve caber sem corte. |

### Tokens de marca observados

| Token | Claro | Uso |
|---|---|---|
| Primária | `#0e723b` | Navegação, botões principais, links e indicadores positivos. |
| Destaque | `#f45103` | Foco, acento lateral, identidade de destaque e `ring`. |
| Fundo | `#f7faf7` | Área geral do aplicativo. |
| Cartão | `#ffffff` | Superfícies de conteúdo. |
| Texto | `#133523` | Títulos e conteúdo principal. |
| Borda | `#d8e8dc` | Separação de cartões e controles. |
| Muted | `#eef4ef` | Áreas de apoio, filtros e estados neutros. |

O tema escuro já possui tokens próprios. A IA não deve corrigir contraste criando exceções locais com cores fixas; deve preferir os tokens semânticos e verificar o comportamento em `.dark`. As exceções existentes em `index.css`, como compatibilidade para `bg-white` e listas antigas com `divide-y`, devem ser tratadas como legado a ser reduzido, não como convite para criar mais exceções.

## 5. Estrutura de tela que deve ser repetida

### 5.1 Cabeçalho de workspace

O cabeçalho de uma tela operacional deve apresentar um pequeno eyebrow contextual, um título de página, uma descrição de uma linha e as ações no lado oposto. Em telas de lista, a ação primária de criação fica no cabeçalho e aparece somente quando a permissão de escrita permite.

Exemplo conceitual do padrão usado em Ações:

```tsx
<main className="mx-auto max-w-6xl space-y-5">
  <header className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <p className="text-sm font-medium text-primary">Operação</p>
      <h1 className="font-display text-3xl font-bold text-foreground">Ações</h1>
      <p className="text-sm text-muted-foreground">Planeje, execute e acompanhe ativações de trade em uma ficha única.</p>
    </div>
    <div className="flex flex-wrap items-center gap-2">...</div>
  </header>
</main>
```

Não colocar filtros, tabelas ou múltiplos parágrafos no cabeçalho. O cabeçalho deve orientar a leitura, não carregar toda a densidade da operação.

### 5.2 Lista operacional

A lista deve ser formada por cartões independentes, nunca por uma linha contínua que faça os registros parecerem uma planilha sem separação. O padrão base é `hub-list`/`hub-list-item` ou um equivalente local com as mesmas propriedades.

Cada cartão deve ter uma hierarquia previsível: identificação da entidade, classificação/status, contexto territorial, período/responsável, métricas financeiras ou operacionais e avaliação. Em telas largas, esses blocos podem ocupar colunas; em telas menores, devem quebrar para novas linhas sem sobreposição. Datas longas, nomes grandes e descrições extensas nunca podem empurrar métricas para cima de outro bloco.

A campanha usa uma miniatura em um quadro compacto, identificação e objetivo, situação e empresa, período e território, métricas de operações vinculadas e nota de debriefing. A lista de ações segue o mesmo princípio, adicionando custo estimado, parceria e situação operacional. Em ambos os casos, o item inteiro é acionável e abre o detalhe, mas qualquer ação secundária deve ser um controle independente e acessível.

Estados mínimos que toda lista deve definir são: carregando, lista com dados, lista vazia sem filtros, lista vazia com filtros e erro de carregamento. O estado vazio deve explicar o que ocorreu e, quando fizer sentido, oferecer a ação de criar ou limpar filtros.

### 5.3 Filtros

Filtros podem ficar recolhidos para não dominar a tela. Quando abertos, devem aparecer em um cartão separado com `border border-border bg-card p-4`, busca textual com ícone à esquerda e seletores pesquisáveis. O botão deve indicar a quantidade de filtros ativos e deve existir uma ação clara para limpar tudo.

A seleção deve respeitar dependências. No padrão de Ações, regional filtra cidades; cidade limita fornecedores, pontos de ação e estoque; fornecedor limita serviços e ofertas. A IA não deve mostrar uma lista ampla e inválida para depois tentar corrigir a seleção no submit.

### 5.4 Detalhe

O detalhe deve começar com uma ação de retorno para a lista. Em seguida, deve exibir um cabeçalho em cartão com imagem, status, empresa ou contexto principal, título, objetivo e ações de edição/renovação. As informações devem ser distribuídas em seções independentes, normalmente em uma grade `lg:grid-cols-2`, sem transformar o detalhe em uma única parede de texto.

Campanhas demonstram o padrão de entidade agregadora: segmentação e vigência, identidade visual, promoções e planos, operações vinculadas e debriefing. Ações demonstram o padrão de entidade executável: planejamento, contexto comercial, responsáveis, fornecedores, serviços, estoque, custos, debriefing, evidências e histórico.

Subrecursos que exigem leitura concentrada devem abrir em `Dialog`, como os planos de uma promoção e a lista de operações vinculadas. A navegação cruzada deve manter a rota de cada domínio, e o detalhe não deve duplicar toda a edição inline se o formulário já é um fluxo complexo.

### 5.5 Formulário de criação e edição

Criação e edição devem compartilhar o mesmo formulário sempre que o contrato for o mesmo. O título do diálogo deve deixar claro se é uma nova entidade ou edição, e o botão de submit deve variar entre criar e salvar alterações.

O diálogo deve usar altura máxima com rolagem interna, largura suficiente para os campos relacionados e seções visuais. Cada seção deve ter um propósito. Em Campanhas, a primeira seção concentra modelo, identificação, segmentação e vigência; a segunda concentra promoções e planos; o rodapé concentra cancelar e salvar. Em Ações, o formulário separa contexto, localização, operação, fornecedores/serviços, equipe, estoque e capa.

Campos condicionais devem limpar dados que deixaram de ser válidos. Por exemplo, trocar a empresa ou regional de uma campanha limpa cidades incompatíveis; trocar a cidade da ação limpa evento, ponto, endereço, coordenadas, fornecedores e alocações de estoque que dependiam do contexto anterior.

## 6. Campanhas como referência de entidade agregadora

O módulo de campanhas é o padrão para telas que agrupam outras operações. A campanha pode relacionar ações, eventos e mídias, além de manter segmentação territorial, promoções, planos, identidade visual, vigência, status e debriefing.

### Comportamento obrigatório observado

| Área | Comportamento que deve ser preservado |
|---|---|
| Lista | A campanha é exibida como cartão independente, com identificação, objetivo, empresa, território, período, contagens de ações/mídias/eventos e nota. |
| Criação | O modelo de campanha pode preencher nome, objetivo, status, promoções e planos, mas não deve apagar o que o usuário já digitou sem confirmação. |
| Segmentação | Empresa, regionais e cidades possuem relação hierárquica; cidades e cidades de promoções devem respeitar o escopo da campanha. |
| Promoções | Cada promoção possui nome, descrição, cidades específicas e uma coleção de planos. Pelo menos um plano pode ser preservado quando a remoção total não fizer sentido. |
| Detalhe | Promoções são consultadas em diálogo; operações vinculadas são agrupadas por tipo e abrem suas próprias rotas. |
| Identidade visual | Upload limitado aos formatos JPEG, PNG e WEBP e apresentado com `ImageViewer`. |
| Renovação | A renovação altera início, término e status respeitando o intervalo de datas e registra auditoria. |
| Debriefing | Nota de 1 a 5, história/resultado e aprendizados são salvos com permissão de escrita e ficam visíveis no detalhe. |

O backend substitui a estrutura territorial e promocional da campanha em transação ao criar ou editar. A IA deve considerar essa semântica ao alterar o formulário: não deve enviar apenas um fragmento esperando que o backend faça merge implícito, nem criar mutações paralelas que deixem a estrutura parcialmente atualizada.

## 7. Ações como referência de entidade executável

O módulo de ações é o padrão para fluxos que possuem planejamento, execução e pós-operação. A ação relaciona cidade, tipo, campanha opcional, evento opcional, ponto de ação opcional, supervisor, fornecedores, serviços, equipe, estoque e evidências.

### Dependências que não podem ser quebradas

| Escolha anterior | Dados derivados ou restringidos |
|---|---|
| Cidade | Regional da ação, fornecedores com cobertura, pontos de ação e estoque elegível. |
| Campanha | Deve ser compatível com a regional da cidade. |
| Evento | Deve ser da mesma cidade; quando ambos estão em campanha, a campanha também deve coincidir. |
| Ponto de ação | Deve pertencer à cidade escolhida e pode preencher endereço e coordenadas. |
| Fornecedores | Devem cobrir a cidade; habilitam os serviços oferecidos por eles. |
| Serviços | Exigem pelo menos um fornecedor e precisam ser oferecidos por um dos fornecedores selecionados. |
| Oferta de serviço | Deve estar ativa, ser do tipo serviço e pertencer a um fornecedor da ação. |
| Estoque | Deve pertencer à regional da cidade e, quando territorializado, à cidade selecionada. |
| Datas | O término, quando informado, não pode ser anterior ao início. |
| Status pausado/cancelado | Exige motivo; a alteração registra histórico e evidências quando fornecidas. |
| Reagendamento | Exige motivo e não é permitido para ação concluída ou cancelada. |

O custo estimado deve ser calculado a partir de serviços e estoque no backend. Não duplicar esse cálculo somente no frontend nem aceitar um total digitado como fonte de verdade quando já existirem alocações detalhadas.

## 8. Dados, tRPC e permissões

A query `referenceData` deve alimentar opções de formulário e filtros. A query `list` deve retornar dados suficientemente enriquecidos para a tela, evitando uma cascata de requests por cartão. Mutations de criação, edição, status, reagendamento, upload e debriefing devem invalidar as queries que alimentam a lista ou o detalhe.

Todo procedimento protegido deve chamar `assertPermission` no backend. O frontend usa `useEffectivePermissions` para esconder ou desabilitar ações de escrita, mas isso é uma melhoria de experiência e **não substitui** a autorização do servidor. Uma nova permissão deve ser adicionada ao modelo de autorização e ao mapa de módulo; nunca deve ser simulada com um `if` visual isolado.

Mensagens de erro do backend devem ser utilizáveis pelo usuário. O frontend deve exibi-las com `toast.error`, e mutations com duração ou upload devem refletir `isPending` no controle que iniciou a operação. Após sucesso, a mensagem deve ser curta e específica, a query deve ser invalidada e o estado local temporário deve ser limpo.

### 8.1 Branding e personalização visual

A identidade visual global é persistida na tabela chave/valor `app_settings` com a chave `app_branding`. O contrato está em `server/routers/settings.ts`, os tipos e defaults em `shared/branding.ts`, a aplicação global em `client/src/contexts/BrandingContext.tsx` e a edição em `client/src/components/BrandingSettingsPanel.tsx`.

| Configuração | Aplicação |
|---|---|
| Nome do aplicativo | Sidebar, login, home, 404, tutorial e `document.title`. |
| Subtítulo/organização | Sidebar, login, home, 404, tutorial e `document.title`. |
| Logo | Storage persistente, sidebar, login, 404, preview e identidade visual. |
| Cor primária | Tokens `primary`, sidebar, botões e indicadores principais. |
| Cor de destaque | Tokens `sidebar-primary`, `ring`, destaques e estados acentuados. |
| Fundo, cartões e texto | Tokens globais de superfície e tipografia. |
| Fonte | Seleção segura entre famílias permitidas, carregada dinamicamente e aplicada ao corpo e aos títulos. |

A leitura do branding é pública para permitir que a tela de login carregue a marca antes da autenticação. A escrita exige `settings.write`, valida cores hexadecimais, limita fontes a uma lista permitida, valida MIME/tamanho da logo e registra auditoria. Não inserir bytes da imagem em `app_settings`, não usar URL fornecida diretamente pelo cliente e não criar estilos fixos por página para contornar os tokens globais.

Ao criar novos componentes, use `useBranding()` quando o nome, a logo ou o subtítulo forem exibidos. Para novas cores, prefira os tokens semânticos derivados do branding; não leia `appSettings` diretamente no componente e não invente uma segunda fonte de verdade.

## 9. Anti-gambiarra: regras que a IA deve obedecer

> **Princípio central:** uma solução é considerada inadequada quando funciona apenas para um caso visual ou de dados, mas ignora o padrão de navegação, os tokens, as permissões, as validações do servidor ou a manutenção futura.

| Não fazer | Fazer no lugar |
|---|---|
| Criar uma segunda sidebar, cabeçalho ou sistema de cores. | Usar `DashboardLayout`, tokens semânticos e componentes existentes. |
| Colocar um novo módulo em uma rota inventada sem atualizar o mapa central. | Registrar a rota em `App.tsx`, o `module` em `ProtectedModule.tsx` e a entrada no menu quando necessário. |
| Resolver vínculo de negócio apenas escondendo opções no frontend. | Filtrar a experiência e validar novamente no router com Zod e regras de domínio. |
| Usar `any` para mascarar um contrato desconhecido. | Tipar o retorno, confirmar o schema do router e ajustar frontend/backend em conjunto. |
| Colocar toda a tela dentro de uma única tabela ou card monolítico. | Separar identificação, classificação, contexto, período, métricas e ações em blocos legíveis. |
| Usar `position: absolute`, margens negativas ou larguras fixas para corrigir sobreposição. | Redesenhar a grade com `minmax`, `flex-wrap`, quebra de texto e comportamento responsivo. |
| Duplicar um formulário para criar e editar. | Compartilhar o formulário e diferenciar apenas estado inicial, título e mutation. |
| Fazer request adicional por item da lista sem necessidade. | Enriquecer `list` no backend ou usar uma query agregada previsível. |
| Atualizar relações em várias mutations independentes sem transação. | Usar uma mutation de domínio e transação quando a estrutura deve ser substituída em conjunto. |
| Engolir erro com `catch` vazio ou deixar a UI silenciosamente parada. | Mostrar feedback, manter o formulário preservado e registrar o estado pendente. |
| Remover validação para “deixar o usuário avançar”. | Explicar a dependência, limpar dados inválidos e preservar a regra no servidor. |
| Criar CSS global específico para uma tela sem necessidade. | Preferir classes semânticas, componentes UI e tokens já existentes. |
| Adicionar exceções de tema escuro com `!important` em páginas. | Corrigir tokens ou componentes reutilizáveis na origem. |
| Apagar histórico, motivo ou evidência ao mudar status. | Registrar a alteração no audit log com ator, contexto e evidências. |
| Aceitar upload sem validar MIME, tamanho e entidade. | Reutilizar o contrato de storage e validar formato, tamanho e permissão. |

## 10. Acessibilidade e responsividade

Todo controle interativo deve ser teclado-acessível, ter nome compreensível e preservar foco dentro de diálogos quando o componente base já oferece esse comportamento. Ícones sozinhos precisam de `aria-label` ou texto alternativo. Imagens decorativas podem usar `alt=""`; imagens de identidade devem usar o nome da entidade.

A largura de 1280 px é uma referência importante para validar listas densas, mas não é o único alvo. O layout deve funcionar em telas menores sem scroll horizontal acidental. Datas, objetivos e nomes precisam quebrar de forma segura; métricas não devem depender de uma linha única. Diálogos devem ter rolagem interna e respeitar a altura do viewport.

O tema escuro deve ser verificado em todas as superfícies novas. Não assumir que `bg-white`, `text-black` ou cores de status somente no tema claro terão contraste adequado. A solução correta é usar os tokens e as classes de estado já praticadas em Campanhas e Ações.

## 11. Fluxo de implementação recomendado

A IA deve começar descrevendo a mudança em termos de domínio: entidade, rota, permissão, query, mutation, vínculos e estado de auditoria. Em seguida deve localizar um exemplo canônico, implementar o contrato de backend, conectar a query de referências e a listagem, construir a lista, construir o detalhe e somente depois adicionar diálogos auxiliares ou refinamentos visuais.

A implementação deve ser validada em camadas. Primeiro, verificar tipos e testes relacionados; depois, executar a suíte de testes; por fim, revisar visualmente estados de carregamento, vazio, erro, formulário, detalhe, tema escuro e viewport estreito. Se uma regra nova não couber no padrão de Campanhas ou Ações, a IA deve justificar a exceção no código ou na documentação em vez de criar uma variação silenciosa.

## 12. Checklist de aceite para novas funcionalidades

| Categoria | Pergunta de aceite |
|---|---|
| Rota | A rota é legível, está registrada em `App.tsx` e trata lista/detalhe de forma explícita? |
| Permissão | O módulo possui permissão de leitura e as mutations possuem permissão de escrita no backend? |
| Menu | A entrada está no grupo correto e respeita `useEffectivePermissions`? |
| Layout | A tela usa `DashboardLayout`/`cluster-workspace`, `max-w-6xl` e espaçamento consistente? |
| Lista | Há cartões independentes, estados de loading/vazio/erro, filtros e densidade quando necessário? |
| Detalhe | Existe retorno para a lista, cabeçalho contextual, seções e navegação cruzada coerente? |
| Formulário | Criar e editar compartilham o mesmo fluxo e os campos dependentes limpam valores incompatíveis? |
| Dados | A query de listagem retorna o necessário e as mutations invalidam o cache correto? |
| Domínio | Todas as relações são validadas no backend e as datas/valores possuem limites? |
| Auditoria | Mudanças de criação, edição, status, reagendamento e debriefing registram ator e contexto? |
| Visual | A tela funciona em tema claro, tema escuro, viewport estreito e largura de 1280 px sem sobreposição? |
| Qualidade | `pnpm check`, `pnpm test` e `pnpm build` foram executados ou a limitação foi registrada? |

## Referências internas

[1]: ../client/src/App.tsx "Roteamento principal do frontend"
[2]: ../client/src/pages/ProtectedModule.tsx "Proteção, permissões e resolução de módulos"
[3]: ../client/src/components/DashboardLayout.tsx "Layout autenticado e navegação lateral"
[4]: ../client/src/index.css "Tokens visuais e padrões globais de interface"
[5]: ../client/src/pages/CampaignsWorkspace.tsx "Implementação de referência do módulo de campanhas"
[6]: ../client/src/pages/ActionsWorkspace.tsx "Implementação de referência do módulo de ações"
[7]: ../server/routers/campaigns.ts "Contrato e regras de negócio de campanhas"
[8]: ../server/routers/actions.ts "Contrato e regras de negócio de ações"
[9]: ../docs/campaign-list-visual-notes.md "Decisões visuais da lista de campanhas"
[10]: ../docs/action-ux-review-2026-08-14.md "Revisão de UX do módulo de ações"
