import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const createActionPoint = vi.hoisted(() => vi.fn());
const deleteActionPoint = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ settings: { overview: { invalidate: vi.fn() } } }),
    settings: {
      overview: { useQuery: () => ({ isLoading: false, data: { cities: [{ id: 8, name: "Uberlândia", state: "MG", active: true }], actionPoints: [] } }) },
      createActionPoint: { useMutation: () => ({ mutate: createActionPoint, isPending: false }) },
      updateActionPoint: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      deleteActionPoint: { useMutation: () => ({ mutate: deleteActionPoint, isPending: false }) },
    },
  },
}));
vi.mock("@/hooks/useEffectivePermissions", () => ({ useEffectivePermissions: () => ({ can: () => true }) }));
vi.mock("wouter", () => ({ useLocation: () => ["/pontos-de-acao", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ActionPointsWorkspace from "./ActionPointsWorkspace";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("cadastro de pontos de ação", () => {
  it("abre a rota dedicada e envia o ponto territorial ao endpoint de criação", () => {
    render(<ActionPointsWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Novo ponto" }));
    fireEvent.change(screen.getByLabelText("Nome do ponto"), { target: { value: "Praça Central" } });
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Endereço"), { target: { value: "Av. Floriano Peixoto, 100" } });
    fireEvent.change(screen.getByLabelText("Latitude e longitude"), { target: { value: "-18,9186, -48,2772" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar ponto" }));

    expect(createActionPoint).toHaveBeenCalledWith({
      cityId: 8,
      name: "Praça Central",
      address: "Av. Floriano Peixoto, 100",
      latitude: -18.9186,
      longitude: -48.2772,
      notes: undefined,
    });
  });
});
