import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mutations = vi.hoisted(() => ({ createProvider: vi.fn(), createCommercialSupervisor: vi.fn(), createFinancialCategory: vi.fn(), updateFinancialCategory: vi.fn(), updatePartner: vi.fn(), updateCommercialSupervisor: vi.fn(), updateSupplier: vi.fn(), updateSupplierOffering: vi.fn(), setRegistryActive: vi.fn() }));
const trpcStub = vi.hoisted(() => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false });
  const overviewData = { providers: [{ id: 1, name: "Cluster MG", active: true }], regionals: [{ id: 2, name: "Central", code: "MG-C", active: true, providerId: 1 }], cities: [{ id: 3, name: "Belo Horizonte", state: "MG", active: true, regionalId: 2 }], suppliers: [{ id: 4, displayName: "Fornecedor BH", active: true, document: "00.000.000/0001-00", email: "contato@fornecedor.com", phone: null, providerId: 1 }], partners: [{ id: 9, name: "Parceiro BH", email: "parceiro@bh.com", phone: "31999999999", active: true }], commercialSupervisors: [{ id: 8, name: "João Supervisor", email: "joao@cluster.com", phone: null, active: true }], serviceTypes: [{ id: 5, name: "Locução", active: true }], mediaTypes: [{ id: 6, name: "Rádio", active: true }], actionTypes: [{ id: 10, name: "Blitz", active: true }], eventTypes: [{ id: 11, name: "Feira", active: true }], financialCategories: [{ id: 7, name: "Trade e Eventos", description: "Verba principal", active: true }], supplierOfferings: [] };
  const coverageData = { citiesBySupplier: [], servicesBySupplier: [], mediaBySupplier: [] };
  return {
    useUtils: () => ({ settings: { overview: { invalidate: vi.fn() }, supplierCoverage: { invalidate: vi.fn() } } }),
    settings: {
      overview: { useQuery: () => ({ isLoading: false, data: overviewData }) },
      supplierCoverage: { useQuery: () => ({ isLoading: false, data: coverageData }) },
      createProvider: { useMutation: () => ({ mutate: mutations.createProvider, isPending: false }) }, updateProvider: { useMutation: mutation }, createRegional: { useMutation: mutation }, updateRegional: { useMutation: mutation }, createCity: { useMutation: mutation }, updateCity: { useMutation: mutation }, createPartner: { useMutation: mutation }, updatePartner: { useMutation: () => ({ mutate: mutations.updatePartner, isPending: false }) }, createCommercialSupervisor: { useMutation: () => ({ mutate: mutations.createCommercialSupervisor, isPending: false }) }, updateCommercialSupervisor: { useMutation: () => ({ mutate: mutations.updateCommercialSupervisor, isPending: false }) }, createSupplier: { useMutation: mutation }, updateSupplier: { useMutation: () => ({ mutate: mutations.updateSupplier, isPending: false }) }, uploadRegistryContract: { useMutation: mutation }, createType: { useMutation: mutation }, updateType: { useMutation: mutation }, createFinancialCategory: { useMutation: () => ({ mutate: mutations.createFinancialCategory, isPending: false }) }, updateFinancialCategory: { useMutation: () => ({ mutate: mutations.updateFinancialCategory, isPending: false }) }, createSupplierOffering: { useMutation: mutation }, updateSupplierOffering: { useMutation: () => ({ mutate: mutations.updateSupplierOffering, isPending: false }) }, setSupplierCoverage: { useMutation: mutation }, setRegistryActive: { useMutation: () => ({ mutate: mutations.setRegistryActive, isPending: false }) },
    },
  };
});

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import OperationalRegistriesPanel from "./OperationalRegistriesPanel";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("centro de cadastros operacionais", () => {
  it("organiza os domínios configuráveis em caixas e abre o cadastro de fornecedores", () => {
    render(<OperationalRegistriesPanel />);

    expect(screen.getByRole("heading", { name: "Cadastros operacionais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /empresas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tipos de ação/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fornecedores e preços/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /fornecedores e preços/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("CNPJ")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Fornecedor"), { target: { value: "4" } });
    expect(screen.getByText("Cidades atendidas")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço unitário (R$)")).toBeInTheDocument();
  });

  it("mantém o acesso de Empresas na página dedicada e administra categorias financeiras no centro operacional", () => {
    render(<OperationalRegistriesPanel />);

    expect(screen.getByText("Ver empresas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /categorias financeiras/i }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Mídia de rua" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));
    expect(mutations.createFinancialCategory).toHaveBeenCalledWith({ name: "Mídia de rua" });
    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));
    expect(mutations.setRegistryActive).toHaveBeenLastCalledWith({ kind: "financial_category", id: 7, active: false });
  });

  it("edita o fornecedor selecionado e atualiza a categoria financeira existente", () => {
    render(<OperationalRegistriesPanel />);

    fireEvent.click(screen.getByRole("button", { name: /fornecedores e preços/i }));
    fireEvent.change(screen.getByLabelText("Fornecedor"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome de exibição"), { target: { value: "Fornecedor Atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar fornecedor" }));
    expect(mutations.updateSupplier).toHaveBeenCalledWith(expect.objectContaining({ id: 4, displayName: "Fornecedor Atualizado" }));

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /categorias financeiras/i }));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Verba revisada" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar edição" }));
    expect(mutations.updateFinancialCategory).toHaveBeenCalledWith({ id: 7, name: "Trade e Eventos", description: "Verba revisada" });
  });

  it("edita e inativa parceiros preservando o cadastro no centro operacional", () => {
    render(<OperationalRegistriesPanel />);

    fireEvent.click(screen.getByText("Parceiros").closest("button") as HTMLButtonElement);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Parceiro Atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar edição" }));
    expect(mutations.updatePartner).toHaveBeenCalledWith(expect.objectContaining({ id: 9, name: "Parceiro Atualizado", email: "parceiro@bh.com", phone: "31999999999" }));
    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));
    expect(mutations.setRegistryActive).toHaveBeenLastCalledWith({ kind: "partner", id: 9, active: false });
  });

  it("edita e inativa supervisores comerciais preservando o cadastro no centro operacional", () => {
    render(<OperationalRegistriesPanel />);

    fireEvent.click(screen.getByText("Supervisores comerciais").closest("button") as HTMLButtonElement);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "João Atualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar edição" }));
    expect(mutations.updateCommercialSupervisor).toHaveBeenCalledWith({ id: 8, name: "João Atualizado", email: "joao@cluster.com", phone: undefined });
    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));
    expect(mutations.setRegistryActive).toHaveBeenLastCalledWith({ kind: "supervisor", id: 8, active: false });
  });

  it.each([
    ["Regionais", "Central"],
    ["Cidades", "Belo Horizonte"],
    ["Parceiros", "Parceiro BH"],
    ["Supervisores comerciais", "João Supervisor"],
    ["Tipos de ação", "Blitz"],
    ["Tipos de evento", "Feira"],
    ["Tipos de mídia", "Rádio"],
    ["Serviços", "Locução"],
    ["Categorias financeiras", "Trade e Eventos"],
  ])("expõe edição e status para %s", (cardTitle) => {
    render(<OperationalRegistriesPanel />);
    fireEvent.click(screen.getByText(cardTitle).closest("button") as HTMLButtonElement);
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inativar" })).toBeInTheDocument();
  });
});
