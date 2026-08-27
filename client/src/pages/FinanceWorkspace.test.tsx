import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutation = vi.hoisted(() => () => ({ mutate: vi.fn(), isPending: false }));
const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ finance: { listInvoices: { invalidate: vi.fn() }, listSupplierContracts: { invalidate: vi.fn() }, listBillings: { invalidate: vi.fn() }, listPayments: { invalidate: vi.fn() }, listPurchaseOrders: { invalidate: vi.fn() }, cashAnalysis: { invalidate: vi.fn() } }, budgets: { annualSummary: { invalidate: vi.fn() }, listBudgets: { invalidate: vi.fn() }, summary: { invalidate: vi.fn() }, listCosts: { invalidate: vi.fn() } } }),
  users: { effectivePermissions: { useQuery: () => ({ isSuccess: true, data: ["finance.read", "finance.create", "finance.update", "finance.delete"] }) } },
  budgets: {
    annualSummary: { useQuery: () => ({ data: [], isLoading: false }) }, summary: { useQuery: () => ({ data: [], isLoading: false }) }, listBudgets: { useQuery: () => ({ data: [] }) }, listCosts: { useQuery: () => ({ data: [], isLoading: false }) }, operationOptions: { useQuery: () => ({ data: [] }) }, saveAnnualBudget: { useMutation: mutation }, saveBudget: { useMutation: mutation }, deleteBudget: { useMutation: mutation }, upsertCost: { useMutation: mutation }, reviewCost: { useMutation: mutation }, deleteCost: { useMutation: mutation },
  },
  finance: {
    listInvoices: { useQuery: () => ({ data: [], isLoading: false }) }, referenceData: { useQuery: () => ({ data: [{ id: 2, displayName: "Fornecedor Alfa" }] }) }, financeDimensions: { useQuery: () => ({ data: { companies: [], fiscalEntities: [], stock: [], offerings: [], catalog: [], products: [] }, isLoading: false }) }, listSupplierContracts: { useQuery: () => ({ data: [], isLoading: false }) }, operationOptions: { useQuery: () => ({ data: [{ id: 9, type: "action", name: "Ação Centro", label: "Ação · Ação Centro" }, { id: 17, type: "media_campaign", name: "Campanha Norte", label: "Mídia · Campanha Norte" }] }) }, listBillings: { useQuery: () => ({ data: [], isLoading: false }) }, listPayments: { useQuery: () => ({ data: [], isLoading: false }) }, operationForecasts: { useQuery: () => ({ data: [{ id: 9, type: "action", label: "Ação · Ação Centro", startsAt: new Date("2026-09-10T12:00:00Z"), estimatedCost: "1500.00", suppliers: [{ id: 2, name: "Fornecedor Alfa" }] }, { id: 17, type: "media_campaign", label: "Mídia · Campanha Norte", startsAt: new Date("2026-09-12T12:00:00Z"), estimatedCost: "2450.50", suppliers: [{ id: 2, name: "Fornecedor Alfa" }] }], isLoading: false }) }, budgetSnapshot: { useQuery: () => ({ data: { lines: [], plans: [] }, isLoading: false }) }, cashAnalysis: { useQuery: () => ({ data: { totals: { planned: 0, committed: 0, realized: 0, paid: 0, pending: 0, balance: 0 }, monthly: [] }, isLoading: false }) }, listPurchaseOrders: { useQuery: () => ({ data: [], isLoading: false }) }, createInvoice: { useMutation: mutation }, createSupplierContract: { useMutation: mutation }, registerPayment: { useMutation: mutation }, receiveInvoiceItem: { useMutation: mutation }, createPurchaseOrder: { useMutation: mutation }, reviewPurchaseOrder: { useMutation: mutation }, deleteInvoice: { useMutation: mutation }, deletePayment: { useMutation: mutation }, deletePurchaseOrder: { useMutation: mutation }, deleteSupplierContract: { useMutation: mutation },
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
    fireEvent.click(screen.getByRole("button", { name: "Análise de Caixa" }));
    expect(screen.getByText("Previsões operacionais")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Análise de Caixa" }));
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
