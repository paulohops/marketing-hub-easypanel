# Sistema visual do Marketing HUB

## Objetivo

O Marketing HUB usa uma linguagem operacional única: a pessoa deve reconhecer onde está, entender a ação principal e localizar filtros, status, histórico e evidências sem reaprender o módulo. Cada módulo pode ter dados próprios, mas não deve inventar uma nova estrutura visual.

## Estrutura de página

Toda página interna deve usar o shell `WorkspaceShell`, centralizado em um container de conteúdo de aproximadamente `1180px`, com o espaçamento externo fornecido uma única vez pelo `cluster-workspace`. A página começa com um `WorkspaceHeader` e depois organiza o conteúdo em `WorkspaceSection` e `WorkspaceCard`, seguindo a composição validada em `/midias/3`.

```tsx
<WorkspaceShell>
  <WorkspaceHeader
    eyebrow="Trade"
    title="Mídia Audiovisual"
    description="Descrição curta da responsabilidade da tela."
    icon={RadioTower}
    actions={<WorkspaceActions>...</WorkspaceActions>}
  />
  <WorkspaceSection title="Conteúdo principal">
    <WorkspaceCard className="hub-card--padded">...</WorkspaceCard>
  </WorkspaceSection>
</WorkspaceShell>
```

## Header

O header possui quatro níveis. O **eyebrow** identifica o domínio ou grupo de navegação, o **título** informa a tela, a **descrição** explica o objetivo em uma frase e o grupo de **ações** contém somente comandos diretamente relacionados ao contexto. O ícone é opcional, mas deve ser usado nos workspaces principais.

As ações seguem a ordem: voltar ou contexto, ação secundária, filtros, ação destrutiva ou de estado e, por último, a ação primária. O header não deve conter mais de três ações principais em telas comuns. Em entidades, `Editar`, `Reagendar` e `Status` ficam juntos; debriefing fica dentro da entidade que será avaliada.

## Botões

O componente `Button` é a fonte de verdade. A altura padrão é `h-9` e deve ser utilizada para ações comuns e de status. `size="sm"` (`h-8`) serve para ações dentro de cards, tabelas e listas. `size="lg"` fica reservado para entradas importantes de fluxos vazios ou confirmação de alta prioridade. Não usar `h-10`, `h-11` ou alturas customizadas sem uma justificativa de acessibilidade ou layout.

| Função | Variante | Tamanho | Uso |
|---|---|---|---|
| Criar, salvar, confirmar | `default` | padrão | Uma única ação primária por grupo |
| Voltar, editar, filtros | `outline` | padrão ou `sm` | Ações secundárias e reversíveis |
| Ação discreta em card | `ghost` | `sm` | Menos destaque visual |
| Excluir ou cancelar definitivamente | `destructive` | padrão | Sempre com confirmação quando houver perda de dados |
| Link contextual | `link` | `sm` | Navegação textual, sem competir com CTAs |

Ícones devem aparecer antes do texto, ter tamanho controlado pelo componente e nunca substituir um rótulo em ações críticas. O texto deve usar verbos claros: `Novo`, `Editar`, `Reagendar`, `Salvar`, `Filtrar`, `Ver detalhes`.

## Cores e status

Ações primárias usam `primary`; ações secundárias usam `outline` ou `secondary`; superfícies usam `card`, `background` e `muted`; erros e exclusões usam `destructive`. Não criar cores hexadecimais novas em páginas. Status operacionais devem usar `OperationalStatusDropdown` e seus diálogos globais, com motivo e evidência registrados no histórico.

## Cards e seções

Cards usam borda semântica, raio de `1rem`, fundo `card`, sombra discreta e padding padrão de `1.25rem`. O card é uma unidade completa: borda, superfície, respiro e conteúdo pertencem ao mesmo componente. Títulos de seção usam uma única hierarquia visual. Informações resumidas podem aparecer em cards; formulários extensos devem ficar em diálogos ou seções claramente nomeadas.

## Filtros

Filtros começam recolhidos. O botão `Filtros` deve ficar no grupo de ações do header. O painel aparece logo abaixo do header, com campos alinhados, botão `Redefinir filtros` no final e contador quando houver filtros ativos.

## Entidades operacionais

