import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const uploadProviderLogo = vi.hoisted(() => vi.fn());
const uploadProviderCnpjCard = vi.hoisted(() => vi.fn());
const uploadProviderBrandManual = vi.hoisted(() => vi.fn());
const updateProvider = vi.hoisted(() => vi.fn());
const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ settings: { overview: { invalidate: vi.fn() } } }),
  settings: {
    overview: { useQuery: () => ({ data: { providers: [{ id: 1, name: "Cluster MG", legalName: "Cluster MG LTDA", billingCnpj: "12345678000195", contactName: "Paulo", email: "contato@cluster.com", phone: "3133333333", address: "Av. Central, 1", logoUrl: null, headquartersCityId: 3, brandColors: ["#0E723B", "#F45103"], cnpjCardUrl: "https://example.com/cnpj.pdf", brandManualUrl: null, active: true }], regionals: [{ id: 2, providerId: 1, name: "Central", code: "MG-C" }], cities: [{ id: 3, regionalId: 2, name: "Belo Horizonte", state: "MG", active: true }], stores: [{ id: 4, cityId: 3, name: "Loja Centro" }], suppliers: [{ id: 5, providerId: 1, displayName: "Fornecedor BH" }], serviceTypes: [], mediaTypes: [], actionTypes: [], eventTypes: [], financialCategories: [], supplierOfferings: [], partners: [], commercialSupervisors: [] }, isLoading: false }) },
    uploadProviderLogo: { useMutation: () => ({ mutate: uploadProviderLogo, isPending: false }) },
    uploadProviderCnpjCard: { useMutation: () => ({ mutate: uploadProviderCnpjCard, isPending: false }) },
    uploadProviderBrandManual: { useMutation: () => ({ mutate: uploadProviderBrandManual, isPending: false }) },
    updateProvider: { useMutation: () => ({ mutate: updateProvider, isPending: false }) },
  },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/hooks/useEffectivePermissions", () => ({ useEffectivePermissions: () => ({ can: () => true }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CompaniesWorkspace from "./CompaniesWorkspace";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("workspace Empresas", () => {
  it("mantém cartões e ações em superfícies semânticas sob o tema escuro", () => {
    const { container } = render(<div className="dark"><CompaniesWorkspace /></div>);

    expect(container.querySelector(".dark")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-card").length).toBeGreaterThan(0);
    expect(container.querySelector(".bg-white")).toBeNull();
  });

  it("resume relações territoriais e oferece envio do logotipo para pessoas autorizadas", async () => {
    render(<CompaniesWorkspace />);
    expect(screen.getByRole("heading", { name: "Cluster MG" })).toBeInTheDocument();
    expect(screen.getByText("12345678000195")).toBeInTheDocument();
    expect(screen.getByText("Regionais")).toBeInTheDocument();
    expect(screen.getByText("Adicionar logo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes" }));
    expect(screen.getByText("Central · MG-C")).toBeInTheDocument();
    expect(screen.getByText("Cidade-matriz")).toBeInTheDocument();
    expect(screen.getByText("#0E723B")).toBeInTheDocument();
    expect(screen.getByText("Cartão CNPJ")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(updateProvider).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: "Cluster MG", headquartersCityId: 3, brandColors: ["#0E723B", "#F45103"] }));
    const file = new File(["logo"], "marca.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Adicionar logo"), { target: { files: [file] } });
    await waitFor(() => expect(uploadProviderLogo).toHaveBeenCalled());
  });
});
