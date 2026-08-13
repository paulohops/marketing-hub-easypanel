import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "./DashboardPage";

const setLocation = vi.fn();

vi.mock("wouter", () => ({ useLocation: () => ["/", setLocation] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    media: { list: { useQuery: () => ({ data: [{ id: 1, status: "active" }, { id: 2, status: "inactive" }] }) } },
    actions: { list: { useQuery: () => ({ data: [{ action: { id: 1, status: "completed" } }, { action: { id: 2, status: "planned" } }] }) } },
    events: { list: { useQuery: () => ({ data: [{ event: { id: 1, status: "completed" } }] }) } },
  },
}));

describe("DashboardPage", () => {
  it("prioriza os indicadores operacionais e direciona para a central de ajuda", () => {
    render(<DashboardPage />);

    expect(screen.getByText("Mídias ativas")).toBeInTheDocument();
    expect(screen.getByText("Ações realizadas")).toBeInTheDocument();
    expect(screen.getByText("Eventos realizados")).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: /ver ajuda e suporte/i }));
    expect(setLocation).toHaveBeenCalledWith("/ajuda");
  });

  it("preserva tokens de superfície semânticos quando renderizado sob o tema escuro", () => {
    const { container } = render(<div className="dark"><DashboardPage /></div>);

    expect(container.querySelector(".dark")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-card").length).toBeGreaterThan(0);
    const registrationsAction = Array.from(container.querySelectorAll("button")).find(button => /abrir cadastros/i.test(button.textContent ?? ""));
    expect(registrationsAction).toHaveClass("bg-card");
    expect(container.querySelector(".bg-white")).toBeNull();
  });
});
