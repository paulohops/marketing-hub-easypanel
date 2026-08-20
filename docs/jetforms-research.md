# Avaliação técnica do JetForms

## Fonte oficial consultada
- [JetFormBuilder: Call Webhook Action](https://jetformbuilder.com/features/call-webhook/)

A documentação oficial descreve a ação **Call Webhook** como um pós-envio que conecta formulários a aplicativos de terceiros, citando Zapier e Make, e informa que esses serviços fornecem uma URL de webhook para receber os dados enviados pelo formulário. A página também mostra a configuração de uma URL de webhook no campo **Webhook URL**.

## Implicação para o Marketing HUB
É tecnicamente viável receber submissões do JetForms em um endpoint HTTP próprio do Marketing HUB. A implementação recomendada é criar um endpoint autenticado por segredo, por exemplo `/api/requests/jetforms`, que aceite o payload enviado pelo formulário, valide e normalize os campos para o contrato já existente de `requests.create`, crie a solicitação e registre o histórico/auditoria. A ação do JetForms deve apontar diretamente para esse endpoint ou, se necessário, para uma camada intermediária como Make/Zapier.

## Pendências para implementação
Ainda é necessário confirmar o formato exato do payload configurado no formulário, o método/headers aceitos pelo endpoint, o segredo compartilhado e o mapeamento dos campos de negócio (`title`, `description`, `requestType`, `priority`, cidade/regional e vínculos). Nenhuma credencial do usuário foi fornecida; portanto, esta rodada fica restrita à avaliação e arquitetura, sem ativar conector nem publicar endpoint de produção.

## Nota de segurança
O endpoint futuro deve validar método, tamanho do corpo, esquema, segredo de assinatura, idempotência e permissões de origem. Falhas devem ser registradas com correlação, sem retornar dados sensíveis nem aceitar campos administrativos não mapeados.

## Referências
[1]: https://jetformbuilder.com/features/call-webhook/ "JetFormBuilder: Call Webhook Action Overview"

Última atualização: 2026-08-20.

---

## Contrato interno consultado
O router `server/routers/requests.ts` já define os campos de criação e as validações da solicitação. A futura integração deve reutilizar essa validação e o mesmo fluxo de histórico/auditoria, em vez de duplicar regras no endpoint.

### Arquitetura proposta
```text
JetFormBuilder
  -> POST HTTPS com segredo compartilhado
  -> /api/requests/jetforms
  -> validação + normalização + idempotência
  -> requests.create / lógica compartilhada
  -> solicitação + histórico inicial + auditoria
```

### Opções
| Abordagem | Trade-offs | Custo | Complexidade |
|---|---|---:|---:|
| Endpoint direto do Marketing HUB | Menor latência e menos dependências; exige segredo, validação e configuração de URL pública | Baixo | Média |
| JetForms -> Make/Zapier -> endpoint do HUB | Melhor observabilidade e transformação visual; adiciona dependência e custo da plataforma intermediária | Variável | Baixa a média |
| Exportação/importação manual | Sem endpoint público; não é automática e aumenta retrabalho | Baixo | Baixa |

## Segunda fonte oficial consultada
- [JetFormBuilder: Formless Actions Endpoints](https://jetformbuilder.com/addons/formless-actions-endpoints/)

A página oficial descreve o addon como capaz de executar ações pós-envio sem um formulário visível e de enviar submissões entre sites. Ela informa que o addon configura um **REST API Endpoint**, com namespace e path definidos pelo administrador, estrutura de dados com tipos/valores de exemplo, opção de restringir permissões e registro de requisições. A própria página indica que o recurso é um addon **Pro**.

## Conclusão refinada
Para o caso do Marketing HUB, a ação **Call Webhook** é o caminho mais direto para o fluxo JetForms → HUB. O addon Formless Actions Endpoints pode ser útil se a origem também precisar expor/consumir endpoints REST gerenciados pelo WordPress, mas não é obrigatório para simplesmente enviar uma submissão para o endpoint do HUB. A decisão entre endpoint direto e Make/Zapier deve depender da disponibilidade de URL pública HTTPS, governança do segredo e necessidade de transformação/monitoramento no WordPress.

[2]: https://jetformbuilder.com/addons/formless-actions-endpoints/ "JetFormBuilder: Formless Actions Endpoints"

## Avaliação ampliada: RD Station e dois formulários

A documentação oficial do RD Station informa que a API de Marketing permite gerar eventos, incluindo conversão, e-commerce, qualificação, chat e chamada, e que o serviço de Webhooks automatiza o envio de dados e atividades de contatos do RD Station Marketing e CRM para sistemas externos. A documentação do webhook personalizado descreve o uso de uma URL de entrada capaz de ler e consumir os dados enviados pelo RD Station.

A documentação oficial do JetFormBuilder descreve a ação **Call Webhook** como uma ação pós-envio que conecta o formulário a aplicações de terceiros, como Zapier ou Make, e permite inserir a URL do webhook no formulário para transferir os dados para outro sistema. Isso é suficiente para o formulário WordPress enviar os campos de captação de leads diretamente ao endpoint de integração, sem depender obrigatoriamente de uma planilha.

### Fontes consultadas nesta ampliação
- [RD Station Developers — Webhook Service](https://developers.rdstation.com/reference/webhooks)
- [RD Station Help — Customizable integration with own system (Webhook)](https://ajuda.rdstation.com/s/article/Customizable-integration-with-own-system-Webhook?language=en_US)
- [JetFormBuilder — Call Webhook Action](https://jetformbuilder.com/features/call-webhook/)

## RD Station, contas distintas e planilha

A documentação de desenvolvedores do RD Station informa que Marketing, CRM e Conversas possuem APIs distintas, com autenticação, endpoints e particularidades próprios. Portanto, a empresa/formulário que estiver no RD Station Marketing não deve ser tratado automaticamente como se estivesse no RD Station CRM; o produto exato precisa ser confirmado antes da implementação.

A API do RD Station Marketing usa OAuth2. As credenciais dão acesso a um produto RD Station específico; o fluxo utiliza client_id, client_secret, access token e refresh token. Se as duas empresas tiverem contas RD diferentes, a integração deverá preservar a conta/origem de cada submissão e, se necessário, manter credenciais separadas.

A Google Sheets API possui uma operação oficial para acrescentar valores ao fim de uma tabela, exigindo spreadsheet ID, intervalo e autorização OAuth. Isso torna viável usar uma planilha como caixa de entrada ou mecanismo de importação, mas exige controle de duplicidade, cabeçalhos padronizados e credenciais com escopo adequado.

### Fontes adicionais
- [RD Station Developers — Welcome](https://developers.rdstation.com/reference/welcome)
- [RD Station Developers — Authentication](https://developers.rdstation.com/reference/autentica%C3%A7%C3%A3o)
- [Google Sheets API — spreadsheets.values.append](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append)
