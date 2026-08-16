import { afterEach, describe, expect, it, vi } from "vitest";

const invalidateOverview = vi.hoisted(() => vi.fn());
const setOverview = vi.hoisted(() => vi.fn());
const uploadProviderLogo = vi.hoisted(() => vi.fn());
const uploadProviderCnpjCard = vi.hoisted(() => vi.fn());
const uploadProviderBrandManual = vi.hoisted(() => vi.fn());
const uploadProviderDocument = vi.hoisted(() => vi.fn());
const deleteProviderDocument = vi.hoisted(() => vi.fn());
const updateProvider = vi.hoisted(() => vi.fn());
const provider = { id: 1, name: "Cluster MG", legalName: "Cluster MG LTDA", billingCnpj: "12345678000195", contactName: "Paulo", email: "contato@cluster.com", website: "https://cluster.com.br/", phone: "3133333333", address: "Av. Central, 1", logoStorageKey: null, logoUrl: null, headquartersCityId: 3, brandColors: ["#0E723B", "#F45103"], cnpjCardStorageKey: null, cnpjCardUrl: "https://example.com/cnpj.pdf", brandManualStorageKey: null, brandManualUrl: null, active: true, createdAt: new Date(), updatedAt: new Date() };
const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ settings: { overview: { invalidate: invalidateOverview, setData: setOverview } } }),
  settings: {
    overview: { useQuery: () => ({ data: { providers: [provider], regionals: [{ id: 2, providerId: 1, name: "Central", code: "MG-C" }], cities: [{ id: 3, regionalId: 2, name: "Belo Horizonte", state: "MG", active: true }], stores: [{ id: 4, cityId: 3, name: "Loja Centro" }], suppliers: [{ id: 5, providerId: 1, displayName: "Fornecedor BH" }], providerDocuments: [], operationalFootprint: { actions: [], events: [], mediaPoints: [], mediaCampaigns: [] } }, isLoading: false }) },
    uploadProviderLogo: { useMutation: () => ({ mutateAsync: uploadProviderLogo, isPending: false }) },
    uploadProviderCnpjCard: { useMutation: () => ({ mutateAsync: uploadProviderCnpjCard, isPending: false }) },
    uploadProviderBrandManual: { useMutation: () => ({ mutateAsync: uploadProviderBrandManual, isPending: false }) },
    uploadProviderDocument: { useMutation: () => ({ mutateAsync: uploadProviderDocument, isPending: false }) },
    deleteProviderDocument: { useMutation: () => ({ mutateAsync: deleteProviderDocument, isPending: false }) },
    updateProvider: { useMutation: () => ({ mutateAsync: updateProvider, isPending: false }) },
  },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/hooks/useEffectivePermissions", () => ({ useEffectivePermissions: () => ({ can: () => true }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import CompaniesWorkspace from "./CompaniesWorkspace";

afterEach(() => { cleanup(); localStorage.removeItem("marketing_hub_list_density"); vi.clearAllMocks(); window.history.pushState({}, "", "/empresas"); });

