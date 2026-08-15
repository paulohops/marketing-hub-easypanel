# Auditoria visual — padronização de listas

**Data:** 15/08/2026  
**Objetivo:** consolidar cantos de 10 px e itens de lista visualmente independentes no Marketing HUB.

## Padrões globais aplicados

| Elemento | Padrão aplicado | Implementação principal |
| --- | --- | --- |
| Cantos de interface | Raio base de **10 px** | Tokens globais e componentes de Card, Button, Input e Textarea |
| Listas operacionais | Cada registro tem superfície, espaçamento e borda próprios | Classes globais de lista e cartões de módulo |
| Tabelas operacionais | Linhas de dados com percepção de item independente | Componente de tabela reutilizável |
| Estado responsivo | Conteúdo e controles quebram de forma controlada | Grades móveis, limites de largura e empilhamento de ações |

## Auditoria por código

| Área | Arquivo auditado | Origem do padrão | Cobertura confirmada |
| --- | --- | --- | --- |
| Base compartilhada | `client/src/index.css` | Global | Token de raio de 10 px e espaçamento/superfície para listas com itens independentes |
| Base tabular | `client/src/components/ui/table.tsx` | Global | Linhas tabulares operacionais com separação visual, preservando cabeçalho e colunas |
| Gestão financeira | `client/src/pages/FinanceWorkspace.tsx` | Global + módulo | Painéis financeiros e registros usam os tokens de superfície e raio; a leitura móvel é vertical |
| Gestão de estoque | `client/src/pages/InventoryWorkspace.tsx` | Módulo | Cartões de posição de estoque separados e controles organizados em grade móvel |
| Mídias | `client/src/pages/MediaWorkspace.tsx` | Global + módulo | Lista de mídias herdando o padrão de itens independentes e controles por registro |
| Mídia Urbana | `client/src/pages/MediaWorkspace.tsx`, `client/src/pages/UrbanPointDetails.tsx` e `client/src/pages/UrbanVeiculationPage.tsx` | Global + módulo | Pontos, campanhas e veiculações organizados em painéis e cartões independentes |
| Cadastros | `client/src/pages/CompaniesWorkspace.tsx` | Módulo | Seleção de Empresas em itens separados com logotipo, indicadores e ação de abertura |
| Cadastros | `client/src/components/OperationalRegistriesPanel.tsx` | Global + componente | Grades e listas de cadastros usam superfícies individuais e tokens compartilhados |
| Configurações | `client/src/pages/SettingsWorkspace.tsx` | Global + módulo | Entradas administrativas apresentam cartões independentes e cantos padronizados |
| Configurações | `client/src/pages/UserAdministrationWorkspace.tsx` | Global + módulo | Pessoas, permissões e controles mantêm separação visual em telas estreitas |

## Matriz de revisão visual

| Área | Rota revisada | Desktop | Celular | Resultado |
| --- | --- | --- | --- | --- |
| Campanhas | `/campanhas` | Lista com cartões separados e dados compactos | Conteúdo mantém leitura sem sobreposição | Aprovado |
| Ações | `/acoes` | Itens separados e controles preservados | Metadados e ações adaptados | Aprovado |
| Eventos | `/eventos` | Registros separados e pós-evento preservado | Cartões e filtros legíveis | Aprovado |
| Empresas | `/empresas` | Seleção em itens individuais | Logotipo, dados e ação “Ver ficha” legíveis | Aprovado |
| Estoque | `/estoque` | Itens e posição de estoque separados | Ações reorganizadas em grade móvel; sem extravasamento | Aprovado |
| Financeiro | `/financeiro` | Blocos de planejamento, custos e notas separados | Campos e controles mantêm leitura vertical | Aprovado |
| Mídia Urbana | `/midias/urbana` | Pontos de mídia e veiculações organizados em cartões | Filtros, cards e ações permanecem acessíveis | Aprovado |
| Notificações | `/notificacoes` | Alertas visualmente independentes | Cartões seguem a referência aprovada, com leitura e ação preservadas | Aprovado |
| Configurações | `/configuracoes` | Entradas administrativas em cartões separados | Ações e descrições mantêm espaçamento | Aprovado |
| Equipes | `/equipes` | Painéis de contexto e estado vazio separados | Conteúdo centralizado e legível | Aprovado |
| Usuários e permissões | `/usuarios` | Cartões de pessoa e permissões estruturados | Controles preservados na largura estreita | Aprovado |

## Observações

As exceções mantidas são intencionais: avatares, indicadores de status e ícones circulares não receberam o raio de 10 px, pois representam identidades ou marcadores compactos. Estruturas que são realmente tabulares preservam cabeçalho e relações de coluna, mas suas linhas recebem separação visual para evitar uma lista contínua.
