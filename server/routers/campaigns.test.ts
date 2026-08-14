import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const getDbMock = vi.hoisted(() => vi.fn());
const assertPermissionMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../audit", () => ({ writeAuditLog: writeAuditLogMock }));
vi.mock("../authorization", async importOriginal => ({ ...(await importOriginal<typeof import("../authorization")>()), assertPermission: assertPermissionMock }));

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

describe("campaigns router", () => {
  it("persiste campanha, promoções, planos e cidades de forma estruturada", async () => {
    const campaignValues = vi.fn(() => ({ returning: vi.fn(() => [{ id: 77, name: "Volta às aulas" }]) }));
    const promotionValues = vi.fn(() => ({ returning: vi.fn(() => [{ id: 88, name: "Internet em dobro" }]) }));
    const planValues = vi.fn();
    const cityValues = vi.fn();
    const transaction = {
      insert: vi.fn()
        .mockReturnValueOnce({ values: campaignValues })
        .mockReturnValueOnce({ values: cityValues })
        .mockReturnValueOnce({ values: promotionValues })
        .mockReturnValueOnce({ values: planValues }),
      delete: vi.fn(() => ({ where: vi.fn() })),
    };
    const validCities = [{ id: 4, regionalId: 1, providerId: null }, { id: 7, regionalId: 1, providerId: null }];
    getDbMock.mockResolvedValue({
      select: vi.fn(() => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(() => validCities) })) })) })),
      transaction: vi.fn(async callback => callback(transaction)),
    });
    const caller = appRouter.createCaller(context());

    await expect(caller.campaigns.create({
      name: "Volta às aulas",
      objective: "Aumentar adesões",
      providerId: null,
      regionalId: null,
      cityIds: [4, 7],
      startsAt: new Date("2026-08-20T09:00:00Z"),
      endsAt: new Date("2026-08-31T22:00:00Z"),
      status: "scheduled",
      promotions: [{ name: "Internet em dobro", description: "Oferta para novos clientes", active: true, plans: [{ name: "300 Mega", price: 99.9, unit: "mês", active: true }] }],
    })).resolves.toMatchObject({ id: 77, name: "Volta às aulas" });

    expect(cityValues).toHaveBeenCalledWith([{ campaignId: 77, cityId: 4 }, { campaignId: 77, cityId: 7 }]);
    expect(promotionValues).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 77, name: "Internet em dobro", sortOrder: 0 }));
    expect(planValues).toHaveBeenCalledWith([{ campaignPromotionId: 88, name: "300 Mega", description: null, price: "99.9", unit: "mês", active: true, sortOrder: 0 }]);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "trade_campaign", entityId: 77, action: "create" }));
  });

  it("bloqueia período inválido antes de acessar o banco", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.campaigns.create({ name: "Campanha inválida", providerId: null, regionalId: null, cityIds: [], startsAt: new Date("2026-08-31T10:00:00Z"), endsAt: new Date("2026-08-20T10:00:00Z"), status: "scheduled", promotions: [] })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "O término da campanha deve ser posterior ao início." });
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("salva nota e resultado consolidados no debriefing da campanha", async () => {
    const before = { id: 77, regionalId: 2, debriefRating: null, debriefAt: null };
    const updated = { ...before, debriefRating: 5, debriefResult: "Meta superada" };
    const database = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [before]) })) })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [updated]) })) })) })),
    };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(context());

    await expect(caller.campaigns.saveDebrief({ campaignId: 77, rating: 5, notes: "Boa adesão", result: "Meta superada", completedAt: new Date("2026-08-31T22:00:00Z") })).resolves.toEqual(updated);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "trade_campaign", entityId: 77, action: "save_debrief" }));
  });

  it("persiste um modelo reutilizável com sua estrutura de promoções e planos", async () => {
    const templateValues = vi.fn(() => ({ returning: vi.fn(() => [{ id: 42, name: "Lançamento regional" }]) }));
    const promotionValues = vi.fn(() => ({ returning: vi.fn(() => [{ id: 43, name: "Fibra em dobro" }]) }));
    const planValues = vi.fn();
    const transaction = {
      insert: vi.fn()
        .mockReturnValueOnce({ values: templateValues })
        .mockReturnValueOnce({ values: promotionValues })
        .mockReturnValueOnce({ values: planValues }),
      delete: vi.fn(() => ({ where: vi.fn() })),
    };
    getDbMock.mockResolvedValue({ transaction: vi.fn(async callback => callback(transaction)) });
    const caller = appRouter.createCaller(context());

    await expect(caller.campaigns.saveTemplate({
      name: "Lançamento regional",
      description: "Base para campanhas de expansão",
      objective: "Gerar adesões",
      defaultStatus: "scheduled",
      defaultDurationDays: 30,
      active: true,
      promotions: [{ name: "Fibra em dobro", active: true, plans: [{ name: "500 Mega", price: 109.9, unit: "mês", active: true }] }],
    })).resolves.toMatchObject({ id: 42, name: "Lançamento regional" });

    expect(promotionValues).toHaveBeenCalledWith(expect.objectContaining({ campaignTemplateId: 42, name: "Fibra em dobro", sortOrder: 0 }));
    expect(planValues).toHaveBeenCalledWith([{ campaignTemplatePromotionId: 43, name: "500 Mega", description: null, price: "109.9", unit: "mês", active: true, sortOrder: 0 }]);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "campaign_template", entityId: 42, action: "create" }));
  });
});
