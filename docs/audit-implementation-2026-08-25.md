# Correções da auditoria manual — 25/08/2026

Este documento registra as correções implementadas após a auditoria manual da instância do Marketing HUB. O objetivo é oferecer exclusão operacional explícita sem transformar uma ação destrutiva em remoção silenciosa de histórico.

## Política de ciclo de vida

| Registro | Exclusão permitida quando | Exclusão bloqueada quando | Permissão |
|---|---|---|---|
| Ponto de ação | Não há ação vinculada ao ponto | Existe ação vinculada; o ponto deve ser inativado | `settings.write` |
| Campanha | Não há ações, eventos, mídias ou publicações sociais vinculadas | Qualquer operação ou publicação já referencia a campanha | `actions.write` |
| Evento | Status `planned` ou `cancelled`, sem ações, solicitações, faturas ou evidências | Status `in_progress`/`completed` ou qualquer histórico operacional/financeiro/documental | `events.write` |

As exclusões permitidas são executadas em transações do PostgreSQL. Os vínculos configuracionais filhos são removidos antes do registro principal; nenhum vínculo operacional é desassociado silenciosamente para viabilizar a exclusão. Cada exclusão aprovada grava o estado anterior em `audit_logs` com a ação `delete`.

## Alterações de interface e validação

As telas de Pontos de ação, Campanhas e Eventos agora exibem ação destrutiva apenas para usuários com a permissão de escrita correspondente. Cada ação abre um diálogo de confirmação com o nome do registro, a permanência da operação e a orientação para inativar ou preservar o histórico quando existirem vínculos. O botão fica bloqueado enquanto a mutation está pendente e a lista é invalidada após sucesso.

O formulário de fornecedor passou a sinalizar o CNPJ como obrigatório nos fluxos completo e de criação rápida. A interface limita a entrada à máscara usual de até 18 caracteres e explica que são necessários 14 dígitos; o schema tRPC também passou a exigir o campo, mantendo a normalização existente.

Eventos planejados agora iniciam com `Resultado atingido` desmarcado. O helper compartilhado de debriefing também usa `false` para `resultAchieved` e `worthRepeating`. Promoções de Campanha começam sem plano vazio, e o editor permite remover o único plano antes de adicionar outro. A tabela de desempenho do BI informa explicitamente quando nenhum módulo corresponde ao recorte.

## Segunda rodada de otimizações

A visão de Panfletagem do BI foi corrigida na origem. O backend agora identifica as veiculações por meio da categoria `leafleting` do ponto de mídia e expõe um módulo próprio, enquanto os cartões da tela usam somente os totais e custos dessa frente. O problema anterior era uma combinação de dados válidos com um filtro textual que não encontrava nenhum rótulo correspondente.

O default de nova Campanha foi alinhado ao fluxo de planejamento e passou a ser `scheduled`. Também foram adicionados estados de erro recuperáveis nas listas de Campanhas, Eventos, Mídias e Indicadores, com `role="alert"`, carregamento anunciado e botão de reconsulta. As fichas de Mídias passaram a diferenciar erro de rede de registro inexistente.

## Validação automatizada

A cobertura adicionada inclui exclusões permitidas, registros inexistentes, conflitos por vínculos operacionais, status concluído, fatura de evento, auditoria do estado anterior, CNPJ obrigatório e promoção sem plano inicial. A suíte completa deve ser executada com:

```text
pnpm check
pnpm test
pnpm build
```

A validação de navegador móvel e a utilização da instância de produção permanecem fora deste pacote: o navegador conectado operou em 1560×768 e apresentou instabilidade de rede durante a auditoria. Os controles devem ser publicados e testados em homologação antes de qualquer limpeza dos fixtures `TESTE AUDITORIA 20260825` ainda existentes em produção.

> Não foram executadas operações diretas no banco de produção. A remoção dos fixtures remanescentes deve ocorrer pela interface após o deploy e somente se as regras de segurança permitirem a operação.

## Home e paridade de Eventos

