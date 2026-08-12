import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const listQuery = vi.hoisted(() => vi.fn());
const territorialQuery = vi.hoisted(() => vi.fn());

const references = {
  regionals: [
    { id: 3, name: "Central" },
    { id: 4, name: "Norte" },
  ],
  cities: [
    { id: 10, regionalId: 3, name: "Belo Horizonte", state: "MG" },
    { id: 11, regionalId: 4, name: "Montes Claros", state: "MG" },
  ],
};

const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ inventory: { list: { invalidate: vi.fn() }, territorialSummary: { invalidate: vi.fn() }, listMovements: { invalidate: vi.fn() } } }),
  inventory: {
    list: { useQuery: listQuery },
    territorialSummary: { useQuery: territorialQuery },
    referenceData: { useQuery: () => ({ data: references, isLoading: false }) },
    listMovements: { useQuery: () => ({ data: undefined, isLoading: false }) },
    createItem: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    registerMovement: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    transfer: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import InventoryWorkspace from "./InventoryWorkspace";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("estoque territorial", () => {
  it("filtra os materiais por regional, cidade e categoria", () => {
    listQuery.mockReturnValue({ data: [], isLoading: false });
    territorialQuery.mockReturnValue({ data: [], isLoading: false });
    render(<InventoryWorkspace />);

    fireEvent.change(screen.getByLabelText("Regional"), { target: { value: "3" } });
    expect(screen.getByRole("option", { name: "Belo Horizonte - MG" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Montes Claros - MG" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Categoria"), { target: { value: "brinde_vip" } });

    expect(listQuery).toHaveBeenLastCalledWith({ regionalId: 3, cityId: 10, category: "brinde_vip" });
    expect(territorialQuery).toHaveBeenLastCalledWith({ regionalId: 3, cityId: 10 });
    expect(screen.getByRole("option", { name: "Brinde VIP" })).toBeInTheDocument();
  });

  it("declara estrutura responsiva para os filtros em móvel e desktop", () => {
    listQuery.mockReturnValue({ data: [], isLoading: false });
    territorialQuery.mockReturnValue({ data: [], isLoading: false });
    render(<InventoryWorkspace />);

    const filterGrid = screen.getByLabelText("Regional").parentElement?.parentElement;
    const workspaceHeader = screen.getByRole("heading", { name: "Estoque de materiais" }).parentElement?.parentElement?.parentElement;

    expect(filterGrid).toHaveClass("grid", "sm:grid-cols-3");
    expect(workspaceHeader).toHaveClass("flex", "flex-col", "sm:flex-row", "sm:items-end", "sm:justify-between");
  });
});
