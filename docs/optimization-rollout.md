# Rollout das otimizações técnicas

**Projeto:** Marketing HUB
**Escopo:** escalabilidade da listagem de Ações, consistência de domínio, proteção de arquivos, autenticação e operação em produção.

## Resumo

Esta atualização concentra as correções de maior impacto identificadas na auditoria técnica. A tela operacional de Ações passou a enviar filtros ao backend e a buscar no máximo 26 registros por página; o vigésimo sexto registro funciona como sentinela para habilitar a navegação para a próxima página. O backend mantém o contrato legado quando a query é chamada sem parâmetros, preservando dashboard, exportações e componentes de evidências existentes.

As mutações críticas do módulo de Ações agora gravam o evento de auditoria na mesma transação da alteração de domínio. A matriz de transições de status continua permitindo a correção administrativa de uma ação concluída para `in_progress`, mas deixa de aceitar combinações arbitrárias. A migration `0068_action_list_indexes.sql` adiciona índices de ordenação e filtragem e duas constraints para datas e notas de debriefing.

## Alterações implementadas

| Área | Alteração | Efeito esperado |
|---|---|---|
| Listagem | Filtros server-side por texto, status, regional, cidade, responsável e nota; paginação limitada a 25 itens | Menos dados transferidos e menos filtragem/enriquecimento em memória no navegador e no servidor |
| Banco | Índices por data, status, cidade, responsável e campanha | Melhor plano de execução para a ordenação operacional e filtros mais frequentes |
| Integridade | Constraints para `endsAt >= scheduledFor` e nota entre 1 e 5 | Regras críticas também protegidas no PostgreSQL |
| Status | Matriz explícita de transições | Evita mudanças arbitrárias de estado e mantém correções administrativas auditadas |
| Auditoria | Criação, edição, status, reagendamento e debriefing auditados dentro de transação | Evita confirmar alteração crítica sem o registro correspondente |
| Uploads | Sanitização de nomes e validação de assinatura binária nos uploads de Ações | Reduz falsificação de MIME e nomes com caracteres perigosos |
| Arquivos | Proxy exige sessão para arquivos não pertencentes ao prefixo público de branding | Evidências e documentos deixam de ser públicos apenas por conhecer o caminho |
| Login | Rate limiting por e-mail e IP, limpeza de entradas expiradas e limite de memória | Melhora a proteção contra brute force em processo único |
| HTTP | Cabeçalhos `nosniff`, `SAMEORIGIN`, `Referrer-Policy` e remoção de `X-Powered-By` | Reduz exposição e interpretação indevida de conteúdo |
| Operação | Endpoint `/ready` verifica PostgreSQL e storage; Docker usa esse endpoint no healthcheck | O orquestrador passa a distinguir processo vivo de serviço pronto |
| CI | Workflow com PostgreSQL 16 efêmero executa migrations, typecheck, testes e build | Validação reprodutível antes do merge/deploy |

## Procedimento de atualização

O deploy deve usar `DATABASE_URL` ou `POSTGRES_URL` apontando para o banco do ambiente e manter `RUN_MIGRATIONS=true` no primeiro rollout, conforme o entrypoint existente. A migration 0068 deve ser aplicada antes de liberar a nova versão do bundle. Em seguida, o healthcheck deve apontar para `/ready`, enquanto o monitoramento de liveness pode continuar usando `/health`.

A proteção do proxy preserva como público apenas o prefixo `trade/app-branding/`. Se o ambiente possuir outros arquivos que precisem ser públicos sem sessão, eles devem ser classificados explicitamente antes do deploy; não se deve ampliar a exceção para todo `/uploads` ou `/manus-storage`.

## Validações executadas

| Comando | Resultado |
|---|---|
| `pnpm check` | Aprovado |
| `pnpm test` | 69 arquivos aprovados, 3 pulados; 278 testes aprovados, 3 pulados |
| `pnpm build` | Deve ser executado no fechamento do commit e no CI |
| `pnpm db:ensure` | Coberto pelo workflow de CI com PostgreSQL efêmero; não foi executado localmente sem banco configurado |

## Limitações e próximos passos

O rate limiting desta entrega continua armazenado em memória. Ele ficou mais resistente a crescimento indefinido dentro de um processo, mas ainda não é compartilhado entre réplicas. Para escala horizontal, o próximo passo deve ser um adapter Redis ou equivalente configurado por ambiente, sem colocar credenciais no repositório.

A validação de assinatura foi aplicada aos uploads do módulo de Ações. Os fluxos de documentos, financeiro, mídias e fornecedores continuam precisando ser migrados para o mesmo helper caso recebam arquivos que devam ter a mesma política. A proteção de leitura no proxy é transversal, mas não substitui autorização por entidade em uma futura rota de download granular.

A centralização total do catálogo de rotas e os testes E2E autenticados permanecem como evolução posterior. A CI agora cobre migrations reais, types, testes e build; um estágio E2E ainda deve usar um navegador controlado e seed mínimo em ambiente isolado.

## Referências internas

[1]: ../server/routers/actions.ts "Router de Ações"
[2]: ../drizzle/0068_action_list_indexes.sql "Migration de índices e constraints"
[3]: ../server/_core/storageProxy.ts "Proxy autenticado de storage"
[4]: ../server/_core/index.ts "Bootstrap de produção e readiness"
[5]: ../server/_core/dev-index.ts "Bootstrap de desenvolvimento"
[6]: ../.github/workflows/ci.yml "Workflow de CI"
