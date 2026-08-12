import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const getDbMock = vi.hoisted(() => vi.fn());
const assertPermissionMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
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

function fromWithOrder(rows: unknown[]) {
  return { from: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertPermissionMock.mockResolvedValue(undefined);
});

describe("finance.listInvoices via tRPC", () => {
  it("aplica filtros combinados e retorna status calculado, pagamentos e campanha vinculada", async () => {
    const invoiceRows = [{
      invoice: { id: 41, supplierId: 7, invoiceNumber: "NF-41", dueDate: "2026-08-01", amount: "1000.00", status: "open", operationType: "media_campaign", operationId: 12 },
      supplierName: "Fornecedor MG",
    }];
    const paymentRows = [{ id: 1, invoiceId: 41, amount: "250.00" }];
    const documentRows = [{ id: 8, entityId: 41, entityType: "invoice" }];
    const invoiceWhere = vi.fn(() => ({ orderBy: vi.fn(() => invoiceRows) }));
    const database = {
      select: vi.fn()
        .mockReturnValueOnce({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: invoiceWhere })) })) })
        .mockReturnValueOnce({ from: vi.fn(() => paymentRows) })
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => documentRows) })) })
        .mockReturnValueOnce(fromWithOrder([{ id: 12, name: "Campanha Inverno" }]))
        .mockReturnValueOnce(fromWithOrder([]))
        .mockReturnValueOnce(fromWithOrder([])),
    };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    const result = await caller.finance.listInvoices({
      status: "overdue",
      supplierId: 7,
      dueStartsAt: "2026-08-01",
      dueEndsAt: "2026-08-31",
      operationType: "media_campaign",
      operationId: 12,
    });

    expect(assertPermissionMock).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), "finance.read");
    expect(invoiceWhere).toHaveBeenCalledTimes(1);
    expect(result).toEqual([expect.objectContaining({
      id: 41,
      status: "overdue",
      supplierName: "Fornecedor MG",
      totalPaid: 250,
      outstandingAmount: 750,
      operationLabel: "Campanha · Campanha Inverno",
      attachedDocuments: documentRows,
    })]);
  });
});
