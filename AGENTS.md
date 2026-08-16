# Instruções para agentes de código

Este repositório é o **Marketing HUB**, uma plataforma de gestão de trade marketing. Antes de modificar o sistema, leia [`docs/ai-system-guide.md`](docs/ai-system-guide.md). O guia é a fonte de verdade para arquitetura, rotas, permissões, padrões visuais, comportamento de formulários e regras anti-gambiarra.

## Ordem obrigatória de leitura

Leia `client/src/App.tsx`, `client/src/pages/ProtectedModule.tsx`, `client/src/components/DashboardLayout.tsx`, `client/src/index.css`, `client/src/pages/CampaignsWorkspace.tsx`, `client/src/pages/ActionsWorkspace.tsx` e os routers tRPC correspondentes antes de criar uma tela operacional semelhante.

## Regras essenciais

A solução deve reutilizar `DashboardLayout`, tokens semânticos, componentes de `client/src/components/ui`, o padrão lista → detalhe → diálogo/formulário e os hooks de permissão e densidade. Não crie uma segunda navegação, um segundo sistema de cores, CSS global específico ou uma rota paralela para contornar o fluxo existente.

Toda mutation deve validar a regra no backend, exigir a permissão apropriada, registrar auditoria quando alterar dados operacionais e invalidar as queries relacionadas após sucesso. Formulários dependentes devem filtrar opções e limpar valores que ficaram incompatíveis. Custos, datas, vínculos territoriais, fornecedores, serviços, estoque, status e evidências não podem ser confiados somente ao frontend.

Antes de concluir, valide loading, vazio, erro, detalhe, formulário, tema escuro, viewport estreito e largura de 1280 px. Execute `pnpm check`, `pnpm test` e `pnpm build` sempre que possível e registre qualquer limitação.
