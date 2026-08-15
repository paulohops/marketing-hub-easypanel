import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("./pages/ProtectedModule", () => ({
  default: ({ module }: { module: string }) => <main data-testid="protected-module">Módulo protegido: {module}</main>,
}));

vi.mock("./components/ErrorBoundary", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import App from "./App";

describe("rotas protegidas", () => {
  const originalPath = window.location.pathname;

  beforeEach(() => {
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    cleanup();
    window.history.pushState({}, "", originalPath);
  });

  it.each([
    ["/usuarios", "usuarios"],
    ["/administracao-usuarios", "usuarios"],
    ["/cadastros/operacionais", "cadastros"],
    ["/cadastros/empresas", "empresas"],
    ["/cadastros/empresas/1", "empresas"],
    ["/cadastros/regionais", "cadastro-entidade"],
    ["/cadastros/cidades", "cadastro-entidade"],
    ["/cadastros/lojas", "cadastro-entidade"],
    ["/cadastros/fornecedores", "cadastro-entidade"],
    ["/cadastros/parceiros", "cadastro-entidade"],
    ["/cadastros/supervisores", "cadastro-entidade"],
    ["/cadastros/influencers", "cadastro-influencers"],
    ["/cadastros/tipos-de-campanha", "cadastro-entidade"],
    ["/cadastros/setores-de-campanha", "cadastro-entidade"],
    ["/cadastros/servicos", "cadastro-entidade"],
    ["/cadastros/tipos-de-acao", "cadastro-entidade"],
    ["/cadastros/tipos-de-evento", "cadastro-entidade"],
    ["/cadastros/tipos-de-midia", "cadastro-entidade"],
    ["/cadastros/modelos", "modelos-campanha"],
    ["/cadastros/modelos-acoes", "modelos-acao"],
    ["/pontos-de-acao", "pontos-de-acao"],
    ["/configuracoes", "configuracoes"],
    ["/ajuda", "ajuda"],
    ["/midias/27", "midias-graficas"],
    ["/midias/veiculacao/27", "midias-veiculacao"],
  ])("renderiza o módulo protegido %s", (path, module) => {
    window.history.pushState({}, "", path);
    render(<App />);

    expect(screen.getByTestId("protected-module")).toHaveTextContent(`Módulo protegido: ${module}`);
    expect(screen.queryByText("Página não encontrada")).not.toBeInTheDocument();
  });

  it.each([
    ["/midias", "/midias/graficas", "midias-graficas"],
    ["/cadastros", "/cadastros/operacionais", "cadastros"],
  ])("redireciona a rota-pai %s para %s", async (path, destination, module) => {
    window.history.pushState({}, "", path);
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe(destination));
    expect(screen.getByTestId("protected-module")).toHaveTextContent(`Módulo protegido: ${module}`);
  });
});
