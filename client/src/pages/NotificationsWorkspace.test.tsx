import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const complete = vi.hoisted(() => vi.fn());
const markRead = vi.hoisted(() => vi.fn());
const deleteNotification = vi.hoisted(() => vi.fn());
const invalidate = vi.hoisted(() => vi.fn());
const trpcStub = vi.hoisted(() => ({
  useUtils: () => ({ notifications: { list: { invalidate }, unreadCount: { invalidate } } }),
  users: {
    effectivePermissions: { useQuery: () => ({ data: ["tasks.create", "notifications.delete"], isSuccess: true, isLoading: false }) },
  },
  tasks: {
    createFromNotification: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
  },
  notifications: {
    list: { useQuery: () => ({ data: [{ id: 8, userId: 4, regionalId: 2, cityId: 3, category: "payment_due", title: "Pagamento próximo", message: "A nota fiscal vence amanhã.", readAt: null, completedAt: null, actionUrl: "/financeiro?invoice=8", actionLabel: "Abrir nota", createdAt: new Date("2026-08-12T12:00:00Z"), userName: "Ana Paula", userEmail: "ana@cluster.com", regionalName: "Central", cityName: "Belo Horizonte", cityState: "MG" }], isLoading: false }) },
    referenceData: { useQuery: () => ({ data: { users: [{ id: 4, name: "Ana Paula", email: "ana@cluster.com" }], regionals: [{ id: 2, name: "Central" }], cities: [{ id: 3, regionalId: 2, name: "Belo Horizonte", state: "MG" }], categories: ["payment_due"] }, isLoading: false }) },
    complete: { useMutation: () => ({ mutate: complete, isPending: false }) },
    markRead: { useMutation: () => ({ mutate: markRead, isPending: false }) },
    delete: { useMutation: () => ({ mutate: deleteNotification, isPending: false }) },
  },
}));

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 1, role: "admin" } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import NotificationsWorkspace from "./NotificationsWorkspace";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("central de notificações", () => {
  it("exibe filtros administrativos, destinatário, território e permite concluir", () => {
    render(<NotificationsWorkspace />);

    expect(screen.getByLabelText("Usuário")).toBeInTheDocument();
    expect(screen.getByLabelText("Regional")).toBeInTheDocument();
    expect(screen.getByText("Ana Paula")).toBeInTheDocument();
    expect(screen.getByText("Belo Horizonte · MG")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir nota" })).toBeInTheDocument();
    expect(screen.getByText("Não vista")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Marcar como vista" }));
    expect(markRead).toHaveBeenCalledWith({ notificationId: 8 });
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(complete).toHaveBeenCalledWith({ notificationId: 8 });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    expect(deleteNotification).toHaveBeenCalledWith({ notificationId: 8 });
  });
});
