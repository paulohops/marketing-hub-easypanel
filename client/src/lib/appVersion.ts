export const APP_VERSION = "1.3.1.0";

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
