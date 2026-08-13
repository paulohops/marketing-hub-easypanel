import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ImageViewer from "./ImageViewer";

afterEach(() => { cleanup(); document.documentElement.classList.remove("dark"); });

describe("ImageViewer", () => {
  it("exibe um estado compacto quando não há imagem disponível", () => {
    render(<ImageViewer src={null} alt="Foto do material" />);

    expect(screen.getByLabelText("Sem foto")).toBeInTheDocument();
  });

  it("abre a imagem em modal e oferece o download do arquivo original", () => {
    render(<ImageViewer src="/manus-storage/trade/stock/tenda.png" alt="Foto da tenda" title="Tenda de ativação" />);

    fireEvent.click(screen.getByRole("button", { name: "Ampliar Foto da tenda" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tenda de ativação" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar imagem" })).toHaveAttribute("href", "/manus-storage/trade/stock/tenda.png");
  });

  it("mantém o modal aberto em uma superfície semântica no tema escuro", () => {
    document.documentElement.classList.add("dark");
    render(<ImageViewer src="/manus-storage/trade/stock/tenda.png" alt="Foto da tenda" />);

    fireEvent.click(screen.getByRole("button", { name: "Ampliar Foto da tenda" }));

    const dialog = screen.getByRole("dialog");
    expect(document.documentElement).toHaveClass("dark");
    expect(dialog).toHaveClass("bg-card");
    expect(dialog).not.toHaveClass("bg-white");
    expect(screen.getByRole("link", { name: "Baixar imagem" })).toHaveClass("bg-primary");
  });
});
