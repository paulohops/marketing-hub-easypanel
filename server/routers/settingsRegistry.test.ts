// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const getDbMock = vi.hoisted(() => vi.fn());
const assertPermissionMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../audit", () => ({ writeAuditLog: writeAuditLogMock }));
vi.mock("../authorization", async importOriginal => {
  const actual = await importOriginal<typeof import("../authorization")>();
  return { ...actual, assertPermission: assertPermissionMock };
});

import { appRouter } from "../routers";

function context(): TrpcContext {
  return {
    user: { id: 1, openId: "admin-user", name: "Paulo Oliveira", email: "paulo@clustermg.com.br", phone: null, loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertPermissionMock.mockResolvedValue(undefined);
});

describe("action point deletion", () => {
  const query = (rows: unknown[]) => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit: vi.fn(() => rows) })),
    })),
  });

  it("exclui ponto sem ações vinculadas e audita o estado anterior", async () => {
    const before = { id: 31, cityId: 4, name: "Ponto descartável" };
    const where = vi.fn(() => []);
    getDbMock.mockResolvedValue({
      select: vi.fn().mockReturnValueOnce(query([before])).mockReturnValueOnce(query([])),
      delete: vi.fn(() => ({ where })),
    });
    const caller = appRouter.createCaller(context());

    await expect(caller.settings.deleteActionPoint({ id: 31 })).resolves.toEqual({ success: true });

    expect(where).toHaveBeenCalled();
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "action_point", entityId: 31, action: "delete", beforeData: before }));
  });

  it("bloqueia ponto usado por ação para preservar o histórico operacional", async () => {
    const before = { id: 32, cityId: 4, name: "Ponto utilizado" };
    getDbMock.mockResolvedValue({
      select: vi.fn().mockReturnValueOnce(query([before])).mockReturnValueOnce(query([{ id: 77 }])),
    });
    const caller = appRouter.createCaller(context());

    await expect(caller.settings.deleteActionPoint({ id: 32 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("vinculado a uma ação"),
    });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("retorna não encontrado quando o ponto não existe", async () => {
    getDbMock.mockResolvedValue({ select: vi.fn(() => query([])) });
    const caller = appRouter.createCaller(context());

    await expect(caller.settings.deleteActionPoint({ id: 999 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
