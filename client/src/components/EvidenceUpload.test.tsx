import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ documents: { listForEntity: { invalidate: vi.fn() } } }),
  documents: {
    listForEntity: { useQuery: () => ({ data: [
      { id: 1, originalName: "ativacao.jpg", mimeType: "image/jpeg", url: "/manus-storage/evidencias/ativacao.jpg" },
      { id: 2, originalName: "nota.pdf", mimeType: "application/pdf", url: "/manus-storage/evidencias/nota.pdf" },
    ] }) },
    upload: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import EvidenceUpload from "./EvidenceUpload";

describe("EvidenceUpload", () => {
  it("mostra as mídias no sistema e oferece download direto para cada arquivo", () => {
    render(<EvidenceUpload entityType="action" entityId={12} variant="side" />);

    expect(screen.getByRole("img", { name: "ativacao.jpg" })).toHaveAttribute("src", "/manus-storage/evidencias/ativacao.jpg");
    expect(screen.getByTitle("nota.pdf")).toHaveAttribute("src", "/manus-storage/evidencias/nota.pdf");
    expect(screen.getAllByRole("button", { name: "Baixar" })).toHaveLength(2);
  });
});
