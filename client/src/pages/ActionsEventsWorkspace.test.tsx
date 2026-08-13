import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createAction = vi.hoisted(() => vi.fn());
const createEvent = vi.hoisted(() => vi.fn());
const saveActionDebrief = vi.hoisted(() => vi.fn());
const savePostEvent = vi.hoisted(() => vi.fn());
const actionListQuery = vi.hoisted(() => vi.fn());
const eventListQuery = vi.hoisted(() => vi.fn());
const references = { cities: [{ id: 1, name: "Belo Horizonte", state: "MG" }], actionTypes: [{ id: 2, name: "Blitz" }], eventTypes: [{ id: 3, name: "Feira" }], suppliers: [{ id: 4, displayName: "Fornecedor MG" }], serviceTypes: [{ id: 5, name: "Promotoria" }], supervisors: [{ id: 6, name: "Larissa Souza" }], teamUsers: [{ id: 7, name: "Rafael Lima", email: "rafael@cluster.com", jobTitle: "Promotor" }], stockItems: [{ id: 8, name: "Tenda", sku: "TEN-01", unit: "un", cityId: 1 }] };
const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ actions: { list: { invalidate: vi.fn() } }, events: { list: { invalidate: vi.fn() } } }),
  users: { effectivePermissions: { useQuery: () => ({ isSuccess: true, data: ["actions.read", "actions.create", "actions.update", "events.read", "events.create", "events.update"] }) } },
  actions: { referenceData: { useQuery: () => ({ data: references, isLoading: false }) }, list: { useQuery: actionListQuery }, create: { useMutation: () => ({ mutate: createAction, isPending: false }) }, updateExecutionStatus: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) }, saveDebrief: { useMutation: () => ({ mutate: saveActionDebrief, isPending: false }) } },
  events: { referenceData: { useQuery: () => ({ data: references, isLoading: false }) }, list: { useQuery: eventListQuery }, create: { useMutation: () => ({ mutate: createEvent, isPending: false }) }, savePostEvent: { useMutation: () => ({ mutate: savePostEvent, isPending: false }) } },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import ActionsWorkspace from "./ActionsWorkspace";
import EventsWorkspace from "./EventsWorkspace";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
beforeEach(() => { actionListQuery.mockReturnValue({ data: [], isLoading: false }); eventListQuery.mockReturnValue({ data: [], isLoading: false }); });

function selectMultiple(label: string, value: string) {
  const select = screen.getByLabelText(label) as HTMLSelectElement;
  Array.from(select.options).forEach(option => { option.selected = option.value === value; });
  fireEvent.change(select);
}

