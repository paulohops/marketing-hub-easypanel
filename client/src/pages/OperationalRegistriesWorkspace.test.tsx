import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const trpcStub = vi.hoisted(() => ({
  settings: {
    overview: {
      useQuery: () => ({
        isLoading: false,
        data: {
          providers: [{ id: 1 }],
          regionals: [],
          cities: [],
          stores: [],
          suppliers: [{ id: 1 }],
          partners: [],
          commercialSupervisors: [],
          serviceTypes: [],
          productTypes: [],
          mediaTypes: [],
          actionTypes: [],
          eventTypes: [],
          campaignTypes: [],
          campaignSectors: [],
          financialCategories: [],
        },
      }),
    },
  },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));

import OperationalRegistriesWorkspace from "./OperationalRegistriesWorkspace";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/cadastros/territorio");
});

describe("OperationalRegistriesWorkspace", () => {
  it("apresenta o grupo Território em uma lista e abre a entidade selecionada", () => {
    render(<OperationalRegistriesWorkspace />);

    expect(
      screen.getByRole("heading", { name: "Cadastros" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Empresas/ })
    ).toBeInTheDocument();
    expect(screen.getByText("1", { selector: "span" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Empresas/ }));
    expect(window.location.pathname).toBe("/cadastros/empresas");
  });

  it("troca o grupo sem misturar entidades de outros contextos", () => {
    window.history.replaceState({}, "", "/cadastros/parceiros");
    render(<OperationalRegistriesWorkspace />);

    expect(
      screen.getByRole("button", { name: /^Fornecedores/ })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Empresas/ })
    ).not.toBeInTheDocument();
  });

  it("mantém Produtos e serviços como grupo navegável e exibe Tipos de mídia em Categorias do Trade", () => {
    window.history.replaceState({}, "", "/cadastros/produtos-servicos");
    render(<OperationalRegistriesWorkspace />);

    expect(screen.getByRole("button", { name: /^Serviços/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Tipos de produtos/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Tipos de mídia/ })).not.toBeInTheDocument();

    window.history.replaceState({}, "", "/cadastros/categorias");
    cleanup();
    render(<OperationalRegistriesWorkspace />);
    expect(screen.getByRole("button", { name: /^Tipos de mídia/ })).toBeInTheDocument();
  });
});
