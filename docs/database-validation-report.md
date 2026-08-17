# Validação do banco e rotas canônicas

## Escopo da validação

A análise foi feita sobre o dump PostgreSQL `public.sql` enviado e sobre o schema Drizzle atual do repositório. O dump foi lido em modo schema-only; nenhum SQL do arquivo foi executado e nenhum banco remoto foi alterado.

## Resultado estrutural

| Verificação | Resultado |
|---|---:|
| Tabelas declaradas no Drizzle | 74 |
| Tabelas encontradas no dump | 74 |
| Tabelas esperadas ausentes | 0 |
| Colunas esperadas ausentes | 0 |
| Tabelas extras no dump | 0 |
| Chaves primárias no dump | 74 |
| Foreign keys no dump | 142 |
| Constraints UNIQUE no dump | 21 |
| Índices únicos no dump | 34 |
| Entradas no journal do Drizzle | 47 |

A comparação de tabelas e colunas indica que o dump enviado está compatível com o schema Drizzle quanto à existência dos objetos. Isso não prova, sozinho, que tipos, defaults, nulabilidade, índices e regras de exclusão estejam idênticos; esses elementos devem ser validados no ambiente remoto com a `DATABASE_URL` do deploy.

## Rotas canônicas

As rotas oficiais de Configurações são:

| Funcionalidade | Rota oficial |
|---|---|
| Acessos | `/configuracoes/acessos` |
| Equipes | `/configuracoes/equipes` |
| Central de Dados | `/configuracoes/central-de-dados` |
| Design | `/configuracoes/design` |
| Sistema | `/configuracoes/sistema` |

Os aliases `/usuarios` e `/administracao-usuarios` agora redirecionam para `/configuracoes/acessos`. O alias `/equipes` redireciona para `/configuracoes/equipes`. Os links internos da tela de equipes também foram atualizados para usar a rota oficial.

## Empresas

O código atual mantém duas experiências diferentes:

- `/cadastros/empresas` abre o fluxo de entidade dentro de Cadastros;
- `/empresas` abre o workspace operacional de empresas.

Essas rotas não foram unificadas automaticamente porque o código indica que elas possuem responsabilidades distintas. A decisão de negócio pendente é escolher uma delas como tela oficial ou confirmar que devem continuar separadas com nomes diferentes.

## Central de Dados

`/importar-dados` e `/exportar-relatorios` são atalhos funcionais, enquanto `/configuracoes/central-de-dados` é a tela canônica de configuração. Eles não foram convertidos em redirects porque representam ações diferentes e não apenas duplicação visual da mesma tela.

## Isolamento multi-tenant e territorial

A validação encontrou filtros explícitos de `providerId`, regional e cidade em partes de campanhas e notificações. Porém, há consultas amplas em routers de ações, analytics, budgets, documentos e cadastros que dependem de relações territoriais ou da permissão do usuário sem um helper único de escopo compartilhado.

Isso deve ser corrigido por módulo, definindo antes:

1. se o usuário admin pode visualizar todos os providers;
2. quais regionais e cidades cada papel pode consultar;
3. se registros sem regional/cidade são globais;
4. se o filtro deve ocorrer por `providerId`, por atribuição territorial, ou pelos dois.

Não foi aplicado um filtro genérico nessas consultas sem essa decisão, porque uma regra incorreta poderia esconder dados válidos ou quebrar o fluxo administrativo.

## Operações e tabela unificadora

O dump confirma a existência de `trade_operations` e das entidades específicas de ações, eventos e campanhas de mídia, além das respectivas foreign keys. A existência estrutural está confirmada. A sincronização transacional entre as tabelas precisa ser validada por mutation: cada criação/edição de ação ou evento deve definir se cria, atualiza ou remove o registro correspondente em `trade_operations`.

Essa validação será tratada como requisito de cada módulo, não como uma alteração global inferida apenas pelo dump.

## Conclusão

O dump enviado contém todas as tabelas e colunas esperadas pelo código atual. As duplicações de rotas idênticas foram reduzidas com redirects canônicos. O banco não apresenta, no dump, ausência estrutural de tabelas ou colunas; a confirmação final de migrations pendentes, tipos, defaults e dados depende da execução do `db:ensure` no mesmo banco usado pelo EasyPanel.
