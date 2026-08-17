export const APP_VERSION = "1.0.0.0";

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
