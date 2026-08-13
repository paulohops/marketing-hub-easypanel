import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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
    ["/cadastros", "cadastros"],
    ["/configuracoes", "configuracoes"],
    ["/ajuda", "ajuda"],
  ])("renderiza o módulo protegido %s", (path, module) => {
    window.history.pushState({}, "", path);
    render(<App />);

    expect(screen.getByTestId("protected-module")).toHaveTextContent(`Módulo protegido: ${module}`);
    expect(screen.queryByText("Página não encontrada")).not.toBeInTheDocument();
  });
});
