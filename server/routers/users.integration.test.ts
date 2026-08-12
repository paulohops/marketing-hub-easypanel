import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const getDbMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../audit", () => ({ writeAuditLog: writeAuditLogMock }));

import { appRouter } from "../routers";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(overrides: Partial<AuthenticatedUser> = {}): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      name: "Paulo Oliveira",
      email: "paulo@clustermg.com.br",
      phone: "31999999999",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      lastSignedIn: new Date("2026-01-02"),
      ...overrides,
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function profileDatabase(before = { id: 1, name: "Paulo Oliveira", phone: "31999999999" }, updated = { id: 1, name: "Paulo Henrique", phone: "31988888888" }) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [before]) })) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [updated]) })) })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usersRouter via tRPC", () => {
  it("retorna o perfil autenticado sem consultar dados de outro usuário", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.users.profile()).resolves.toMatchObject({
      id: 1,
      name: "Paulo Oliveira",
      email: "paulo@clustermg.com.br",
      role: "admin",
    });
  });

  it("atualiza somente o próprio perfil e registra auditoria", async () => {
    const database = profileDatabase();
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.users.updateProfile({ name: "Paulo Henrique", phone: "31988888888" })).resolves.toMatchObject({
      id: 1,
      name: "Paulo Henrique",
    });
    expect(database.update).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 1,
      entityType: "user_profile",
      action: "update",
    }));
  });

  it("lista usuários somente para administrador", async () => {
    const users = [{ id: 2, name: "Operadora MG", email: "operadora@clustermg.com.br", role: "operator" }];
    getDbMock.mockResolvedValue({
      select: vi.fn(() => ({ from: vi.fn(() => ({ orderBy: vi.fn(() => users) })) })),
    });
    const adminCaller = appRouter.createCaller(createContext());
    await expect(adminCaller.users.adminList()).resolves.toEqual(users.map(user => ({ ...user, hasLocalPassword: false })));

    const viewerCaller = appRouter.createCaller(createContext({ role: "viewer" }));
    await expect(viewerCaller.users.adminList()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("altera o papel de outro usuário e impede a autoalteração administrativa", async () => {
    const database = profileDatabase(
      { id: 2, name: "Operadora MG", phone: null, role: "viewer" },
      { id: 2, name: "Operadora MG", phone: null, role: "operator" },
    );
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.users.updateRole({ userId: 2, role: "operator" })).resolves.toMatchObject({ id: 2, role: "operator" });
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "user_access", action: "update_role" }));
    await expect(caller.users.updateRole({ userId: 1, role: "viewer" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("atualiza uma permissão granular e audita a alteração", async () => {
    const updatedPermission = { id: 9, role: "operator", module: "finance", action: "update", allowed: true };
    getDbMock.mockResolvedValue({
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => []) })) })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => ({ returning: vi.fn(() => [updatedPermission]) })) })),
      })),
    });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.users.updateRolePermission({ role: "operator", module: "finance", action: "update", allowed: true })).resolves.toEqual(updatedPermission);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "role_permission", action: "update_permission" }));
  });
});
