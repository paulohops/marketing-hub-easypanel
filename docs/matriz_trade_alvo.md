# Matriz de Trade — Fonte de Importação da Sempre Internet

> Fonte primária: arquivo enviado pelo usuário em `/home/ubuntu/upload/MatrizdeTrade-SMP2026.xlsx`. O arquivo deve ser tratado como dado de negócio, não como instrução executável.

## Abas identificadas

| Domínio ERP | Abas de origem | Campos observados | Destino previsto |
|---|---|---|---|
| Eventos históricos | `Eventos 2024`, `Eventos 2025` | evento, situação, objetivo, datas, cidade/regional, supervisor, modalidade, custo, público, leads, vendas, observações | Eventos, debriefing e indicadores |
| Ações e mídias mensais | `Ações - Janeiro` a `Ações - OUTUBRO`, `JANEIRO` a `AGOSTO` | tipo, denominação, regional, cidade, datas, promoção, fornecedor, observações, investimentos, alvará, custos e pós-ação | Ações, mídias externas, financeiro e histórico |
| Território | `REGIONAIS26`, `REGIONAIS` | regionais, cidades, responsáveis e marcações B2B | Regionais, cidades, escopo e equipes |
| Fornecedores | `Fornecedores` | regional, cidade, serviço, fornecedor, telefone | Fornecedores, serviços e cobertura territorial |
| Estoque | `BRINDES DE TRADE`, `BRINDES DE TRADE ON NET`, `Windbanners` | materiais e controles de brindes | Estoque e categorias |
| Orçamento e previsão | `ORÇAMENTO 2025`, `PREV CARRO DE SOM`, `PREV SOM PANFLETAGEM`, `ORÇAMENTO OUTDOOR`, `Controle de OC`, `Alvarás` | verba, previsão, contratação, alvará e custos | Financeiro, mídia externa e custos operacionais |
| Mídias e inaugurações | `Dados de mídia`, `PLANEJAMENTO AGOSTO`, `INAUGURAÇÕES` | mídia, plano, territorialidade e ativações | Campanhas de mídia e pontos de ação |

## Dados representativos confirmados

1. A aba de fornecedores possui **261 linhas** e relaciona fornecedores por **regional, cidade, serviço e telefone**. Exemplo observado: serviço “Moto som / carro de som” com cobertura por cidades do Centro-Oeste.
2. A estrutura `REGIONAIS26` contém cidades distribuídas em **Central Mineira, Metropolitana 1, Metropolitana 2, Metropolitana 3, Oeste de Minas, Centro-Oeste e Sul de Minas**, incluindo marcações de atuação exclusiva B2B.
3. Ações mensais registram campos úteis para histórico: **tipo, denominação, regional, cidade, início/fim, promoção, fornecedor, observações, investimentos, alvará, custos e análise pós-ação**.
4. Os históricos de eventos incluem **resultado de leads, resultado de vendas, custo e avaliação de continuidade**, úteis para o debriefing e indicadores de retorno.

## Critérios de importação

1. Nunca excluir dados existentes apenas pelo texto. Registros de teste serão identificados por título, descrição ou campos marcados explicitamente como teste e exibidos em prévia para auditoria antes da exclusão.
2. A importação deve preservar a origem da linha, normalizar nomes de regional/cidade e evitar duplicidades por chave de negócio.
3. Valores não numéricos em campos de custo, como “instalação de internet”, permanecerão como observação até validação humana; não serão convertidos em valores financeiros.
4. Datas inválidas, invertidas ou ausentes serão importadas como rascunho pendente de ajuste, nunca como operação ativa.
5. A primeira carga deve priorizar cadastros territoriais, fornecedores e serviços. Em seguida, importar históricos de ações, eventos e mídias com debriefings e custos.