describe("workspace Empresas", () => {
  it("exibe Empresas como itens independentes e organizados na lista", () => {
    render(<div className="dark"><CompaniesWorkspace /></div>);
    expect(screen.getByRole("heading", { name: "Empresas" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cluster MG" })).toBeInTheDocument();
    expect(screen.getByText("Cluster MG LTDA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir ficha completa/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Criar empresa/i })).toHaveAttribute("href", "/cadastros/operacionais?novo=empresas");
  });

  it("lê a preferência compacta no primeiro render da lista de Empresas", () => {
    localStorage.setItem("marketing_hub_list_density", "compact");
    render(<CompaniesWorkspace />);

    expect(screen.getByRole("button", { name: "Compacto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Cluster MG" }).closest("button")).toHaveClass("p-3");
  });

  it("mostra ficha detalhada, persiste dados e permite incluir documentos complementares", async () => {
    window.history.pushState({}, "", "/empresas/1");
    updateProvider.mockResolvedValue(provider);
    uploadProviderDocument.mockResolvedValue({ id: 9, providerId: 1, title: "Certidão", url: "https://example.com/certidao.pdf", originalName: "certidao.pdf", mimeType: "application/pdf", sizeBytes: 100, createdAt: new Date() });
    render(<CompaniesWorkspace />);
    expect(screen.getByRole("button", { name: /Voltar para Empresas/i })).toBeInTheDocument();
    expect(screen.getByText("Detalhes cadastrais")).toBeInTheDocument();
    expect(screen.getByText("Vínculos e cobertura")).toBeInTheDocument();
    expect(screen.getByText("Documentos institucionais")).toBeInTheDocument();
    expect(screen.getAllByText("Não informado").length).toBeGreaterThan(0);
    expect(screen.getByText("Cartão CNPJ")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir site da empresa/i })).toHaveAttribute("href", "https://cluster.com.br/");
    expect(screen.getByText("Demais documentos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Central · MG-C/i })).toHaveAttribute("href", "/cadastros/regionais/2");
    fireEvent.click(screen.getByRole("button", { name: /Cidades atendidas/i }));
    expect(screen.getByRole("link", { name: /Belo Horizonte · MG/i })).toHaveAttribute("href", "/cadastros/cidades/3");
    fireEvent.click(screen.getByRole("button", { name: /Lojas vinculadas/i }));
    expect(screen.getByRole("link", { name: /Loja Centro/i })).toHaveAttribute("href", "/cadastros/lojas/4");
    fireEvent.click(screen.getByRole("button", { name: /Fornecedores vinculados/i }));
    expect(screen.getByRole("link", { name: /Fornecedor BH/i })).toHaveAttribute("href", "/cadastros/fornecedores/5");

    fireEvent.click(screen.getByRole("button", { name: "Editar empresa" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(updateProvider).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: "Cluster MG", headquartersCityId: 3, brandColors: ["#0E723B", "#F45103"] })));
    expect(setOverview).toHaveBeenCalled();
    expect(invalidateOverview).toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Título do documento"), { target: { value: "Certidão" } });
    const file = new File(["certidao"], "certidao.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Arquivo"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar documento" }));
    await waitFor(() => expect(uploadProviderDocument).toHaveBeenCalledWith(expect.objectContaining({ providerId: 1, title: "Certidão", originalName: "certidao.pdf" })));
  });

  it("preserva a ficha detalhada na rota Cadastros → Território → Empresas", () => {
    window.history.pushState({}, "", "/cadastros/empresas/1");

    render(<CompaniesWorkspace />);

    expect(screen.getByRole("button", { name: /Voltar para Empresas/i })).toBeInTheDocument();
    expect(screen.getByText("Detalhes cadastrais")).toBeInTheDocument();
    expect(screen.getByText("Documentos institucionais")).toBeInTheDocument();
    expect(screen.getByText("Demais documentos")).toBeInTheDocument();
  });

  it("exibe uma única categoria de vínculo quando a pessoa a seleciona", () => {
    window.history.pushState({}, "", "/cadastros/empresas/1");
    render(<CompaniesWorkspace />);

    const regionais = screen.getByRole("button", { name: /Regionais vinculadas/i });
    const cidades = screen.getByRole("button", { name: /Cidades atendidas/i });
    expect(regionais).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByText("Regionais vinculadas"));
    expect(regionais).toHaveAttribute("aria-pressed", "true");
    expect(cidades).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByText("Cidades atendidas"));
    expect(cidades).toHaveAttribute("aria-pressed", "true");
    expect(regionais).toHaveAttribute("aria-pressed", "false");
  });

  it("abre a ficha completa a partir da lista de Empresas dentro de Cadastros", async () => {
    window.history.pushState({}, "", "/cadastros/empresas");

    render(<CompaniesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir ficha completa/i }));

    await waitFor(() => expect(window.location.pathname).toBe("/cadastros/empresas/1"));
    expect(screen.getByText("Detalhes cadastrais")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Voltar para Empresas/i })).toBeInTheDocument();
  });
});
