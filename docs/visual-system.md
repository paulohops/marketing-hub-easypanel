# Sistema visual do Marketing HUB

## Objetivo

O Marketing HUB usa uma linguagem operacional única: a pessoa deve reconhecer onde está, entender a ação principal e localizar filtros, status, histórico e evidências sem reaprender o módulo. Cada módulo pode ter dados próprios, mas não deve inventar uma nova estrutura visual.

## Estrutura de página

Toda página interna deve usar o shell `WorkspaceShell`, com largura máxima de `1480px`, padding responsivo e espaçamento vertical consistente. A página começa com um `WorkspaceHeader` e depois organiza o conteúdo em `WorkspaceSection` e `WorkspaceCard`.

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

Cards usam borda semântica, raio entre `0.875rem` e `1rem`, fundo `card` e padding padrão de `1.25rem`. Títulos de seção usam uma única hierarquia visual. Informações resumidas podem aparecer em cards; formulários extensos devem ficar em diálogos ou seções claramente nomeadas.

## Filtros

Filtros começam recolhidos. O botão `Filtros` deve ficar no grupo de ações do header. O painel aparece logo abaixo do header, com campos alinhados, botão `Redefinir filtros` no final e contador quando houver filtros ativos.

## Entidades operacionais

Páginas de entidade usam duas colunas em telas grandes: a coluna menor concentra dados básicos, localização, anexos e histórico; a coluna maior concentra a operação, resumo, resultado e debriefing da entidade. O conteúdo não deve aumentar artificialmente a altura da coluna oposta; usar grids independentes e cards separados.

## Checklist de revisão

Antes de publicar uma tela nova, confirmar: shell de `1480px`; header com eyebrow, título, descrição e ações; botão primário único; botões em `h-9` ou `sm`; filtros recolhidos; status global; histórico com motivo e evidências; cards sem cores inventadas; layout responsivo; foco visível; textos em português; versão e changelog atualizados.

## Regras de alinhamento e dropdowns — agosto de 2026

Todos os módulos de Trade usam o mesmo `WorkspaceHeader`: altura desktop fixa de `7.25rem`, alinhamento vertical central, ações agrupadas à direita e descrição limitada a duas linhas. Os painéis de filtros usam `hub-filter-panel`, mantêm os controles centralizados verticalmente e só são renderizados após o acionamento do botão **Filtros**. Em telas menores, o header passa a ter altura automática para preservar a leitura.

Dropdowns pesquisáveis devem seguir o padrão visual de referência: conteúdo com raio de `0.875rem`, campo de pesquisa com `2.25rem` de altura, borda de foco na cor primária e lista com itens de pelo menos `3rem` de altura, área clicável integral e descrição truncada. Não criar selects customizados com alturas, raios ou sombras diferentes sem atualizar este documento e os tokens globais.

Serviços e SubServiços são entidades distintas. `serviceTypeId` sempre identifica o Serviço principal; `subserviceTypeId` identifica uma linha de `subservice_types`, e a seleção só deve listar vínculos ativos da tabela muitos-para-muitos `service_subservices` ou do catálogo de mídia correspondente. Fichas de Serviço exibem seus SubServiços; fichas de SubServiço exibem os Serviços vinculados.

O eyebrow de Mídia Audiovisual é **Trade**. Novos módulos devem preservar a mesma escala de header, espaçamento horizontal e vertical, hierarquia tipográfica e comportamento de filtros.

## Auditoria de alinhamento e dropdowns

Todos os workspaces devem usar a mesma régua visual: `WorkspaceShell` centralizado, `WorkspaceHeader` com altura mínima de `7.25rem`, identidade verticalmente centralizada, área de ações alinhada ao centro e espaçamento de `0.5rem` entre controles. Os painéis de filtros devem começar ocultos, usar controles com altura mínima de `2.25rem`, manter os campos alinhados no eixo vertical e posicionar o botão de redefinição no centro do conjunto.

Menus de seleção devem preferir `SearchableSelect` ou `SearchableMultiSelect`, reproduzindo o padrão de referência: trigger compacto, popover com bordas arredondadas, campo `Pesquisar…` com foco destacado, opções em linhas com área de toque confortável, descrição secundária quando houver e opção explícita de limpar. Selects legados recebem os mesmos tokens de altura, raio, borda e foco para não quebrar módulos ainda em migração.

No fluxo de veiculação urbana, `Serviço` é sempre o serviço principal e `SubServiço` é carregado apenas a partir dos vínculos ativos de `serviceSubservices` ou do catálogo de mídia correspondente. O payload nunca deve enviar o ID de um Serviço no campo de SubServiço. As fichas de Serviços, SubServiços e Tipos de mídia devem exibir os relacionamentos nos dois sentidos, sem duplicar registros legados.
