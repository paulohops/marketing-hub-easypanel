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

  it("edita somente os metadados do produto, preservando saldos, movimentos e transferências", async () => {
    const before = { id: 5, regionalId: 3, cityId: 10, sku: "TENDA-3X3", name: "Tenda antiga", unit: "un", category: "material_suporte", minimumQuantity: "2.00", active: true };
    const updated = { ...before, sku: "TENDA-3X3", name: "Tenda 3x3 premium", description: "Lona reforçada", minimumQuantity: "4.00", active: true, updatedAt: new Date("2026-08-12T12:00:00Z") };
    const setMock = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [updated]) })) }));
    const database = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [before]) })) })) })),
      update: vi.fn(() => ({ set: setMock })),
      transaction: vi.fn(),
      insert: vi.fn(),
    };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.inventory.updateStockItem({ id: 5, sku: "tenda-3x3", name: "Tenda 3x3 premium", description: "Lona reforçada", unit: "un", category: "material_suporte", minimumQuantity: 4, active: true })).resolves.toEqual(updated);
    expect(database.transaction).not.toHaveBeenCalled();
    expect(database.insert).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ sku: "TENDA-3X3", name: "Tenda 3x3 premium", description: "Lona reforçada", minimumQuantity: "4.00" }));
    expect(setMock.mock.calls[0][0]).not.toHaveProperty("regionalId");
    expect(setMock.mock.calls[0][0]).not.toHaveProperty("cityId");
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "stock_item", entityId: 5, regionalId: 3, action: "update", beforeData: before, afterData: updated }));
  });

  it("consolida saldos por regional, cidade e categoria de material", async () => {
    const territorialRows = [
      { regionalId: 3, regionalName: "Central", cityId: 10, cityName: "Belo Horizonte", category: "material_suporte", balance: "4.00" },
      { regionalId: 3, regionalName: "Central", cityId: 10, cityName: "Belo Horizonte", category: "material_suporte", balance: "6.00" },
      { regionalId: 3, regionalName: "Central", cityId: 11, cityName: "Contagem", category: "brinde_vip", balance: "2.00" },
    ];
    const database = { select: vi.fn(() => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ leftJoin: vi.fn(() => ({ leftJoin: vi.fn(() => ({ where: vi.fn(() => territorialRows) })) })) })) })) })) };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.inventory.territorialSummary()).resolves.toEqual([
      { regionalId: 3, regionalName: "Central", cityId: 10, cityName: "Belo Horizonte", category: "material_suporte", itemCount: 2, quantity: 10 },
      { regionalId: 3, regionalName: "Central", cityId: 11, cityName: "Contagem", category: "brinde_vip", itemCount: 1, quantity: 2 },
    ]);
  });

  it("bloqueia transferência para o próprio item antes de abrir transação", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.inventory.transfer({ sourceStockItemId: 5, destinationStockItemId: 5, quantity: 1, occurredAt: new Date("2026-08-12") })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Escolha itens de origem e destino diferentes." });
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("transfere entre cidades com saldo atômico, dupla movimentação e auditoria", async () => {
    const source = { id: 5, cityId: 10, regionalId: 3, sku: "TENDA-3X3", unit: "un", category: "material_suporte" };
    const destination = { id: 6, cityId: 11, regionalId: 3, sku: "TENDA-3X3", unit: "un", category: "material_suporte" };
    const createdTransfer = { id: 91, sourceStockItemId: 5, destinationStockItemId: 6, quantity: "2.00" };
    const transaction = {
      select: vi.fn()
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [source]) })) })) })
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [destination]) })) })) }),
      insert: vi.fn()
        .mockReturnValueOnce({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn() })) })
        .mockReturnValueOnce({ values: vi.fn(() => ({ returning: vi.fn(() => [createdTransfer]) })) })
        .mockReturnValueOnce({ values: vi.fn() }),
      update: vi.fn()
        .mockReturnValueOnce({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [{ stockItemId: 5, quantity: "8.00" }]) })) })) })
        .mockReturnValueOnce({ set: vi.fn(() => ({ where: vi.fn() })) }),
    };
    const database = { transaction: vi.fn(async callback => callback(transaction)) };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.inventory.transfer({ sourceStockItemId: 5, destinationStockItemId: 6, quantity: 2, occurredAt: new Date("2026-08-12"), notes: "Remanejamento para Contagem" })).resolves.toEqual(createdTransfer);
    expect(transaction.insert).toHaveBeenCalledTimes(3);
    expect(transaction.update).toHaveBeenCalledTimes(2);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "stock_transfer", entityId: 91, regionalId: 3 }));
  });
});
