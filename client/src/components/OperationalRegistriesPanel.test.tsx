import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const trpcStub = vi.hoisted(() => {
  const mutations: Record<string, ReturnType<typeof vi.fn>> = {};
  const mutation = (name: string) => ({ mutate: mutations[name] ??= vi.fn(), isPending: false });
  const createStoreMutate = vi.fn();
  const settings = new Proxy(
    {
      overview: { useQuery: () => ({ isLoading: false, data: { providers: [], regionals: [], cities: [{ id: 1, name: "Patos de Minas", state: "MG", active: true }], stores: [], commercialSupervisorStores: [], suppliers: [], partners: [], commercialSupervisors: [], serviceTypes: [], mediaTypes: [], actionTypes: [], eventTypes: [], campaignTypes: [], campaignSectors: [], financialCategories: [], supplierOfferings: [] } }) },
      supplierCoverage: { useQuery: () => ({ isLoading: false, data: { citiesBySupplier: [], servicesBySupplier: [], mediaBySupplier: [] } }) },
      createStore: { useMutation: () => ({ mutate: createStoreMutate, isPending: false }) },
    },
    { get: (target, property) => target[property as keyof typeof target] ?? { useMutation: () => mutation(String(property)) } },
  );
  return {
    useUtils: () => ({ settings: { overview: { invalidate: vi.fn() }, supplierCoverage: { invalidate: vi.fn() } } }),
    settings,
    createStoreMutate,
    mutations,
  };
});

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import OperationalRegistriesPanel from "./OperationalRegistriesPanel";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/cadastros/territorio");
  vi.clearAllMocks();
});

