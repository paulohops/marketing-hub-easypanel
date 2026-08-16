import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_BRANDING } from "@shared/branding";

const updateBranding = vi.fn();
const setData = vi.fn();

vi.mock("@/contexts/BrandingContext", () => ({
  useBranding: () => ({ branding: DEFAULT_APP_BRANDING, isLoading: false }),
}));
vi.mock("@/hooks/useEffectivePermissions", () => ({
  useEffectivePermissions: () => ({ can: () => true }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ settings: { branding: { setData } } }),
    settings: {
      updateBranding: {
        useMutation: () => ({ mutate: updateBranding, isPending: false }),
      },
      uploadAppLogo: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
      resetBranding: {
        useMutation: () => ({ mutate: vi.fn(), isPending: false }),
      },
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import BrandingSettingsPanel from "./BrandingSettingsPanel";

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

describe("BrandingSettingsPanel", () => {
  it("exibe os controles de identidade e a prévia do aplicativo", () => {
    render(<BrandingSettingsPanel />);

    expect(screen.getByText("Design do aplicativo")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do aplicativo")).toHaveValue(
      "MARKETING HUB"
    );
    expect(screen.getByLabelText("Subtítulo ou organização")).toHaveValue(
      "CLUSTER MG"
    );
    expect(screen.getByLabelText("Fonte principal")).toHaveValue("montserrat");
    expect(screen.getByText("Pré-visualização")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar identidade" })
    ).toBeInTheDocument();
  });

  it("envia as alterações de marca sem incluir a logo no payload textual", () => {
    render(<BrandingSettingsPanel />);

    fireEvent.change(screen.getByLabelText("Nome do aplicativo"), {
      target: { value: "OPERAÇÃO HUB" },
    });
    fireEvent.change(screen.getByLabelText("Cor primária"), {
      target: { value: "#123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar identidade" }));

    expect(updateBranding).toHaveBeenCalledWith(
      expect.objectContaining({
        appName: "OPERAÇÃO HUB",
        primaryColor: "#123456",
        fontFamily: "montserrat",
      })
    );
    expect(updateBranding.mock.calls[0]?.[0]).not.toHaveProperty("logoUrl");
  });
});
