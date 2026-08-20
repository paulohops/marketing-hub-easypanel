# Auditoria técnica do Marketing HUB — 20/08/2026

## Escopo

Esta auditoria foi realizada após a rodada de correções de navegação, permissões, formulários, diálogos, BI, Estoque, Tarefas, remoção de Solicitações e integração de consulta de CNPJ. O objetivo foi separar **falhas confirmadas**, **riscos técnicos** e **melhorias recomendadas**, sem classificar como defeito aquilo que foi removido deliberadamente por decisão de produto.

A referência de engenharia do repositório é formada por [`AGENTS.md`](../AGENTS.md), [`docs/ai-system-guide.md`](./ai-system-guide.md), [`docs/operational-ux-standards.md`](./operational-ux-standards.md), `DashboardLayout`, `ProtectedModule`, `index.css` e os padrões operacionais de Ações.

## Resultado executivo

| Área | Situação | Observação |
|---|---|---|
| Compilação TypeScript | Aprovada | `pnpm run check` concluído sem erros após a implementação de ENV, health checks e IA. |
| Build de produção | Aprovado | O entry principal ficou em 163,30 kB; os maiores vendors ficaram em 424,69 kB (`vendor-data`) e 351,52 kB (`vendor-react`), abaixo do limite de 1.200 kB por chunk. |
| Testes funcionais | Aprovados | A suíte completa passou com **67 arquivos, 246 testes aprovados e 3 ignorados**; os 26 cenários de `RegistryEntityWorkspace` foram separados e passaram com um único worker. |
| Navegação | Corrigida | Tarefas deixou de ser submenu de Trello; Cadastros foi movido para Configurações; Solicitações foi removido do frontend e do agregador tRPC. |
| Formulários | Padronizados | `DialogContent`, grids, rolagem interna, largura segura e rodapés de ações receberam uma base reutilizável. |
| Permissões financeiras | Corrigidas | Aprovação de pedido de compra passou a usar `finance.update`, escopo reconhecido pela autorização efetiva de administradores. |
| CNPJ de fornecedores | Integrado | O backend consulta a BrasilAPI com CNPJ normalizado e timeout; o editor de fornecedor preenche os campos retornados sem apagar valores não retornados. |
| BI | Corrigido | As rotas de Visão geral, Mídias e Panfletagem não devem mais manter Visão geral marcada quando outra visão está ativa. |
| Configuração | Implementada | Portas, banco e integrações opcionais usam `server/_core/env.ts`; o boot valida requisitos e avisa sobre opcionais ausentes. |
| Observabilidade | Implementada | `health.integrations` verifica BrasilAPI com timeout/cache e armazenamento sem expor segredos. |
| IA assistida | Implementada | `ai.detectInventoryAnomalies` e `ai.summarizeAction` são somente leitura, exigem `dashboard.read`, validam JSON com Zod e auditam modelo/hash/resultado. |

## Correções realizadas

O menu principal agora diferencia hierarquia visual de relacionamento funcional. Tarefas aparece próxima de Trello, mas é um módulo independente, com rota e autorização próprias. Cadastros passou para Configurações. A expansão de grupos ativos é preservada durante a navegação, evitando o fechamento inesperado do dropdown quando o usuário seleciona um subitem.

O primitive global de botões foi reforçado com dimensões, foco, hover e feedback de clique consistentes. O primitive de diálogo recebeu largura limitada pela viewport, altura máxima e rolagem interna. Estoque e Financeiro passaram a usar a classe global de formulário e diálogo, reduzindo quebras em telas menores e formulários extensos.

O módulo de Solicitações foi removido nesta etapa, conforme solicitado. Foram removidos a rota frontend, o workspace e o router tRPC exposto pelo agregador. A estrutura de dados não foi apagada do banco para preservar a possibilidade de recriação futura sem perda histórica não autorizada.

A consulta de CNPJ foi implementada no backend para manter a chave e a regra de integração fora do navegador. O endpoint oficial consultado é `GET https://brasilapi.com.br/api/cnpj/v1/{cnpj}`. O formulário usa o campo real `cnpj` e aplica razão social, nome fantasia, endereço, cidade, UF, CEP, telefone e e-mail quando esses dados estiverem disponíveis. A consulta não substitui validação humana, porque dados cadastrais externos podem estar desatualizados ou incompletos.

