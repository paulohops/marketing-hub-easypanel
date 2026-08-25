# Auditoria e padronização visual do Marketing HUB

**Data:** 25 de agosto de 2026
**Escopo:** shell autenticado, dashboard, componentes de formulário, superfícies, tabelas, estados vazios, telas públicas, responsividade e foco acessível.

## Diagnóstico inicial

O sistema já possuía uma direção visual clara baseada em verde primário, laranja de destaque, fundo claro/escuro e uma camada `hub-*` criada para aproximar os módulos de uma mesma anatomia. O problema principal não era ausência de identidade, mas **adoção incompleta**: muitos módulos ainda combinavam tokens semânticos com valores locais de padding, margin, radius e shadow.

A base tinha 46 páginas de produção e apenas uma parcela pequena importava diretamente `WorkspaceChrome`. O shell global já limitava o conteúdo, mas páginas legadas continuavam trazendo seus próprios wrappers, margens verticais, cards com `rounded-xl`/`rounded-2xl` e sombras hardcoded. Isso permitia diferenças perceptíveis entre telas, especialmente em headers, listas, formulários, estados vazios e modais.

| Área auditada | Situação encontrada | Risco visual |
|---|---|---|
| Espaçamento | Uso disperso de `mt-*`, `p-*`, `gap-*` e `space-y-*`, com concentração em `p-4`, `p-5`, `p-6` e `gap-2`/`gap-3` | Ritmo vertical irregular e excesso de respiro em algumas telas |
| Superfícies | Cards e listas alternando raios e sombras fixas | Hierarquia visual inconsistente |
| Shell | `WorkspaceChrome` coexistindo com wrappers próprios | Larguras e margens diferentes entre módulos |
| Formulários | Inputs e selects com alturas e raios próximos, mas não idênticos | Controles desalinhados em grids e diálogos |
| Tabelas | Padding e raio definidos localmente no primitivo | Densidade diferente de cards e listas |
| Estados vazios | Primitivo com `gap-6`, `rounded-lg`, `p-6`/`md:p-12` | Estado vazio visualmente mais espaçado que o restante |
| Navegação | Sidebar com valores locais de altura e raio | Shell não seguia os tokens de controle |
| Acessibilidade visual | Componentes base tinham foco, mas controles legados nem sempre | Foco pouco previsível em algumas páginas |

## Contrato visual adotado

O sistema passa a usar tokens CSS como contrato único. O shell externo é responsável apenas por largura, padding de viewport e gap entre seções; cards e seus subcomponentes controlam apenas o espaço interno. Essa separação evita o padrão problemático de somar padding no wrapper, no card e no `CardContent` simultaneamente.

| Token | Valor | Uso |
|---|---:|---|
| `--hub-space-1` a `--hub-space-10` | escala de 0,25rem a 2,5rem | gaps, padding e separação entre elementos |
| `--hub-shell-inline` | `clamp(1rem, 2.8vw, 2.5rem)` | respiro horizontal do viewport |
| `--hub-shell-top` | `clamp(0.75rem, 1.8vw, 1.5rem)` | respiro superior do conteúdo |
| `--hub-content-max` | `1180px` | largura máxima dos workspaces |
| `--hub-section-gap` | `1.25rem` | distância entre seções principais |
| `--hub-grid-gap` | `1rem` | distância entre cards e colunas |
| `--hub-card-padding` | `1.25rem` | padding interno padrão de card |
| `--hub-card-radius` | `1rem` | raio de cards e superfícies |
| `--hub-control-radius` | `0.625rem` | raio de inputs, botões, badges e itens interativos |
| `--hub-control-height` | `2.25rem` | altura padrão de input, select e botão |
| `--hub-card-shadow` | sombra curta e discreta | superfície em repouso |
| `--hub-card-shadow-hover` | sombra elevada | hover de cards e itens interativos |
| `--hub-focus-shadow` | anel baseado em `--ring` | foco visível e consistente |

## Correções realizadas

A base `WorkspaceChrome` agora marca o shell com `hub-runtime-shell`, e o `ProtectedModule` envolve todos os workspaces protegidos com esse contrato. Assim, páginas novas e legadas recebem a mesma contenção de largura e não acumulam margens externas imprevisíveis.

