import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const campaignDetailsQuery = vi.hoisted(() => vi.fn());
const updateStatusMutation = vi.hoisted(() => vi.fn());
const saveDebriefMutation = vi.hoisted(() => vi.fn());
const renewMutation = vi.hoisted(() => vi.fn());
const updateUrbanMutation = vi.hoisted(() => vi.fn());

const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ media: { campaignDetails: { invalidate: vi.fn() }, pointDetails: { invalidate: vi.fn() }, list: { invalidate: vi.fn() } }, tasks: { list: { invalidate: vi.fn() } } }),
  media: {
    campaignDetails: { useQuery: campaignDetailsQuery },
    referenceData: { useQuery: () => ({ data: { users: [], subserviceTypes: [] }, isLoading: false }) },
    updateCampaignStatus: { useMutation: () => ({ mutate: updateStatusMutation, isPending: false }) },
    saveDebrief: { useMutation: () => ({ mutate: saveDebriefMutation, isPending: false }) },
    renewCampaign: { useMutation: () => ({ mutate: renewMutation, isPending: false }) },
    updateUrbanVeiculation: { useMutation: () => ({ mutate: updateUrbanMutation, isPending: false }) },
  },
  campaigns: { list: { useQuery: () => ({ data: [], isLoading: false }) } },
  tasks: { referenceData: { useQuery: () => ({ data: { users: [] }, isLoading: false }) }, create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/hooks/useEffectivePermissions", () => ({ useEffectivePermissions: () => ({ can: () => true }) }));
vi.mock("@/components/EvidenceUpload", () => ({ default: () => <span>Anexar evidência</span> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import UrbanVeiculationPage from "./UrbanVeiculationPage";

const campaign = {
  id: 13, mediaPointId: 7, name: "Primavera no Centro", objective: "Comercial", status: "active", startsOn: "2026-09-01", endsOn: "2026-10-31", estimatedCost: "1200.00", partnershipType: "paid", notes: "Troca mensal da arte.", campaignDetails: "Outdoor de 9 x 3 metros.", rating: null, feedback: null,
  point: { id: 7, name: "Frontlight Centro", supplierName: "Mídia MG", cityName: "Belo Horizonte", regionalName: "Central", mediaTypeName: "Outdoor" },
  registration: { id: 31, variationName: "Impressão de papel", contractReference: "CT-01", contract: { contractCode: "CT-01" } },
  tradeCampaignName: "Campanha Primavera", evidences: [], historyEvidences: [], history: [],
};

afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState({}, "", "/midias/veiculacao/13"); window.dispatchEvent(new PopStateEvent("popstate")); });

describe("ficha de veiculação urbana", () => {
  it("apresenta dados operacionais, status, debriefing e evidências", () => {
    window.history.replaceState({}, "", "/midias/veiculacao/13");
    campaignDetailsQuery.mockReturnValue({ data: campaign, isLoading: false });
    render(<UrbanVeiculationPage />);

    expect(screen.getByRole("heading", { name: "Primavera no Centro" })).toBeInTheDocument();
    expect(screen.getByText("Frontlight Centro")).toBeInTheDocument();
    expect(screen.getByText("Planejamento e mídia")).toBeInTheDocument();
    expect(screen.getByText("Campanha Primavera")).toBeInTheDocument();
    expect(screen.getByText("Evidências")).toBeInTheDocument();
    expect(screen.getByText("Debriefing e resultado")).toBeInTheDocument();
    expect(screen.getAllByText("Anexar evidência").length).toBeGreaterThan(0);
  });

  it("confirma a alteração de status pelo padrão global", () => {
    window.history.replaceState({}, "", "/midias/veiculacao/13");
    campaignDetailsQuery.mockReturnValue({ data: campaign, isLoading: false });
    render(<UrbanVeiculationPage />);
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "scheduled" } });
    fireEvent.change(screen.getByPlaceholderText("Descreva a razão da alteração de status."), { target: { value: "Ajuste operacional" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar status" }));
    expect(updateStatusMutation).toHaveBeenCalledWith({ campaignId: 13, status: "scheduled", reason: "Ajuste operacional", evidenceDocumentIds: [] });
  });
});
