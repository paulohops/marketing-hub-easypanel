# Referência de importação — Matriz de Trade SMP 2026

Fonte: `/home/ubuntu/upload/MatrizdeTrade-SMP2026.xlsx`, enviada pelo usuário.

## Escopo desta rodada

- Popular Cadastros com exemplos reais extraídos da planilha, sem dados inventados.
- Estruturar a operação OnNet com regionais e cidades relacionadas.
- Usar a aba `Fornecedores` para criar fornecedores com serviço, telefone, cidade e regional de cobertura.

## Dados territoriais observados

- A aba `REGIONAIS26` lista sete agrupamentos de cidades: Central Mineira, Metropolitana 1, Metropolitana 2, Metropolitana 3, Oeste de Minas, Centro Oeste e Sul de Minas.
- A aba `REGIONAIS` confirma, entre outras, as cidades de Metropolitana 2: Bonfim, Brumadinho, Casa Branca, Ibirité, Mário Campos, Nova Lima, Piedade dos Gerais, Rio Manso e Sarzedo.
- A mesma aba traz cidades de Metropolitana 3: Baldim, Cachoeira da Prata, Capim Branco, Cordisburgo, Fortuna de Minas, Funilândia, Inhaúma, Jaboticatubas, Jequitibá, Lagoa Santa, Matozinhos, Paraopeba, Prudente de Morais, Santana de Pirapama e Sete Lagoas.

## Dados de fornecedores observados

- A aba `Fornecedores` contém as colunas Regional, Cidade, Serviço, Fornecedor e Telefone.
- Exemplos verificados: Emerson em Arcos e Córrego Fundo; Juarez em Camacho e Itapecerica; Thiago em Ijaci, Lavras e Perdões; Adriana em Campo Belo e Candeias. O serviço informado nesses exemplos é Moto som / carro de som.

## Limites

- A planilha não identifica explicitamente, por coluna, quais grupos territoriais pertencem à OnNet. A importação inicial deve preservar os agrupamentos disponíveis e vincular a empresa OnNet aos territórios destinados a teste, deixando a atribuição de cobertura auditável e editável.

## Referência pública complementar da OnNet

- Em 15/08/2026, o site institucional da [OnNet Telecom](https://www.onnetmais.com.br/) listava lojas em Patrocínio, João Pinheiro, Varjão de Minas, São Gonçalo, Patos de Minas, Abadia dos Dourados, Três Marias, Presidente Olegário, Lagoa Formosa, Guimarânia, Cruzeiro da Fortaleza, Pirapora, Buritizeiro, Várzea da Palma, Iraí de Minas, Uberlândia, Prata, Tupaciguara e Monte Alegre de Minas.
- Esses municípios serão usados como exemplos territoriais ativos da empresa OnNet, separados por regionais operacionais para facilitar testes. A estrutura continua editável em Cadastros.

## Verificação posterior à importação

- A consulta somente leitura `scripts/verify-cadastros-import.mjs` confirmou 73 fornecedores da Sempre Internet, distribuídos em 41 cidades e vinculados a 14 serviços. Estão disponíveis exemplos reais de panfletagem, carro de som e ações promocionais com cidade e serviço associados.
- Para a OnNet, foram criadas quatro regionais operacionais e 19 cidades: Alto Paranaíba (8), Noroeste (4), Norte de Minas (3) e Triângulo Mineiro (4).
- A auditoria não encontrou regionais sem empresa, cidades sem regional, fornecedores sem empresa, vínculos quebrados de fornecedor com cidade/serviço ou hierarquias inválidas de Tipos de mídia.
- O único fluxo corrigido nesta rodada foi a ficha individual de Tipos de mídia, que não preservava categoria principal e subtipo ao editar fora do painel operacional. A persistência foi corrigida e recebeu teste de regressão.
