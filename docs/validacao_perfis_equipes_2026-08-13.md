# Validação visual — perfis e equipes

Em 13 de agosto de 2026, foram revisadas as rotas administrativas `/equipes`, `/perfil` e `/configuracoes` na visualização desktop de 1280 px.

| Rota | Evidência verificada | Resultado |
|---|---|---|
| `/equipes` | Organograma, seletor de gestor direto, contagem de colaboradores e atalho para edição de perfil | Aprovado visualmente |
| `/perfil` | Foto existente, ação de escolher foto, instrução de formatos e painel de conta | Aprovado visualmente |
| `/configuracoes` | Cartões de Usuários e permissões, Equipes, importação e exportação | Aprovado visualmente |

As imagens de avatar usam `object-contain`, preservando a imagem sem corte na lista de usuários, no perfil e no organograma. O envio de foto prepara uma versão quadrada em canvas antes do armazenamento seguro.
