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

describe("events deletion", () => {
  const query = (rows: unknown[]) => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit: vi.fn(() => rows) })),
    })),
  });

  it("exclui evento planejado sem vínculos e remove seus vínculos planejados em transação", async () => {
    const before = { id: 41, name: "Evento descartável", status: "planned" };
    const deleteWhere = vi.fn(() => []);
    const transaction = { delete: vi.fn(() => ({ where: deleteWhere })) };
    const select = vi.fn()
      .mockReturnValueOnce(query([before]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]));
    getDbMock.mockResolvedValue({ select, transaction: vi.fn(async callback => callback(transaction)) });
    const caller = appRouter.createCaller(context());

    await expect(caller.events.delete({ id: 41 })).resolves.toEqual({ success: true });

    expect(transaction.delete).toHaveBeenCalledTimes(5);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "event", entityId: 41, action: "delete", beforeData: before }));
  });

  it("bloqueia exclusão de evento já concluído", async () => {
    const before = { id: 42, name: "Evento concluído", status: "completed" };
    getDbMock.mockResolvedValue({ select: vi.fn(() => query([before])) });
    const caller = appRouter.createCaller(context());

    await expect(caller.events.delete({ id: 42 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("planejados ou cancelados"),
    });
  });

  it("bloqueia exclusão quando existe fatura vinculada", async () => {
    const before = { id: 43, name: "Evento faturado", status: "cancelled" };
    const select = vi.fn()
      .mockReturnValueOnce(query([before]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([]))
      .mockReturnValueOnce(query([{ id: 501 }]))
      .mockReturnValueOnce(query([]));
    getDbMock.mockResolvedValue({ select });
    const caller = appRouter.createCaller(context());

    await expect(caller.events.delete({ id: 43 })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("faturas"),
    });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });
});
