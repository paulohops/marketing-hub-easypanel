import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedModule from "./ProtectedModule";

const authState = vi.hoisted(() => ({
  loading: false,
  isAuthenticated: true,
  user: { id: 1, name: "Ana", email: "ana@empresa.com", role: "viewer" },
  logout: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/lib/trpc", () => ({ trpc: { users: { effectivePermissions: { useQuery: () => ({ isSuccess: true, data: ["media.read"] }) } } } }));
vi.mock("./MediaWorkspace", () => ({
  default: ({ initialCategory }: { initialCategory?: string }) => <h1>{initialCategory === "audio_video" ? "Mídia Tradicional" : "Mídias e campanhas"}</h1>,
}));
vi.mock("@/components/MediaCoverageExplorer", () => ({ default: () => null }));
vi.mock("@/components/MediaCampaignLibrary", () => ({ default: () => null }));
vi.mock("@/components/RegionalMediaPanel", () => ({ default: () => null }));

describe("ProtectedModule", () => {
  beforeEach(() => window.localStorage.setItem("trade_hub_onboarding_done", "true"));
  afterEach(() => window.localStorage.removeItem("trade_hub_onboarding_done"));

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

  it("abre a tela protegida de Mídia Tradicional com o rótulo atualizado", () => {
    authState.user.role = "viewer";
    render(<ProtectedModule module="midias-audio-video" />);

    expect(screen.getByRole("heading", { name: "Mídia Tradicional" })).toBeInTheDocument();
  });
});
