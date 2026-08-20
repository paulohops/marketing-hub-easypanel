import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HelpWorkspace from "./HelpWorkspace";

describe("HelpWorkspace", () => {
  it("apresenta o índice operacional em cards navegáveis", () => {
    render(<HelpWorkspace />);

    expect(screen.getByRole("heading", { name: "Como trabalhar no Marketing HUB" })).toBeInTheDocument();
    expect(screen.getByText("Como o Marketing HUB se organiza")).toBeInTheDocument();
    expect(screen.getByText("Cadastros e relacionamentos")).toBeInTheDocument();
    expect(screen.getByText("Mídias: urbana, audiovisual e externa")).toBeInTheDocument();
    expect(screen.getByText("Processos e governança operacional")).toBeInTheDocument();
    expect(screen.getByText("Financeiro integrado")).toBeInTheDocument();
    expect(screen.getByLabelText("Pesquisar na Central de Conhecimento")).toBeInTheDocument();
    expect(screen.queryByLabelText("Assunto")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Preparar solicitação" })).not.toBeInTheDocument();
  });
});
