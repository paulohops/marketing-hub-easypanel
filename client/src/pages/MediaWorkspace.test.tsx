import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const listQuery = vi.hoisted(() => vi.fn());
const detailQuery = vi.hoisted(() => vi.fn());
const referenceDataQuery = vi.hoisted(() => vi.fn(() => ({ data: { suppliers: [], cities: [], regionals: [], mediaTypes: [], serviceTypes: [], supplierMediaTypes: [], supplierServiceTypes: [], supplierOfferings: [] }, isLoading: false })));
const createCampaignMutation = vi.hoisted(() => vi.fn());
const createConfiguredCampaignMutation = vi.hoisted(() => vi.fn());
const renewCampaignMutation = vi.hoisted(() => vi.fn());
const saveDebriefMutation = vi.hoisted(() => vi.fn());
const createUrbanRegistrationMutation = vi.hoisted(() => vi.fn());
const createUrbanVeiculationMutation = vi.hoisted(() => vi.fn());
const updatePointMutation = vi.hoisted(() => vi.fn());
const updatePointStatusMutation = vi.hoisted(() => vi.fn());
const updateUrbanVeiculationMutation = vi.hoisted(() => vi.fn());
const createInfluencerMutation = vi.hoisted(() => vi.fn());

const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ media: { list: { invalidate: vi.fn() }, pointDetails: { invalidate: vi.fn() }, listSpecializedData: { invalidate: vi.fn() }, campaignDetails: { invalidate: vi.fn() } } }),
  users: { effectivePermissions: { useQuery: () => ({ isSuccess: true, data: ["media.read", "media.write", "media.create", "media.update", "media.delete"] }) } },
  media: {
    referenceData: { useQuery: referenceDataQuery },
    list: { useQuery: listQuery },
    pointDetails: { useQuery: detailQuery },
    listSpecializedData: { useQuery: () => ({ data: { spots: [], runs: [], influencers: [], groups: [], memberships: [], posts: [], campaigns: [] }, isLoading: false }) },
    createPoint: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    createCampaign: { useMutation: () => ({ mutate: createCampaignMutation, isPending: false }) },
    createConfiguredCampaign: { useMutation: () => ({ mutate: createConfiguredCampaignMutation, isPending: false }) },
    renewCampaign: { useMutation: () => ({ mutate: renewCampaignMutation, isPending: false }) },
    saveDebrief: { useMutation: () => ({ mutate: saveDebriefMutation, isPending: false }) },
    createUrbanRegistration: { useMutation: () => ({ mutate: createUrbanRegistrationMutation, isPending: false }) },
    createUrbanVeiculation: { useMutation: () => ({ mutate: createUrbanVeiculationMutation, mutateAsync: vi.fn(), isPending: false }) },
    updatePoint: { useMutation: () => ({ mutate: updatePointMutation, isPending: false }) },
    updatePointStatus: { useMutation: () => ({ mutate: updatePointStatusMutation, isPending: false }) },
    updateUrbanVeiculation: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: updateUrbanVeiculationMutation, isPending: false }) },
    createInfluencer: { useMutation: () => ({ mutate: createInfluencerMutation, isPending: false }) },
    createSpot: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    uploadSpot: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    uploadEvidenceFile: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    createSoundCarRun: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    createInfluencerGroup: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    createInfluencerPost: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    confirmInfluencerPost: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    updateSpot: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    campaignDetails: { useQuery: () => ({ data: undefined, isLoading: false }) },
    updateCampaignStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  },
  campaigns: { list: { useQuery: () => ({ data: [], isLoading: false }) } },
  documents: { upload: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, listForEntity: { invalidate: vi.fn() } },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/EvidenceUpload", () => ({ default: () => <span>Adicionar evidência</span> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MediaWorkspace from "./MediaWorkspace";

afterEach(() => { cleanup(); localStorage.removeItem("marketing_hub_list_density"); vi.clearAllMocks(); window.history.replaceState({}, "", "/midias"); window.dispatchEvent(new PopStateEvent("popstate")); });