describe("centro de cadastros operacionais", () => {
  it("apresenta diretamente as opções do grupo Território", () => {
    render(<OperationalRegistriesPanel />);

    expect(screen.getByRole("heading", { name: "Cadastros operacionais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /empresas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lojas/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fornecedores/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exibe somente as opções do grupo selecionado", () => {
    window.history.replaceState({}, "", "/cadastros/territorio");
    render(<OperationalRegistriesPanel />);
    expect(screen.getByRole("button", { name: /empresas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lojas/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^fornecedores/i })).not.toBeInTheDocument();
  });

  it("exibe somente as opções do grupo Parceiros", () => {
    window.history.replaceState({}, "", "/cadastros/parceiros");
    render(<OperationalRegistriesPanel />);
    expect(screen.getByRole("button", { name: /fornecedores/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /parceiros comerciais/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /empresas/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lojas/i })).not.toBeInTheDocument();
  });

  it.each([
    ["Empresas", "/cadastros/empresas"],
    ["Regionais", "/cadastros/regionais"],
    ["Cidades", "/cadastros/cidades"],
    ["Lojas", "/cadastros/lojas"],
    ["Fornecedores", "/cadastros/fornecedores"],
    ["Parceiros comerciais", "/cadastros/parceiros"],
    ["Supervisores comerciais", "/cadastros/supervisores"],
    ["Atuação", "/cadastros/tipos-de-campanha"],
    ["Setores", "/cadastros/setores-de-campanha"],
    ["Tipos de ação", "/cadastros/tipos-de-acao"],
    ["Tipos de evento", "/cadastros/tipos-de-evento"],
    ["Tipos de mídia", "/cadastros/tipos-de-midia"],
    ["Serviços", "/cadastros/servicos"],
    ["Pontos de ação", "/pontos-de-acao"],
    ["Influencers", "/cadastros/influencers"],
    ["Modelos de campanha", "/cadastros/modelos"],
    ["Modelos de ações", "/cadastros/modelos-acoes"],
  ])("direciona %s para %s", (cardTitle, expectedPath) => {
    const group = ["Empresas", "Regionais", "Cidades", "Lojas", "Pontos de ação"].includes(cardTitle) ? "territorio" : ["Fornecedores", "Parceiros comerciais", "Supervisores comerciais", "Influencers", "Serviços"].includes(cardTitle) ? "parceiros" : ["Atuação", "Setores"].includes(cardTitle) ? "operacao" : ["Tipos de ação", "Tipos de evento", "Tipos de mídia"].includes(cardTitle) ? "categorias" : "modelos";
    const groupPath = group === "territorio" ? "territorio" : group;
    window.history.replaceState({}, "", `/cadastros/${groupPath}`);
    render(<OperationalRegistriesPanel />);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${cardTitle}`) }));

    expect(window.location.pathname).toBe(expectedPath);
  });

  it("abre Lojas pela intenção de criação e envia os dados ao endpoint específico", async () => {
    window.history.replaceState({}, "", "/cadastros/territorio?novo=lojas");
    render(<OperationalRegistriesPanel />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Lojas" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Loja Centro" } });
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "LJ-001" } });
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(trpcStub.createStoreMutate).toHaveBeenCalledWith(expect.objectContaining({
      name: "Loja Centro",
      code: "LJ-001",
      cityId: 1,
    }));
  });

  it.each([
    ["empresas", "Empresas"],
    ["regionais", "Regionais"],
    ["cidades", "Cidades"],
    ["lojas", "Lojas"],
    ["fornecedores", "Fornecedores"],
    ["parceiros", "Parceiros comerciais"],
    ["supervisores", "Supervisores comerciais"],
    ["servicos", "Serviços"],
    ["tipos-de-campanha", "Atuação"],
    ["setores-de-campanha", "Setores"],
    ["tipos-de-acao", "Tipos de ação"],
    ["tipos-de-evento", "Tipos de evento"],
    ["tipos-de-midia", "Tipos de mídia"],
  ])("abre %s na intenção de criação, sem retornar ao início", async (slug, title) => {
    const directGroup = ["empresas", "regionais", "cidades", "lojas"].includes(slug) ? "territorio" : ["fornecedores", "parceiros", "supervisores", "servicos"].includes(slug) ? "parceiros" : ["tipos-de-campanha", "setores-de-campanha"].includes(slug) ? "operacao" : ["tipos-de-acao", "tipos-de-evento", "tipos-de-midia"].includes(slug) ? "categorias" : "modelos";
    window.history.replaceState({}, "", `/cadastros/${directGroup}?novo=${slug}`);
    render(<OperationalRegistriesPanel />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(window.location.pathname).not.toBe("/cadastros/operacionais");
  });

  it.each([
    ["empresas", "createProvider", {}],
    ["regionais", "createRegional", {}],
    ["cidades", "createCity", { state: "MG" }],
    ["parceiros", "createPartner", { partnershipType: "paid" }],
    ["supervisores", "createCommercialSupervisor", { userId: null }],
    ["servicos", "createType", { kind: "service" }],
    ["tipos-de-campanha", "createType", { kind: "campaign" }],
    ["setores-de-campanha", "createType", { kind: "campaign_sector" }],
    ["tipos-de-acao", "createType", { kind: "action" }],
    ["tipos-de-evento", "createType", { kind: "event" }],
    ["tipos-de-midia", "createType", { kind: "media", operationCategory: "graphics" }],
  ])("envia %s ao endpoint %s", async (slug, endpoint, expectedPayload) => {
    const directGroup = ["empresas", "regionais", "cidades", "lojas"].includes(slug) ? "territorio" : ["fornecedores", "parceiros", "supervisores", "servicos"].includes(slug) ? "parceiros" : ["tipos-de-campanha", "setores-de-campanha"].includes(slug) ? "operacao" : ["tipos-de-acao", "tipos-de-evento", "tipos-de-midia"].includes(slug) ? "categorias" : "modelos";
    window.history.replaceState({}, "", `/cadastros/${directGroup}?novo=${slug}`);
    render(<OperationalRegistriesPanel />);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Registro de teste" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));

    expect(trpcStub.mutations[endpoint]).toHaveBeenCalled();
    expect(trpcStub.mutations[endpoint].mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ name: "Registro de teste", ...expectedPayload }));
  });
});
