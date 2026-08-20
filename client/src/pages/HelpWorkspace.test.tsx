import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HelpWorkspace from "./HelpWorkspace";

describe("HelpWorkspace", () => {
  it("apresenta documentação operacional e formulário de solicitação", () => {
    render(<HelpWorkspace />);

    expect(screen.getByRole("heading", { name: "Como trabalhar no Marketing HUB" })).toBeInTheDocument();
    expect(screen.getByText("Cadastros e relacionamentos")).toBeInTheDocument();
    expect(screen.getByText("Mídias: urbana, audiovisual e externa")).toBeInTheDocument();
    expect(screen.getByText("Processos e governança operacional")).toBeInTheDocument();
    expect(screen.getByText("Financeiro integrado")).toBeInTheDocument();
    expect(screen.getByLabelText("Pesquisar na Central de Conhecimento")).toBeInTheDocument();
    expect(screen.getByLabelText("Assunto")).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preparar solicitação" })).toBeInTheDocument();
  });
});
