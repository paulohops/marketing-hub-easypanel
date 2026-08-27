import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedModule from "./ProtectedModule";

const authState = vi.hoisted(() => ({
  loading: false,
  isAuthenticated: true,
  user: { id: 1, name: "Ana", email: "ana@empresa.com", role: "viewer" },
  logout: vi.fn(),
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/lib/trpc", () => ({ trpc: { users: { effectivePermissions: { useQuery: () => ({ isSuccess: true, data: ["media.read"] }) } }, notifications: { unreadCount: { useQuery: () => ({ data: { count: 0 }, isLoading: false }) } } } }));
vi.mock("./MediaWorkspace", () => ({
  default: ({ initialCategory }: { initialCategory?: string }) => <h1>{initialCategory === "audio_video" ? "Mídia Tradicional urbana acoplada" : "Mídias e campanhas"}</h1>,
}));
vi.mock("./TraditionalMediaWorkspace", () => ({ default: () => <h1>Mídia Tradicional independente</h1> }));
vi.mock("./TraditionalVeiculationPage", () => ({ default: () => <h1>Veiculação Tradicional independente</h1> }));
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

  it("libera acesso direto a um módulo permitido para visualizador", async () => {
    authState.user.role = "viewer";
    render(<ProtectedModule module="midias" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Mídias e campanhas" })).toBeInTheDocument());
  });

  it("abre a tela protegida de Mídia Tradicional pela entrada independente", async () => {
    authState.user.role = "viewer";
    render(<ProtectedModule module="midias-audio-video" />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Mídia Tradicional independente" })).toBeInTheDocument());
  });
});
