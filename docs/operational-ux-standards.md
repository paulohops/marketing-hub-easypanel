# Padrões globais de UX operacional

Este documento é a referência obrigatória para novas telas e alterações nos módulos operacionais do Marketing HUB. O módulo de **Ações** é a referência visual e comportamental principal. Cada módulo pode manter seus próprios vínculos e regras de negócio, mas deve preservar a mesma identidade visual, hierarquia de informação, densidade, acessibilidade e fluxo de interação.

## Princípio de identidade

Toda nova tela operacional deve reutilizar `DashboardLayout`, tokens semânticos, componentes de `client/src/components/ui` e os padrões compartilhados em `client/src/components/OperationalPatterns.tsx`. Não criar uma paleta, navegação, sistema de status, sistema de anexos ou estrutura de histórico paralelos.

O fluxo recomendado é **lista → detalhe → diálogo/formulário**. O cabeçalho do detalhe deve concentrar voltar, identificação visual, edição, reagendamento e status. Em viewport estreito, os controles devem quebrar com segurança e nunca causar overflow horizontal.

## Status

Status operacionais devem aparecer como um seletor no cabeçalho do detalhe, com rótulos legíveis e cores semânticas. Alterações que exigem contexto devem abrir o diálogo global de confirmação. O diálogo deve solicitar o motivo e, quando aplicável, a pasta de motivo e evidências. A validação final é sempre feita no backend, com auditoria e invalidação das consultas relacionadas.

## Histórico

O histórico deve aparecer depois do conteúdo operacional principal, em uma lista vertical com os registros mais recentes primeiro. Mostrar inicialmente os cinco registros mais recentes e oferecer uma ação para expandir. Cada alteração com motivo ou evidência deve exibir a ação **Ver motivo e evidências**, abrindo um diálogo separado. Evidências de histórico não devem ser misturadas com a galeria geral de artes ou evidências da entidade.

## Debriefing

O debriefing deve seguir o cartão global de Ações: nota geral, história e resultado, avaliação e aprendizados, métricas operacionais, pontos positivos, pontos a melhorar, decisões de resultado e data de conclusão. O botão de salvar deve permanecer no final do cartão e o formulário deve respeitar permissões de escrita. Módulos diferentes podem alterar os rótulos de negócio, mas não a estrutura visual sem justificativa registrada.

## Coordenadas

Latitude e longitude devem ser editadas em um único campo **Latitude e longitude**, aceitando colagem direta do Google Maps. O parser compartilhado deve validar os dois valores e persistir latitude e longitude separadamente para mapas e relatórios. Não criar campos separados em novos formulários sem uma justificativa técnica documentada.

## Anexos

Artes, spots e evidências gerais devem usar galerias com o botão de adicionar acima e miniaturas abaixo. Evidências que justificam status ou reagendamento pertencem à pasta do histórico e devem ser exibidas somente no diálogo de motivo e evidências. O controle de anexar não deve exibir preview inline.

## Checklist de alteração

Antes de publicar uma alteração operacional, verificar loading, vazio, erro, detalhe, formulário, permissões, tema escuro, viewport estreito, largura de 1280 px, auditoria, invalidação de queries, dependências de banco e testes do fluxo principal. Ao adicionar um novo padrão, primeiro atualizar este documento e os componentes compartilhados; depois aplicar o padrão aos módulos necessários.

> Regra permanente: novas funcionalidades devem parecer e funcionar como parte do módulo de Ações, mesmo quando a interação específica do módulo for diferente.