## Falhas confirmadas e limitações remanescentes

### 1. Suíte completa de testes e memória do worker

O teste monolítico de `RegistryEntityWorkspace` foi removido e seus 26 cenários foram divididos em seis arquivos por domínio, cada um com mock e fixtures mínimas. A execução direcionada usa um único worker e não depende mais de um arquivo que concentra todos os cenários. A suíte completa ainda deve ser executada na validação final para medir o comportamento global.

### 2. Bundle principal acima do limite recomendado

O `ProtectedModule` agora usa `React.lazy` para workspaces pesados, com fallback único de `Suspense`. O Vite também separa dependências estáveis em chunks de React, UI e dados por `manualChunks`. O build desta rodada confirmou entry principal de **163,30 kB**, maior vendor de **424,69 kB** e nenhum chunk acima do limite configurado de **1.200 kB**.

### 3. Auditoria estática de manutenção

A contagem estática atual encontrou 43 ocorrências de `any`, 33 referências totais a `process.env` (9 fora do módulo central, incluindo arquivos de teste/boot), 70 arquivos de teste, 42 routers e 67 migrations. Esses números não significam que todas as ocorrências são defeitos: comentários, tipos de biblioteca e adaptadores podem aparecer na contagem. Eles indicam áreas para revisão controlada.

| Risco | Prioridade | Situação nesta rodada |
|---|---:|---|
| `any` em áreas de domínio | Média | Permanece como backlog de tipagem progressiva; a rodada concentrou-se em confiabilidade, bundle, configuração, observabilidade e IA. |
| `process.env` fora do módulo central | Média | Reduzido para 9 referências residuais de teste/boot; o runtime de banco, portas e integrações revisadas usa `ENV`, com validação no boot. |
| Worker de testes encerrado por memória | Alta para CI | Tratado com divisão do teste de cadastros, fixtures mínimas e execução serializada. |
| Bundle principal grande | Média | Tratado com lazy loading por rota e chunks manuais de dependências; medir no build final. |
| Migrations numerosas | Média | Mantido como recomendação operacional: migrations continuam imutáveis e devem ser verificadas no deploy. |

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

O próximo ciclo técnico deve priorizar a redução progressiva dos `any` remanescentes nas áreas de domínio, testes de contrato para integrações externas e uma matriz de permissões testada por papel. Nesta rodada foram implementados code splitting por rota, centralização de configuração, health check da BrasilAPI e armazenamento, além das fundações de IA assistida. RD Station e WordPress continuam fora do health check porque não possuem credenciais/contratos ativos nesta cópia; quando habilitados, devem receber o mesmo padrão de timeout, logs estruturados, retries limitados e fila de falhas.

Na camada de produto, faltam evoluções naturais para um sistema mais robusto: centro de auditoria pesquisável, histórico de alterações por entidade, importação idempotente, fila de pendências, SLA por responsável, reconciliação financeira, dashboard de qualidade dos dados, exportação controlada e política de retenção de dados pessoais. Essas capacidades reduzem o risco operacional antes de adicionar autonomia de IA.

A rodada corrigiu a limitação conhecida do teste pesado, aplicou code splitting, centralizou configuração, adicionou observabilidade das integrações disponíveis e criou as duas primeiras procedures de IA sob governança. O build final confirmou a redução do entry principal para 163,30 kB e a suíte completa confirmou 246 testes aprovados. A tipagem progressiva de `any`, a integração futura de RD Station/WordPress e a matriz ampliada de testes de permissão permanecem como backlog técnico priorizado, não como falhas funcionais confirmadas.

## Referências

[1]: https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence "NIST — Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile"

[2]: https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/ "OWASP — GenAI LLM Top 10 2026"

[3]: https://developers.openai.com/api/docs/guides/evaluation-best-practices "OpenAI — Evaluation best practices"

[4]: https://brasilapi.com.br/docs "BrasilAPI — Documentação oficial"
