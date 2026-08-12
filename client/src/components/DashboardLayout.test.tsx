import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it("oculta configurações para o perfil visualizador", () => {
    authState.user.role = "viewer";
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);

    expect(screen.getByText("Estoque")).toBeInTheDocument();
    expect(screen.queryByText("Configurações")).not.toBeInTheDocument();
  });

  it("exibe configurações para o perfil administrador", () => {
    authState.user.role = "admin";
    render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);

    expect(screen.getByText("Configurações")).toBeInTheDocument();
  });
});
