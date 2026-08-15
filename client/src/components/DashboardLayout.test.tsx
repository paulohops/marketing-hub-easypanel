import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "./DashboardLayout";

const authState = vi.hoisted(() => ({
  loading: false,
  user: { id: 1, name: "Ana", email: "ana@empresa.com", role: "viewer" },
  logout: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ ...authState, isAuthenticated: true }),
}));

vi.mock("@/lib/trpc", () => ({ trpc: { users: { effectivePermissions: { useQuery: () => ({
  isSuccess: true,
  data: authState.user.role === "admin"
    ? ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read", "settings.read"]
    : ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read"],
}) } } } }));

describe("DashboardLayout", () => {
  afterEach(() => { cleanup(); document.documentElement.classList.remove("dark"); });

  it("oculta Cadastros para o perfil visualizador", () => {
    authState.user.role = "viewer";
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);

    expect(screen.getByText("Estoque")).toBeInTheDocument();
    expect(screen.getByText("Estoque").closest("button")).toHaveClass("group-data-[collapsible=icon]:mx-auto");
    expect(screen.queryByText("Cadastros")).not.toBeInTheDocument();
  });

  it("exibe Cadastros para o perfil administrador", () => {
    authState.user.role = "admin";
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);

    expect(screen.getByText("Cadastros")).toBeInTheDocument();
    expect(screen.getAllByText("Operação").length).toBeGreaterThan(0);
    expect(screen.getByText("Gestão")).toBeInTheDocument();
    expect(screen.getByText("Relatórios")).toBeInTheDocument();
    expect(screen.queryByText("Ajuda e suporte")).not.toBeInTheDocument();
    expect(screen.queryByText("Operações unificadas")).not.toBeInTheDocument();
  });

  it("expande Mídias e Cadastros por clique sem navegar para uma página-pai", () => {
    authState.user.role = "admin";
    window.history.replaceState({}, "", "/acoes");
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);

    const midias = screen.getByText("Mídias").closest("button");
    const cadastros = screen.getByText("Cadastros").closest("button");
    expect(midias).toHaveAttribute("aria-expanded", "false");
    expect(cadastros).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(midias!);
    expect(midias).toHaveAttribute("aria-expanded", "true");
    expect(window.location.pathname).toBe("/acoes");
    expect(screen.getByText("Mídia Urbana")).toBeInTheDocument();
    expect(screen.getByText("Mídia Tradicional")).toBeInTheDocument();

    fireEvent.click(cadastros!);
    expect(cadastros).toHaveAttribute("aria-expanded", "true");
    expect(window.location.pathname).toBe("/acoes");
  });

  it("mantém os rótulos de grupos no fluxo vertical normal da barra lateral", () => {
    authState.user.role = "admin";
    const { container } = render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);

    const headings = container.querySelectorAll('[data-sidebar="group-heading"]');
    expect(headings).toHaveLength(4);
    expect(headings[0]).toHaveTextContent("Operação");
    expect(headings[1]).toHaveTextContent("Gestão");
    expect(headings[0]).not.toHaveClass("group-data-[collapsible=icon]:-mt-8");
    expect(headings[0].parentElement).toHaveClass("shrink-0");
  });

  it("abre o menu de usuário sobre uma superfície semântica no tema escuro", async () => {
    authState.user.role = "admin";
    document.documentElement.classList.add("dark");
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);

    fireEvent.click(screen.getByRole("button", { name: "Pular tutorial" }));
    const trigger = screen.getByRole("button", { name: "Abrir menu de usuário: Ana" });
    trigger.focus();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveClass("hover:bg-white/[0.12]", "focus-visible:ring-2", "focus-visible:ring-ring");
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const helpItem = await screen.findByText("Ajuda e suporte");
    const menu = helpItem.closest('[role="menu"]');
    expect(document.documentElement).toHaveClass("dark");
    expect(menu).toBeInTheDocument();
    expect(menu).toHaveClass("bg-popover");
    expect(menu).not.toHaveClass("bg-white");
  });
});
