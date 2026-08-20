# Parecer técnico: formulários de parcerias e captação de leads

## Contexto

O cenário possui dois formulários de empresas diferentes: um formulário de **solicitação de parcerias** alimentado pelo RD Station e um formulário de **captação de leads** publicado em WordPress. A recomendação é centralizar a entrada no Marketing HUB, mas preservar a origem, a empresa e o tipo de formulário em cada registro.

O RD Station informa que Marketing, CRM e Conversas possuem APIs distintas, com autenticação, endpoints e particularidades próprios [1]. A API do RD Station Marketing usa OAuth2, com credenciais e tokens específicos para o produto conectado [2]. O serviço oficial de Webhooks permite enviar dados e atividades de contatos para sistemas externos [3]. Para WordPress com JetFormBuilder, a ação Call Webhook permite enviar os dados do formulário para uma URL externa após o envio [4].

## Recomendação

A melhor arquitetura para produção é usar **webhooks diretos para um endpoint de entrada do Marketing HUB**, com uma planilha opcional como auditoria ou contingência. O fluxo seria:

```text
RD Station — formulário de parcerias ──┐
                                       ├─> endpoint seguro de entrada ─> normalização ─> HUB
WordPress/JetFormBuilder — leads ──────┘                              ├─> Solicitações
                                                                      └─> Leads
```

O formulário de parcerias deve criar um registro no domínio de **Solicitações**, com status inicial `recebida` ou `em análise`. O formulário de captação deve criar um registro no domínio de **Leads**, pois lead e solicitação de parceria têm ciclos, responsáveis e indicadores diferentes. Eles podem aparecer em uma visão unificada de entradas, mas não devem ser misturados na mesma entidade operacional.

## A planilha facilita?

**Sim, para uma primeira fase ou para importação manual.** A Google Sheets API possui uma operação oficial para acrescentar linhas ao final de uma tabela, mediante autorização [5]. Uma planilha também facilita a conferência humana, a correção de campos e a carga inicial de dados.

Entretanto, a planilha não deve ser a fonte principal de produção se a expectativa for receber os registros automaticamente e em tempo real. Ela acrescenta risco de duplicidade, alterações manuais de cabeçalho, linhas incompletas, perda de histórico e atraso entre o envio do formulário e a leitura pelo sistema. O melhor uso é como **fila de conferência, backup operacional ou mecanismo de importação inicial**.

| Abordagem | Como funciona | Vantagens | Limitações | Complexidade |
|---|---|---|---|---|
| Webhooks diretos | RD Station e WordPress enviam cada submissão ao HUB | Tempo quase real, rastreabilidade e menos trabalho manual | Exige endpoint HTTPS, autenticação e configuração dos dois fornecedores | Média |
| Planilha intermediária | Dados são registrados em Google Sheets e depois importados/sincronizados | Fácil de conferir, corrigir e começar sem modelar tudo | Não é ideal para tempo real; exige padronização, deduplicação e controle de acesso | Baixa |
| Plataforma de automação | RD/WordPress enviam para Make, Zapier ou similar, que entrega ao HUB e/ou Sheets | Configuração visual, logs e transformações rápidas | Custo recorrente, dependência de terceiro e limites por volume | Baixa a média |

## Estrutura mínima de dados

Os dois fluxos devem usar um formato normalizado. Os campos essenciais são:

| Campo | Finalidade |
|---|---|
| `sourceSystem` | `rd_station` ou `wordpress` |
| `sourceAccount` | Identifica a empresa ou conta de origem |
| `formType` | `partnership_request` ou `lead_capture` |
| `externalSubmissionId` | Evita duplicidade quando o mesmo envio for reenviado |
| `name`, `email`, `phone` | Dados de contato normalizados |
| `companyName` | Empresa do contato, quando aplicável |
| `city` | Localidade para roteamento e análise |
| `message` | Texto livre ou descrição da oportunidade |
| `consent` | Registro de consentimento, quando coletado |
| `submittedAt` | Data/hora original do formulário |
| `rawPayload` | Payload original para auditoria e reprocessamento |
| `receivedAt` | Data/hora em que o HUB recebeu a integração |
| `processingStatus` | `received`, `processed`, `duplicate` ou `error` |

A idempotência deve ser baseada em `sourceSystem + sourceAccount + externalSubmissionId`. O endpoint também deve validar uma assinatura ou segredo por origem, limitar tamanho do payload, registrar logs sem expor dados sensíveis e responder rapidamente; processamento posterior pode ocorrer em fila interna.

## Como eu estruturaria as duas empresas

Mesmo que os dois formulários tenham campos parecidos, eu manteria duas configurações de origem: **Empresa A / RD Station / Parcerias** e **Empresa B / WordPress / Leads**. Cada configuração teria seu próprio segredo, mapeamento de campos e responsável inicial. Assim, uma alteração no formulário do WordPress não quebra a entrada do RD Station.

Se for utilizada uma planilha, recomendo uma tabela única com as colunas normalizadas acima e uma coluna `importBatchId`. Alternativamente, podem existir duas abas de entrada, uma para parcerias e outra para leads, mais uma aba consolidada somente para visualização. Não recomendo duas planilhas com layouts diferentes sem um dicionário de campos.

## Próxima etapa recomendada

Antes de implementar, é necessário confirmar quatro pontos: qual produto RD está sendo usado — Marketing ou CRM —, qual plugin/form builder está instalado no WordPress, se a planilha será Google Sheets ou arquivo Excel, e quais campos existem em cada formulário. Com essas informações, o próximo passo pode ser criar os dois mapeamentos, o endpoint seguro e a tela de monitoramento de entradas sem depender de importações manuais.

## Referências

[1]: https://developers.rdstation.com/reference/welcome "RD Station Developers — Welcome"
[2]: https://developers.rdstation.com/reference/autentica%C3%A7%C3%A3o "RD Station Developers — Authentication"
[3]: https://developers.rdstation.com/reference/webhooks "RD Station Developers — Webhook Service"
[4]: https://jetformbuilder.com/features/call-webhook/ "JetFormBuilder — Call Webhook Action"
[5]: https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append "Google Sheets API — spreadsheets.values.append"
