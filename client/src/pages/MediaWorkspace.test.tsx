import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const listQuery = vi.hoisted(() => vi.fn());
const detailQuery = vi.hoisted(() => vi.fn());
const createCampaignMutation = vi.hoisted(() => vi.fn());
const createConfiguredCampaignMutation = vi.hoisted(() => vi.fn());
const renewCampaignMutation = vi.hoisted(() => vi.fn());
const saveDebriefMutation = vi.hoisted(() => vi.fn());

const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ media: { list: { invalidate: vi.fn() }, pointDetails: { invalidate: vi.fn() } } }),
  users: { effectivePermissions: { useQuery: () => ({ isSuccess: true, data: ["media.read", "media.write", "media.create", "media.update", "media.delete"] }) } },
  media: {
    referenceData: { useQuery: () => ({ data: { suppliers: [], cities: [], regionals: [], mediaTypes: [], serviceTypes: [], supplierMediaTypes: [], supplierServiceTypes: [], supplierOfferings: [] }, isLoading: false }) },
    list: { useQuery: listQuery },
    pointDetails: { useQuery: detailQuery },
    createPoint: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    createCampaign: { useMutation: () => ({ mutate: createCampaignMutation, isPending: false }) },
    createConfiguredCampaign: { useMutation: () => ({ mutate: createConfiguredCampaignMutation, isPending: false }) },
    renewCampaign: { useMutation: () => ({ mutate: renewCampaignMutation, isPending: false }) },
    saveDebrief: { useMutation: () => ({ mutate: saveDebriefMutation, isPending: false }) },
  },
  campaigns: { list: { useQuery: () => ({ data: [], isLoading: false }) } },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("@/components/EvidenceUpload", () => ({ default: () => <span>Adicionar evidência</span> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MediaWorkspace from "./MediaWorkspace";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("detalhe de mídias", () => {
  it("abre a criação de ponto em modal, sem expandir o formulário na cobertura", () => {
    listQuery.mockReturnValue({ data: [], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(<MediaWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Novo ponto de mídia" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Novo ponto de mídia" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do ponto")).toBeInTheDocument();
  });

  it("abre fornecedor, histórico e evidências ao selecionar um ponto", () => {
    listQuery.mockReturnValue({ data: [{ id: 7, name: "Frontlight Centro", supplierName: "Mídia MG", mediaTypeName: "Outdoor", cityName: "Belo Horizonte", regionalName: "Central", regionalId: 3, address: "Av. Afonso Pena", coverImageUrl: "https://example.com/capa.jpg", activeCampaign: { id: 13, name: "Campanha Primavera", startsOn: "2026-09-01", endsOn: "2026-10-31", status: "active", partnershipType: "paid", finance: { estimatedAmount: 1200, paidAmount: 0, remainingAmount: 1200 } } }], isLoading: false });
    detailQuery.mockReturnValue({ data: { id: 7, name: "Frontlight Centro", supplierName: "Mídia MG", cityName: "Belo Horizonte", regionalName: "Central", regionalId: 3, mediaTypeName: "Outdoor", serviceTypeName: "Exibição", address: "Av. Afonso Pena", history: [{ id: 1, action: "create", scope: "point", occurredAt: new Date("2026-08-12T12:00:00Z") }], campaigns: [{ id: 13, name: "Campanha Primavera", startsOn: "2026-09-01", endsOn: "2026-10-31", estimatedCost: "1200.00", status: "active", notes: "Circuito principal", evidences: [{ id: 5, url: "https://example.com/foto.jpg", originalName: "foto-instalacao.jpg" }] }] }, isLoading: false });

    render(<MediaWorkspace />);
    expect(screen.getByRole("img", { name: "Identificação de Frontlight Centro" })).toHaveAttribute("src", "https://example.com/capa.jpg");
    fireEvent.click(screen.getByRole("button", { name: "Detalhes" }));

    expect(screen.getByRole("heading", { name: "Frontlight Centro" })).toBeInTheDocument();
    expect(screen.getByText("Cobertura e fornecedor")).toBeInTheDocument();
    expect(screen.getByText("Histórico")).toBeInTheDocument();
    expect(screen.getByText("Registro criado")).toBeInTheDocument();
    expect(screen.getByText("foto-instalacao.jpg")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?1\.200,00/).length).toBeGreaterThan(0);
    expect(detailQuery).toHaveBeenLastCalledWith({ mediaPointId: 7 }, { enabled: true });
  });

  it("mantém cobertura e pontos em superfícies semânticas sob o tema escuro", () => {
    listQuery.mockReturnValue({ data: [], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });
    const { container } = render(<div className="dark"><MediaWorkspace /></div>);

    expect(container.querySelector(".dark")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-card").length).toBeGreaterThan(0);
    expect(container.querySelector(".bg-white")).toBeNull();
  });

  it("registra o investimento previsto ao criar uma campanha", () => {
    listQuery.mockReturnValue({ data: [{ id: 8, name: "Painel Norte", supplierName: "Mídia MG", mediaTypeName: "Outdoor", cityName: "Belo Horizonte", regionalName: "Central", regionalId: 3, address: null, activeCampaign: null }], isLoading: false });
    detailQuery.mockReturnValue({ data: undefined, isLoading: false });

    render(<MediaWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Nova campanha" }));
    const modal = within(screen.getByRole("dialog"));
    fireEvent.change(modal.getByLabelText("Nome da campanha"), { target: { value: "Campanha Verão" } });
    fireEvent.change(modal.getByLabelText("Início"), { target: { value: "2026-09-01" } });
    fireEvent.change(modal.getByLabelText("Término"), { target: { value: "2026-09-30" } });
    fireEvent.change(modal.getByLabelText("Investimento previsto"), { target: { value: "2450.50" } });
    fireEvent.click(modal.getByRole("button", { name: "Confirmar programação" }));

    expect(createConfiguredCampaignMutation).toHaveBeenCalledWith({ mediaPointId: 8, tradeCampaignId: null, name: "Campanha Verão", startsOn: "2026-09-01", endsOn: "2026-09-30", partnershipType: "paid", estimatedCost: 2450.5, notes: undefined, campaignDetails: undefined, campaignConfig: { dailyRate: undefined, circulationDays: undefined, dailyRoute: undefined, audioBrief: undefined, materialFormat: undefined, materialQuantity: undefined, deadlineDays: undefined, deliveryInstructions: undefined }, cityDistributions: [] });
  });
});
