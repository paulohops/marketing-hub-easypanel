import { fireEvent, render, screen } from "@testing-library/react";
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
  it("apresenta fotos em cartão ampliável e mantém documentos como links", () => {
    render(<EvidenceUpload entityType="action" entityId={12} />);

    expect(screen.getByRole("button", { name: "Ampliar ativacao.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "nota.pdf" })).toHaveAttribute("href", "/manus-storage/evidencias/nota.pdf");

    fireEvent.click(screen.getByRole("button", { name: "Ampliar ativacao.jpg" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar imagem" })).toHaveAttribute("href", "/manus-storage/evidencias/ativacao.jpg");
  });
});
