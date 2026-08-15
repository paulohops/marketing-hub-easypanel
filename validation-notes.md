# Evidências de validação visual

Em 12 de agosto de 2026, foram verificados os principais fluxos em viewport móvel de 390 × 844 pixels: visão geral, configurações, estoque, financeiro, mídias, ações, eventos e indicadores.

As telas mantiveram cabeçalho acessível, ações principais com largura adequada para toque, cartões sem sobreposição visível, tipografia legível e estados vazios orientativos. A navegação lateral permanece recolhida em dispositivos móveis, preservando a área útil do conteúdo.

Também foram verificados os painéis de indicadores, configurações, estoque e financeiro em desktop. A hierarquia visual, estados vazios e formulários permaneceram estáveis na renderização observada.

## Revisão de 13 de agosto de 2026

Foi verificada a tela de **Trello** com a integração autenticada: o quadro individual retorna listas e cartões pelo servidor, sem depender de iframe, e mantém o acesso ao quadro original no Trello.

A ficha de **Lojas** exibe foto, informações cadastrais e painel de supervisores comerciais vinculados, incluindo a ação de desvincular. O **Financeiro** mostra planejamento anual, previsões operacionais e painel de contratos e ordens de compra. A rota de **Exportar relatórios** mostra intervalo, registros disponíveis e exportação XLSX.

As listas de **Eventos**, **Mídias** e **Mídias externas** apresentam os filtros territoriais e operacionais. Após ajuste, a lista de **Ações** também apresenta filtros explícitos por regional e cidade, além do resumo de valor previsto, pago e saldo.

As validações automatizadas incluíram `pnpm check` sem erros e `pnpm test -- --run` com 153 testes aprovados antes do último ajuste de Ações; o teste específico de Ações foi reexecutado e aprovado após esse ajuste.

## Revisão de 15 de agosto de 2026 — Mídia Urbana

As rotas `/midias/1` e `/midias/veiculacao/1` foram revisadas visualmente em desktop e no viewport móvel de 375 × 812 pixels. A ficha do ponto permanece isolada dos painéis genéricos de Mídias; os blocos de cadastro, histórico e mídias registradas se reorganizam verticalmente. Na ficha de veiculação, status, planejamento, debriefing, evidências e histórico permanecem legíveis, sem sobreposição ou rolagem horizontal perceptível.

As mesmas rotas foram revisadas em tablet de 768 × 1024 pixels. A ficha de veiculação preservou os cartões de status e dados operacionais em duas colunas, enquanto a ficha do ponto será mantida em empilhamento vertical nesse espaço útil menor para evitar compressão da descrição do cabeçalho junto à barra lateral.

A validação automatizada específica executou `pnpm check` e as suítes `App.test.tsx`, `MediaWorkspace.test.tsx` e `UrbanVeiculationPage.test.tsx`, totalizando 17 testes aprovados. Após o ajuste final de composição para tablet, a suíte completa `pnpm test -- --run` foi aprovada com 181 testes em 56 arquivos.
