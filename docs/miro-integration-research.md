# Pesquisa de integração com Miro

## Fonte oficial consultada

- [OAuth 2.0 e Miro](https://developers.miro.com/docs/getting-started-with-oauth)

## Constatações

O Miro oferece integração por API REST em nome de cada pessoa usuária, por meio do fluxo OAuth 2.0 de código de autorização. A aplicação precisa ser criada nas configurações de desenvolvimento do Miro, ter uma URI de redirecionamento cadastrada e solicitar os escopos compatíveis com a leitura e escrita de boards.

O retorno de autorização fornece token de acesso, token de renovação, pessoa usuária, time e escopos. Os tokens devem ser guardados de forma segura, vinculados à pessoa usuária no banco de dados, e jamais expostos ao navegador. A documentação informa validade típica de 60 minutos para o token de acesso e 60 dias para o token de renovação; o backend deve renovar o acesso antes de chamadas à API.

O endpoint de autorização é `https://miro.com/oauth/authorize`; a troca e a renovação de token usam `https://api.miro.com/v1/oauth/token`; e a API REST aceita o cabeçalho `Authorization: Bearer <token>`. A primeira abordagem recomendada para o Marketing HUB é permitir que cada pessoa conecte uma conta Miro, selecione um board e use o sistema para criar, listar e atualizar conteúdos diretamente no board com trilha de auditoria.

## Estado da sessão

Há um conector Miro listado na configuração da sessão, porém desabilitado em 14 de agosto de 2026. Nenhuma credencial ou conexão foi ativada nesta etapa.
