import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const saveTemplate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ campaigns: { listTemplates: { invalidate: vi.fn() } } }),
    campaigns: {
      listTemplates: { useQuery: () => ({ data: [], isLoading: false }) },
      saveTemplate: { useMutation: () => ({ mutate: saveTemplate, isPending: false }) },
      deleteTemplate: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/cadastros/modelos-campanha", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import CampaignTemplatesWorkspace from "./CampaignTemplatesWorkspace";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("modelos de campanha", () => {
  it("envia modelo, promoção e plano ao endpoint dedicado", async () => {
    render(<CampaignTemplatesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Novo modelo" }));
    fireEvent.change(screen.getByLabelText("Nome do modelo"), { target: { value: "Lançamento regional" } });
    fireEvent.change(screen.getByLabelText("Objetivo padrão"), { target: { value: "Aumentar vendas" } });
    fireEvent.change(screen.getByLabelText("Duração sugerida (dias)"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar promoção" }));
    fireEvent.change(await screen.findByLabelText("Nome da promoção"), { target: { value: "Fibra 600 Mega" } });
    fireEvent.change(screen.getByLabelText("Nome do plano"), { target: { value: "Plano 600" } });
    fireEvent.change(screen.getByLabelText("Valor"), { target: { value: "99.9" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar modelo" }));

    expect(saveTemplate).toHaveBeenCalledWith({
      id: undefined,
      name: "Lançamento regional",
      description: undefined,
      objective: "Aumentar vendas",
      defaultStatus: "scheduled",
      defaultDurationDays: 30,
      active: true,
      promotions: [{
        name: "Fibra 600 Mega",
        description: undefined,
        active: true,
        plans: [{ name: "Plano 600", speed: undefined, description: undefined, price: 99.9, unit: "mês", active: true }],
      }],
    });
  });
});
