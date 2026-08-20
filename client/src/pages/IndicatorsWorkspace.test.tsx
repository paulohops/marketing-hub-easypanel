import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import IndicatorsWorkspace from "./IndicatorsWorkspace";

const trpcStub = vi.hoisted(() => ({
  media: { referenceData: { useQuery: () => ({ data: { regionals: [{ id: 1, name: "Regional Norte" }], cities: [{ city: { id: 2, name: "Uberlândia", state: "MG", regionalId: 1 } }] } }) } },
  analytics: { overview: { useQuery: () => ({ data: { summary: { mediaPoints: 4, activeMediaPoints: 2, campaigns: 3, activeCampaigns: 2, actions: 5, completedActions: 2, events: 2, completedEvents: 1, estimatedCost: 12000, outstandingAmount: 3000, debriefRate: 40, averageActionRating: 4, averageEventRating: 5 }, byModule: [{ key: "media", label: "Mídias", total: 4, active: 2, cost: 0 }], byCity: [{ cityId: 2, cityName: "Uberlândia", regionalName: "Regional Norte", media: 4, campaigns: 3, actions: 5, events: 2, estimatedCost: 12000 }], supplierPerformance: [{ id: 1, name: "Fornecedor Alfa", mediaPoints: 2, campaigns: 1, actions: 2, events: 1, invoicedAmount: 10000, paidAmount: 7000 }] } }) } },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("BI & Indicadores — Trade", () => {
  it("renderiza a dashboard com cartões e painéis agregados", () => {
    const { container } = render(<div className="dark"><IndicatorsWorkspace /></div>);
    expect(screen.getByText(/BI & Indicadores · Trade/)).toBeInTheDocument();
    expect(screen.getByText("Pontos de mídia")).toBeInTheDocument();
    expect(screen.getByText("Desempenho por frente")).toBeInTheDocument();
    expect(screen.getByText("Leitura por cidade")).toBeInTheDocument();
    expect(screen.getByText("Fornecedores em destaque")).toBeInTheDocument();
    expect(container.querySelectorAll(".hub-card").length).toBeGreaterThan(0);
    expect(container.querySelector(".bg-white")).toBeNull();
  });
});
