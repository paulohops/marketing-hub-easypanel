# Central de Conhecimento e Processos

## Objetivo

A versão 1.3.0.0 introduz uma Central de Conhecimento operacional e o módulo de Processos. A Central de Conhecimento explica os relacionamentos dos módulos, o significado dos campos, a ordem de preenchimento e os cuidados de governança. Processos registra o procedimento oficial do Trade com descritivo estruturado, versionamento e anexos documentais.

## Relacionamentos funcionais

| Camada | Entidades principais | Papel no fluxo |
|---|---|---|
| Cadastros mestres | Empresa, empresa fiscal, regional, cidade, fornecedor, produto, Serviço, SubServiço e tipo de mídia | Evita texto livre e fornece opções válidas para os demais módulos. |
| Planejamento | Campanha, contrato, pedido e memória de cálculo | Define objetivo, período, orçamento, compromisso e origem esperada do custo. |
| Execução | Ação, evento, ponto de mídia, programa audiovisual, veiculação e operação | Registra o que foi executado, por quem, onde, quando e com qual serviço. |
| Comprovação | Arte, spot, evidência, histórico de status e debriefing | Preserva a prova da execução e a avaliação do resultado. |
| Controle | Financeiro, Estoque, notificações e Processos | Controla custo, saldo físico, responsabilidades e procedimento oficial. |
| Análise | BI & Indicadores | Consolida fatos de execução, custo, prazo, cobertura e resultado. |

## Modelo de Serviço e SubServiço

A relação oficial é muitos-para-muitos em `serviceSubservices`. Um Serviço é a categoria principal da entrega; um SubServiço representa a execução específica. O mesmo SubServiço pode ser usado por vários Serviços, e cada Serviço pode possuir vários SubServiços. A tabela legada `serviceTypeRelations` não deve ser usada para resolver esse relacionamento.

Na criação de uma veiculação, a aplicação deve resolver o Serviço a partir do catálogo do tipo de mídia e filtrar o SubServiço pelo vínculo ativo. Se uma opção não aparecer, a conferência deve seguir esta ordem: registro ativo, vínculo Serviço/SubServiço, catálogo do tipo de mídia e permissões do usuário.

## Processo operacional

O registro de Processo utiliza as seguintes informações:

| Campo | Orientação |
|---|---|
| Código | Identificador único, estável e legível, como `PROC-TRADE-001`. |
| Nome | Resultado ou procedimento descrito em linguagem de negócio. |
| Categoria | Grupo do processo, por exemplo Planejamento, Execução, Financeiro ou Estoque. |
| Versão | Versão do procedimento vigente. Deve aumentar quando a regra mudar. |
| Status | Rascunho, Ativo, Em revisão ou Arquivado. |
| Responsável | Pessoa que responde pela manutenção e aplicação do processo. |
| Regional | Abrangência territorial, quando o processo não for corporativo. |
| Objetivo e escopo | Resultado esperado, ponto de início e ponto de encerramento. |
| Entradas e saídas | Dados, documentos, aprovações e entregáveis envolvidos. |
| Controles e exceções | Validações, segregação de funções, aprovações e tratamento de desvios. |
| SLA e KPIs | Prazo esperado e indicadores que comprovam eficiência ou qualidade. |
| Vigência e revisão | Data a partir da qual a versão vale e data da próxima revisão. |
| Descritivo | Instrução executável em ordem: gatilho, pré-requisitos, etapas, decisões, exceções, encerramento e evidências. |

O arquivo anexo é complementar ao descritivo. PDF, PNG, JPEG e WEBP são armazenados como documentos da entidade `process` e visualizados pelo componente de galeria com abertura ampliada. O arquivo não deve ser usado para esconder regras que precisam ser pesquisáveis e auditáveis no próprio registro.

## Implementação

A tabela `processes` foi adicionada na migração `0060_processes_and_documents.sql`. O router `processes` fornece listagem, criação, atualização e arquivamento lógico, com validação de referências, permissões `operations.read/write` e auditoria de alterações. O router `documents` reconhece `process` como entidade válida e verifica a existência do registro antes de aceitar um arquivo.

O módulo está disponível em `/processos`, é protegido pelo `ProtectedModule` e aparece no grupo Gestão. A Central de Conhecimento está disponível no acesso rápido do menu. Ambos usam `WorkspaceChrome` para preservar o padrão global de headers, seções, cards, filtros e alinhamentos.

## Próximas integrações

A área de Tarefas será conectada às notificações e às responsabilidades de registros operacionais em uma rodada posterior. O BI & Indicadores será organizado por Trade e substituirá a entrada antiga de Indicadores Operacionais. A área de Solicitações ficará em Gestão e poderá receber integração com planilhas ou WordPress após a definição do canal de entrada e das regras de aprovação.
