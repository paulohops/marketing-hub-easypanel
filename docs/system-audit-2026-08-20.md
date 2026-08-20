# Auditoria técnica do Marketing HUB — 20/08/2026

## Escopo

Esta auditoria foi realizada após a rodada de correções de navegação, permissões, formulários, diálogos, BI, Estoque, Tarefas, remoção de Solicitações e integração de consulta de CNPJ. O objetivo foi separar **falhas confirmadas**, **riscos técnicos** e **melhorias recomendadas**, sem classificar como defeito aquilo que foi removido deliberadamente por decisão de produto.

A referência de engenharia do repositório é formada por [`AGENTS.md`](../AGENTS.md), [`docs/ai-system-guide.md`](./ai-system-guide.md), [`docs/operational-ux-standards.md`](./operational-ux-standards.md), `DashboardLayout`, `ProtectedModule`, `index.css` e os padrões operacionais de Ações.

## Resultado executivo

| Área | Situação | Observação |
|---|---|---|
| Compilação TypeScript | Aprovada | `pnpm run check` concluído sem erros na rodada. |
| Build de produção | Aprovado com aviso | O bundle principal permanece acima do limite recomendado pelo Vite; não impede a publicação, mas indica necessidade de code splitting. |
| Testes funcionais | Aprovados nos testes executados | A suíte restante chegou a 61 arquivos, 220 testes aprovados e 3 ignorados. O teste pesado de `RegistryEntityWorkspace` provoca encerramento inesperado de worker por memória. |
| Navegação | Corrigida | Tarefas deixou de ser submenu de Trello; Cadastros foi movido para Configurações; Solicitações foi removido do frontend e do agregador tRPC. |
| Formulários | Padronizados | `DialogContent`, grids, rolagem interna, largura segura e rodapés de ações receberam uma base reutilizável. |
| Permissões financeiras | Corrigidas | Aprovação de pedido de compra passou a usar `finance.update`, escopo reconhecido pela autorização efetiva de administradores. |
| CNPJ de fornecedores | Integrado | O backend consulta a BrasilAPI com CNPJ normalizado e timeout; o editor de fornecedor preenche os campos retornados sem apagar valores não retornados. |
| BI | Corrigido | As rotas de Visão geral, Mídias e Panfletagem não devem mais manter Visão geral marcada quando outra visão está ativa. |

## Correções realizadas

O menu principal agora diferencia hierarquia visual de relacionamento funcional. Tarefas aparece próxima de Trello, mas é um módulo independente, com rota e autorização próprias. Cadastros passou para Configurações. A expansão de grupos ativos é preservada durante a navegação, evitando o fechamento inesperado do dropdown quando o usuário seleciona um subitem.

O primitive global de botões foi reforçado com dimensões, foco, hover e feedback de clique consistentes. O primitive de diálogo recebeu largura limitada pela viewport, altura máxima e rolagem interna. Estoque e Financeiro passaram a usar a classe global de formulário e diálogo, reduzindo quebras em telas menores e formulários extensos.

O módulo de Solicitações foi removido nesta etapa, conforme solicitado. Foram removidos a rota frontend, o workspace e o router tRPC exposto pelo agregador. A estrutura de dados não foi apagada do banco para preservar a possibilidade de recriação futura sem perda histórica não autorizada.

A consulta de CNPJ foi implementada no backend para manter a chave e a regra de integração fora do navegador. O endpoint oficial consultado é `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}`. O formulário usa o campo real `cnpj` e aplica razão social, nome fantasia, endereço, cidade, UF, CEP, telefone e e-mail quando esses dados estiverem disponíveis. A consulta não substitui validação humana, porque dados cadastrais externos podem estar desatualizados ou incompletos.

## Falhas confirmadas e limitações remanescentes

### 1. Suíte completa de testes e memória do worker

Os testes direcionados do menu passaram isoladamente. A execução controlada dos demais testes passou com **61 arquivos, 220 testes aprovados e 3 ignorados**, mas o processo apresentou um erro de worker ao alcançar o teste pesado de `RegistryEntityWorkspace.test.tsx`. A causa observada foi encerramento inesperado do worker por pressão de memória, não uma asserção funcional do módulo. Esse teste deve ser dividido em cenários menores ou executado em um job separado de CI com mais memória.

### 2. Bundle principal acima do limite recomendado

O build de produção concluiu, porém o Vite reportou que o chunk principal excede 1.200 kB após minificação. O impacto provável é maior tempo de carregamento inicial, especialmente em conexões móveis. A correção recomendada é adotar `import()` para workspaces raramente acessados, separar rotas de módulos pesados e configurar `manualChunks` somente depois de medir o efeito real.

### 3. Auditoria estática de manutenção

A contagem estática final encontrou 49 ocorrências de `any`, 32 leituras diretas de `process.env`, 65 arquivos de teste, 41 routers e 67 migrations. Esses números não significam que todas as ocorrências são defeitos: comentários, tipos de biblioteca e adaptadores podem aparecer na contagem. Eles indicam áreas para revisão controlada.

