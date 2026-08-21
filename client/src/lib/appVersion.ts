export const APP_VERSION = "1.5.9.0";

export type AppVersionEntry = {
  version: string;
  date: string;
  label: string;
  summary: string;
  changes: string[];
};

// Atualize a versão e acrescente uma entrada a cada release publicado.
export const APP_VERSION_HISTORY: AppVersionEntry[] = [
  {
    version: "1.5.9.0",
    date: "21/08/2026",
    label: "Minor update",
    summary: "Cadastro territorial de Bairros, SubTipos de mídia disponíveis e Mídia Volante simplificada por cidade.",
    changes: [
      "Criado o cadastro de Bairros vinculado a Cidades, com criação, edição, ativação, exclusão protegida e auditoria no fluxo padrão de Cadastros.",
      "SubTipos opcionais passaram a ser carregados diretamente a partir do Tipo de mídia pai em Mídia Urbana, Mídia Audiovisual e Mídia Volante.",
      "Mídia Volante passou a usar o campo Nome do responsável e a manter somente a Cidade no cadastro do programa, removendo localização física, coordenadas, rota e mapa.",
      "A ficha de Mídia Volante foi alinhada ao novo modelo e mantém o contrato do backend com coordenadas nulas para registros sem localização física.",
    ],
  },
  {
    version: "1.5.8.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Correções de navegação, BPMN, responsividade, filtros, CNPJ e legibilidade dos módulos operacionais.",
    changes: [
      "Submenus do menu principal passaram a navegar sem salto de scroll e preservam a seleção da seção ativa.",
      "O BPMN de Processos passou a permitir arraste no canvas e zoom somente com Ctrl + rolagem, com melhor suporte a toque.",
      "Cards, tabelas, formulários e filtros receberam regras globais de largura mínima, quebra de conteúdo, responsividade e contraste no tema escuro.",
      "Estoque, Eventos, Panfletagem e Tarefas foram alinhados ao padrão global; Tarefas recebeu filtro por usuário responsável.",
      "A consulta de CNPJ de Fornecedores passou a usar o campo document e a preencher cidade/UF da matriz por normalização da BrasilAPI.",
      "A criação inline de cadastros dentro de dropdowns foi desativada para manter os formulários consistentes e evitar rotas quebradas.",
      "Removido o texto introdutório redundante da Central de Conhecimento.",
    ],
  },
  {
    version: "1.5.7.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Confiabilidade de testes, carregamento por rota, observabilidade de integrações e fundações seguras de IA.",
    changes: [
      "RegistryEntityWorkspace.test.tsx foi dividido em seis arquivos por domínio, com fixtures mínimas e execução serializada para reduzir pressão de memória.",
      "Workspaces pesados passaram a usar React.lazy/Suspense e o Vite recebeu chunks separados para React, UI e dados.",
      "Portas, banco e integrações opcionais passaram a usar o ENV central, com validação de requisitos no boot e avisos operacionais.",
      "Adicionado health.integrations para BrasilAPI e armazenamento, com timeout, cache curto e status individual por integração.",
      "Criadas as procedures somente leitura ai.detectInventoryAnomalies e ai.summarizeAction, com dashboard.read, saída Zod, modelo gpt-5-mini e auditoria de modelo, hash do prompt e resultado.",
      "Atualizados o guia de IA e o relatório de auditoria com rotas atuais, governança, limitações e backlog técnico remanescente.",
    ],
  },
  {
    version: "1.5.6.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Padronização global de navegação, formulários e botões, integração de CNPJ e auditoria técnica do Marketing HUB.",
    changes: [
      "Tarefas passou a ser um módulo independente, apenas posicionado próximo de Trello, e Cadastros foi movido para Configurações.",
      "Dropdowns do menu passaram a preservar a expansão durante a navegação por subitens.",
      "Criado um padrão global de botões, diálogos e formulários responsivos, aplicado especialmente a Estoque e Financeiro.",
      "Corrigida a permissão de aprovação e rejeição de pedidos de compra para administradores e perfis autorizados.",
      "Solicitações foi removido do frontend e do agregador tRPC, preservando os dados para uma futura recriação do módulo.",
      "Fornecedores passaram a consultar CNPJ na BrasilAPI com normalização, timeout e preenchimento assistido dos dados cadastrais.",
      "Corrigida a indicação visual das visões de BI e documentada a auditoria técnica, incluindo recomendações de segurança e governança para IA.",
    ],
  },
  {
    version: "1.5.5.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Padronização de rotas e melhorias operacionais em Eventos, Estoque, Tarefas, Processos e BI do Trade.",
    changes: [
      "Páginas principais e subpáginas passaram a usar o shell canônico com header, largura e espaçamento uniformes.",
      "Eventos foi alinhado ao padrão de Ações, sem agenda ou avaliação na interface, com filtros reorganizados para evitar sobreposição.",
      "Estoque recebeu filtros recolhíveis, soma numérica explícita dos saldos e visualização detalhada sem a visão territorial consolidada.",
      "Tarefas passou a ficar sob Trello no menu e manteve somente A fazer, Em andamento e Concluídas, com header padronizado.",
      "BI & Indicadores foi dividido em Visão geral, Mídias e Panfletagem, com rotas e dropdown no menu principal.",
      "O BPMN de Processos ganhou enquadramento ampliado, início/fim visíveis, gateway amarelo com borda preta, zoom, pan, seleção de etapas e conectores mais espaçados.",
    ],
  },
  {
    version: "1.5.4.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Aprimoramentos de processos, tarefas e operação de Mídia Volante, com integração JetForms avaliada tecnicamente.",
    changes: [
      "Processos passaram a contar com exclusão protegida por permissão, confirmação e auditoria.",
      "O Kanban de Tarefas recebeu cards e colunas com visual inspirado no Trello, mais limpo e focado no quadro.",
      "Solicitações ficou temporariamente desativado com placeholder informativo, preservando o acesso pelo menu.",
      "Carro de som foi renomeado para Mídia Volante e recebeu workspace, detalhe e veiculação independentes, usando a categoria sound_car.",
      "O backend passou a aceitar veiculações tradicionais para Audiovisual e Mídia Volante.",
      "A integração com JetForms foi avaliada e documentada com arquitetura recomendada via webhook autenticado.",
    ],
  },
  {
    version: "1.5.3.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Refatoração estrutural para tornar routers, configuração e tipagem do frontend mais observáveis e fáceis de manter.",
    changes: [
      "Falhas parciais de settings.overview passaram a gerar logs estruturados, evitando o mascaramento silencioso de erros de banco.",
      "Credenciais e chaves de integração de Trello, Google Maps e Mídias passaram a usar o objeto ENV centralizado.",
      "O router monolítico de settings foi decomposto em overview, branding, cadastros e importação, preservando os endpoints tRPC públicos.",
      "ActionsWorkspace deixou de usar any e passou a derivar tipos dos contratos actions.list e actions.referenceData.",
      "Os testes do FinanceWorkspace foram atualizados para refletir todas as queries e a navegação financeira efetivamente usadas.",
    ],
  },
  {
    version: "1.5.2.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Menu responsivo mobile adicionado ao shell principal do Marketing HUB.",
    changes: [
      "Criada barra superior mobile com acesso visível ao menu de navegação.",
      "O menu lateral passou a abrir como drawer em telas menores que 768px, mantendo grupos e permissões do desktop.",
      "A navegação mobile fecha automaticamente após trocar de rota e exibe a marca e a seção ativa.",
      "Mantidos foco visível, rótulos acessíveis e suporte ao tema global.",
    ],
  },
  {
    version: "1.5.1.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Solicitações conectadas aos registros operacionais de Trade.",
    changes: [
      "Solicitações passaram a manter vínculos explícitos com Ações, Eventos, Pontos de Mídia e Veiculações.",
      "O formulário de Solicitações recebeu seleção pesquisável do tipo e do registro operacional relacionado.",
      "A fila e a ficha da solicitação exibem o registro vinculado e permitem abrir diretamente a página correspondente.",
      "Criada a migration 0065 com chaves estrangeiras, atualização de vínculos legados e preservação do histórico.",
    ],
  },
  {
    version: "1.5.0.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Solicitações integradas ao fluxo de Gestão e à navegação responsiva do Marketing HUB.",
    changes: [
      "Criado o módulo Solicitações para registrar demandas de ações, eventos, mídias, financeiro e outras frentes administrativas.",
      "Adicionados responsáveis, regional, cidade, prioridade, datas desejadas, prazo, status e histórico operacional com auditoria.",
      "Incluídos filtros recolhíveis por texto, frente, status e prioridade, além de cards gerenciais da fila.",
      "Solicitações passou a aparecer no menu Gestão, incluindo o menu lateral utilizado em telas celulares.",
      "Criada a migration 0064 com enums, tabelas, vínculos territoriais e permissões específicas do módulo.",
    ],
  },
  {
    version: "1.4.1.0",
    date: "20/08/2026",
    label: "Major update",
    summary: "Módulo de Tarefas integrado às notificações e BI Trade com visão gerencial filtrável.",
    changes: [
      "Adicionado o módulo protegido de Tarefas no menu Gestão, com visão compartilhada da equipe e visão Minhas tarefas.",
      "Criado painel Kanban com Backlog, A fazer, Em andamento, Bloqueadas e Concluídas, incluindo movimentação por arrastar e soltar.",
      "Tarefas passaram a aceitar prioridade, responsável, prazo, descrição, delegação e edição conforme as permissões do usuário.",
      "Notificações podem ser convertidas em tarefas preservando a origem e o vínculo com o registro operacional.",
      "Incluído histórico de alterações de status e responsável no diálogo de edição da tarefa.",
      "Criadas as tabelas persistentes de tarefas, histórico, participantes e a migração 0063 com permissões específicas do módulo.",
      "Criado o router analítico do BI Trade com filtros por período, regional, cidade e status.",
      "Adicionada dashboard gerencial com cards, desempenho por frente, leitura por cidade, fornecedores e qualidade operacional.",
      "Corrigida a compatibilidade dos indicadores de atividade com os status globais planejado e em andamento.",
    ],
  },
  {
    version: "1.3.5.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Reconstrução da identidade visual global a partir da página de detalhe de Mídia Urbana.",
    changes: [
      "A anatomia de entidades da rota /midias/3 passou a definir o padrão oficial de shell, header-card, colunas, cards de dados e listas operacionais.",
      "Páginas de detalhe de Mídia Urbana, Mídia Audiovisual e mídias externas foram alinhadas ao mesmo shell de entidade, sem alterar suas regras operacionais.",
      "Cards legados passaram a receber compatibilidade visual global de raio, superfície, sombra e padding canônico, reduzindo divergências entre módulos.",
      "O componente Card semântico e os históricos operacionais passaram a utilizar uma única fonte de espaçamento interno.",
      "A documentação visual foi atualizada para registrar a referência /midias/3, tokens, anatomia de entidade e exceções controladas.",
    ],
  },
  {
    version: "1.3.4.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Padronização global de margens, padding e ritmo visual em todo o sistema.",
    changes: [
      "Criada uma escala global de espaçamento com tokens oficiais para páginas, seções, grids, filtros, controles e cards.",
      "Todos os módulos autenticados passaram a usar o container cluster-workspace, com uma única margem externa e sem padding duplicado no DashboardLayout.",
      "Cards semânticos e WorkspaceCard passaram a compartilhar padding interno obrigatório de 1,25rem e gap interno canônico.",
      "Headers, filtros, listas e dropdowns pesquisáveis foram alinhados à mesma régua de espaçamento, incluindo a página inicial e os módulos legados.",
      "A documentação do sistema visual foi ampliada com regras de margem, padding, exceções para overlays e checklist de validação responsiva.",
    ],
  },
  {
    version: "1.3.3.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Processos com página detalhada, BPMN ortogonal e revisão visual dos formulários e da Central de Conhecimento.",
    changes: [
      "A página principal de Processos passou a exibir um catálogo de cards; cada card abre a página detalhada com informações, BPMN e descritivo operacional.",
      "Os conectores do BPMN passaram a usar rotas ortogonais com segmentos em ângulo reto, incluindo os caminhos Sim e Não dos gateways.",
      "Removidos os asteriscos automáticos de obrigatoriedade que estavam quebrando o alinhamento dos formulários; a validação de negócio permanece no envio.",
      "Headers, painel de busca e espaçamentos da Central de Conhecimento foram alinhados ao WorkspaceChrome e ao padrão global documentado.",
      "A rota detalhada de Processos foi adicionada sem alterar a proteção de permissões dos módulos.",
    ],
  },
  {
    version: "1.3.2.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Processos com BPMN por setor, navegação de ajuda revisada e espaçamento global dos cards.",
    changes: [
      "Central de Conhecimento deixou de aparecer no menu principal e permanece acessível pelo botão Ver ajuda e suporte da página inicial e pelo menu do perfil.",
      "Cards globais passaram a aplicar padding interno canônico de 1,25rem, inclusive em Processos e na Central de Conhecimento.",
      "Processos passou a usar os Setores oficiais de Cadastros > Operação, com passos nomeados, explicação, gateways de decisão Sim/Não e BPMN gerado automaticamente com pools por setor.",
      "Documentos de Processos passaram a ser abertos em nova guia, sem exibição inline no formulário ou na página de detalhe.",
      "Tipos de arquivo de evidência foram ampliados para suportar também áudio OGG e MP4.",
    ],
  },
  {
    version: "1.3.1.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Central de Conhecimento navegável, padding global e Processos simplificados por passos.",
    changes: [
      "Central de Conhecimento passou a funcionar como índice de cards, com uma página detalhada por tópico, explicações de relacionamento, campos, regras e fluxogramas visuais.",
      "Removido o fluxo de Ajuda e suporte/solicitação de ajuda; o acesso oficial passa a ser a Central de Conhecimento.",
      "WorkspaceCard recebeu padding interno canônico de 1,25rem no token global, documentado para novos módulos e revisões de interface.",
      "Processos passou a ter fluxo simples com arquivo visual do procedimento e descritivo estruturado em vários passos, cada um com setor e explicação.",
      "Adicionada a migração 0061 para persistir os passos de Processos com ordenação e exclusão em cascata.",
    ],
  },
  {
    version: "1.3.0.0",
    date: "20/08/2026",
    label: "Minor update",
    summary: "Central de Conhecimento completa e Processos operacionais com governança documental.",
    changes: [
      "Central de Conhecimento reorganizada em cards por tópico, com relacionamentos, instruções de preenchimento, campos importantes e regras de uso para os módulos do sistema.",
      "Novo módulo Processos adicionado ao menu Gestão, com código, versão, status, categoria, responsáveis, abrangência, vigência, revisão, descritivo estruturado e indicadores de processo.",
      "Processos passaram a aceitar PDF, PNG, JPEG e WEBP no card de documentos oficiais, com galeria e visualização ampliada em tela inteira.",
      "Criada a migração idempotente 0060 para persistir Processos e permitir documentos associados à nova entidade.",
    ],
  },
  {
    version: "1.2.1.0",
    date: "20/08/2026",
    label: "Patch update",
    summary: "Ritmo visual, dropdowns pesquisáveis e vínculos de serviços revisados.",
    changes: [
      "Headers, actions e painéis de filtros receberam uma escala vertical e horizontal comum, com alinhamento centralizado e espaçamento consistente entre os módulos de Trade.",
      "Mídia Audiovisual passou a usar o eyebrow Trade Mídia Audiovisual e os controles de seleção receberam o mesmo tratamento visual de bordas, foco, busca e lista do padrão aprovado.",
      "Serviços e SubServiços passaram a usar exclusivamente a relação muitos-para-muitos atual nas fichas, evitando a mistura de IDs da estrutura legada.",
      "O formulário de nova veiculação urbana passou a filtrar SubServiços pelo Serviço principal, pelo catálogo da mídia e pelos vínculos ativos.",
    ],
  },
  {
    version: "1.2.0.0",
    date: "19/08/2026",
    label: "Minor update",
    summary: "Sistema visual global aplicado aos workspaces operacionais.",
    changes: [
      "Criado o WorkspaceChrome com shell, header, ações, seções e cards reutilizáveis para manter identidade visual única.",
      "Aplicados tokens CSS globais de largura, espaçamento, hierarquia tipográfica, ícones, bordas e cards ao padrão de Mídia Urbana e Ações.",
      "Migrados os headers de Ações, Campanhas, Eventos, Trade, Mídia Urbana e Mídia Audiovisual para a estrutura visual canônica.",
      "Filtros dos workspaces passaram a iniciar ocultos e os dropdowns pesquisáveis foram alinhados ao tamanho dos botões compactos.",
    ],
  },
  {
    version: "1.1.4.0",
    date: "19/08/2026",
    label: "Patch update",
    summary: "Padronização de status, Trade e template inicial de Carro de Som.",
    changes: [
      "Dropdowns globais de status ajustados ao tamanho dos demais botões do sistema.",
      "Menu Operação renomeado para Trade, preservando rotas e destaque ativo.",
      "Novo ponto de Mídia Urbana passou a exibir tipo de mídia principal e subtipo opcional em seletores separados.",
      "Carro de Som recebeu a primeira estrutura visual baseada no template de Mídia Audiovisual, com dados, spot, resumo operacional, rotas, programação e histórico.",
    ],
  },
  {
    version: "1.1.3.0",
    date: "19/08/2026",
    label: "Patch update",
    summary: "Correção da ficha audiovisual, calendário interativo e ações rápidas.",
    changes: [
      "Corrigido o erro React #310 na ficha de veiculação audiovisual, garantindo que todos os hooks sejam executados na mesma ordem durante carregamento e atualização.",
      "Calendário de programação passou a abrir um pop-up com dados da veiculação, horário, cidades, spot e evidências, com acesso direto à ficha.",
      "Periodicidades audiovisuais continuam sendo exibidas em português, com revisão das ocorrências de Semanal, Quinzenal, Mensal e demais opções.",
      "Debriefing foi removido do painel do programa audiovisual e permanece exclusivamente dentro das veiculações.",
      "Header do programa recebeu status compacto e os cards de spots e veiculações mantêm as ações Abrir mídia e Reagendar.",
    ],
  },
  {
    version: "1.1.2.0",
    date: "19/08/2026",
    label: "Patch update",
    summary: "Reorganização visual e operacional da Mídia Audiovisual.",
    changes: [
      "Menu lateral corrigido para destacar somente Mídias ao navegar por Mídia Audiovisual, sem destacar Panfletagem.",
      "Header do programa audiovisual reorganizado com edição, status, debriefing e nova veiculação em hierarquia consistente.",
      "Programa audiovisual passou a usar colunas independentes: dados, mapa e histórico ficam na lateral menor; spots, calendário e debriefing ficam na coluna maior.",
      "Fichas de spots e veiculações passaram a exibir somente informações resumidas, com duas fichas inicialmente e botão para mostrar mais.",
      "Ficha de veiculação audiovisual reorganizada com dados, resumo operacional e debriefing na coluna maior; spot, cidades/programação, evidências e histórico na lateral menor.",
      "Adicionada edição da veiculação audiovisual sem duplicação, mantendo status, reagendamento e evidências de motivo junto ao histórico.",
    ],
  },
  {
    version: "1.1.1.0",
    date: "19/08/2026",
    label: "Patch update",
    summary: "Correções da programação audiovisual e consolidação dos padrões operacionais.",
    changes: [
      "Campo de programa audiovisual corrigido para aceitar texto completo e horários normalizados antes do envio.",
      "Página do programa audiovisual passou a permitir edição, alteração de status com motivo e evidência e debriefing global persistido.",
      "Histórico audiovisual passou a seguir o padrão global, com motivo, evidências e visualização dos últimos cinco registros.",
      "Fornecedor e tipo de mídia podem ser cadastrados em pop-up no formulário audiovisual e selecionados automaticamente.",
      "Campanhas, ações e detalhe audiovisual receberam a largura e o espaçamento amplo do padrão de Mídia Urbana; filtros continuam recolhidos por padrão.",
      "Migração idempotente 0059 adicionada para os campos de debriefing dos pontos audiovisuais.",
    ],
  },
  {
    version: "1.1.0.0",
    date: "19/08/2026",
    label: "Minor update",
    summary: "Padronização operacional, catálogo relacionado e evolução da Mídia Audiovisual.",
    changes: [
      "Cadastro contextual com pop-up e seleção automática em ações, campanhas e eventos, incluindo fornecedores, serviços, tipos e setores.",
      "Dropdowns pesquisáveis nos formulários atualizados e componente global de seleção única com pesquisa.",
      "Mídia Tradicional renomeada para Mídia Audiovisual, com aliases de rota preservados, serviço derivado do catálogo e programação com múltiplos dias.",
      "Detalhe audiovisual reorganizado com spots antes do calendário e dados, mapa e histórico na coluna lateral.",
      "Páginas de cadastros passam a exibir serviços e subserviços relacionados por tipo de mídia e os vínculos bidirecionais entre serviços e subserviços.",
      "Estoque recebeu filtros pesquisáveis e seleções com pesquisa, mantendo cálculos numéricos de saldo e transferência por localização.",
      "Filtros financeiros iniciam recolhidos e permanecem acessíveis pelo botão de filtros.",
    ],
  },
  {
    version: "1.0.0.0",
    date: "17/08/2026",
    label: "Major release",
    summary: "Base operacional do Marketing HUB.",
    changes: [
      "Cadastros, ações, campanhas comerciais e estoque.",
      "Mídias urbanas e tradicionais com veiculações, evidências e histórico.",
      "Filtros operacionais, mapas, debriefing e controle de permissões.",
    ],
  },
];

export function formatVersion(version: string) {
  return `v${version}`;
}

export function nextVersion(current: string, kind: "major" | "minor" | "patch") {
  const parts = current.split(".").map(Number);
  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;
  const build = parts[3] || 0;
  if (kind === "major") return `${major + 1}.0.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0.0`;
  return `${major}.${minor}.${patch + 1}.${build}`;
}

export function versionKindDescription(kind: "major" | "minor" | "patch") {
  if (kind === "major") return "Mudança estrutural ou novo módulo";
  if (kind === "minor") return "Nova funcionalidade compatível";
  return "Correção e melhoria incremental";
}

export const CURRENT_VERSION_LABEL = formatVersion(APP_VERSION);
