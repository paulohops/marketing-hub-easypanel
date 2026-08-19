import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const trpcMock = vi.hoisted(() => ({
  media: {
    referenceData: { useQuery: () => ({ data: { mediaTypes: [], supplierMediaTypes: [], supplierCities: [], suppliers: [], cities: [], regionals: [] } }) },
    list: { useQuery: () => ({ data: [], isLoading: false }) },
    pointDetails: { invalidate: vi.fn() },
    createPoint: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  },
  useUtils: () => ({ media: { list: { invalidate: vi.fn() }, pointDetails: { invalidate: vi.fn() } } }),
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcMock }));
vi.mock("@/hooks/useEffectivePermissions", () => ({ useEffectivePermissions: () => ({ can: () => true }) }));
vi.mock("@/components/SearchableMultiSelect", () => ({ default: () => <div>Cidade do programa</div> }));
vi.mock("@/components/StoreLocationFields", () => ({ CoordinatesField: () => <div>Localização</div> }));

import TraditionalMediaWorkspace from "./TraditionalMediaWorkspace";

afterEach(() => cleanup());

describe("workspace independente de Mídia Audiovisual", () => {
  it("renderiza a listagem e o botão de criação próprios do módulo", () => {
    render(<TraditionalMediaWorkspace />);

    expect(screen.getByRole("heading", { name: "Mídia Audiovisual" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo programa de mídia audiovisual" })).toBeInTheDocument();
    expect(screen.getByText("Programas cadastrados")).toBeInTheDocument();
  });
});
