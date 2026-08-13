import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const setCommercialSupervisorStores = vi.hoisted(() => vi.fn());
const trpcStub = vi.hoisted(() => {
  const mutations = () => ({ mutate: vi.fn(), isPending: false });
  const overviewData = {
    providers: [], regionals: [], cities: [{ id: 3, name: "Belo Horizonte", state: "MG", active: true }], stores: [{ id: 2, cityId: 3, name: "Loja Central", code: "LC-01", active: true }],
    suppliers: [{ id: 7, displayName: "Fornecedor Central", document: "12.345.678/0001-90", phone: "31999999999", email: "contato@fornecedor.com", cityId: 3, active: true }],
    partners: [], commercialSupervisors: [{ id: 21, name: "Gabriel", email: "gabriel@cluster.com", active: true }], commercialSupervisorStores: [{ commercialSupervisorId: 21, storeId: 2 }], serviceTypes: [{ id: 4, name: "Panfletagem" }], mediaTypes: [{ id: 5, name: "Outdoor" }], actionTypes: [], eventTypes: [], financialCategories: [], supplierOfferings: [{ id: 9, supplierId: 7, name: "Folder A5", unit: "milheiro", unitPrice: "450.00" }],
    operationalFootprint: { actions: [{ id: 11, name: "Ação Central", cityId: 3 }], events: [{ id: 12, name: "Evento Central", cityId: 3 }], mediaPoints: [{ id: 13, name: "Painel Central", cityId: 3, supplierId: 7 }], actionSuppliers: [{ actionId: 11, supplierId: 7 }], eventSuppliers: [{ eventId: 12, supplierId: 7 }] },
  };
  return {
    useUtils: () => ({ settings: { overview: { invalidate: vi.fn() } } }),
    settings: new Proxy({
      overview: { useQuery: () => ({ isLoading: false, data: overviewData }) },
      supplierCoverage: { useQuery: () => ({ data: { citiesBySupplier: [{ supplierId: 7, cityId: 3 }], servicesBySupplier: [{ supplierId: 7, serviceTypeId: 4 }], mediaBySupplier: [{ supplierId: 7, mediaTypeId: 5 }] } }) },
      setCommercialSupervisorStores: { useMutation: () => ({ mutate: setCommercialSupervisorStores, isPending: false }) },
    }, { get: (target, property) => target[property as keyof typeof target] ?? { useMutation: mutations } }),
  };
});

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/hooks/useEffectivePermissions", () => ({ useEffectivePermissions: () => ({ can: () => true }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import RegistryEntityWorkspace from "./RegistryEntityWorkspace";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/cadastros/fornecedores");
  vi.clearAllMocks();
});

describe("fichas de cadastros", () => {
  it("permite pesquisar e abrir a edição contextual de um fornecedor", () => {
    window.history.replaceState({}, "", "/cadastros/fornecedores");
    render(<RegistryEntityWorkspace />);

    fireEvent.change(screen.getByPlaceholderText("Pesquisar fornecedores…"), { target: { value: "Central" } });
    fireEvent.click(screen.getByRole("button", { name: /Fornecedor Central/i }));

    expect(screen.getByRole("button", { name: "Editar informações" })).toBeInTheDocument();
    expect(screen.getByText("Visão relacional do fornecedor")).toBeInTheDocument();
    expect(screen.getByText("Custo médio das ofertas").parentElement).toHaveTextContent("450,00");
    expect(screen.getByText(/Ação Central/)).toBeInTheDocument();
    expect(screen.getByText(/Evento Central/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar informações" }));
    expect(screen.getByLabelText("Nome de exibição")).toHaveValue("Fornecedor Central");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("12.345.678/0001-90");
    expect(screen.getByRole("button", { name: "Salvar alterações" })).toBeInTheDocument();
  });

  it("mostra e permite desvincular supervisores comerciais na ficha da loja", () => {
    window.history.replaceState({}, "", "/cadastros/lojas/2");
    render(<RegistryEntityWorkspace />);

    expect(screen.getByRole("heading", { name: "Supervisores vinculados" })).toBeInTheDocument();
    expect(screen.getByText("Gabriel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desvincular" }));
    expect(setCommercialSupervisorStores).toHaveBeenCalledWith({ commercialSupervisorId: 21, storeIds: [] });
  });
});
