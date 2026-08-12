import { cleanup, render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { afterEach, expect, it, vi } from "vitest";
import DashboardLayout from "@/components/DashboardLayout";
import ActionsWorkspace from "./ActionsWorkspace";
import DashboardPage from "./DashboardPage";
import EventsWorkspace from "./EventsWorkspace";
import FinanceWorkspace from "./FinanceWorkspace";
import IndicatorsWorkspace from "./IndicatorsWorkspace";
import InventoryWorkspace from "./InventoryWorkspace";
import MediaWorkspace from "./MediaWorkspace";
import SettingsWorkspace from "./SettingsWorkspace";
import ProfileWorkspace from "./ProfileWorkspace";
import UserAdministrationWorkspace from "./UserAdministrationWorkspace";
import TradeOperationsWorkspace from "./TradeOperationsWorkspace";

expect.extend(toHaveNoViolations);

const trpcStub = vi.hoisted(() => {
  const emptyData = new Proxy(Object.assign([], {
    activeCampaigns: 0,
    totalMediaPoints: 0,
    completedActions: 0,
    plannedActions: 0,
    completedEvents: 0,
    totalEvents: 0,
    totalInvoices: 0,
    pendingAmount: 0,
    providers: [], regionals: [], cities: [], suppliers: [], stores: [], partners: [],
    serviceTypes: [], mediaTypes: [], actionTypes: [], eventTypes: [],
    supplierPerformance: [], alerts: [],
    media: { activeCampaigns: 0 }, actions: { averageRating: null }, events: { averageRating: null }, finance: { openAmount: 0 },
  }), {
    get(target, property, receiver) {
      if (typeof property === "string" && !(property in target)) return [];
      return Reflect.get(target, property, receiver);
    },
  });
  const profileData = { id: 1, name: "Ana", email: "ana@empresa.com", phone: null, role: "admin", avatarUrl: null, loginMethod: "local" };
  const adminUsers: never[] = [];
  const rolePermissions: never[] = [];
  const stub: Record<string | symbol, unknown> = {};
  const usersStub = new Proxy(stub, {
    get(_target, property) {
      if (property === "profile") return { useQuery: () => ({ data: profileData, isLoading: false, isError: false }) };
      if (property === "passwordPolicy") return { useQuery: () => ({ data: { message: "A senha local é gerenciada com segurança." }, isLoading: false, isError: false }) };
      if (property === "adminList") return { useQuery: () => ({ data: adminUsers, isLoading: false, isError: false }) };
      if (property === "adminPermissions") return { useQuery: () => ({ data: rolePermissions, isLoading: false, isError: false, refetch: vi.fn() }) };
      if (property === "adminDetail") return { useQuery: () => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() }) };
      if (property === "useQuery") return () => ({ data: emptyData, isLoading: false, isError: false });
      if (property === "useMutation") return () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
      return trpcStub;
    },
  });
  return new Proxy(stub, {
    get(_target, property) {
      if (property === "users") return usersStub;
      if (property === "useQuery") return () => ({ data: emptyData, isLoading: false, isError: false });
      if (property === "useMutation") return () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
      if (property === "useUtils") return () => trpcStub;
      if (property === "invalidate" || property === "setData") return vi.fn();
      return trpcStub;
    },
  });
});

afterEach(cleanup);

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    isAuthenticated: true,
    user: { id: 1, name: "Ana", email: "ana@empresa.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/components/Map", () => ({ MapView: () => <div role="img" aria-label="Mapa operacional" /> }));

const workspaces = [
  ["Dashboard", DashboardPage],
  ["Configurações", SettingsWorkspace],
  ["Estoque", InventoryWorkspace],
  ["Financeiro", FinanceWorkspace],
  ["Operações", TradeOperationsWorkspace],
  ["Mídias", MediaWorkspace],
  ["Ações", ActionsWorkspace],
  ["Eventos", EventsWorkspace],
  ["Indicadores", IndicatorsWorkspace],
  ["Meu perfil", ProfileWorkspace],
  ["Usuários e permissões", UserAdministrationWorkspace],
] as const;

for (const [label, Workspace] of workspaces) {
  it(`não apresenta violações de acessibilidade em ${label}`, async () => {
    const { container } = render(<DashboardLayout><Workspace /></DashboardLayout>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
}
