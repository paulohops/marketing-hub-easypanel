import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const updateConfiguration = vi.hoisted(() => vi.fn());
const trelloConfiguration = vi.hoisted(() => ({ url: "" }));
const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ settings: { getTrelloConfiguration: { invalidate: vi.fn() } } }),
  settings: {
    getTrelloConfiguration: { useQuery: () => ({ data: trelloConfiguration, isLoading: false }) },
    updateTrelloConfiguration: { useMutation: () => ({ mutate: updateConfiguration, isPending: false }) },
  },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/hooks/useEffectivePermissions", () => ({ useEffectivePermissions: () => ({ can: (permission: string) => permission === "settings.write", isLoading: false }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import TrelloWorkspace from "./TrelloWorkspace";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("workspace Trello", () => {
  it("mantém a configuração e o estado vazio em superfícies semânticas sob o tema escuro", () => {
    const { container } = render(<div className="dark"><TrelloWorkspace /></div>);

    expect(container.querySelector(".dark")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-card").length).toBeGreaterThan(0);
    expect(container.querySelector(".bg-white")).toBeNull();
  });

  it("permite à administração configurar o quadro e informa quando não há integração", async () => {
    render(<TrelloWorkspace />);
    expect(screen.getByText("Nenhum quadro conectado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conectar quadro" }));
    await waitFor(() => expect(screen.getByLabelText("URL do quadro")).toHaveValue(""));
    fireEvent.change(screen.getByLabelText("URL do quadro"), { target: { value: "https://trello.com/b/abc123/comercial" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(updateConfiguration).toHaveBeenCalledWith({ url: "https://trello.com/b/abc123/comercial" }, expect.objectContaining({ onSuccess: expect.any(Function) }));
  });
});
