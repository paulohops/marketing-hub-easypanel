import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

const mutations = vi.hoisted(() => ({
  provider: vi.fn(),
  regional: vi.fn(),
  city: vi.fn(),
  supplier: vi.fn(),
  store: vi.fn(),
  partner: vi.fn(),
  type: vi.fn(),
}));

const overview = {
  providers: [{ id: 1, name: "Prestador MG" }],
  regionals: [{ id: 1, name: "Regional MG", code: "RMG", providerId: null }],
  cities: [{ id: 1, name: "Belo Horizonte", state: "MG", regionalId: 1 }],
  suppliers: [{ id: 1, displayName: "Fornecedor MG", document: "12345678000195" }],
  stores: [{ id: 1, name: "Loja Centro", code: "LJ001", cityId: 1 }],
  partners: [{ id: 1, name: "Parceiro MG" }],
  serviceTypes: [], mediaTypes: [], actionTypes: [], eventTypes: [],
};

const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ settings: { overview: { invalidate: vi.fn() } } }),
  settings: {
    overview: { useQuery: () => ({ data: overview, isLoading: false }) },
    createProvider: { useMutation: () => ({ mutate: mutations.provider, isPending: false }) },
    createRegional: { useMutation: () => ({ mutate: mutations.regional, isPending: false }) },
    createCity: { useMutation: () => ({ mutate: mutations.city, isPending: false }) },
    createSupplier: { useMutation: () => ({ mutate: mutations.supplier, isPending: false }) },
    createStore: { useMutation: () => ({ mutate: mutations.store, isPending: false }) },
    createPartner: { useMutation: () => ({ mutate: mutations.partner, isPending: false }) },
    createType: { useMutation: () => ({ mutate: mutations.type, isPending: false }) },
  },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/components/SupplierCoverageManager", () => ({ default: () => <div data-testid="supplier-coverage" /> }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import SettingsWorkspace, { digitsOnly, hasDuplicateRegistryValue, normalizeRegistryValue } from "./SettingsWorkspace";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderWorkspace() {
  return render(<SettingsWorkspace />);
}

function submit(label: string) {
  const button = screen.getByRole("button", { name: label });
  fireEvent.submit(button.closest("form")!);
}

function formFor(heading: string) {
  return screen.getByRole("heading", { name: heading }).closest("form")!;
}

describe("validações preventivas de cadastros", () => {
  it("compara nomes sem depender de caixa, espaços ou acentuação regional", () => {
    expect(normalizeRegistryValue("  Regional MG ")).toBe("regional mg");
    expect(hasDuplicateRegistryValue(["Regional MG", "Norte"], " regional mg ")).toBe(true);
  });

  it("normaliza o CNPJ antes da prevenção de duplicidade no formulário", () => {
    expect(digitsOnly("12.345.678/0001-95")).toBe("12345678000195");
    expect(hasDuplicateRegistryValue([digitsOnly("12.345.678/0001-95")], digitsOnly("12345678000195"))).toBe(true);
  });

  it("bloqueia regional duplicada antes de chamar a mutação", () => {
    renderWorkspace();
    const regionalForm = formFor("Regionais");
    fireEvent.change(within(regionalForm).getByPlaceholderText("Nome"), { target: { value: " regional mg " } });
    fireEvent.change(within(regionalForm).getByPlaceholderText("Código"), { target: { value: "rmg" } });
    submit("Adicionar regional");
    expect(toast.error).toHaveBeenCalledWith("Já existe uma regional com este nome ou código.");
    expect(mutations.regional).not.toHaveBeenCalled();
  });

  it("bloqueia cidade já cadastrada na mesma regional", () => {
    renderWorkspace();
    fireEvent.change(screen.getByPlaceholderText("Cidade"), { target: { value: "belo horizonte" } });
    fireEvent.change(screen.getByPlaceholderText("UF"), { target: { value: "mg" } });
    fireEvent.change(screen.getByLabelText("Regional da cidade"), { target: { value: "1" } });
    submit("Adicionar cidade");
    expect(toast.error).toHaveBeenCalledWith("Esta cidade já está cadastrada na regional selecionada.");
    expect(mutations.city).not.toHaveBeenCalled();
  });

  it("bloqueia fornecedor com CNPJ já cadastrado", () => {
    renderWorkspace();
    const supplierForm = formFor("Fornecedores");
    fireEvent.change(within(supplierForm).getByPlaceholderText("Nome de exibição"), { target: { value: "Novo fornecedor" } });
    fireEvent.change(within(supplierForm).getByPlaceholderText("CNPJ"), { target: { value: "12.345.678/0001-95" } });
    fireEvent.change(within(supplierForm).getByPlaceholderText("E-mail"), { target: { value: "novo@fornecedor.com" } });
    fireEvent.change(within(supplierForm).getByPlaceholderText("Telefone"), { target: { value: "31999999999" } });
    submit("Adicionar fornecedor");
    expect(toast.error).toHaveBeenCalledWith("Já existe um fornecedor cadastrado com este CNPJ.");
    expect(mutations.supplier).not.toHaveBeenCalled();
  });

  it("bloqueia loja duplicada por código e parceiro duplicado por nome", () => {
    renderWorkspace();
    const storeForm = formFor("Lojas");
    fireEvent.change(within(storeForm).getByPlaceholderText("Nome da loja"), { target: { value: "Outra loja" } });
    fireEvent.change(within(storeForm).getByPlaceholderText("Código"), { target: { value: "LJ001" } });
    fireEvent.change(within(storeForm).getByLabelText("Cidade da loja"), { target: { value: "1" } });
    submit("Adicionar loja");
    expect(toast.error).toHaveBeenCalledWith("Já existe uma loja com este código ou nome na cidade selecionada.");
    expect(mutations.store).not.toHaveBeenCalled();

    fireEvent.change(within(formFor("Parceiros")).getByPlaceholderText("Nome do parceiro"), { target: { value: " parceiro mg " } });
    submit("Adicionar parceiro");
    expect(toast.error).toHaveBeenCalledWith("Já existe um parceiro com este nome.");
    expect(mutations.partner).not.toHaveBeenCalled();
  });
});
