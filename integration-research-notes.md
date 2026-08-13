# Pesquisa de integração — Trello

Em 13 de agosto de 2026, a documentação oficial do Trello confirmou que a API REST suporta criar e atualizar cartões, bem como atualizar e criar listas. Isso permite oferecer uma experiência visual de quadro própria no Trade HUB, com alterações persistidas no Trello por meio de API autenticada no servidor.

Para quadros privados, a incorporação em `iframe` não é um caminho suportado com segurança pelo Trello; há resposta da comunidade Atlassian explicitando que a incorporação de um quadro privado em site externo não é suportada por motivos de segurança. Portanto, a interface deve reproduzir a experiência de quadro dentro do Trade HUB e usar a API para leitura e escrita, preservando o botão para abrir o quadro original quando necessário.

## Referências

1. [Trello Cards API — Atlassian Developer](https://developer.atlassian.com/cloud/trello/rest/api-group-cards/)
2. [Trello REST API introduction — Atlassian Developer](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/)
3. [Can I embed private board to my site? — Atlassian Community](https://community.atlassian.com/forums/Trello-questions/Can-I-embed-private-board-to-my-site/qaq-p/715012)