A composição anterior da Home foi restaurada: hero verde, indicadores compactos, agenda operacional e bloco de prioridades. A marca configurada agora aparece no hero ao lado do título e subtítulo, com fallback para o favicon quando não houver logo carregada.

O módulo de Eventos passou a seguir o padrão de Ações na listagem e na ficha individual. A listagem oferece cards densos com status, modalidade, território, período, supervisor, custo e contagem de vínculos. A ficha organiza planejamento/local, contexto comercial, campanha, responsáveis, fornecedores, serviços, estoque, financeiro, debriefing, evidências e histórico auditado.

A migration `0069_event_rich_detail.sql` adiciona o vínculo persistente de ponto de ação e os campos de resultado do evento (`resultSummary`, leads, vendas, renovações, pontos positivos, pontos a melhorar e `completedAt`). O deploy deve aplicar as migrations normalmente antes de disponibilizar a edição e o debriefing ampliado de Eventos.

A criação e edição de Evento agora validam o ponto selecionado contra a cidade e preservam os vínculos em transação. A exclusão de Ponto de ação também bloqueia referências vindas de Eventos, além das referências existentes em Ações.

## Expansão de governança operacional
As exclusões financeiras agora são explícitas, protegidas por `finance.delete`, executadas em transações e registradas em `audit_logs`. Contratos só podem ser removidos em rascunho sem notas, competências faturadas ou documentos; ordens de compra só podem ser removidas em rascunho/canceladas sem notas, recebimentos de estoque ou itens faturados; notas fiscais só podem ser removidas em aberto sem pagamentos, recebimentos ou comprovantes; pagamentos podem ser revertidos com recálculo transacional do status da nota e da competência; custos operacionais só podem ser removidos em rascunho ou aguardando aprovação; e verbas mensais podem ser removidas com confirmação e auditoria. As telas mostram os controles apenas para usuários autorizados e solicitam confirmação antes da ação permanente.

O cadastro `Categoria de estoque` foi incluído em Configurações > Cadastros > Produtos e serviços. Uma categoria pode ser global/compartilhada (`companyId` nulo) ou específica de uma empresa financeira. O banco mantém índices únicos parciais para evitar nomes duplicados tanto no escopo global quanto dentro da mesma empresa. Itens de estoque continuam preservando a categoria enum legada para compatibilidade, mas podem receber `stockCategoryId`; a transferência compara o identificador administrado quando disponível e o fallback legado quando necessário. Categorias vinculadas a itens não podem ser excluídas, somente inativadas.

A Central de notificações, em Configurações > Central de notificações, permite cadastrar regras por módulo específico ou por todos os módulos, evento de criação, alteração, mudança de status, exclusão, vencimento, expiração ou qualquer evento, templates com variáveis, canais in-app/e-mail, exclusão do ator e destinatários por usuário, regional, cidade ou empresa. Destinatários são validados contra cadastros ativos, deduplicados e materializados com chave idempotente. O dispatcher é acionado pelo helper de auditoria, cobre os eventos auditados dos módulos operacionais e mantém fallback para alertas de vencimento e estoque mínimo quando nenhuma regra aplicável existir.

Tarefas contextuais foram disponibilizadas por meio do componente reutilizável `ContextTaskDialog` nos principais registros de operação: campanhas, ações, eventos, pontos de ação, itens de estoque, pontos de mídia, veiculações urbanas, tradicionais e volantes, notas fiscais e demais superfícies financeiras. O vínculo é persistido em `entityType`/`entityId`, a origem contextual usa `source=context`, e o Kanban exibe o registro relacionado e permite abrir sua rota. A exclusão de tarefas exige `tasks.delete`, é limitada ao criador ou administrador e grava o estado anterior no audit log.

A migration `0070_notifications_stock_categories.sql` cria o catálogo de categorias, as regras e recipients de notificações, os campos de vínculo/deduplicação, os índices parciais e o valor `context` da origem de tarefas. Ela não foi executada diretamente contra produção; deve ser aplicada pelo fluxo normal de deploy, depois da `0069_event_rich_detail.sql`.
