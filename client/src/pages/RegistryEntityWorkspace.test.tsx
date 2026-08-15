import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const setCommercialSupervisorStores = vi.hoisted(() => vi.fn());
const updateType = vi.hoisted(() => vi.fn());
const updateStore = vi.hoisted(() => vi.fn());
const deleteRegistry = vi.hoisted(() => vi.fn());
const trpcStub = vi.hoisted(() => {
  const mutations = () => ({ mutate: vi.fn(), isPending: false });
  const overviewData = {
    providers: [], regionals: [], cities: [{ id: 3, name: "Belo Horizonte", state: "MG", active: true }], stores: [{ id: 2, cityId: 3, name: "Loja Central", code: "LC-01", address: "Av. Central, 100", referencePoint: "Ao lado da praça", zipCode: "30100-000", phone: "3133334444", email: "loja@cluster.com", openingHours: "08h às 18h", latitude: "-19.9", longitude: "-43.9", active: true }],
    suppliers: [{ id: 7, displayName: "Fornecedor Central", document: "12.345.678/0001-90", phone: "31999999999", email: "contato@fornecedor.com", cityId: 3, active: true }],
    partners: [], commercialSupervisors: [{ id: 21, name: "Gabriel", email: "gabriel@cluster.com", active: true }], commercialSupervisorStores: [{ commercialSupervisorId: 21, storeId: 2 }], serviceTypes: [{ id: 4, name: "Panfletagem" }], mediaTypes: [{ id: 5, name: "Outdoor", operationCategory: "graphics" }, { id: 6, name: "Impressão em lona", operationCategory: "graphics", parentMediaTypeId: 5 }], actionTypes: [], eventTypes: [], financialCategories: [], supplierOfferings: [{ id: 9, supplierId: 7, name: "Folder A5", unit: "milheiro", unitPrice: "450.00" }],
    operationalFootprint: { actions: [{ id: 11, name: "Ação Central", cityId: 3 }], events: [{ id: 12, name: "Evento Central", cityId: 3 }], mediaPoints: [{ id: 13, name: "Painel Central", cityId: 3, supplierId: 7 }], actionSuppliers: [{ actionId: 11, supplierId: 7 }], eventSuppliers: [{ eventId: 12, supplierId: 7 }] },
  };
  return {
    useUtils: () => ({ settings: { overview: { invalidate: vi.fn() } } }),
    settings: new Proxy({
      overview: { useQuery: () => ({ isLoading: false, data: overviewData }) },
      supplierCoverage: { useQuery: () => ({ data: { citiesBySupplier: [{ supplierId: 7, cityId: 3 }], servicesBySupplier: [{ supplierId: 7, serviceTypeId: 4 }], mediaBySupplier: [{ supplierId: 7, mediaTypeId: 5 }] } }) },
      setCommercialSupervisorStores: { useMutation: () => ({ mutate: setCommercialSupervisorStores, isPending: false }) },
      updateType: { useMutation: () => ({ mutate: updateType, isPending: false }) },
      updateStore: { useMutation: () => ({ mutate: updateStore, isPending: false }) },
      deleteRegistry: { useMutation: () => ({ mutate: deleteRegistry, isPending: false }) },
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
    vi.restoreAllMocks();
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

  it("mostra, edita e permite desvincular supervisores comerciais na ficha da loja", () => {
    window.history.replaceState({}, "", "/cadastros/lojas/2");
    render(<RegistryEntityWorkspace />);

    expect(screen.getByRole("heading", { name: "Supervisores vinculados" })).toBeInTheDocument();
    expect(screen.getByText("Gabriel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Editar informações" }));
    expect(screen.getByLabelText("Cidade")).toHaveValue("3");
    expect(screen.getByLabelText("Endereço")).toHaveValue("Av. Central, 100");
    expect(screen.getByLabelText("Horário de funcionamento")).toHaveValue("08h às 18h");
    fireEvent.change(screen.getByLabelText("Horário de funcionamento"), { target: { value: "09h às 19h" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(updateStore).toHaveBeenCalledWith(expect.objectContaining({ id: 2, cityId: 3, openingHours: "09h às 19h" }));
    fireEvent.click(screen.getByRole("button", { name: "Desvincular" }));
    expect(setCommercialSupervisorStores).toHaveBeenCalledWith({ commercialSupervisorId: 21, storeIds: [] });
  });

  it("solicita confirmação e envia a exclusão segura da Loja ao endpoint protegido", () => {
    window.history.replaceState({}, "", "/cadastros/lojas/2");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<RegistryEntityWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(confirm).toHaveBeenCalledWith("Excluir loja? A exclusão somente será permitida quando não houver dependências.");
    expect(deleteRegistry).toHaveBeenCalledWith({ kind: "store", id: 2 });
  });

  it("edita a hierarquia de um Tipo de mídia pela ficha individual", () => {
    window.history.replaceState({}, "", "/cadastros/tipos-de-midia/6");
    render(<RegistryEntityWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Editar informações" }));
    expect(screen.getByLabelText("Tipo principal")).toHaveValue("graphics");
    expect(screen.getByLabelText("Subtipo pai")).toHaveValue("5");
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(updateType).toHaveBeenCalledWith({ id: 6, kind: "media", name: "Impressão em lona", operationCategory: "graphics", parentMediaTypeId: 5 });
  });
});
