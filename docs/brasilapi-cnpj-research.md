# Pesquisa — BrasilAPI para CNPJ

Fonte oficial consultada: https://brasilapi.com.br/docs

A documentação oficial descreve a consulta de informações empresariais por CNPJ e indica o endpoint no formato `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}`. O CNPJ pode ser enviado com ou sem pontuação e deve representar 14 caracteres. A resposta JSON contém, entre outros campos, `razao_social`, `nome_fantasia`, `logradouro`, `numero`, `complemento`, `bairro`, `municipio`, `uf`, `cep`, `ddd_telefone_1`, `ddd_telefone_2`, `email`, `situacao_cadastral`, `descricao_situacao_cadastral`, `cnae_fiscal` e `cnae_fiscal_descricao`.

Decisão de integração: a consulta deve ocorrer no backend do Marketing HUB, com timeout, validação do CNPJ normalizado e tratamento de respostas 400/404/5xx. O frontend receberá somente os campos necessários para preencher o formulário; a consulta não salvará dados automaticamente. O usuário deverá revisar os dados antes de criar ou atualizar o fornecedor.

Observação: a API é uma fonte de enriquecimento cadastral, não substitui a revisão fiscal interna nem deve ser usada para sobrescrever automaticamente dados já confirmados no sistema.
