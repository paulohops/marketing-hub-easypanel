# Auditoria visual solicitada — 19/08/2026

## Print 1 — dropdown pesquisável

O dropdown de referência apresenta um campo de pesquisa destacado no topo, com ícone de busca à esquerda, borda arredondada, foco visual em laranja, altura compacta e placeholder `Pesquisar...`. As opções ficam dentro de um painel branco com borda e sombra suaves; cada item tem indicador circular à esquerda, título em uma linha e descrição secundária truncada em cinza. O painel possui cantos arredondados e espaçamento interno consistente.

## Print 2 — header e filtros do módulo audiovisual

O header do módulo tem ícone, eyebrow, título, descrição e ações alinhadas na mesma linha inferior. O botão `Filtros` aparece junto da ação primária. Ao abrir, o painel de filtros possui borda, fundo de card e padding uniforme. O título `Filtros da mídia audiovisual` está à esquerda, enquanto os campos ficam na mesma linha e o botão `Redefinir filtros` no lado direito. A solicitação é centralizar verticalmente o título, os campos e o botão para eliminar desalinhamento.

O nome desejado para o eyebrow é `Trade Mídia Audiovisual`, substituindo `Módulo independente Mídia Audiovisual`.

## Print 3 — erro funcional no formulário de veiculação

O formulário `Nova veiculação` exibe `Serviço` com valor `Veiculação` e `SubServiço` como `Não definido`; ao salvar, aparece o erro `O tipo selecionado precisa ser um SubServiço cadastrado.`. O problema indica que o campo está enviando o identificador de um serviço ou um valor padrão incompatível onde o backend exige um cadastro de SubServiço. A correção deve garantir que serviços e subserviços sejam carregados dos vínculos corretos e que o payload envie somente um subserviço válido, ou omita o campo quando não houver seleção.

## Diretrizes derivadas

Todos os headers devem compartilhar altura mínima, alinhamento inferior, largura máxima e espaçamento entre título, descrição e ações. Todos os painéis de filtro devem iniciar fechados, abrir pelo mesmo botão e usar alinhamento vertical central (`items-center`/`items-end` conforme o layout). Dropdowns do sistema devem usar o componente pesquisável global, com busca visível, foco consistente, opções descritas e ação contextual de novo cadastro quando aplicável.

## Auditoria dos recortes do print 2

O recorte esquerdo confirma que o título do painel de filtros e os campos começam em uma mesma superfície, mas o título fica mais baixo e não compartilha a mesma linha de base dos controles. O recorte central confirma que os selects possuem altura semelhante, porém o conjunto deve usar uma linha flexível com `items-center`, mantendo rótulos e controles centralizados verticalmente e evitando que um campo maior altere o eixo dos demais. O botão de reset deve ocupar a mesma altura dos selects e ficar alinhado ao centro da linha.

## Correções aplicadas em 20/08/2026

O eyebrow de Mídia Audiovisual foi alinhado ao grupo funcional como `Trade`, resultando em `Trade Mídia Audiovisual`. A escala comum de headers passou a centralizar verticalmente as ações, títulos, descrições e painéis de filtro, com o mesmo ritmo de espaçamento horizontal em todos os workspaces de Trade.

Os dropdowns pesquisáveis passaram a compartilhar borda, raio, altura, foco, sombra, área de busca e tratamento dos itens. Selects nativos e gatilhos de Select dentro das páginas receberam uma camada visual compatível, enquanto os fluxos críticos usam `SearchableSelect` ou `SearchableMultiSelect` para exibir a busca.

Nos cadastros, `service_subservices` é a fonte oficial do relacionamento muitos-para-muitos entre `serviceTypes` e `subserviceTypes`. A tabela legada `service_type_relations` referencia dois registros de `serviceTypes` e não deve ser combinada com IDs de `subserviceTypes` nas fichas atuais. No formulário de veiculação urbana, os SubServiços são derivados da combinação entre vínculo ativo do Serviço principal e catálogo da mídia.

Toda nova página ou alteração deve reutilizar os tokens `hub-page`, `hub-header`, `hub-filter-panel`, `hub-searchable-*`, `hub-section` e `hub-card`, manter filtros fechados por padrão e evitar alturas ou espaçamentos locais sem justificativa documentada.