| Risco | Prioridade | Ação recomendada |
|---|---:|---|
| `any` em áreas de domínio | Média | Substituir progressivamente por tipos derivados de tRPC, schemas Zod ou tipos de domínio. Começar por integrações e operações financeiras. |
| `process.env` fora do módulo central | Média | Concentrar configuração em `server/env.ts`, validar variáveis no boot e impedir que credenciais cheguem ao bundle do cliente. |
| Worker de testes encerrado por memória | Alta para CI | Dividir o teste de cadastros, reduzir fixtures e configurar um job com memória dedicada. |
| Bundle principal grande | Média | Lazy loading por rota e análise de dependências antes de alterar chunks manualmente. |
| Migrations numerosas | Média | Manter migrations imutáveis, verificar drift no deploy e documentar política de restauração/rollback. |

Não foram encontradas ocorrências de `TODO`, `FIXME` ou `HACK` nos diretórios de cliente e servidor pela busca estática realizada. Também não foram encontrados `catch {}` completamente vazios nessa varredura; isso não elimina a necessidade de revisar tratamentos que retornam valores vazios sem registrar contexto.

## Recomendações para sistemas com IA

A recomendação central é não começar por um agente com acesso amplo ao banco. O Marketing HUB deve evoluir por **fluxos assistidos, estruturados e auditáveis**, nos quais o modelo sugere, classifica ou resume e uma regra de negócio — ou uma pessoa autorizada — confirma ações de impacto.

O NIST recomenda tratar confiança, segurança, privacidade e avaliação como partes do ciclo de vida do sistema de IA, não como uma etapa posterior [1]. Para este projeto, isso significa registrar versão do modelo, prompt, origem dos dados, usuário solicitante, decisão humana e resultado da ação.

O OWASP destaca riscos como prompt injection, tratamento inseguro de saída, divulgação de informação sensível, excesso de autonomia e dependência excessiva do modelo [2]. Portanto, qualquer integração futura deve usar escopos mínimos, ferramentas allowlisted, saída estruturada validada com Zod, limites de custo e confirmação antes de alterar status, aprovar despesas, enviar mensagens ou movimentar estoque.

A avaliação também precisa ser contínua. A documentação de boas práticas de evals recomenda conjuntos de casos reais, casos-limite e casos adversariais, métricas específicas do domínio, registro das execuções e calibração com avaliação humana [3]. O sistema deve ter uma pequena suíte de avaliação para cada função de IA antes de disponibilizá-la aos usuários.

| Oportunidade no HUB | Primeira versão segura | Controle obrigatório |
|---|---|---|
| Triagem de solicitações e leads | Classificar origem, tipo, cidade, urgência e área responsável. | Saída JSON validada, fila de revisão e deduplicação por ID externo/e-mail. |
| Assistente da Central de Conhecimento | Responder somente com documentos internos recuperados por busca semântica. | Citações da fonte, recusa quando não houver evidência e controle de acesso por módulo. |
| Resumo de ações, eventos e veiculações | Gerar resumo operacional e pendências a partir dos registros existentes. | Nenhuma alteração automática; usuário confirma antes de salvar. |
| Apoio financeiro | Comparar planejado, contratado, nota e pago; explicar divergências. | Somente leitura no início; valores finais calculados pelo backend. |
| Detecção de anomalias | Sinalizar estoque negativo, duplicidade, veiculação vencida ou custo fora do padrão. | Alertas explicáveis, limiar configurável e revisão humana. |
| Automação de tarefas | Sugerir responsável e prazo com base em regras do módulo. | Delegação explícita e registro de auditoria. |

A ordem recomendada de evolução é: primeiro observabilidade e dados confiáveis; depois classificação e busca; em seguida resumos e alertas; somente por último ações automatizadas. O fluxo de entradas do RD Station e WordPress deve usar IDs idempotentes e uma camada de normalização antes de qualquer classificação por IA.

## O que ainda vale aperfeiçoar

O próximo ciclo técnico deveria priorizar a confiabilidade da suíte de testes, code splitting por rota, centralização completa das configurações, revisão dos `any` nas áreas de domínio, testes de contrato para integrações externas e uma matriz de permissões testada por papel. Também é importante criar health checks para BrasilAPI, RD Station, WordPress e armazenamento de arquivos, com logs estruturados, retries limitados e dead-letter queue para entradas que não puderem ser processadas.

Na camada de produto, faltam evoluções naturais para um sistema mais robusto: centro de auditoria pesquisável, histórico de alterações por entidade, importação idempotente, fila de pendências, SLA por responsável, reconciliação financeira, dashboard de qualidade dos dados, exportação controlada e política de retenção de dados pessoais. Essas capacidades reduzem o risco operacional antes de adicionar autonomia de IA.

A auditoria não identificou uma falha de compilação ou uma falha funcional adicional confirmada além da limitação de memória do teste pesado e do aviso de bundle. Os pontos listados como risco devem ser tratados como backlog técnico priorizado e validados com testes ou telemetria antes de serem classificados como defeitos.

## Referências

[1]: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence "NIST — Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile"

[2]: https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/ "OWASP — GenAI LLM Top 10 2026"

[3]: https://developers.openai.com/api/docs/guides/evaluation-best-practices "OpenAI — Evaluation best practices"

[4]: https://brasilapi.com.br/docs "BrasilAPI — Documentação oficial"
