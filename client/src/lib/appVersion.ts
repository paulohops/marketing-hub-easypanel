export const APP_VERSION = "1.1.1.0";

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
