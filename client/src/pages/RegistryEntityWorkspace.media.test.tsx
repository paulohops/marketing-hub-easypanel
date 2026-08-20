import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const setup = vi.hoisted(() => {
  const mocks = { setCommercialSupervisorStores: vi.fn(), updateType: vi.fn(), updateStore: vi.fn(), updateProvider: vi.fn(), deleteRegistry: vi.fn(), deleteRegistries: vi.fn(), setRegistryActive: vi.fn(), fallbackMutation: vi.fn() };
  const overviewData = { providers: [{ id: 1, name: "Paulo", legalName: "Paulo Serviços Ltda.", headquartersCityId: 3, brandColors: ["#0E723B", "#F45103"], cnpjCardUrl: "https://files.example/cartao-cnpj.pdf", brandManualUrl: "https://files.example/manual-marca.pdf", active: true }], regionals: [{ id: 1, name: "Regional Central", code: "CENTRAL", providerId: 1, active: true }], cities: [{ id: 3, name: "Belo Horizonte", state: "MG", regionalId: 1, active: true }], stores: [{ id: 2, cityId: 3, name: "Loja Central", code: "LC-01", address: "Av. Central, 100", referencePoint: "Ao lado da praça", zipCode: "30100-000", phone: "3133334444", email: "loja@cluster.com", openingHours: "08h às 18h", latitude: "-19.9", longitude: "-43.9", active: true }], suppliers: [{ id: 7, displayName: "Fornecedor Central", document: "12.345.678/0001-90", phone: "31999999999", email: "contato@fornecedor.com", cityId: 3, active: true }], partners: [{ id: 8, name: "Parceiro Central", active: true }], commercialSupervisors: [{ id: 21, name: "Gabriel", email: "gabriel@cluster.com", active: true }], commercialSupervisorStores: [{ commercialSupervisorId: 21, storeId: 2 }], commercialSupervisorCities: [], productMediaTypes: [], subserviceTypes: [], mediaServiceCatalog: [], serviceTypeRelations: [], serviceSubservices: [], serviceTypes: [{ id: 4, name: "Panfletagem", active: true }], mediaTypes: [{ id: 5, name: "Outdoor", operationCategory: "graphics", active: true }, { id: 6, name: "Impressão em lona", operationCategory: "graphics", parentMediaTypeId: 5, active: true }], actionTypes: [{ id: 31, name: "Ação promocional", active: true }], eventTypes: [{ id: 32, name: "Evento de loja", active: true }], campaignTypes: [{ id: 33, name: "Comercial", active: true }], campaignSectors: [{ id: 34, name: "B2C", active: true }], financialCategories: [{ id: 35, name: "Mídia", active: true }], supplierOfferings: [{ id: 9, supplierId: 7, name: "Folder A5", unit: "milheiro", unitPrice: "450.00" }], operationalFootprint: { actions: [{ id: 11, name: "Ação Central", cityId: 3 }], events: [{ id: 12, name: "Evento Central", cityId: 3 }], mediaPoints: [{ id: 13, name: "Painel Central", cityId: 3, supplierId: 7 }], actionSuppliers: [{ actionId: 11, supplierId: 7 }], eventSuppliers: [{ eventId: 12, supplierId: 7 }] } };
  const mutation = (mutate: (input: unknown) => void) => ({ useMutation: () => ({ mutate, isPending: false }), useQuery: () => ({ data: undefined, isLoading: false }) });
  const supplierCoverageData = { citiesBySupplier: [{ supplierId: 7, cityId: 3 }], servicesBySupplier: [{ supplierId: 7, serviceTypeId: 4 }], mediaBySupplier: [{ supplierId: 7, mediaTypeId: 5 }] };
  const supplierCoverageQuery = { data: supplierCoverageData };
  const settings = { overview: { useQuery: () => ({ isLoading: false, data: overviewData }) }, supplierCoverage: { useQuery: () => supplierCoverageQuery }, setCommercialSupervisorStores: mutation(mocks.setCommercialSupervisorStores), updateType: mutation(mocks.updateType), updateStore: mutation(mocks.updateStore), updateProvider: mutation(mocks.updateProvider), setRegistryActive: mutation(mocks.setRegistryActive), deleteRegistries: mutation(mocks.deleteRegistries), deleteRegistry: { useMutation: (options?: { onSuccess?: () => void }) => ({ mutate: (input: unknown) => { mocks.deleteRegistry(input); options?.onSuccess?.(); }, isPending: false }) } };
  return { mocks, trpcStub: { useUtils: () => ({ settings: { overview: { invalidate: vi.fn() } } }), settings: new Proxy(settings, { get: (target, property: string | symbol) => property in target ? target[property as keyof typeof target] : mutation(mocks.fallbackMutation) }) } };
});
vi.mock("@/lib/trpc", () => ({ trpc: setup.trpcStub }));
vi.mock("@/hooks/useEffectivePermissions", () => ({ useEffectivePermissions: () => ({ can: () => true }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import RegistryEntityWorkspace from "./RegistryEntityWorkspace";

afterEach(() => { cleanup(); window.history.replaceState({}, "", "/cadastros/tipos-de-midia"); vi.clearAllMocks(); vi.restoreAllMocks(); });

describe("tipos de mídia", () => {
  it("edita a hierarquia de um tipo de mídia pela ficha individual", () => {
    window.history.replaceState({}, "", "/cadastros/tipos-de-midia/6");
    render(<RegistryEntityWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Editar informações" }));
    expect(screen.getByLabelText("Categoria da mídia")).toHaveValue("graphics");
    expect(screen.getByText("Tipo de mídia pai (opcional)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(setup.mocks.updateType).toHaveBeenCalledWith(expect.objectContaining({ id: 6, kind: "media", name: "Impressão em lona", operationCategory: "graphics", parentMediaTypeId: 5 }), expect.objectContaining({ onSuccess: expect.any(Function) }));
  });
});