describe("formulários operacionais ampliados", () => {
  it("expõe supervisor, equipe, serviços e recursos no planejamento de ação", () => {
    render(<ActionsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Nova ação" }));
    expect(screen.getByLabelText("Supervisor comercial")).toBeInTheDocument();
    expect(screen.getByLabelText("Responsáveis do trade")).toBeInTheDocument();
    expect(screen.getByLabelText("Serviços")).toBeInTheDocument();
    expect(screen.getByLabelText("Recursos de estoque")).toBeInTheDocument();
    expect(screen.getByLabelText("Custo previsto (R$)")).toBeInTheDocument();
  });

  it("expõe a decisão de renovação no pós-evento e recursos no planejamento", () => {
    render(<EventsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Novo evento" }));
    expect(screen.getByLabelText("Motivo da parceria")).toBeInTheDocument();
    expect(screen.getByLabelText("Supervisor comercial")).toBeInTheDocument();
    expect(screen.getByLabelText("Responsáveis do trade")).toBeInTheDocument();
    expect(screen.getByLabelText("Recursos de estoque")).toBeInTheDocument();
  });

  it("envia supervisão, equipe, serviços e recursos ao planejar uma ação", () => {
    render(<ActionsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Nova ação" }));
    fireEvent.change(screen.getByLabelText("Nome da ação"), { target: { value: "Blitz Centro" } });
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Supervisor comercial"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-08-14T09:00" } });
    fireEvent.change(screen.getByLabelText("Término"), { target: { value: "2026-08-14T12:00" } });
    fireEvent.change(screen.getByLabelText("Modalidade"), { target: { value: "mixed" } });
    fireEvent.change(screen.getByLabelText("Custo previsto (R$)"), { target: { value: "1250.5" } });
    fireEvent.change(screen.getByLabelText("Objetivo"), { target: { value: "Gerar experimentação" } });
    selectMultiple("Responsáveis do trade", "7");
    selectMultiple("Fornecedores envolvidos", "4");
    selectMultiple("Serviços", "5");
    selectMultiple("Recursos de estoque", "8");
    fireEvent.change(screen.getByLabelText("Quantidade planejada para Tenda"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Planejar ação" }));
    expect(createAction).toHaveBeenCalledWith(expect.objectContaining({ name: "Blitz Centro", cityId: 1, actionTypeId: 2, commercialSupervisorId: 6, partnershipType: "mixed", estimatedCost: 1250.5, supplierIds: [4], serviceTypeIds: [5], teamMemberIds: [7], stockAllocations: [{ stockItemId: 8, quantity: 2 }] }));
  });

  it("envia custos, parceria, vínculos e recursos ao planejar um evento", () => {
    render(<EventsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Novo evento" }));
    fireEvent.change(screen.getByLabelText("Nome do evento"), { target: { value: "Feira Minas" } });
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Tipo"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Supervisor comercial"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Início"), { target: { value: "2026-08-20T10:00" } });
    fireEvent.change(screen.getByLabelText("Modalidade"), { target: { value: "barter" } });
    fireEvent.change(screen.getByLabelText("Custo previsto (R$)"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Motivo da parceria"), { target: { value: "Cobertura regional" } });
    selectMultiple("Responsáveis do trade", "7");
    selectMultiple("Fornecedores envolvidos", "4");
    selectMultiple("Serviços", "5");
    selectMultiple("Recursos de estoque", "8");
    fireEvent.click(screen.getByRole("button", { name: "Planejar evento" }));
    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({ name: "Feira Minas", cityId: 1, eventTypeId: 3, commercialSupervisorId: 6, partnershipType: "barter", estimatedCost: 300, partnershipReason: "Cobertura regional", supplierIds: [4], serviceTypeIds: [5], teamMemberIds: [7], stockAllocations: [{ stockItemId: 8, quantity: 1 }] }));
  });

  it("persiste a decisão de repetir uma ação no debriefing", () => {
    actionListQuery.mockReturnValue({ data: [{ action: { id: 21, name: "Blitz", status: "completed", partnershipType: "paid", scheduledFor: new Date("2026-08-14T09:00:00Z"), endsAt: null, estimatedCost: "0", objective: "Teste" }, cityName: "Belo Horizonte", actionTypeName: "Blitz", supervisorName: null, teamMembers: [], stockItems: [], debrief: null }], isLoading: false });
    render(<ActionsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Registrar debrief" }));
    fireEvent.click(screen.getByLabelText("Vale repetir a iniciativa"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar debrief" }));
    expect(saveActionDebrief).toHaveBeenCalledWith(expect.objectContaining({ actionId: 21, worthRepeating: false, resultAchieved: true }));
  });

  it("persiste a decisão de renovação no pós-evento", () => {
    eventListQuery.mockReturnValue({ data: [{ event: { id: 22, name: "Feira", status: "planned", partnershipType: "paid", startsAt: new Date("2026-08-20T10:00:00Z"), endsAt: null, estimatedCost: "0", partnershipReason: null, preEventNotes: null, rating: null, worthRenewing: null }, cityName: "Belo Horizonte", eventTypeName: "Feira", supervisorName: null, teamMembers: [], stockItems: [] }], isLoading: false });
    render(<EventsWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Pós-evento" }));
    fireEvent.click(screen.getByLabelText("Vale renovar a parceria"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar avaliação" }));
    expect(savePostEvent).toHaveBeenCalledWith(expect.objectContaining({ eventId: 22, worthRenewing: false, resultAchieved: true }));
  });
});
