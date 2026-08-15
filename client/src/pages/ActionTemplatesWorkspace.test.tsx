import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const saveTemplate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ actions: { listTemplates: { invalidate: vi.fn() }, referenceData: { invalidate: vi.fn() } } }),
    actions: {
      listTemplates: { useQuery: () => ({ data: [], isLoading: false }) },
      referenceData: { useQuery: () => ({ data: { actionTypes: [] } }) },
      saveTemplate: { useMutation: () => ({ mutate: saveTemplate, isPending: false }) },
      deleteTemplate: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));
vi.mock("wouter", () => ({ useLocation: () => ["/cadastros/modelos-acoes", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ActionTemplatesWorkspace from "./ActionTemplatesWorkspace";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("modelos de ações", () => {
  it("envia o novo modelo ao endpoint dedicado", () => {
    render(<ActionTemplatesWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Novo modelo" }));
    fireEvent.change(screen.getByLabelText("Nome do modelo"), { target: { value: "Panfletagem em loja" } });
    fireEvent.change(screen.getByLabelText("Duração padrão (horas)"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Objetivo padrão"), { target: { value: "Gerar novas vendas" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar modelo" }));

    expect(saveTemplate).toHaveBeenCalledWith({
      id: undefined,
      name: "Panfletagem em loja",
      description: undefined,
      objective: "Gerar novas vendas",
      defaultActionTypeId: null,
      defaultPartnershipType: "paid",
      defaultDurationHours: 6,
      active: true,
    });
  });
});
