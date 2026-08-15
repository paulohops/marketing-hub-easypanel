import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const setCommercialSupervisorStores = vi.hoisted(() => vi.fn());
const updateType = vi.hoisted(() => vi.fn());
const updateStore = vi.hoisted(() => vi.fn());
const deleteRegistry = vi.hoisted(() => vi.fn());
const setRegistryActive = vi.hoisted(() => vi.fn());
const trpcStub = vi.hoisted(() => {
  const mutations = () => ({ mutate: vi.fn(), isPending: false });
  const overviewData = {
    providers: [{ id: 1, name: "Paulo", legalName: "Paulo Serviços Ltda.", active: true }], regionals: [{ id: 1, name: "Regional Central", code: "CENTRAL", providerId: 1, active: true }], cities: [{ id: 3, name: "Belo Horizonte", state: "MG", regionalId: 1, active: true }], stores: [{ id: 2, cityId: 3, name: "Loja Central", code: "LC-01", address: "Av. Central, 100", referencePoint: "Ao lado da praça", zipCode: "30100-000", phone: "3133334444", email: "loja@cluster.com", openingHours: "08h às 18h", latitude: "-19.9", longitude: "-43.9", active: true }],
    suppliers: [{ id: 7, displayName: "Fornecedor Central", document: "12.345.678/0001-90", phone: "31999999999", email: "contato@fornecedor.com", cityId: 3, active: true }],
    partners: [{ id: 8, name: "Parceiro Central", active: true }], commercialSupervisors: [{ id: 21, name: "Gabriel", email: "gabriel@cluster.com", active: true }], commercialSupervisorStores: [{ commercialSupervisorId: 21, storeId: 2 }], serviceTypes: [{ id: 4, name: "Panfletagem", active: true }], mediaTypes: [{ id: 5, name: "Outdoor", operationCategory: "graphics", active: true }, { id: 6, name: "Impressão em lona", operationCategory: "graphics", parentMediaTypeId: 5, active: true }], actionTypes: [{ id: 31, name: "Ação promocional", active: true }], eventTypes: [{ id: 32, name: "Evento de loja", active: true }], campaignTypes: [{ id: 33, name: "Comercial", active: true }], campaignSectors: [{ id: 34, name: "B2C", active: true }], financialCategories: [{ id: 35, name: "Mídia", active: true }], supplierOfferings: [{ id: 9, supplierId: 7, name: "Folder A5", unit: "milheiro", unitPrice: "450.00" }],
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
      setRegistryActive: { useMutation: () => ({ mutate: setRegistryActive, isPending: false }) },
      deleteRegistry: { useMutation: (options?: { onSuccess?: () => void }) => ({ mutate: (input: unknown) => { deleteRegistry(input); options?.onSuccess?.(); }, isPending: false }) },
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

    expect(confirm).toHaveBeenCalledWith("Excluir loja? A exclusão só será concluída se não houver vínculos operacionais dependentes.");
    expect(deleteRegistry).toHaveBeenCalledWith({ kind: "store", id: 2 });
  });

  it("permite inativar um cadastro diretamente pela ficha individual", () => {
    window.history.replaceState({}, "", "/cadastros/lojas/2");
    render(<RegistryEntityWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));
    expect(setRegistryActive).toHaveBeenCalledWith({ kind: "store", id: 2, active: false });
  });

  it("confirma e envia a exclusão de Empresa com desvinculação segura de regionais e fornecedores", () => {
    window.history.replaceState({}, "", "/cadastros/empresas/1");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<RegistryEntityWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));

    expect(confirm).toHaveBeenCalledWith("Excluir empresa? Regionais e fornecedores vinculados serão desvinculados da empresa, preservando os demais dados.");
    expect(deleteRegistry).toHaveBeenCalledWith({ kind: "provider", id: 1 });
    expect(window.location.pathname).toBe("/cadastros/empresas");
  });

  it.each([
    ["empresa", "/cadastros/empresas/1", "provider", 1],
    ["regional", "/cadastros/regionais/1", "regional", 1],
    ["cidade", "/cadastros/cidades/3", "city", 3],
    ["loja", "/cadastros/lojas/2", "store", 2],
    ["fornecedor", "/cadastros/fornecedores/7", "supplier", 7],
    ["parceiro", "/cadastros/parceiros/8", "partner", 8],
    ["supervisor", "/cadastros/supervisores/21", "supervisor", 21],
    ["serviço", "/cadastros/servicos/4", "service", 4],
    ["tipo de mídia", "/cadastros/tipos-de-midia/5", "media", 5],
    ["tipo de ação", "/cadastros/tipos-de-acao/31", "action", 31],
    ["tipo de evento", "/cadastros/tipos-de-evento/32", "event", 32],
    ["atuação", "/cadastros/tipos-de-campanha/33", "campaign", 33],
    ["setor", "/cadastros/setores-de-campanha/34", "campaign_sector", 34],
    ["categoria financeira", "/cadastros/categorias-financeiras/35", "financial_category", 35],
  ])("envia a alteração de status de %s ao endpoint persistente", (_label, path, kind, id) => {
    window.history.replaceState({}, "", path);
    render(<RegistryEntityWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));

    expect(setRegistryActive).toHaveBeenCalledWith({ kind, id, active: false });
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
