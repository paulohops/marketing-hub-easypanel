import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { expect, it, vi } from "vitest";
import DashboardLayout from "./DashboardLayout";

expect.extend(toHaveNoViolations);

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    isAuthenticated: true,
    user: { id: 1, name: "Ana", email: "ana@empresa.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/trpc", () => ({ trpc: { users: { effectivePermissions: { useQuery: () => ({ isSuccess: false }) } } } }));

it("não apresenta violações automatizadas de acessibilidade na navegação", async () => {
  const { container } = render(<DashboardLayout><div>Conteúdo protegido</div></DashboardLayout>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
