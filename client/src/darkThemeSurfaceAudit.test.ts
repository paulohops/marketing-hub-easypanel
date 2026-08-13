import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = resolve(process.cwd(), "client/src");
const priorityFiles = [
  "client/src/pages/DashboardPage.tsx",
  "client/src/pages/OperationalRegistriesWorkspace.tsx",
  "client/src/pages/CompaniesWorkspace.tsx",
  "client/src/pages/TrelloWorkspace.tsx",
  "client/src/pages/MediaWorkspace.tsx",
  "client/src/pages/FinanceWorkspace.tsx",
  "client/src/pages/InventoryWorkspace.tsx",
  "client/src/pages/IndicatorsWorkspace.tsx",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") && !entry.name.endsWith(".test.tsx") ? [path] : [];
  });
}

describe("auditoria de superfícies no tema escuro", () => {
  it("mantém as páginas prioritárias livres de superfícies brancas explícitas", () => {
    for (const file of priorityFiles) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/\bbg-white(?:\b|\/)/);
    }
  });

  it("restringe toda a interface a tokens semânticos ou realces translúcidos documentados", () => {
    for (const file of sourceFiles(sourceRoot)) {
      const source = readFileSync(file, "utf8");
      const whiteBackgrounds = source.match(/\bbg-white(?:\/[^\s"'`]+|\b)/g) ?? [];
      for (const className of whiteBackgrounds) {
        expect(className, file).toMatch(/^bg-white\/(?:\[[0-9.]+\]|\d+)$/);
      }
    }
  });

  it("mantém a barra lateral em token semântico e restringe o realce de interação ao branco translúcido", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
    expect(source).toContain("bg-sidebar-accent p-1");
    expect(source).not.toContain("bg-white p-1");
    expect(source).toMatch(/hover:bg-white\/\[0\.12\]/);
  });
});
