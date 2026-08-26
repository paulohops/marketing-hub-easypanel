import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAction = vi.hoisted(() => vi.fn());
const createEvent = vi.hoisted(() => vi.fn());
const saveActionDebrief = vi.hoisted(() => vi.fn());
const savePostEvent = vi.hoisted(() => vi.fn());
const updateEvent = vi.hoisted(() => vi.fn());
const deleteEvent = vi.hoisted(() => vi.fn());
const updateExecutionStatus = vi.hoisted(() => vi.fn());
const actionListQuery = vi.hoisted(() => vi.fn());
const eventListQuery = vi.hoisted(() => vi.fn());
const references = { cities: [{ city: { id: 1, name: "Belo Horizonte", state: "MG", regionalId: 11 }, regionalName: "Central Mineira" }], actionTypes: [{ id: 2, name: "Blitz" }], eventTypes: [{ id: 3, name: "Feira" }], suppliers: [{ id: 4, displayName: "Fornecedor MG" }], supplierCities: [{ supplierId: 4, cityId: 1 }], supplierServiceTypes: [{ supplierId: 4, serviceTypeId: 5 }], serviceTypes: [{ id: 5, name: "Promotoria" }], supplierOfferings: [{ id: 9, supplierId: 4, supplierName: "Fornecedor MG", name: "Promotoria", unit: "dia", unitPrice: "400" }], supervisors: [{ id: 6, name: "Larissa Souza" }], teamUsers: [{ id: 7, name: "Rafael Lima", email: "rafael@cluster.com", jobTitle: "Promotor" }], stockItems: [{ id: 8, name: "Tenda", sku: "TEN-01", unit: "un", cityId: 1, regionalId: 11 }], actionPoints: [{ id: 12, cityId: 1, name: "Praça Central", address: "Praça Sete, Centro", latitude: "-19.9208", longitude: "-43.9378", active: true }], campaigns: [] };
const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ actions: { list: { invalidate: vi.fn() }, referenceData: { invalidate: vi.fn() } }, events: { list: { invalidate: vi.fn() } }, campaigns: { list: { invalidate: vi.fn() } } }),
  users: { effectivePermissions: { useQuery: () => ({ isSuccess: true, data: ["actions.read", "actions.create", "actions.update", "events.read", "events.create", "events.update"] }) } },
  actions: { referenceData: { useQuery: () => ({ data: references, isLoading: false }) }, list: { useQuery: actionListQuery }, create: { useMutation: () => ({ mutate: createAction, isPending: false }) }, updateDetails: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, uploadCover: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, uploadStatusEvidence: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) }, updateExecutionStatus: { useMutation: () => ({ mutate: updateExecutionStatus, isPending: false }) }, reschedule: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, saveDebrief: { useMutation: () => ({ mutate: saveActionDebrief, isPending: false }) } },
  events: { referenceData: { useQuery: () => ({ data: references, isLoading: false }) }, list: { useQuery: eventListQuery }, create: { useMutation: () => ({ mutate: createEvent, isPending: false }) }, updateDetails: { useMutation: () => ({ mutate: updateEvent, isPending: false }) }, savePostEvent: { useMutation: () => ({ mutate: savePostEvent, isPending: false }) }, delete: { useMutation: () => ({ mutate: deleteEvent, isPending: false }) } },
  campaigns: { create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/EvidenceUpload", () => ({ default: ({ variant }: { variant?: string }) => <div data-testid="evidence-upload" data-variant={variant}>Evidências</div> }));

import ActionsWorkspace from "./ActionsWorkspace";
import EventsWorkspace from "./EventsWorkspace";

afterEach(() => { cleanup(); localStorage.removeItem("marketing_hub_list_density"); vi.clearAllMocks(); });
beforeEach(() => { actionListQuery.mockReturnValue({ data: [], isLoading: false }); eventListQuery.mockReturnValue({ data: [], isLoading: false }); });

function selectMultiple(label: string, option: string) {
  const controls = screen.getAllByLabelText(label);
  fireEvent.click(controls[controls.length - 1]);
  fireEvent.click(screen.getByLabelText(`Selecionar ${option}`));
}

describe("formulários operacionais ampliados", () => {
  it("expõe campos pesquisáveis e ponto comercial no planejamento de ação", () => {
    render(<ActionsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Nova ação" }));
    expect(screen.getByLabelText("Supervisor responsável")).toBeInTheDocument();
    expect(screen.getByLabelText("Responsáveis do trade")).toBeInTheDocument();
    expect(screen.getByLabelText("Fornecedores envolvidos")).toBeInTheDocument();
    expect(screen.getByLabelText("Ponto comercial ou local de ação")).toBeInTheDocument();
  });

  it("expõe tipo, ponto comercial, equipe e recursos no planejamento de evento", () => {
    render(<EventsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Novo evento" }));
    expect(screen.getByLabelText("Tipo de evento")).toBeInTheDocument();
    expect(screen.getByLabelText("Ponto comercial ou local de ação")).toBeInTheDocument();
    expect(screen.getByLabelText("Responsáveis do trade")).toBeInTheDocument();
    expect(screen.getByLabelText("Recursos de estoque")).toBeInTheDocument();
  });

  it("envia supervisão, equipe, serviços e recursos ao planejar uma ação", () => {
    render(<ActionsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Nova ação" }));
    fireEvent.change(screen.getByLabelText("Nome da ação"), { target: { value: "Blitz Centro" } });
    selectMultiple("Cidade", "Belo Horizonte");
    selectMultiple("Tipo de ação", "Blitz");
    selectMultiple("Ponto comercial ou local de ação", "Praça Central");
    fireEvent.change(screen.getByPlaceholderText("Ex.: -18.95677454094437, -46.99206057116672"), { target: { value: "-18.95677454094437, -46.99206057116672" } });
    selectMultiple("Supervisor responsável", "Larissa Souza");
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-08-14T09:00" } });
    fireEvent.change(screen.getByLabelText("Término"), { target: { value: "2026-08-14T12:00" } });
    selectMultiple("Modalidade", "Misto");
    fireEvent.change(screen.getByLabelText("Objetivo"), { target: { value: "Gerar experimentação" } });
    selectMultiple("Responsáveis do trade", "Rafael Lima");
    selectMultiple("Fornecedores envolvidos", "Fornecedor MG");
    selectMultiple("Serviços oferecidos", "Promotoria");
    selectMultiple("Recursos de estoque", "Tenda");
    fireEvent.change(screen.getByDisplayValue("1"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Planejar ação" }));
    expect(createAction).toHaveBeenCalledWith(expect.objectContaining({ name: "Blitz Centro", cityId: 1, actionTypeId: 2, actionPointId: 12, latitude: -18.95677454094437, longitude: -46.99206057116672, commercialSupervisorId: 6, partnershipType: "mixed", supplierIds: [4], serviceTypeIds: [5], serviceAllocations: [{ serviceTypeId: 5, supplierOfferingId: 9, estimatedAmount: 400 }], teamMemberIds: [7], stockAllocations: [{ stockItemId: 8, quantity: 2 }] }));
  });

  it("aplica um modelo de ação sem bloquear a edição do planejamento", () => {
    (references as any).actionTemplates = [{ id: 31, name: "Panfletagem em loja", actionTypeName: "Blitz", defaultActionTypeId: 2, defaultPartnershipType: "paid", defaultDurationHours: "6", objective: "Divulgar planos no entorno da loja" }];
    render(<ActionsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Nova ação" }));
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-08-14T09:00" } });
    selectMultiple("Começar com um modelo", "Panfletagem em loja");
    expect(screen.getByLabelText("Objetivo")).toHaveValue("Divulgar planos no entorno da loja");
    expect(screen.getByLabelText("Término")).toHaveValue("2026-08-14T15:00");
    selectMultiple("Tipo de ação", "Blitz");
  });

  it("oferece filtros recolhíveis, incluindo responsável e nota, na lista de ações", () => {
    actionListQuery.mockReturnValue({ data: [{ action: { id: 25, cityId: 1, name: "Blitz Financeira", status: "planned", partnershipType: "paid", scheduledFor: new Date("2026-08-14T09:00:00Z"), endsAt: null, estimatedCost: "800", objective: "Teste" }, cityName: "Belo Horizonte", actionTypeName: "Blitz", supervisorName: null, teamMembers: [], stockItems: [], debrief: null, finance: { estimatedAmount: 800, paidAmount: 250, remainingAmount: 550 } }], isLoading: false });
    render(<ActionsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    expect(screen.getByLabelText("Regional")).toBeInTheDocument();
    expect(screen.getByLabelText("Cidade")).toBeInTheDocument();
    expect(screen.getByLabelText("Responsável")).toBeInTheDocument();
    expect(screen.getByLabelText("Nota")).toBeInTheDocument();
    expect(screen.getByText("Blitz Financeira")).toBeInTheDocument();
    expect(screen.getByText("itens e serviços")).toBeInTheDocument();
    expect(screen.queryByText("saldo")).not.toBeInTheDocument();
  });

  it("mantém filtros recolhíveis e não exibe o controle de densidade", () => {
    localStorage.removeItem("marketing_hub_list_density");
    eventListQuery.mockReturnValue({ data: [{ event: { id: 28, cityId: 1, name: "Feira Regional", status: "planned", partnershipType: "paid", startsAt: new Date("2026-08-20T10:00:00Z"), endsAt: null, estimatedCost: "300", rating: null, worthRenewing: null }, cityName: "Belo Horizonte", eventTypeName: "Feira", supervisorName: null, teamMembers: [], stockItems: [], finance: { estimatedAmount: 300, paidAmount: 0, remainingAmount: 300 } }], isLoading: false });
    render(<EventsWorkspace />);

    expect(screen.queryByLabelText("Filtrar eventos por regional")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtros" }));
    expect(screen.getByLabelText("Filtrar eventos por regional")).toBeInTheDocument();
    expect(screen.getByLabelText("Filtrar eventos por cidade")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Modo compacto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Compacto" })).not.toBeInTheDocument();
    expect(screen.getByText("Feira Regional").closest("article")).not.toHaveAttribute("data-density", "compact");
  });

  it("mantém a densidade persistida sem exibir um controle compacto", () => {
    eventListQuery.mockReturnValue({ data: [{ event: { id: 29, cityId: 1, name: "Feira de Persistência", status: "planned", partnershipType: "paid", startsAt: new Date("2026-08-20T10:00:00Z"), endsAt: null, estimatedCost: "300", rating: null, worthRenewing: null }, cityName: "Belo Horizonte", eventTypeName: "Feira", supervisorName: null, teamMembers: [], stockItems: [], finance: { estimatedAmount: 300, paidAmount: 0, remainingAmount: 300 } }], isLoading: false });
    const eventView = render(<EventsWorkspace />);
    localStorage.setItem("marketing_hub_list_density", "compact");
    eventView.unmount();

    actionListQuery.mockReturnValue({ data: [{ action: { id: 30, cityId: 1, name: "Blitz Compacta", status: "planned", partnershipType: "paid", scheduledFor: new Date("2026-08-20T10:00:00Z"), endsAt: null, estimatedCost: "300", objective: "Teste" }, cityName: "Belo Horizonte", actionTypeName: "Blitz", supervisorName: null, teamMembers: [], stockItems: [], debrief: null, finance: { estimatedAmount: 300, paidAmount: 0, remainingAmount: 300 } }], isLoading: false });
    render(<ActionsWorkspace />);

    expect(screen.queryByRole("button", { name: "Compacto" })).not.toBeInTheDocument();
    expect(screen.getByText("Blitz Compacta").closest("button")).toHaveClass("min-h-[112px]", "py-3");
  });

  it("envia custos, parceria, vínculos e recursos ao planejar um evento", () => {
    render(<EventsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Novo evento" }));
    fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Feira Minas" } });
    fireEvent.change(screen.getByLabelText("Cidade e regional"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Tipo de evento"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Supervisor comercial"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-08-20T10:00" } });
    fireEvent.change(screen.getByLabelText("Modalidade"), { target: { value: "barter" } });
    fireEvent.change(screen.getByLabelText("Custo previsto (R$)"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Motivo da parceria"), { target: { value: "Cobertura regional" } });
    selectMultiple("Responsáveis do trade", "Rafael Lima");
    selectMultiple("Fornecedores envolvidos", "Fornecedor MG");
    selectMultiple("Serviços", "Promotoria");
    selectMultiple("Recursos de estoque", "Tenda");
    fireEvent.click(screen.getByRole("button", { name: "Planejar evento" }));
    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ name: "Feira Minas", cityId: 1, eventTypeId: 3, commercialSupervisorId: 6, partnershipType: "barter", estimatedCost: 300, partnershipReason: "Cobertura regional", supplierIds: [4], serviceTypeIds: [5], teamMemberIds: [7], stockAllocations: [{ stockItemId: 8, quantity: 1 }] }));
  });

  it("abre a ficha da ação antes de registrar o debriefing", () => {
    actionListQuery.mockReturnValue({ data: [{ action: { id: 21, tradeCampaignId: 16, name: "Blitz", status: "completed", partnershipType: "paid", scheduledFor: new Date("2026-08-14T09:00:00Z"), endsAt: null, estimatedCost: "0", objective: "Teste", address: "Avenida Afonso Pena, 100" }, cityName: "Belo Horizonte", actionTypeName: "Blitz", actionPointName: "Farmácia Nacional · Loja 17", supervisorName: null, campaignName: "Volta às aulas", campaignLogoUrl: "https://cdn.example.com/campanha.png", teamMembers: [], suppliers: [{ supplierId: 4, name: "Fornecedor MG", photoUrl: null, mainService: "Panfletagem" }], services: [{ serviceTypeId: 5, name: "Panfletagem", supplierName: "Fornecedor MG", estimatedAmount: "100" }], stockItems: [{ stockItemId: 8, name: "Tenda", sku: "TEN-01", plannedQuantity: "9.00" }], history: [{ auditAction: "create", occurredAt: new Date("2026-08-14T09:00:00Z"), actorName: "Paulo Oliveira", afterData: null }, { auditAction: "update_execution_status", occurredAt: new Date("2026-08-14T10:00:00Z"), actorName: "Paulo Oliveira", afterData: null }], debrief: null }], isLoading: false });
    render(<ActionsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /Blitz.*Teste/ }));
    expect(screen.getByText("Planejamento e local")).toBeInTheDocument();
    expect(screen.getByText("Contexto comercial")).toBeInTheDocument();
    expect(screen.getByText("Objetivo da ação")).toBeInTheDocument();
    expect(screen.getByText("Teste")).toHaveClass("text-base", "leading-7");
    expect(screen.getByText("Volta às aulas")).toHaveClass("text-sm");
    expect(screen.getByAltText("Identidade visual da campanha Volta às aulas")).toHaveClass("object-cover");
    expect(screen.getByText("Farmácia Nacional · Loja 17").tagName).toBe("STRONG");
    expect(screen.getByText("Avenida Afonso Pena, 100")).toBeInTheDocument();
    expect(screen.getByText("Fornecedor: Fornecedor MG")).toBeInTheDocument();
    expect(screen.getByText("Fornecedor MG")).toBeInTheDocument();
    expect(screen.getAllByText("Panfletagem").length).toBeGreaterThan(1);
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Fotos, vídeos e evidências")).toBeInTheDocument();
    expect(screen.getByTestId("evidence-upload")).toHaveAttribute("data-variant", "gallery");
    expect(screen.getAllByText(/Status atualizado|Ação planejada/).map(element => element.textContent)).toEqual(["Status atualizado", "Ação planejada"]);
    expect(screen.queryByText("Total de itens e serviços")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver motivo e evidências/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nota geral" }));
    fireEvent.click(screen.getByRole("option", { name: "Selecionar 4 · Bom" }));
    expect(screen.queryByRole("checkbox", { name: "Selecionar 4 · Bom" })).not.toBeInTheDocument();
    selectMultiple("Alterar status", "Planejada");
    expect(updateExecutionStatus).toHaveBeenCalledWith({ actionId: 21, status: "planned" });
    expect(screen.queryByText("Confirmar alteração de status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Vale repetir"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar debriefing" }));
    expect(saveActionDebrief).toHaveBeenCalledWith(expect.objectContaining({ actionId: 21, worthRepeating: false, resultAchieved: true }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir campanha Volta às aulas" }));
    expect(window.location.pathname).toBe("/campanhas/16");
  });

  it("mostra inicialmente os cinco registros mais recentes e permite expandir o Histórico", () => {
    actionListQuery.mockReturnValue({ data: [{ action: { id: 33, name: "Histórico", status: "completed", partnershipType: "paid", scheduledFor: new Date("2026-08-14T09:00:00Z"), endsAt: null, estimatedCost: "0", objective: "Teste" }, cityName: "Belo Horizonte", actionTypeName: "Blitz", teamMembers: [], suppliers: [], services: [], stockItems: [], debrief: null, history: [1, 2, 3, 4, 5, 6].map(index => ({ id: index, auditAction: "update_execution_status", occurredAt: new Date(`2026-08-${index + 10}T10:00:00Z`), actorName: `Usuário ${index}` })) }], isLoading: false });
    render(<ActionsWorkspace />);
    fireEvent.click(screen.getByText("Histórico"));
    expect(screen.getByText(/Usuário 6/)).toBeInTheDocument();
    expect(screen.queryByText(/Usuário 1/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar tudo (6)" }));
    expect(screen.getByText(/Usuário 1/)).toBeInTheDocument();
  });

  it("persiste a decisão de renovação dentro da ficha do evento", () => {
    eventListQuery.mockReturnValue({ data: [{ event: { id: 22, name: "Feira", status: "planned", partnershipType: "paid", startsAt: new Date("2026-08-20T10:00:00Z"), endsAt: null, estimatedCost: "0", partnershipReason: null, preEventNotes: null, rating: null, worthRenewing: null }, cityName: "Belo Horizonte", eventTypeName: "Feira", supervisorName: null, teamMembers: [], stockItems: [] }], isLoading: false });
    render(<EventsWorkspace />);
    fireEvent.click(screen.getByRole("heading", { name: "Feira" }));
    expect(screen.getByLabelText("Vale renovar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salvar debriefing" }));
    expect(savePostEvent).toHaveBeenCalledWith(expect.objectContaining({ eventId: 22, rating: null, worthRenewing: false, resultAchieved: false, status: "planned", leadCount: 0, saleCount: 0, renewalCount: 0 }));
  });
});
