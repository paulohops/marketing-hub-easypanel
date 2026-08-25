// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mediaCampaigns, mediaPoints, suppliers, actions, actionSuppliers, actionDebriefs, events, eventSuppliers, invoices, payments, cities, regionals } from "../../drizzle/schema";
import { analyticsRouter, average } from "./analytics";

const getDbMock = vi.hoisted(() => vi.fn());
const assertPermissionMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../authorization", () => ({ assertPermission: assertPermissionMock }));

function context() {
  return {
    user: { id: 1, openId: "admin-user", name: "Paulo Oliveira", email: "paulo@cluster.com.br", phone: null, loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} },
    res: {},
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertPermissionMock.mockResolvedValue(undefined);
});

describe("analytics.average", () => {
  it("calcula a média apenas das avaliações válidas", () => {
    expect(average([5, null, 4, 2])).toBe(3.7);
  });

  it("retorna nulo quando não há avaliações", () => {
    expect(average([null, null])).toBeNull();
  });
});

describe("analytics.overview", () => {
  it("classifica veiculações de pontos leafleting no módulo de Panfletagem", async () => {
    const pointRows = [
      { id: 10, cityId: 1, supplierId: 9, operationCategory: "leafleting", status: "active", contractStartsOn: null, contractEndsOn: null },
      { id: 11, cityId: 1, supplierId: 9, operationCategory: "graphics", status: "active", contractStartsOn: null, contractEndsOn: null },
    ];
    const campaignRows = [
      { id: 101, mediaPointId: 10, status: "active", startsOn: "2026-08-01", endsOn: "2026-08-31", estimatedCost: "120.00", rating: null },
      { id: 102, mediaPointId: 11, status: "active", startsOn: "2026-08-01", endsOn: "2026-08-31", estimatedCost: "80.00", rating: null },
    ];
    const rowsByTable = new Map([
      [suppliers, [{ id: 9, displayName: "Fornecedor Alfa" }]],
      [mediaPoints, pointRows],
      [mediaCampaigns, campaignRows],
      [actions, []],
      [actionSuppliers, []],
      [actionDebriefs, []],
      [events, []],
      [eventSuppliers, []],
      [invoices, []],
      [payments, []],
      [cities, [{ id: 1, name: "Uberlândia", regionalId: 1 }]],
      [regionals, [{ id: 1, name: "Regional Norte" }]],
    ]);
    const select = vi.fn(() => ({ from: vi.fn(table => rowsByTable.get(table) ?? []) }));
    getDbMock.mockResolvedValue({ select });

    const result = await analyticsRouter.createCaller(context()).overview();

    expect(result.byModule).toEqual(expect.arrayContaining([
      { key: "leafleting", label: "Panfletagem", total: 1, active: 1, cost: 120 },
    ]));
    expect(result.media.leafletingCampaigns).toBe(1);
  });
});
