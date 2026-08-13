import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutation = vi.hoisted(() => () => ({ mutate: vi.fn(), isPending: false }));
const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ finance: { listInvoices: { invalidate: vi.fn() } }, budgets: { listBudgets: { invalidate: vi.fn() }, summary: { invalidate: vi.fn() }, listCosts: { invalidate: vi.fn() } } }),
  users: { effectivePermissions: { useQuery: () => ({ isSuccess: true, data: ["finance.read", "finance.create", "finance.update", "finance.delete"] }) } },
  budgets: {
    summary: { useQuery: () => ({ data: [], isLoading: false }) }, listBudgets: { useQuery: () => ({ data: [] }) }, listCosts: { useQuery: () => ({ data: [], isLoading: false }) }, operationOptions: { useQuery: () => ({ data: [] }) }, saveBudget: { useMutation: mutation }, upsertCost: { useMutation: mutation }, reviewCost: { useMutation: mutation },
  },
  finance: {
    listInvoices: { useQuery: () => ({ data: [], isLoading: false }) }, referenceData: { useQuery: () => ({ data: [{ id: 2, displayName: "Fornecedor Alfa" }] }) }, operationOptions: { useQuery: () => ({ data: [{ id: 9, type: "action", name: "Ação Centro", label: "Ação · Ação Centro" }, { id: 17, type: "media_campaign", name: "Campanha Norte", label: "Mídia · Campanha Norte" }] }) }, operationForecasts: { useQuery: () => ({ data: [{ id: 9, type: "action", label: "Ação · Ação Centro", startsAt: new Date("2026-09-10T12:00:00Z"), estimatedCost: "1500.00", suppliers: [{ id: 2, name: "Fornecedor Alfa" }] }, { id: 17, type: "media_campaign", label: "Mídia · Campanha Norte", startsAt: new Date("2026-09-12T12:00:00Z"), estimatedCost: "2450.50", suppliers: [{ id: 2, name: "Fornecedor Alfa" }] }], isLoading: false }) }, createInvoice: { useMutation: mutation }, registerPayment: { useMutation: mutation },
  },
  documents: { upload: { useMutation: mutation } },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import FinanceWorkspace from "./FinanceWorkspace";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("previsões operacionais no financeiro", () => {
  it("mantém orçamento e previsões em superfícies semânticas sob o tema escuro", () => {
    const { container } = render(<div className="dark"><FinanceWorkspace /></div>);

    expect(container.querySelector(".dark")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-card").length).toBeGreaterThan(0);
    expect(container.querySelector(".bg-white")).toBeNull();
  });

  it("preenche fornecedor, valor e vínculo da nota a partir de uma ação prevista", () => {
    render(<FinanceWorkspace />);
    expect(screen.getByText("Previsões operacionais")).toBeInTheDocument();
    expect(screen.getByText("Fornecedor Alfa")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Usar na nota" })[0]);
    const invoiceForm = screen.getByLabelText("Nº da nota").closest("form");
    expect(invoiceForm).not.toBeNull();
    const fields = within(invoiceForm!);
    expect(fields.getByLabelText("Fornecedor")).toHaveValue("2");
    expect(fields.getByLabelText("Valor (R$)")).toHaveValue(1500);
    expect(fields.getByLabelText("Vínculo operacional")).toHaveValue("action");
    expect(fields.getByLabelText("Operação")).toHaveValue("9");
  });

  it("preenche uma nota a partir do investimento previsto de mídia", () => {
    render(<FinanceWorkspace />);
    expect(screen.getByText("Mídia · Campanha Norte")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Usar na nota" })[1]);
    const invoiceForm = screen.getByLabelText("Nº da nota").closest("form");
    expect(invoiceForm).not.toBeNull();
    const fields = within(invoiceForm!);
    expect(fields.getByLabelText("Fornecedor")).toHaveValue("2");
    expect(fields.getByLabelText("Valor (R$)")).toHaveValue(2450.5);
    expect(fields.getByLabelText("Vínculo operacional")).toHaveValue("media_campaign");
    expect(fields.getByLabelText("Operação")).toHaveValue("17");
  });
});
