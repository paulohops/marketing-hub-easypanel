import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ campaigns: { list: { invalidate: vi.fn() } } }),
  campaigns: {
    list: {
      useQuery: () => ({
        data: [{ id: 77, name: "Campanha Compacta", objective: "Validar a preferência persistida", status: "active", startsAt: new Date("2026-08-01T12:00:00Z"), endsAt: new Date("2026-08-31T12:00:00Z"), hasExplicitCities: false, cities: [], actions: [], media: [], events: [], debriefRating: null, providerName: "OnNet Telecom", campaignTypeName: null, campaignSectorName: null }],
        isLoading: false,
      }),
    },
    referenceData: { useQuery: () => ({ data: { providers: [], campaignTypes: [], campaignSectors: [], regionals: [], cities: [] } }) },
    listTemplates: { useQuery: () => ({ data: [] }) },
    create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    saveDebrief: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    savePromotionCities: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    uploadLogo: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    renew: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/hooks/useEffectivePermissions", () => ({ useEffectivePermissions: () => ({ can: () => true }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CampaignsWorkspace from "./CampaignsWorkspace";

afterEach(() => { cleanup(); localStorage.removeItem("marketing_hub_list_density"); vi.clearAllMocks(); window.history.replaceState({}, "", "/campanhas"); });

describe("densidade persistida em Campanhas", () => {
  it("lê a preferência compacta no primeiro render e reduz a altura do cartão", () => {
    localStorage.setItem("marketing_hub_list_density", "compact");
    render(<CampaignsWorkspace />);

    expect(screen.getByRole("button", { name: "Compacto" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Campanha Compacta").closest("button")).toHaveClass("min-h-[112px]", "py-3");
  });
});
