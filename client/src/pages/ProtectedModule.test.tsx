import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProtectedModule from "./ProtectedModule";

const authState = vi.hoisted(() => ({
  loading: false,
  isAuthenticated: true,
  user: { id: 1, name: "Ana", email: "ana@empresa.com", role: "viewer" },
  logout: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/lib/trpc", () => ({ trpc: { users: { effectivePermissions: { useQuery: () => ({ isSuccess: false }) } } } }));
vi.mock("./MediaWorkspace", () => ({ default: () => <h1>Mídias e campanhas</h1> }));
vi.mock("@/components/MediaCoverageExplorer", () => ({ default: () => null }));
vi.mock("@/components/MediaCampaignLibrary", () => ({ default: () => null }));
vi.mock("@/components/RegionalMediaPanel", () => ({ default: () => null }));

describe("ProtectedModule", () => {
  it("bloqueia acesso direto às configurações para visualizador", () => {
    authState.user.role = "viewer";
    render(<ProtectedModule module="configuracoes" />);

    expect(screen.getByRole("heading", { name: "Acesso não autorizado" })).toBeInTheDocument();
  });

  it("libera acesso direto a um módulo permitido para visualizador", () => {
    authState.user.role = "viewer";
    render(<ProtectedModule module="midias" />);

    expect(screen.getByRole("heading", { name: "Mídias e campanhas" })).toBeInTheDocument();
  });
});
