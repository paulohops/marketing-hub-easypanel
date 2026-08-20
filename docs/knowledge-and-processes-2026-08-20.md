# Central de Conhecimento e Processos

## Objetivo

As versões 1.3.0.0 e 1.3.1.0 introduzem e refinam uma Central de Conhecimento operacional e o módulo de Processos. A Central de Conhecimento explica os relacionamentos dos módulos, o significado dos campos, a ordem de preenchimento e os cuidados de governança. Processos registra o procedimento oficial do Trade com descritivo estruturado, versionamento e anexos documentais.

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


## Revisão da rodada: páginas de conhecimento e Processos simples

A Central de Conhecimento substitui **Ajuda e suporte**. Ela funciona como um índice de cards: cada card possui um identificador legível e abre uma página própria em `/central-conhecimento/:topicId`. A página detalhada deve explicar finalidade, relacionamentos, sequência de uso, campos importantes e regras de cuidado. Quando o tema tiver uma sequência operacional, a página também exibe um fluxograma visual responsivo. A rota antiga `/ajuda` permanece apenas como redirecionamento de compatibilidade e não oferece mais formulário para solicitar ajuda.

O conteúdo da Central deve ser escrito para a operação, não para a implementação técnica. Os nomes dos campos devem ser os mesmos exibidos nos formulários. Quando um relacionamento for relevante, a explicação deve dizer qual é o cadastro de origem, qual registro depende dele e qual consequência ocorre quando o vínculo está inativo ou ausente.

### Padding e ritmo dos cards

Todo card construído com `WorkspaceCard` recebe padding interno global de **1,25 rem** por meio da classe `hub-card`. Esse respiro é obrigatório para separar título, conteúdo, ações e bordas, evitando que textos e controles fiquem colados nas extremidades. O padrão foi observado nos workspaces de Trade, Mídia Urbana, Mídia Audiovisual, Cadastros, Financeiro, Estoque e Processos.

| Elemento | Regra de espaçamento |
|---|---|
| Card principal | `padding: 1.25rem`, borda, raio e sombra do token global |
| Conteúdo interno | Usar `gap`, `mt` e `pt` para separar blocos; não aplicar margem negativa para compensar ausência de padding |
| Cards aninhados | Manter o mesmo respiro quando apresentarem borda própria; reduzir apenas quando forem caixas auxiliares sem ação independente |
| Cabeçalho do card | Alinhar ícone, título e ações no mesmo eixo vertical; ações não devem encostar na borda |
| Filtros | Usar o painel recolhido por padrão e controles alinhados verticalmente; o painel também deve manter respiro interno |
| Modificadores antigos | `hub-card--padded` continua compatível, mas não é necessário em novos cards porque `hub-card` já é padded |

### Novo formato do módulo Processos

O módulo foi simplificado para representar exatamente duas partes na ficha: **Visualização do processo** e **Descritivo**.

Na visualização, a pessoa anexa um PDF ou imagem do processo. Os formatos aceitos são PDF, PNG, JPEG e WEBP. O arquivo fica associado à entidade `process`, é visualizado dentro do sistema em galeria e pode ser aberto em tamanho ampliado. O uso de um quadro Miro incorporado pode ser avaliado posteriormente, mas não deve exigir que o processo seja publicado por uma API ou link público; até essa decisão, o anexo interno é a fonte visual oficial.

No descritivo, a pessoa adiciona quantos passos forem necessários. Cada passo possui apenas dois dados operacionais: **Nome do setor**, preenchido manualmente, e **Explicação do processo**, com a ação, validação e entrega esperada daquela etapa. A numeração é gerada automaticamente na ordem dos passos. O backend grava esses itens na tabela filha `process_steps`, relacionada a `processes` por `processId`; editar o processo substitui a sequência em uma transação para evitar passos órfãos ou numeração inconsistente.

> Um bom passo deve permitir que outra pessoa execute a etapa sem depender de uma explicação oral. Escreva a ação, o critério de conferência e o que deve ser entregue ao setor seguinte.

A descrição legada do processo continua sendo preservada como uma versão consolidada dos passos para compatibilidade de auditoria e validações existentes. A tela, entretanto, apresenta e edita o descritivo no formato estruturado por passos.
