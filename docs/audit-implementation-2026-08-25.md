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
