import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HelpWorkspace from "./HelpWorkspace";

describe("HelpWorkspace", () => {
  it("apresenta documentação operacional e formulário de solicitação", () => {
    render(<HelpWorkspace />);

    expect(screen.getByRole("heading", { name: "Ajuda e suporte" })).toBeInTheDocument();
    expect(screen.getByText("Ações e eventos")).toBeInTheDocument();
    expect(screen.getByText("Cadastros e acessos")).toBeInTheDocument();
    expect(screen.getByText("Documentação completa")).toBeInTheDocument();
    expect(screen.getByText("Estoque de materiais")).toBeInTheDocument();
    expect(screen.getByText("Suporte e boas práticas")).toBeInTheDocument();
    expect(screen.getByLabelText("Assunto")).toBeInTheDocument();
    expect(screen.getByLabelText("Descreva a solicitação")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preparar solicitação" })).toBeInTheDocument();
  });
});
