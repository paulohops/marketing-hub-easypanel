import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
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

vi.mock("@/lib/trpc", () => ({ trpc: { users: { effectivePermissions: { useQuery: () => ({ isSuccess: false }) } } } }));

describe("DashboardLayout", () => {
  afterEach(cleanup);

  it("oculta Cadastros para o perfil visualizador", () => {
    authState.user.role = "viewer";
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);

    expect(screen.getByText("Estoque")).toBeInTheDocument();
    expect(screen.queryByText("Cadastros")).not.toBeInTheDocument();
  });

  it("exibe Cadastros para o perfil administrador", () => {
    authState.user.role = "admin";
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);

    expect(screen.getByText("Cadastros")).toBeInTheDocument();
    expect(screen.getAllByText("Operação").length).toBeGreaterThan(0);
    expect(screen.getByText("Gestão")).toBeInTheDocument();
    expect(screen.getByText("Relatórios")).toBeInTheDocument();
    expect(screen.getByText("Ajuda e suporte")).toBeInTheDocument();
    expect(screen.queryByText("Operações unificadas")).not.toBeInTheDocument();
  });
});
