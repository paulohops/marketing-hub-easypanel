import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutation = vi.hoisted(() => () => ({ mutate: vi.fn(), isPending: false }));
const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ notifications: { list: { invalidate: vi.fn() } } }),
  media: { list: { useQuery: () => ({ data: [{ id: 1, activeCampaign: true }] }) } },
  actions: { list: { useQuery: () => ({ data: [{ action: { id: 2, name: "Ação Centro" }, debrief: { id: 1 } }] }) } },
  events: { list: { useQuery: () => ({ data: [{ event: { id: 3, name: "Evento Norte", status: "completed" } }] }) } },
  finance: { listInvoices: { useQuery: () => ({ data: [{ id: 4, status: "open", outstandingAmount: 500 }] }) } },
  notifications: { list: { useQuery: () => ({ data: [] }) }, markRead: { useMutation: mutation } },
  analytics: { overview: { useQuery: () => ({ data: { media: { activeCampaigns: 1 }, actions: { averageRating: 4 }, supplierPerformance: [] } }) } },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/components/ReportExportPanel", () => ({ default: () => <section className="bg-card">Exportar relatório completo</section> }));
vi.mock("./MapWorkspace", () => ({ default: () => <section className="bg-card">Mapa operacional</section> }));

import IndicatorsWorkspace from "./IndicatorsWorkspace";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Indicadores no tema escuro", () => {
  it("renderiza cartões e painéis auxiliares com tokens semânticos", () => {
    const { container } = render(<div className="dark"><IndicatorsWorkspace /></div>);

    expect(screen.getByText("Indicadores operacionais")).toBeInTheDocument();
    expect(screen.getByText("Desempenho por fornecedor")).toBeInTheDocument();
    expect(screen.getByText("Alertas persistentes")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-card").length).toBeGreaterThan(5);
    expect(container.querySelector(".bg-white")).toBeNull();
  });
});