Páginas de entidade usam duas colunas em telas grandes: a coluna menor concentra dados básicos, localização, anexos e histórico; a coluna maior concentra a operação, resumo, resultado e debriefing da entidade. O conteúdo não deve aumentar artificialmente a altura da coluna oposta; usar grids independentes e cards separados.

## Checklist de revisão

Antes de publicar uma tela nova, confirmar: shell centralizado de aproximadamente `1180px`; header-card com eyebrow, título, descrição e ações; botão primário único; botões em `h-9` ou `sm`; filtros recolhidos; status global; histórico com motivo e evidências; cards sem cores inventadas; layout responsivo; foco visível; textos em português; versão e changelog atualizados.

## Regras de alinhamento e dropdowns — agosto de 2026

Todos os módulos de Trade usam o mesmo `WorkspaceHeader`: um card de identidade com padding de `1,25rem`, alinhamento superior controlado, ações agrupadas à direita e descrição limitada a duas linhas. O header não usa altura fixa; sua altura é determinada pelo conteúdo para evitar desalinhamentos entre módulos. Os painéis de filtros usam `hub-filter-panel`, mantêm os controles centralizados verticalmente e só são renderizados após o acionamento do botão **Filtros**. Em telas menores, o header empilha identidade e ações preservando o mesmo padding.

Dropdowns pesquisáveis devem seguir o padrão visual de referência: conteúdo com raio de `0.875rem`, campo de pesquisa com `2.25rem` de altura, borda de foco na cor primária e lista com itens de pelo menos `3rem` de altura, área clicável integral e descrição truncada. Não criar selects customizados com alturas, raios ou sombras diferentes sem atualizar este documento e os tokens globais.

Serviços e SubServiços são entidades distintas. `serviceTypeId` sempre identifica o Serviço principal; `subserviceTypeId` identifica uma linha de `subservice_types`, e a seleção só deve listar vínculos ativos da tabela muitos-para-muitos `service_subservices` ou do catálogo de mídia correspondente. Fichas de Serviço exibem seus SubServiços; fichas de SubServiço exibem os Serviços vinculados.

O eyebrow de Mídia Audiovisual é **Trade**. Novos módulos devem preservar a mesma escala de header, espaçamento horizontal e vertical, hierarquia tipográfica e comportamento de filtros.

## Auditoria de alinhamento e dropdowns

Todos os workspaces devem usar a mesma régua visual: `WorkspaceShell` centralizado, `WorkspaceHeader` em superfície de card com padding de `1,25rem`, identidade alinhada no topo, área de ações alinhada ao topo e espaçamento de `0.5rem` entre controles. Os painéis de filtros devem começar ocultos, usar controles com altura mínima de `2.25rem`, manter os campos alinhados no eixo vertical e posicionar o botão de redefinição no centro do conjunto.

Menus de seleção devem preferir `SearchableSelect` ou `SearchableMultiSelect`, reproduzindo o padrão de referência: trigger compacto, popover com bordas arredondadas, campo `Pesquisar…` com foco destacado, opções em linhas com área de toque confortável, descrição secundária quando houver e opção explícita de limpar. Selects legados recebem os mesmos tokens de altura, raio, borda e foco para não quebrar módulos ainda em migração.

No fluxo de veiculação urbana, `Serviço` é sempre o serviço principal e `SubServiço` é carregado apenas a partir dos vínculos ativos de `serviceSubservices` ou do catálogo de mídia correspondente. O payload nunca deve enviar o ID de um Serviço no campo de SubServiço. As fichas de Serviços, SubServiços e Tipos de mídia devem exibir os relacionamentos nos dois sentidos, sem duplicar registros legados.

## Padding canônico dos cards

A classe global `hub-card`, usada por `WorkspaceCard`, aplica padding interno de **1,25 rem** a todo card. Esse respiro é obrigatório para separar título, conteúdo, ações e bordas, evitando que textos e controles fiquem colados nas extremidades. O padrão vale para Trade, Mídia Urbana, Mídia Audiovisual, Cadastros, Financeiro, Estoque, Processos e qualquer módulo novo.