describe("detalhe de mídias", () => {
  it("mantém a preferência compacta sem exibir o botão de modo compacto", () => {
    localStorage.setItem("marketing_hub_list_density", "compact");
    listQuery.mockReturnValue({ data: [], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });
    const { container } = render(<MediaWorkspace initialCategory="graphics" />);

    expect(screen.queryByRole("button", { name: "Compacto" })).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("media-list-compact");
  });

  it("abre a criação de ponto em modal, sem expandir o formulário na cobertura", () => {
    listQuery.mockReturnValue({ data: [], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(<MediaWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Novo ponto de mídia" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Novo ponto de mídia urbana" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do ponto")).toBeInTheDocument();
  });

  it("navega para a ficha do ponto ao selecionar uma mídia urbana", () => {
    listQuery.mockReturnValue({ data: [{ id: 7, name: "Frontlight Centro", supplierName: "Mídia MG", mediaTypeName: "Outdoor", cityName: "Belo Horizonte", regionalName: "Central", regionalId: 3, address: "Av. Afonso Pena", coverImageUrl: "https://example.com/capa.jpg", operationCategory: "graphics", activeCampaign: null }], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(<MediaWorkspace initialCategory="graphics" />);
    expect(screen.getByRole("img", { name: "Identificação de Frontlight Centro" })).toHaveAttribute("src", "https://example.com/capa.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(window.location.pathname).toBe("/midias/7");
    expect(window.location.search).toBe("");
  });

  it("mantém cobertura e pontos em superfícies semânticas sob o tema escuro", () => {
    listQuery.mockReturnValue({ data: [], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });
    const { container } = render(<div className="dark"><MediaWorkspace /></div>);

    expect(container.querySelector(".dark")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-card").length).toBeGreaterThan(0);
    expect(container.querySelector(".bg-white")).toBeNull();
  });

  it("abre a ficha para criar uma nova veiculação urbana", () => {
    listQuery.mockReturnValue({ data: [{ id: 8, name: "Painel Norte", supplierName: "Mídia MG", mediaTypeName: "Outdoor", cityName: "Belo Horizonte", regionalName: "Central", regionalId: 3, address: null, operationCategory: "graphics", activeCampaign: null }], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(<MediaWorkspace initialCategory="graphics" />);
    fireEvent.click(screen.getByRole("button", { name: "Nova veiculação" }));

    expect(window.location.pathname).toBe("/midias/8");
    expect(window.location.search).toBe("?nova=1");
  });

  it("mantém Mídia Externa em uma ficha própria ao abrir nova veiculação", () => {
    listQuery.mockReturnValue({ data: [{ id: 21, name: "Panfletagem Triângulo", supplierName: "Gráfica MG", mediaTypeName: "Panfleto", serviceTypeName: "Panfletagem", cityName: "Uberlândia", regionalName: "Triângulo", regionalId: 3, address: null, operationCategory: "leafleting", channelKind: "external", activeCampaign: null }], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(<MediaWorkspace initialCategory="leafleting" />);
    fireEvent.click(screen.getByRole("button", { name: "Nova veiculação" }));

    expect(window.location.pathname).toBe("/midias/externa/21");
    expect(window.location.search).toBe("");
  });

  it("apresenta o formulário de Mídia Urbana sem serviço do fornecedor, com taxonomia, fornecedor, território e coordenadas", () => {
    referenceDataQuery.mockReturnValue({ data: { suppliers: [{ id: 4, displayName: "Fornecedor Urbano", mainService: "Outdoor" }], regionals: [{ id: 2, name: "Triângulo" }], cities: [{ city: { id: 11, name: "Uberlândia", regionalId: 2 }, regionalName: "Triângulo" }], mediaTypes: [{ id: 8, name: "Mídia Urbana", operationCategory: "graphics", parentMediaTypeId: null }, { id: 9, name: "Outdoor", operationCategory: "graphics", parentMediaTypeId: 8 }, { id: 10, name: "Impressão de papel", operationCategory: "graphics", parentMediaTypeId: 9 }], serviceTypes: [{ id: 7, name: "Exibição urbana" }], supplierMediaTypes: [{ supplierId: 4, mediaTypeId: 9 }], supplierServiceTypes: [{ supplierId: 4, serviceTypeId: 7 }], supplierOfferings: [], supplierContracts: [] }, isLoading: false } as any);
    listQuery.mockReturnValue({ data: [], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(<MediaWorkspace initialCategory="graphics" />);
    fireEvent.click(screen.getByRole("button", { name: "Novo ponto de mídia urbana" }));

    const modal = within(screen.getByRole("dialog"));
    expect(modal.getByRole("button", { name: "Cidade do ponto" })).toBeInTheDocument();
    expect(modal.getByRole("button", { name: "Fornecedor" })).toBeInTheDocument();
    expect(modal.getByRole("button", { name: "Tipo de mídia" })).toBeInTheDocument();
    expect(modal.queryByRole("button", { name: "Serviço do fornecedor" })).toBeNull();
    expect(modal.getByLabelText("Localização ou rota de referência")).toBeInTheDocument();
    expect(modal.getByLabelText("Latitude e longitude")).toBeInTheDocument();
    expect(modal.queryByRole("button", { name: "Variação" })).toBeNull();
    expect(modal.queryByRole("button", { name: "Período de troca" })).toBeNull();
    expect(modal.queryByLabelText("Canal")).toBeNull();
  });

  it("cadastra influencer pelo painel dedicado de Cadastros", () => {
    listQuery.mockReturnValue({ data: [], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(<MediaWorkspace initialCategory="influencers" />);
    fireEvent.change(screen.getByPlaceholderText("Nome"), { target: { value: "Ana Andrade" } });
    fireEvent.change(screen.getByPlaceholderText("@perfil"), { target: { value: "@anaandrade" } });
    fireEvent.change(screen.getByPlaceholderText("Forma de pagamento"), { target: { value: "PIX" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar influencer" }));

    expect(createInfluencerMutation).toHaveBeenCalledWith({
      name: "Ana Andrade",
      phone: undefined,
      email: undefined,
      socialHandle: "@anaandrade",
      paymentMethod: "PIX",
      paymentFrequency: undefined,
      paymentDay: undefined,
      notes: undefined,
    });
  });
});
