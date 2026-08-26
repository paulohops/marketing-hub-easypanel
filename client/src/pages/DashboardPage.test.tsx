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
    inventory: { list: { useQuery: () => ({ data: [] }) } },
    notifications: { list: { useQuery: () => ({ data: [] }) } },
  },
}));

describe("DashboardPage", () => {
  it("prioriza os indicadores operacionais e direciona para a central de ajuda", () => {
    render(<DashboardPage />);

    expect(screen.getByAltText("Logo MARKETING HUB")).toBeInTheDocument();
    expect(screen.getByText("Mídias ativas")).toBeInTheDocument();
    expect(screen.getByText("Ações realizadas")).toBeInTheDocument();
    expect(screen.getByText("Eventos realizados")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Próximas ações e eventos" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "O que precisa de atenção" })).toBeInTheDocument();
    expect(screen.getAllByText("1")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: /ver ajuda e suporte/i }));
    expect(setLocation).toHaveBeenCalledWith("/ajuda");
  });

  it("preserva tokens de superfície semânticos quando renderizado sob o tema escuro", () => {
    const { container } = render(<div className="dark"><DashboardPage /></div>);

    expect(container.querySelector(".dark")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-card").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Próximas ações e eventos" }).length).toBeGreaterThan(0);
    expect(container.querySelector(".bg-white")).toBeNull();
  });
});