O modificador `hub-card--padded` permanece apenas por compatibilidade com implementações antigas. Novos componentes não devem depender dele para obter respiro, pois `hub-card` já é padded. Cards auxiliares aninhados podem usar um padding menor somente quando não representarem uma unidade de conteúdo independente; essa exceção deve ser intencional e documentada.

Filtros, headers, seções e cards devem respeitar o mesmo ritmo: header canônico, seção com espaçamento vertical consistente, card com padding, controles alinhados e ações sem contato com as bordas. Ao revisar um módulo, validar desktop e mobile para garantir que o padding não seja removido por classes utilitárias conflitantes.

## Escala global de margem, padding e gaps — agosto de 2026

Todo conteúdo autenticado deve estar dentro de `cluster-workspace` ou `WorkspaceShell`. O container global fornece o único respiro externo da página, com padding horizontal responsivo entre `1rem` e `2,5rem`, padding superior fluido entre `0,75rem` e `1,5rem` e padding inferior de `2,5rem`. O `DashboardLayout` não deve adicionar um segundo padding ao conteúdo, evitando margem dupla entre módulos.

A escala oficial usa os tokens CSS `--hub-space-1` a `--hub-space-10`. O ritmo padrão é: `0,5rem` para agrupamentos compactos, `0,75rem` entre controles relacionados, `1rem` entre itens de uma grade, `1,25rem` entre seções e como padding interno de cards, `1,5rem` para respiros maiores e `2,5rem` no final das páginas. Novas telas devem preferir esses tokens ou as classes compartilhadas `hub-page`, `hub-section`, `hub-filter-panel` e `hub-card` em vez de valores isolados.

O `hub-card` e os componentes `Card` semânticos recebem padding interno obrigatório de `1,25rem`. Classes locais como `p-0`, `px-0` ou `py-0` só podem existir em áreas técnicas ou overlays cuja ausência de respiro seja intencional, como uma imagem ocupando toda a superfície de um card; elas não devem ser usadas para remover o padding de uma unidade de conteúdo, formulário ou ação.

O header canônico é um card independente e fica separado do primeiro conteúdo por `1,25rem`. Filtros ficam em painel próprio com `1rem` de padding, controles separados por `0,75rem` e menus pesquisáveis com `0,75rem` de padding. A mesma régua deve ser preservada em desktop, tablet e mobile; apenas a largura externa se torna fluida.

Checklist adicional de espaçamento: confirmar que a rota passa pelo `cluster-workspace`; confirmar que o DashboardLayout não duplica padding; confirmar que o primeiro bloco não encosta no header; confirmar que headers e cards usam `1,25rem` de respiro; confirmar que grids usam gap de `1rem`; confirmar que seções usam `1,25rem`; confirmar que cards de entidade preservam colunas independentes; e testar a tela em modo claro, escuro, desktop e mobile.


## Módulo de Tarefas

O módulo de Tarefas usa a anatomia de entidade baseada em `/midias/3`: header-card, seção principal com respiro canônico, colunas de conteúdo e cards operacionais com padding interno único. O Kanban mantém colunas legíveis, cards com título, descrição, prioridade, responsável e prazo, além de estados visuais consistentes.

As tarefas são acessíveis por escopo de equipe ou por minhas tarefas. A criação, edição, delegação, movimentação de status e exclusão devem respeitar as permissões `tasks.create`, `tasks.update` e `tasks.delete`. Notificações podem originar tarefas, mas a origem precisa permanecer rastreável no card e no histórico.

Toda alteração operacional relevante deve ser registrada no histórico da tarefa. Novas telas de tarefas devem reutilizar os tokens globais de espaçamento, o header canônico, os cards de entidade e os controles existentes, sem criar paddings ou margens locais divergentes.

### Checklist do módulo de Tarefas

Antes de criar ou alterar uma tarefa, confirmar que o módulo está protegido por permissão; que o card informa responsabilidade, prazo e prioridade; que a movimentação de status gera histórico; que uma tarefa originada de notificação preserva seu vínculo; e que a composição permanece responsiva em telas menores.

### Migração

A migração `0063_tasks_and_workflow.sql` cria os enums, tabelas de tarefas, participantes e histórico necessários ao módulo. O deploy deve aplicar essa migração depois das migrações anteriores, respeitando a ordem registrada no journal do Drizzle.
