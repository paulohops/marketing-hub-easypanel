import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const localUser = {
  id: 10,
  name: "Camila Souza",
  email: "camila@cluster.com.br",
  phone: "(31) 99999-0000",
  jobTitle: "Coordenadora de campo",
  role: "operator",
  isActive: true,
  hasLocalPassword: true,
  lastSignedIn: null,
};

const detailQuery = vi.hoisted(() => vi.fn((input: { userId: number }) => ({
  data: input.userId === 10 ? { user: localUser, permissions: [], regionalIds: [], cityIds: [] } : undefined,
  isLoading: false,
  refetch: vi.fn(),
})));

const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ users: { adminList: { invalidate: vi.fn() }, adminDetail: { invalidate: vi.fn() } } }),
  users: {
    adminList: { useQuery: () => ({ data: [localUser], isLoading: false }) },
    adminPermissions: { useQuery: () => ({ data: [], isLoading: false, refetch: vi.fn() }) },
    adminDetail: { useQuery: detailQuery },
    createLocalUser: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    updateAdminUser: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    setUserActive: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    resetLocalPassword: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    updateRolePermission: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    updateUserPermission: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    clearUserPermission: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    setTrelloBoard: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  },
  settings: {
    overview: { useQuery: () => ({ data: { regionals: [], cities: [] }, isLoading: false }) },
  },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import UserAdministrationWorkspace from "./UserAdministrationWorkspace";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("administração detalhada de usuários", () => {
  it("abre os dados, o status, a redefinição de senha e as permissões individuais de uma conta local", () => {
    render(<UserAdministrationWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: /Camila Souza/i }));

    expect(screen.getByLabelText("Cargo")).toHaveValue("Coordenadora de campo");
    expect(screen.getByText("Conta ativa")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inativar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Redefinir senha" })).toBeInTheDocument();
    expect(screen.getByText("Permissões individuais")).toBeInTheDocument();
    expect(detailQuery).toHaveBeenLastCalledWith({ userId: 10 }, { enabled: true });
  });
});
