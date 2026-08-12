import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const getDbMock = vi.hoisted(() => vi.fn());
const assertPermissionMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../audit", () => ({ writeAuditLog: writeAuditLogMock }));
vi.mock("../authorization", async importOriginal => ({
  ...(await importOriginal<typeof import("../authorization")>()),
  assertPermission: assertPermissionMock,
}));

import { appRouter } from "../routers";

function createContext(): TrpcContext {
  return {
    user: {
      id: 1, openId: "admin-user", name: "Paulo Oliveira", email: "paulo@clustermg.com.br", phone: null,
      loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function movementTransaction({ balance }: { balance: unknown[] }) {
  const movement = { id: 77, stockItemId: 5, movementType: "exit", quantity: "3.00" };
  const transaction = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => [{ id: 5, regionalId: 3, name: "Camiseta" }]) })) })),
    insert: vi.fn()
      .mockReturnValueOnce({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn() })) })
      .mockReturnValueOnce({ values: vi.fn(() => ({ returning: vi.fn(() => [movement]) })) }),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => balance) })) })) })),
  };
  return { transaction, movement };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertPermissionMock.mockResolvedValue(undefined);
});

describe("inventoryRouter via tRPC", () => {
  it("registra movimentação em transação e materializa o saldo antes de gravar o histórico", async () => {
    const { transaction, movement } = movementTransaction({ balance: [{ stockItemId: 5, quantity: "7.00" }] });
    const database = { transaction: vi.fn(async callback => callback(transaction)) };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.inventory.registerMovement({
      stockItemId: 5, movementType: "exit", quantity: 3, occurredAt: new Date("2026-08-12"), reference: "Ação Centro",
    })).resolves.toEqual(movement);
    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(transaction.update).toHaveBeenCalledTimes(1);
    expect(transaction.insert).toHaveBeenCalledTimes(2);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "stock_movement", entityId: 77, regionalId: 3 }));
  });

  it("bloqueia uma saída que tornaria o saldo negativo e não grava movimento", async () => {
    const { transaction } = movementTransaction({ balance: [] });
    const database = { transaction: vi.fn(async callback => callback(transaction)) };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.inventory.registerMovement({
      stockItemId: 5, movementType: "exit", quantity: 50, occurredAt: new Date("2026-08-12"),
    })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "A saída informada deixaria o estoque negativo." });
    expect(transaction.insert).toHaveBeenCalledTimes(1);
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("retorna o histórico com paginação informada e total independente da página", async () => {
    const pagedRows = [{ movement: { id: 12, stockItemId: 5, movementType: "entry" }, itemName: "Camiseta", regionalName: "Central", cityName: "Belo Horizonte", performedByName: "Paulo Oliveira" }];
    const offsetMock = vi.fn(() => pagedRows);
    const rowsBuilder = {
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            leftJoin: vi.fn(() => ({
              leftJoin: vi.fn(() => ({
                where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ offset: offsetMock })) })) })),
              })),
            })),
          })),
        })),
      })),
    };
    const database = {
      select: vi.fn()
        .mockReturnValueOnce({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(() => [{ total: "3" }]) })) })) })
        .mockReturnValueOnce(rowsBuilder),
    };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.inventory.listMovements({ page: 2, pageSize: 5, regionalId: 3 })).resolves.toEqual({ items: pagedRows, total: 3, page: 2, pageSize: 5 });
    expect(offsetMock).toHaveBeenCalledWith(5);
  });
});
