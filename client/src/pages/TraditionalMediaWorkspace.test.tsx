import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listQuery = vi.hoisted(() => vi.fn(() => ({ data: [], isLoading: false })));
const referenceDataQuery = vi.hoisted(() => vi.fn(() => ({
  data: {
    regionals: [{ id: 2, name: "Triângulo" }],
    cities: [{ city: { id: 11, name: "Uberlândia", regionalId: 2 }, regionalName: "Triângulo" }],
  },
  isLoading: false,
})));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    media: {
      referenceData: { useQuery: referenceDataQuery },
      list: { useQuery: listQuery },
    },
  },
}));
vi.mock("wouter", () => ({ useLocation: () => [vi.fn()] }));

import TraditionalMediaWorkspace from "./TraditionalMediaWorkspace";

beforeEach(() => { cleanup(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("workspace independente de Mídia Tradicional", () => {
  it("renderiza a área própria sem reutilizar o título de Mídia Urbana", () => {
    render(<TraditionalMediaWorkspace />);

    expect(screen.getByRole("heading", { name: "Mídia Tradicional" })).toBeInTheDocument();
    expect(screen.getByText("Módulo independente")).toBeInTheDocument();
    expect(screen.queryByText("Mídia Urbana")).not.toBeInTheDocument();
  });

  it("envia apenas a categoria tradicional e os filtros territoriais", () => {
    render(<TraditionalMediaWorkspace />);
    fireEvent.change(screen.getByLabelText("Regional"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Cidade"), { target: { value: "11" } });

    expect((listQuery.mock.calls.at(-1) as any)?.[0]).toMatchObject({ operationCategory: "audio_video", channelKind: "standard", regionalId: 2, cityId: 11 });
  });
});