O dashboard principal foi migrado para `WorkspaceShell`, `WorkspaceHeader`, `WorkspaceSection` e `WorkspaceCard`. Métricas, agenda, prioridades e estado vazio passaram a usar classes compartilhadas (`hub-metric-card`, `hub-record-row`, `hub-priority-item`, `hub-empty-state` e `hub-status-note`). O skeleton de carregamento foi refeito para espelhar sidebar desktop, header mobile, cards e gaps do shell real, reduzindo o salto visual durante o carregamento.

Botões, inputs, textareas, badges, tabelas, diálogos, labels e estados vazios passaram a derivar raio, altura, padding, sombra e foco dos tokens globais. A navegação desktop/mobile também usa a mesma altura e o mesmo raio dos controles. Links e botões legados dentro do dashboard recebem foco visível consistente.

As telas públicas de login e 404 foram harmonizadas com as mesmas superfícies e tokens, mas continuam preservando sua composição própria: login permanece uma experiência pública de entrada e o 404 permanece um estado de erro independente do dashboard.

## Regras para próximas telas

Toda tela protegida deve usar `WorkspaceShell` quando tiver uma composição de página completa. O cabeçalho deve usar `WorkspaceHeader`, blocos com título devem usar `WorkspaceSection` e superfícies devem usar `WorkspaceCard` ou o primitivo `Card`. Não se deve adicionar padding ao `CardContent` para compensar um card sem espaço interno; o card já possui `--hub-card-padding`.

Margens `mt-*` devem ser evitadas para separar seções principais. A composição deve usar `gap-[var(--hub-section-gap)]` ou `gap-[var(--hub-grid-gap)]`. Valores locais são aceitáveis apenas quando representam uma necessidade interna específica, como a distância entre label e campo ou um alinhamento iconográfico.

Para qualquer controle novo, usar os componentes compartilhados de `client/src/components/ui`. Se um módulo precisar de uma exceção visual, ela deve ser expressa por uma classe semântica `hub-*` e registrada nesta documentação, em vez de espalhar valores arbitrários pela página.

## Validação

A checagem de tipos e a suíte de testes foram executadas depois da primeira rodada de padronização. O build de produção também foi executado e gerou frontend e backend normalmente. O servidor local respondeu HTTP 200 para a página principal e entregou o título `Marketing HUB — Cluster MG`.

A inspeção visual interativa no navegador conectado não pôde ser concluída porque a sessão do navegador retornou indisponibilidade do receptor. Por isso, a validação visual desta etapa combina análise estática de tokens/classes, renderização do build, resposta HTTP local e testes existentes de tema, densidade e acessibilidade. Uma captura manual adicional em desktop e mobile continua recomendada após o próximo deploy em ambiente com autenticação real.

## Pontos residuais

A uniformização estrutural do shell e dos componentes base está implementada, mas ainda existem páginas antigas com classes locais internas. Elas não quebram mais a contenção externa, porém podem manter pequenas diferenças de densidade em tabelas, filtros ou blocos especializados. A próxima rodada pode migrar essas páginas em lote, começando por `RegistryEntityWorkspace`, `FinanceWorkspace`, `MediaWorkspace` e `OperationalRegistriesWorkspace`.

A centralização total do registro de rotas continua separada da camada visual, pois é uma mudança de arquitetura de navegação e permissões. Ela não é necessária para corrigir padding, margem ou consistência de superfície.

## Referências internas

[1]: ../client/src/index.css "Tokens globais e anatomia visual"
[2]: ../client/src/components/WorkspaceChrome.tsx "Wrappers canônicos de workspace"
[3]: ../client/src/components/DashboardLayout.tsx "Shell de navegação desktop/mobile"
[4]: ../client/src/components/DashboardLayoutSkeleton.tsx "Skeleton alinhado ao shell"
[5]: ../client/src/components/ui/button.tsx "Primitivo de botão"
[6]: ../client/src/components/ui/input.tsx "Primitivo de input"
[7]: ../client/src/components/ui/dialog.tsx "Primitivo de diálogo"
[8]: ../client/src/pages/DashboardPage.tsx "Dashboard migrado para o shell canônico"
